#!/usr/bin/env python3
"""Operator-only B7 native benchmark; Python standard library, no installation."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))
from ai_gateway_b7_core import B7Error, FIELDS, SHORT_RULES, digest, finalize, markdown, score, strict_json, timings

MODEL = "indexus-document-audio:latest"
BASE = "http://127.0.0.1:11434"
AI_IP = "10.9.2.140"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise B7Error("B7_REDIRECT_REFUSED")


class Ollama:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, endpoint, payload=None):
        allowed = {"/api/version": False, "/api/tags": False, "/api/ps": False,
                   "/api/show": True, "/api/chat": True}
        if endpoint not in allowed or allowed[endpoint] != (payload is not None):
            raise B7Error("B7_OPERATION_FORBIDDEN")
        data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
        request = urllib.request.Request(BASE + endpoint, data=data,
                                         headers={"Content-Type": "application/json", "Accept": "application/json"})
        try:
            with self.opener.open(request, timeout=120) as response:
                if response.status != 200:
                    raise B7Error("B7_HTTP_" + str(response.status))
                if "application/json" not in response.headers.get("Content-Type", "").lower():
                    raise B7Error("B7_INVALID_CONTENT_TYPE")
                raw = response.read(2 * 1024 * 1024 + 1)
                if len(raw) > 2 * 1024 * 1024:
                    raise B7Error("B7_RESPONSE_TOO_LARGE")
                result = strict_json(raw)
                if not isinstance(result, dict) or "error" in result:
                    raise B7Error("B7_OLLAMA_ERROR")
                return result
        except urllib.error.HTTPError as error:
            raise B7Error("B7_HTTP_" + str(error.code)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise B7Error("B7_LOCAL_TRANSPORT_ERROR") from None
        except (ValueError, UnicodeError):
            raise B7Error("B7_INVALID_RESPONSE") from None

    def resident(self):
        entries = self.request("/api/ps").get("models")
        if not isinstance(entries, list):
            raise B7Error("B7_PS_INVALID")
        target = [m for m in entries if m.get("name") == MODEL or m.get("model") == MODEL]
        if len(target) > 1:
            raise B7Error("B7_PS_AMBIGUOUS")
        return {**target[0], "otherLoadedModels": len(entries) - 1} if target else None

    def snapshot(self):
        tags = self.request("/api/tags").get("models", [])
        target = [m for m in tags if m.get("name") == MODEL or m.get("model") == MODEL]
        if len(target) != 1:
            raise B7Error("B7_MODEL_NOT_FOUND_OR_AMBIGUOUS")
        entry = target[0]
        definition = self.request("/api/show", {"model": MODEL, "verbose": False})
        if any(entry.get(k) or definition.get(k) for k in ("remote_model", "remote_host")):
            raise B7Error("B7_REMOTE_MODEL_FORBIDDEN")
        details = definition.get("details", {})
        if details.get("format") != "gguf" or not re.fullmatch(
                r"(?:sha256:)?[a-fA-F0-9]{64}", entry.get("digest", "")):
            raise B7Error("B7_LOCAL_MODEL_IDENTITY_UNVERIFIED")
        parameters = {}
        allowed = {"num_ctx", "num_thread", "temperature", "num_predict", "seed",
                   "top_k", "top_p", "min_p", "repeat_penalty", "repeat_last_n", "num_gpu"}
        for line in definition.get("parameters", "").splitlines():
            pair = line.split(maxsplit=1)
            if len(pair) == 2 and pair[0] in allowed:
                try:
                    parameters[pair[0]] = json.loads(pair[1])
                except ValueError:
                    parameters[pair[0]] = "explicit, non-numeric"
        return dict(modelDigest=entry["digest"], fingerprint=digest({"digest": entry["digest"],
                    "definition": definition}), quantization=details.get("quantization_level"),
                    parameterSize=details.get("parameter_size"), parameters=parameters,
                    trainingContextLimits={k: v for k, v in definition.get("model_info", {}).items()
                                           if k.endswith(".context_length")},
                    templateSha256=digest(definition.get("template")),
                    systemSha256=digest(definition.get("system")),
                    thinking=definition.get("thinking"),
                    capabilities=definition.get("capabilities", []))


def read_text(filename):
    try:
        return pathlib.Path(filename).read_text(errors="replace")
    except OSError:
        return ""


def host_is_ai_server():
    addresses = set()
    try:
        addresses.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    fib = read_text("/proc/net/fib_trie")
    if re.search(r"\b10\.9\.2\.140\s*\n\s*/32 host LOCAL\b", fib):
        addresses.add(AI_IP)
    return AI_IP in addresses


def hardware():
    info = read_text("/proc/cpuinfo")
    cpu = next((line.split(":", 1)[1].strip() for line in info.splitlines()
                if line.startswith("model name") and ":" in line), None)
    cores = set()
    for block in info.split("\n\n"):
        fields = dict(line.split(":", 1) for line in block.splitlines() if ":" in line)
        fields = {k.strip(): v.strip() for k, v in fields.items()}
        if "physical id" in fields and "core id" in fields:
            cores.add((fields["physical id"], fields["core id"]))
    mem = re.search(r"^MemTotal:\s+(\d+)", read_text("/proc/meminfo"), re.M)
    result = dict(cpu=cpu, logicalCpus=os.cpu_count(), physicalCores=len(cores) or None,
                  memoryGiB=round(int(mem[1]) / 1024**2, 2) if mem else None,
                  nvidiaGpu=None)
    try:
        output = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,utilization.gpu",
                                 "--format=csv,noheader,nounits"], capture_output=True, text=True,
                                timeout=5, check=False)
        if output.returncode == 0:
            result["nvidiaGpu"] = output.stdout.strip()[:1000]
    except (OSError, subprocess.TimeoutExpired):
        pass
    return result


def runtime_observation(resident):
    result = dict(contextLength=resident.get("context_length") if resident else None,
                  sizeVramBytes=resident.get("size_vram") if resident else None,
                  inferenceThreads=None, threadSource="not reported", osThreadCount=None)
    runners = []
    proc = pathlib.Path("/proc")
    if proc.is_dir():
        for directory in proc.iterdir():
            if not directory.name.isdigit():
                continue
            try:
                exe = (directory / "exe").resolve(strict=True).name
                if "ollama" not in exe and "llama" not in exe:
                    continue
                args = (directory / "cmdline").read_bytes().decode(errors="replace").split("\0")
                if "runner" not in args and not any("llama-server" in a for a in args):
                    continue
                options = {}
                for key in ("--threads", "--ctx-size", "--parallel", "--n-gpu-layers"):
                    for index, value in enumerate(args):
                        candidate = args[index + 1] if value == key and index + 1 < len(args) else \
                            value[len(key) + 1:] if value.startswith(key + "=") else None
                        if candidate is not None and re.fullmatch(r"\d+", candidate):
                            options[key] = int(candidate)
                count = re.search(r"^Threads:\s+(\d+)", read_text(directory / "status"), re.M)
                runners.append(dict(options=options, osThreadCount=int(count[1]) if count else None))
            except (OSError, ValueError):
                continue
    # Runner attribution is deliberately conservative; OS threads are not inference threads.
    result["visibleRunners"] = len(runners)
    if len(runners) == 1 and resident and resident.get("otherLoadedModels", 0) == 0:
        result["runnerOptions"] = runners[0]["options"]
        result["osThreadCount"] = runners[0]["osThreadCount"]
        if "--threads" in runners[0]["options"]:
            result["inferenceThreads"] = runners[0]["options"]["--threads"]
            result["threadSource"] = "single visible Ollama runner argument; check for other server workloads"
    return result


def validate_fixture(fixture):
    payload = fixture.get("payload") if isinstance(fixture, dict) else None
    if not isinstance(payload, dict) or digest(payload) != fixture.get("sha256"):
        raise B7Error("B7_FIXTURE_HASH_MISMATCH")
    if payload.get("model") != MODEL or not isinstance(payload.get("referencePrompt"), str) or \
            not isinstance(payload.get("schema"), dict) or \
            set(payload["schema"].get("properties", {})) != set(FIELDS) or \
            len(payload.get("corpus", [])) != 20:
        raise B7Error("B7_FIXTURE_INVALID")
    ids = [f"SYN-B4-{i:02}" for i in range(1, 11)] + [f"B6-NEW-{i:02}" for i in range(1, 11)]
    if [d["id"] for d in payload["corpus"]] != ids or \
            payload.get("baselineB6", {}).get("correctFields") != 160:
        raise B7Error("B7_BASELINE_INVALID")
    for doc in payload["corpus"]:
        result = score(json.dumps(doc["expected"], ensure_ascii=False), doc["expected"])
        if not result["schemaValid"] or result["correct"] != 8 or not isinstance(doc.get("text"), str):
            raise B7Error("B7_EXPECTATIONS_INVALID")
    return payload


def benchmark(payload, api, persist, clock=time.perf_counter, stopped=lambda: False,
              hardware_info=None, observe=runtime_observation):
    report = dict(model=MODEL, rows=[], code=None, before=None, after=None, modelUnchanged=False,
                  documentIds=[d["id"] for d in payload["corpus"]], runtimeObservations=[],
                  fixtureSha256=digest(payload), baselineB6=payload["baselineB6"],
                  hardware=hardware_info or {})
    short = SHORT_RULES + json.dumps(payload["schema"], ensure_ascii=False, separators=(",", ":"))
    report["promptCharacters"] = {"reference": len(payload["referencePrompt"]), "short": len(short)}
    try:
        report["ollamaVersion"] = api.request("/api/version").get("version")
        report["before"] = api.snapshot()
        reference = dict(model=MODEL, prompt=payload["referencePrompt"],
                         nativeOptions={"temperature": 0, "num_predict": 512},
                         originalModel=report["before"])
        persist("reference.json", reference)
        persist("plan.json", dict(fixture=payload, shortPrompt=short,
                                  policy="20 paired cases, alternating order, exactly 40 calls, no normalization/retries"))
        for index, doc in enumerate(payload["corpus"]):
            order = ("reference", "short") if index % 2 == 0 else ("short", "reference")
            for variant in order:
                if stopped():
                    raise B7Error("B7_INTERRUPTED")
                resident = api.resident()
                if resident and resident.get("digest") != report["before"]["modelDigest"]:
                    raise B7Error("B7_LOADED_MODEL_DIGEST_MISMATCH")
                persist(f'intent-{doc["id"]}-{variant}.json', {"id": doc["id"], "variant": variant})
                row = dict(id=doc["id"], variant=variant, residentBefore=bool(resident),
                           contextBefore=resident.get("context_length") if resident else None)
                start = clock()
                fatal = False
                try:
                    body = api.request("/api/chat", dict(model=MODEL, stream=False, format="json",
                        options={"temperature": 0, "num_predict": 512},
                        messages=[{"role": "system", "content": payload["referencePrompt"] if variant == "reference" else short},
                                  {"role": "user", "content": doc["text"]}]))
                    row["wallMs"] = (clock() - start) * 1000
                    row["timings"] = timings(body)
                    message = body.get("message", {})
                    if body.get("model") != MODEL or body.get("done") is not True or \
                            body.get("done_reason") != "stop" or message.get("role") != "assistant" or \
                            not isinstance(message.get("content"), str) or message.get("tool_calls"):
                        raise B7Error("B7_INCOMPLETE_OR_INVALID_COMPLETION")
                    row.update(score(message["content"], doc["expected"]))
                except (B7Error, KeyboardInterrupt) as error:
                    row["wallMs"] = (clock() - start) * 1000
                    row["code"] = str(error) if isinstance(error, B7Error) else "B7_INTERRUPTED"
                    report["code"] = row["code"]
                    fatal = True
                report["rows"].append(row)
                persist(f'result-{doc["id"]}-{variant}.json', row)
                if fatal:
                    raise B7Error(report["code"])
                if len(report["rows"]) <= 2:
                    observation = observe(api.resident())
                    observation["afterVariant"] = variant
                    report["runtimeObservations"].append(observation)
    except (B7Error, KeyboardInterrupt) as error:
        report["code"] = str(error) if isinstance(error, B7Error) else "B7_INTERRUPTED"
    except Exception:
        report["code"] = "B7_LOCAL_OR_REPORT_ERROR"
    finally:
        try:
            report["after"] = api.snapshot()
            report["modelUnchanged"] = bool(report["before"]) and \
                report["before"]["fingerprint"] == report["after"]["fingerprint"]
            if not report["modelUnchanged"]:
                report["code"] = report["code"] or "B7_MODEL_DEFINITION_CHANGED"
        except (Exception, KeyboardInterrupt):
            report["code"] = report["code"] or "B7_FINAL_MODEL_UNVERIFIED"
        finalize(report)
        persist("report.json", report)
        persist("report.md", markdown(report))
    return report


def main():
    parser = argparse.ArgumentParser(description="B7: native Ollama benchmark on the AI server only")
    parser.add_argument("--run-b7", action="store_true")
    parser.add_argument("--fixtures", required=True)
    args = parser.parse_args()
    if not args.run_b7:
        parser.error("explicit --run-b7 is required")
    if os.environ.get("REPL_ID") or os.environ.get("REPLIT_DEV_DOMAIN") or not host_is_ai_server():
        raise B7Error("B7_AI_SERVER_ONLY")
    fixture_file = pathlib.Path(args.fixtures)
    if fixture_file.is_symlink() or fixture_file.stat().st_size > 2 * 1024 * 1024:
        raise B7Error("B7_FIXTURE_FILE_UNSAFE")
    payload = validate_fixture(strict_json(fixture_file.read_bytes()))
    base = pathlib.Path.home() / ".indexus-b7"
    base.mkdir(mode=0o700, exist_ok=True)
    if base.is_symlink() or base.stat().st_mode & 0o077 or \
            hasattr(os, "getuid") and base.stat().st_uid != os.getuid():
        raise B7Error("B7_PRIVATE_DIRECTORY_REQUIRED")
    run = pathlib.Path(tempfile.mkdtemp(prefix="run-", dir=base))
    try:
        marker = os.open(base / "b7-started.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise B7Error("B7_ALREADY_STARTED") from None
    with os.fdopen(marker, "w") as file:
        json.dump({"runDir": str(run)}, file)
    def persist(name, value):
        raw = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2)
        fd = os.open(run / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as file:
            file.write(raw)
    print("B7_RESULTS", run, flush=True)
    stopped = [False]
    def stop(_signum, _frame):
        stopped[0] = True
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    report = benchmark(payload, Ollama(), persist, stopped=lambda: stopped[0], hardware_info=hardware())
    print(markdown(report))
    print("B7_RESULTS", run)
    return 0 if report["status"] == "COMPLETED" else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except B7Error as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("B7_INTERRUPTED", file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("B7_LOCAL_ERROR", file=sys.stderr)
        sys.exit(1)
