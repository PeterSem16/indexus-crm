#!/usr/bin/env python3
"""B7.1 operator-only benchmark. No dependencies, CRM access or persistent AI changes."""
import argparse
import datetime
import importlib.util
import json
import math
import os
import pathlib
import re
import signal
import statistics
import sys
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("b7_reference", HERE / "ai-gateway-b7.py")
b7 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b7)
from ai_gateway_b7_core import B7Error, SHORT_RULES, digest, score, strict_json, timings

FIXTURE_SHA256 = "96622885712ac0eaaf0ad826682394e4efce828ad4b4af3140601921b3062ec8"
MODEL_DIGEST = "f4cd2b00ef23244b30130d3ba6fb773ce320416fb62ce035acfda4644d9436d7"
OPTIONS = {"temperature": 0, "num_predict": 512}


def read_private(path):
    path = pathlib.Path(path)
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_size > 2 * 1024 * 1024 or \
            stat.st_mode & 0o077 or stat.st_uid != os.getuid():
        raise B7Error("B71_PRIVATE_INPUT_REQUIRED")
    return strict_json(path.read_bytes())


def load_previous(directory):
    directory = pathlib.Path(directory)
    if directory.is_symlink() or directory.resolve().parent != pathlib.Path.home() / ".indexus-b7":
        raise B7Error("B71_PREVIOUS_RUN_LOCATION_INVALID")
    plan = read_private(directory / "plan.json")
    previous = read_private(directory / "report.json")
    fixture = plan.get("fixture")
    if digest(fixture) != FIXTURE_SHA256:
        raise B7Error("B71_ORIGINAL_SYNTHETIC_FIXTURE_REQUIRED")
    payload = b7.validate_fixture({"payload": fixture, "sha256": FIXTURE_SHA256})
    if previous.get("fixtureSha256") != FIXTURE_SHA256 or \
            previous.get("model") != b7.MODEL or previous.get("modelUnchanged") is not True or \
            any(previous.get(k, {}).get("modelDigest") != MODEL_DIGEST for k in ("before", "after")):
        raise B7Error("B71_PREVIOUS_EVIDENCE_INVALID")
    # Return only a safe historical synopsis; never copy arbitrary response content.
    rows = previous.get("rows", [])
    first = rows[0] if rows else {}
    return payload, {
        "status": "FAILED_OR_INCOMPLETE", "attempted": len(rows),
        "modelFingerprint": previous["after"].get("fingerprint"),
        "firstWallMs": first.get("wallMs"),
        "firstTimings": {k: v for k, v in first.get("timings", {}).items()
                         if k in ("eval_count", "prompt_eval_count", "load_duration",
                                  "prompt_eval_duration", "eval_duration", "total_duration")},
        "note": "Historical failed B7, not a paired baseline; no accuracy claim.",
    }


def response_metadata(body):
    message = body.get("message")
    message = message if isinstance(message, dict) else {}
    def presence(key):
        value = message.get(key)
        return {"fieldPresent": key in message, "isString": isinstance(value, str),
                "nonEmpty": bool(value.strip()) if isinstance(value, str) else False,
                "characters": len(value) if isinstance(value, str) else None}
    content = message.get("content", "")
    return {
        "modelMatches": body.get("model") == b7.MODEL,
        "done": body.get("done") if type(body.get("done")) is bool else None,
        "done_reason": body.get("done_reason") if body.get("done_reason") in
                       ("stop", "length", "load", "unload") else "missing_or_unrecognized",
        "assistantRole": message.get("role") == "assistant",
        "hasToolCalls": bool(message.get("tool_calls")),
        "thinking": presence("thinking"), "content": presence("content"),
        "inlineThinkingTags": bool(isinstance(content, str) and
                                   re.search(r"</?think(?:ing)?\b", content, re.I)),
        "nativeTelemetry": {k: body[k] if type(body.get(k)) is int and body[k] >= 0 else None
                            for k in ("total_duration", "load_duration", "prompt_eval_duration",
                                      "eval_duration", "prompt_eval_count", "eval_count",
                                      "prompt_eval_cached_count")},
    }


def evaluate_response(body, expected):
    meta = response_metadata(body)
    message = body.get("message")
    message = message if isinstance(message, dict) else {}
    scored = score(message.get("content"), expected)
    # Privacy: never persist generated reasoning or generated field values.
    scored.pop("actual", None)
    row = {**meta, **scored, "scored": isinstance(message.get("content"), str),
           "completionValid": False}
    row["code"] = None
    try:
        row["timings"] = timings(body)
        if body["eval_count"] > OPTIONS["num_predict"]:
            raise B7Error("B71_TOKEN_LIMIT_NOT_HONORED")
        if meta["thinking"]["nonEmpty"] or meta["inlineThinkingTags"] or \
                meta["thinking"]["fieldPresent"] and not meta["thinking"]["isString"]:
            raise B7Error("B71_THINKING_NOT_DISABLED")
        if not meta["modelMatches"] or meta["done"] is not True or \
                meta["done_reason"] != "stop" or not meta["assistantRole"] or \
                not meta["content"]["isString"] or not meta["content"]["nonEmpty"] or meta["hasToolCalls"]:
            raise B7Error("B71_INCOMPLETE_OR_INVALID_COMPLETION")
        row["completionValid"] = True
    except B7Error as error:
        row["code"] = str(error)
    row["passed"] = bool(row["completionValid"] and row["schemaValid"] and row["correct"] == 8)
    row["accuracyCode"] = scored["code"]
    return row


def call(payload, doc, variant, stage, api, persist, clock=time.perf_counter):
    row = {"id": doc["id"], "variant": variant, "stage": stage,
           "scored": False, "passed": False, "completionValid": False, "code": None}
    name = stage + "-" + doc["id"] + "-" + variant
    resident = api.resident()
    if resident and resident.get("digest") != MODEL_DIGEST:
        raise B7Error("B71_RESIDENT_MODEL_CHANGED")
    row.update(residentBefore=bool(resident),
               contextBefore=resident.get("context_length") if resident else None,
               otherLoadedModels=resident.get("otherLoadedModels") if resident else None)
    persist("intent-" + name + ".json", {
        "id": doc["id"], "variant": variant, "stage": stage, "think": False,
        "options": OPTIONS, "format": "json", "stream": False})
    prompt = payload["referencePrompt"] if variant == "reference" else \
        SHORT_RULES + json.dumps(payload["schema"], ensure_ascii=False, separators=(",", ":"))
    start = clock()
    interrupted = False
    try:
        body = api.request("/api/chat", {
            "model": b7.MODEL, "think": False, "stream": False, "format": "json",
            "options": dict(OPTIONS), "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": doc["text"]}]})
        row["wallMs"] = (clock() - start) * 1000
        row.update(evaluate_response(body, doc["expected"]))
    except (B7Error, KeyboardInterrupt) as error:
        row["wallMs"] = (clock() - start) * 1000
        row["code"] = str(error) if isinstance(error, B7Error) else "B71_INTERRUPTED"
        interrupted = isinstance(error, KeyboardInterrupt)
    persist("result-" + name + ".json", row)
    print("B71_CALL", stage, doc["id"], variant,
          "PASS" if row["passed"] else row.get("code") or row.get("accuracyCode") or "FAIL", flush=True)
    if interrupted:
        raise KeyboardInterrupt
    return row


def summary(rows):
    scored = [r for r in rows if r.get("scored")]
    measured = [r for r in rows if r.get("timings")]
    def avg(key):
        return statistics.mean(r["timings"][key] for r in measured) if measured else None
    return {
        "planned": 20, "attempted": len(rows), "evaluated": len(scored),
        "measured": len(measured), "correctFields": sum(r["correct"] for r in scored),
        "evaluatedFields": len(scored) * 8,
        "fieldAccuracyPercent": sum(r["correct"] for r in scored) / (len(scored) * 8) * 100
                                if scored else None,
        "exactDocuments": sum(bool(r.get("passed")) for r in rows),
        "validJson": sum(bool(r.get("jsonValid")) for r in scored),
        "validSchema": sum(bool(r.get("schemaValid")) for r in scored),
        "completed": sum(bool(r.get("completionValid")) for r in rows),
        "meanWallMs": statistics.mean(r["wallMs"] for r in measured) if measured else None,
        "meanPromptTokens": avg("prompt_eval_count"), "meanOutputTokens": avg("eval_count"),
        "meanPromptMs": avg("prompt_eval_duration") / 1e6 if measured else None,
        "meanGenerationMs": avg("eval_duration") / 1e6 if measured else None,
        "meanLoadMs": avg("load_duration") / 1e6 if measured else None,
        "meanNativeTotalMs": avg("total_duration") / 1e6 if measured else None,
        "p95WallMs": sorted(r["wallMs"] for r in measured)[
            math.ceil(.95 * len(measured)) - 1] if measured else None,
    }


def finalize(report):
    groups = {v: summary([r for r in report["rows"] if r["variant"] == v])
              for v in ("reference", "short")}
    report["summary"] = groups
    complete = (report["controlPassed"] and not report.get("code") and report["modelUnchanged"] and
                all(s["attempted"] == 20 and s["measured"] == 20 and s["completed"] == 20
                    for s in groups.values()))
    report["status"] = "COMPLETED" if complete else "FAILED_OR_INCOMPLETE"
    ref, short = groups["reference"], groups["short"]
    report["differenceShortMinusReference"] = {
        k: short[k] - ref[k] if complete and short[k] is not None and ref[k] is not None else None
        for k in ("correctFields", "fieldAccuracyPercent", "meanPromptTokens", "meanOutputTokens",
                  "meanWallMs", "meanPromptMs", "meanGenerationMs", "meanLoadMs", "meanNativeTotalMs")}
    pairs = []
    for a in [r for r in report["rows"] if r["variant"] == "reference"]:
        b = next((r for r in report["rows"] if r["id"] == a["id"] and r["variant"] == "short"), None)
        if b and all(r.get("completionValid") and r.get("residentBefore") and
                     r.get("otherLoadedModels") == 0 for r in (a, b)) and \
                a.get("contextBefore") is not None and a["contextBefore"] == b.get("contextBefore"):
            pairs.append((a["wallMs"], b["wallMs"]))
    report["comparableWarmPairs"] = len(pairs)
    report["pairedReferenceMeanMs"] = statistics.mean(a for a, _ in pairs) if pairs else None
    report["pairedShortMeanMs"] = statistics.mean(b for _, b in pairs) if pairs else None
    exact = complete and all(s["exactDocuments"] == 20 for s in groups.values())
    faster = bool(exact and len(pairs) >= 10 and short["meanWallMs"] < ref["meanWallMs"] and
                  report["pairedShortMeanMs"] < report["pairedReferenceMeanMs"])
    report["targetUnder10Seconds"] = bool(faster and short["meanWallMs"] < 10000 and
                                        report["pairedShortMeanMs"] < 10000)
    report["recommendation"] = "SHORT_PROMPT_FURTHER_TEST_ONLY" if faster else "KEEP_B6_REFERENCE"


def markdown(report):
    def val(value):
        return "nevyhodnotené" if value is None else f"{value:.3f}" if type(value) is float else str(value)
    lines = ["# B7.1 – think:false, kontrola a porovnanie promptov", "",
             "**Stav: " + report["status"] + "**; chyba: " + (report.get("code") or "žiadna"),
             "Model: " + b7.MODEL + ". think=false, temperature=0, num_predict=512, format=json, stream=false.",
             "Natívne Ollama používa num_predict=512, nie názov max_tokens z kompatibilného API.",
             "Bez retries, normalizácie, zmeny modelu či trvalých nastavení.", "",
             "## Samostatné kontrolné volanie",
             "Kontrola prešla: **" + str(report["controlPassed"]) + "**.",
             "Kontrola nie je započítaná do následných 20 párov.", "",
             "## Porovnanie – rovnakých 20 dokumentov",
             "| Ukazovateľ | B6 prompt, think:false | Krátky prompt, think:false | Rozdiel krátky − B6 |",
             "|---|---:|---:|---:|"]
    for label, key in [
            ("Pokusy / plán 20", "attempted"), ("Vyhodnotené dokumenty", "evaluated"),
            ("Správne polia", "correctFields"), ("Vyhodnotené polia", "evaluatedFields"),
            ("Presnosť vyhodnotených polí (%)", "fieldAccuracyPercent"),
            ("Presné a dokončené dokumenty", "exactDocuments"), ("Platný JSON", "validJson"),
            ("Platná schéma", "validSchema"), ("Dokončené odpovede", "completed"),
            ("Priemer vstupných tokenov", "meanPromptTokens"), ("Priemer výstupných tokenov", "meanOutputTokens"),
            ("Priemer celého volania (ms)", "meanWallMs"), ("P95 celého volania (ms)", "p95WallMs"),
            ("Priemer natívneho total_duration (ms)", "meanNativeTotalMs"),
            ("Priemer načítania (ms)", "meanLoadMs"), ("Priemer spracovania promptu (ms)", "meanPromptMs"),
            ("Priemer generovania (ms)", "meanGenerationMs")]:
        lines.append("| " + " | ".join([label] + [val(report["summary"][v][key])
                     for v in ("reference", "short")] +
                     [val(report["differenceShortMinusReference"].get(key))]) + " |")
    lines += ["", "Porovnateľné warm páry: " + str(report["comparableWarmPairs"]) + "/20.",
              "Warm priemery B6 / krátky (ms): " + val(report["pairedReferenceMeanMs"]) + " / " +
              val(report["pairedShortMeanMs"]) + ".",
              "Cieľ pod 10 s bez straty presnosti: **" + str(report["targetUnder10Seconds"]) + "**.",
              "Odporúčanie: **" + report["recommendation"] + "**.", "",
              "## Diagnostika každého volania",
              "Časy nižšie sú ms; tok = vstup/výstup. Thinking/content sú iba prítomnosť a dĺžka, nie text.",
              "| Fáza | Dokument | Prompt | done / reason | Thinking znaky | Content znaky | Tok | Load | Prompt | Generovanie | Native total | Wall | Polia | JSON / schéma | Výsledok |",
              "|---|---|---|---|---:|---:|---|---:|---:|---:|---:|---:|---|---|---|"]
    for row in ([report["control"]] if report.get("control") else []) + report["rows"]:
        t = row.get("timings", {})
        cells = [row["stage"], row["id"], row["variant"],
                 str(row.get("done")) + "/" + str(row.get("done_reason")),
                 val(row.get("thinking", {}).get("characters")), val(row.get("content", {}).get("characters")),
                 val(t.get("prompt_eval_count")) + "/" + val(t.get("eval_count"))]
        cells += [val(t[k] / 1e6 if k in t else None) for k in
                  ("load_duration", "prompt_eval_duration", "eval_duration", "total_duration")]
        cells += [val(row.get("wallMs")), str(row.get("correct")) + "/8" if row.get("scored") else "nevyhodnotené",
                  str(row.get("jsonValid")) + "/" + str(row.get("schemaValid")),
                  "PASS" if row.get("passed") else row.get("code") or row.get("accuracyCode") or "FAIL"]
        lines.append("| " + " | ".join(cells) + " |")
    lines += ["", "## Pôvodné referencie a obmedzenia",
              "Historický B6: **160/160 raw polí bez normalizácie**, priemer " +
              val(report["baselineB6"].get("meanProcessingMs")) + " ms cez Gateway; zostáva nezmenený.",
              "Historický B7: " + json.dumps(report["previousB7"], ensure_ascii=False),
              "Tieto historické merania nie sú párové porovnanie ani dôkaz rovnakej generácie.",
              "Chýbajúce volania sú nevyhodnotené, nie nesprávne odpovede. Rozdiely uvádzame iba po úplnom teste.",
              "Model a definícia nezmenené pred/po: " + str(report["modelUnchanged"]) + ".",
              "Ollama: " + str(report.get("ollamaVersion")) + ".",
              "Hardvér: " + json.dumps(report.get("hardware", {}), ensure_ascii=False),
              "Runtime: " + json.dumps(report.get("runtimeObservations", []), ensure_ascii=False),
              "Nastavenia/identita modelu: " + json.dumps(report.get("before"), ensure_ascii=False),
              "Uvažovanie a výsledný content sa neukladajú; JSON report obsahuje iba metadáta a skóre.",
              "Nenulové thinking alebo inline think značky zabránia pokračovaniu. Prázdne thinking nepotvrdzuje vnútorné výpočty modelu.",
              "Kontrola zahreje model/cache; poradie promptov sa strieda. Cache sa nemaže ani nemení.",
              "Ide o malú známu syntetickú sadu a lokálne /api/chat, nie end-to-end benchmark CRM.",
              "Žiadne CRM spojenie: aktuálny stav Gateway a 65 routov sa tu nezávisle neoveruje.",
              "Studený štart sa nevynucuje; neúspech dosiahnuť 10 s nie je dôkazom hardvérového limitu.", ""]
    return "\n".join(lines)


def benchmark(payload, previous, api, persist, clock=time.perf_counter,
              hardware_info=None, observe=b7.runtime_observation):
    report = {"phase": "B7.1", "startedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "model": b7.MODEL, "requestPolicy": {"think": False, "options": dict(OPTIONS),
              "stream": False, "format": "json", "retries": 0},
              "fixtureSha256": digest(payload), "baselineB6": payload["baselineB6"],
              "previousB7": previous, "control": None, "controlPassed": False, "rows": [],
              "before": None, "after": None, "modelUnchanged": False, "code": None,
              "hardware": hardware_info or {}, "runtimeObservations": []}
    def observation(stage):
        value = observe(api.resident())
        report["runtimeObservations"].append({"stage": stage, **value})
    try:
        report["ollamaVersion"] = api.request("/api/version").get("version")
        report["before"] = api.snapshot()
        if report["before"]["modelDigest"] != MODEL_DIGEST:
            raise B7Error("B71_MODEL_IDENTITY_CHANGED")
        if previous.get("modelFingerprint") and \
                report["before"]["fingerprint"] != previous["modelFingerprint"]:
            raise B7Error("B71_REFERENCE_MODEL_DEFINITION_CHANGED")
        persist("reference.json", {"prompt": payload["referencePrompt"], "baselineB6": payload["baselineB6"],
                                  "fixtureSha256": digest(payload), "model": report["before"]})
        observation("beforeControl")
        report["control"] = call(payload, payload["corpus"][0], "reference", "control", api, persist, clock)
        observation("afterControl")
        report["controlPassed"] = report["control"]["passed"]
        if not report["controlPassed"]:
            raise B7Error(report["control"].get("code") or "B71_CONTROL_ACCURACY_FAILED")
        for index, doc in enumerate(payload["corpus"]):
            for variant in (("reference", "short") if index % 2 == 0 else ("short", "reference")):
                row = call(payload, doc, variant, "comparison", api, persist, clock)
                report["rows"].append(row)
                if row.get("code"):
                    raise B7Error(row["code"])
        observation("afterComparison")
    except (B7Error, KeyboardInterrupt) as error:
        report["code"] = str(error) if isinstance(error, B7Error) else "B71_INTERRUPTED"
    except Exception:
        report["code"] = "B71_LOCAL_OR_REPORT_ERROR"
    finally:
        try:
            report["after"] = api.snapshot()
            report["modelUnchanged"] = bool(report["before"]) and \
                report["before"]["fingerprint"] == report["after"]["fingerprint"]
            if not report["modelUnchanged"]:
                report["code"] = report["code"] or "B71_MODEL_DEFINITION_CHANGED"
        except (Exception, KeyboardInterrupt):
            report["code"] = report["code"] or "B71_FINAL_MODEL_UNVERIFIED"
        report["finishedAtUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        finalize(report)
        persist("report.json", report)
        persist("report.md", markdown(report))
    return report


def main():
    parser = argparse.ArgumentParser(description="B7.1: one control, then 40 paired calls only on success")
    parser.add_argument("--run-b71", action="store_true", required=True)
    parser.add_argument("--previous-run", required=True)
    args = parser.parse_args()
    if os.environ.get("REPL_ID") or os.environ.get("REPLIT_DEV_DOMAIN") or not b7.host_is_ai_server():
        raise B7Error("B71_AI_SERVER_ONLY")
    payload, previous = load_previous(args.previous_run)
    base = pathlib.Path.home() / ".indexus-b71"
    base.mkdir(mode=0o700, exist_ok=True)
    stat = base.lstat()
    if base.is_symlink() or not base.is_dir() or stat.st_mode & 0o077 or stat.st_uid != os.getuid():
        raise B7Error("B71_PRIVATE_DIRECTORY_REQUIRED")
    # Separate marker; never remove or reset the historical B7 marker.
    try:
        marker = os.open(base / "b71-started.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise B7Error("B71_ALREADY_STARTED") from None
    with os.fdopen(marker, "w") as file:
        run = pathlib.Path(tempfile.mkdtemp(prefix="run-", dir=base))
        json.dump({"runDir": str(run)}, file)
    def persist(name, value):
        fd = os.open(run / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as file:
            file.write(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2))
    def stop(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    print("B71_RESULTS", run, flush=True)
    report = benchmark(payload, previous, b7.Ollama(), persist, hardware_info=b7.hardware())
    print(markdown(report))
    print("B71_RESULTS", run, flush=True)
    return 0 if report["status"] == "COMPLETED" else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except B7Error as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("B71_INTERRUPTED", file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("B71_LOCAL_ERROR", file=sys.stderr)
        sys.exit(1)
