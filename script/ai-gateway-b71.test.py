"""Offline tests only: all inference responses and timing samples are synthetic mocks."""
import copy
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("b71", HERE / "ai-gateway-b71.py")
b71 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b71)


class FakeOllama:
    def __init__(self, payload, fault=None):
        self.payload, self.fault, self.calls, self.reads, self.clock = payload, fault, [], 0, 0

    def snapshot(self):
        self.reads += 1
        return {"modelDigest": "b" * 64 if self.fault == "identity" else b71.MODEL_DIGEST,
                "fingerprint": "changed" if self.fault == "drift" and self.reads > 1 else "mock"}

    def resident(self):
        return {"digest": b71.MODEL_DIGEST, "context_length": 8192, "otherLoadedModels": 0}

    def request(self, endpoint, payload=None):
        if endpoint == "/api/version":
            return {"version": "MOCK_ONLY"}
        assert endpoint == "/api/chat"
        self.calls.append(copy.deepcopy(payload))
        if self.fault == "transport":
            raise b71.B7Error("B7_LOCAL_TRANSPORT_ERROR")
        if self.fault == "interrupt":
            raise KeyboardInterrupt
        short = payload["messages"][0]["content"] != self.payload["referencePrompt"]
        doc = next(d for d in self.payload["corpus"] if d["text"] == payload["messages"][1]["content"])
        actual = copy.deepcopy(doc["expected"])
        if self.fault == "control_accuracy" or self.fault == "short_accuracy" and short:
            actual["document_id"] = "wrong"
        content = json.dumps(actual)
        if self.fault == "invalid_json":
            content = "not JSON; PRIVATE_OUTPUT_SENTINEL"
        if self.fault == "extra":
            content = json.dumps({**actual, "secret": "PRIVATE_OUTPUT_SENTINEL"})
        if self.fault == "inline":
            content = "<think>PRIVATE_THINKING_SENTINEL</think>" + content
        duration = 6 if short else 12
        self.clock += duration
        result = {
            "model": b71.b7.MODEL, "done": True, "done_reason": "stop",
            "message": {"role": "assistant", "thinking": "", "content": content},
            "total_duration": duration * 10**9, "load_duration": 1000000,
            "prompt_eval_duration": (1 if short else 2) * 10**9,
            "eval_duration": (duration - (1 if short else 2)) * 10**9 - 1000000,
            "prompt_eval_count": 400 if short else 933, "prompt_eval_cached_count": 50,
            "eval_count": 80 if short else 100,
        }
        if self.fault == "thinking":
            result["message"]["thinking"] = "PRIVATE_THINKING_SENTINEL"
        if self.fault == "length":
            result["done_reason"] = "length"
            result["eval_count"] = 512
        if self.fault == "unknown_reason":
            result["done_reason"] = "PRIVATE_REASON_SENTINEL"
        if self.fault == "missing_timing":
            del result["load_duration"]
        if self.fault == "wrong_model":
            result["model"] = "wrong"
        if self.fault == "too_many_tokens":
            result["eval_count"] = 513
        return result


class TestB71(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        out = subprocess.run(["node", str(HERE / "ai-gateway-b7.test.cjs"), "--mock-fixture-json"],
                             capture_output=True, text=True, check=True)
        cls.payload = json.loads(out.stdout)["payload"]

    def run_case(self, fault=None):
        api, files = FakeOllama(self.payload, fault), {}
        def persist(name, value):
            self.assertNotIn(name, files)
            files[name] = copy.deepcopy(value)
        with patch("builtins.print"):
            report = b71.benchmark(self.payload, {"mockHistorical": True}, api, persist,
                                   clock=lambda: api.clock, hardware_info={"mock": True},
                                   observe=lambda _: {"contextLength": 8192})
        return api, report, files

    def test_control_then_forty_paired_calls_same_explicit_settings(self):
        api, report, files = self.run_case()
        self.assertEqual(len(api.calls), 41)
        self.assertTrue(report["controlPassed"])
        self.assertEqual(report["status"], "COMPLETED")
        self.assertEqual(len(report["rows"]), 40)
        self.assertEqual(report["summary"]["reference"]["correctFields"], 160)
        self.assertEqual(report["summary"]["short"]["correctFields"], 160)
        self.assertEqual(report["comparableWarmPairs"], 20)
        self.assertTrue(report["targetUnder10Seconds"])
        self.assertEqual(report["differenceShortMinusReference"]["meanWallMs"], -6000)
        self.assertEqual(report["differenceShortMinusReference"]["meanPromptTokens"], -533)
        self.assertEqual(report["differenceShortMinusReference"]["meanOutputTokens"], -20)
        self.assertEqual(api.calls[0]["messages"][0]["content"], self.payload["referencePrompt"])
        self.assertEqual(api.calls[0]["messages"][1]["content"], self.payload["corpus"][0]["text"])
        for request in api.calls:
            self.assertIs(request["think"], False)
            self.assertEqual(request["options"], {"temperature": 0, "num_predict": 512})
            self.assertEqual(set(request), {"model", "think", "options", "stream", "format", "messages"})
            self.assertEqual(request["model"], "indexus-document-audio:latest")
            self.assertEqual(request["format"], "json")
            self.assertIs(request["stream"], False)
        for i in range(20):
            a, b = api.calls[1 + i * 2:3 + i * 2]
            self.assertEqual(a["messages"][1], b["messages"][1])
            self.assertEqual(a["messages"][0]["content"] == self.payload["referencePrompt"], i % 2 == 0)
        self.assertEqual(files["report.json"], report)
        self.assertIn("512", files["report.md"])
        self.assertEqual(files["reference.json"]["prompt"], self.payload["referencePrompt"])

    def test_control_failure_does_not_run_comparison_or_retry(self):
        for fault in ("control_accuracy", "transport", "length", "thinking", "inline",
                      "invalid_json", "extra", "missing_timing", "wrong_model", "too_many_tokens"):
            with self.subTest(fault=fault):
                api, report, files = self.run_case(fault)
                self.assertEqual(len(api.calls), 1)
                self.assertFalse(report["controlPassed"])
                self.assertEqual(report["rows"], [])
                self.assertEqual(report["status"], "FAILED_OR_INCOMPLETE")
                self.assertIsNone(report["summary"]["short"]["fieldAccuracyPercent"])
                self.assertIsNone(report["differenceShortMinusReference"]["meanWallMs"])
                self.assertIn("report.md", files)
                self.assertEqual(api.reads, 2)

    def test_all_telemetry_and_metadata_retained_on_truncation_without_raw_text(self):
        _, report, files = self.run_case("length")
        row = report["control"]
        self.assertEqual(row["done_reason"], "length")
        self.assertEqual(row["timings"]["eval_count"], 512)
        self.assertEqual(row["timings"]["prompt_eval_count"], 933)
        self.assertEqual(row["nativeTelemetry"]["eval_count"], 512)
        self.assertTrue(row["content"]["fieldPresent"])
        self.assertTrue(row["content"]["nonEmpty"])
        self.assertFalse(row["thinking"]["nonEmpty"])
        self.assertNotIn("actual", row)
        self.assertFalse(row["completionValid"])
        self.assertFalse(row["passed"])
        self.assertEqual(row["correct"], 8)  # JSON can be exact while termination is invalid.
        for key in ("load_duration", "prompt_eval_duration", "eval_duration", "total_duration"):
            self.assertIn(key, row["timings"])
        _, report, _ = self.run_case("missing_timing")
        self.assertEqual(report["control"]["nativeTelemetry"]["eval_count"], 100)

    def test_generated_content_reasoning_and_unknown_reason_never_persisted(self):
        for fault in ("thinking", "inline", "invalid_json", "unknown_reason", "extra"):
            _, report, files = self.run_case(fault)
            raw = json.dumps(files, ensure_ascii=False)
            self.assertNotIn("PRIVATE_", raw)
            self.assertNotIn('"actual"', raw)
        self.assertEqual(report["control"]["correct"], 8)
        self.assertFalse(report["control"]["schemaValid"])  # Extra key must not pass.

    def test_accuracy_regression_finishes_comparison_but_rejects_short_prompt(self):
        api, report, _ = self.run_case("short_accuracy")
        self.assertEqual(len(api.calls), 41)
        self.assertEqual(report["status"], "COMPLETED")
        self.assertEqual(report["summary"]["short"]["correctFields"], 140)
        self.assertEqual(report["differenceShortMinusReference"]["correctFields"], -20)
        self.assertEqual(report["recommendation"], "KEEP_B6_REFERENCE")
        self.assertFalse(report["targetUnder10Seconds"])

    def test_model_identity_guard_and_drift(self):
        api, report, _ = self.run_case("identity")
        self.assertEqual(len(api.calls), 0)
        self.assertEqual(report["code"], "B71_MODEL_IDENTITY_CHANGED")
        _, report, _ = self.run_case("drift")
        self.assertFalse(report["modelUnchanged"])
        self.assertEqual(report["status"], "FAILED_OR_INCOMPLETE")
        self.assertFalse(report["targetUnder10Seconds"])

    def test_reference_definition_change_blocks_before_any_inference(self):
        api, files = FakeOllama(self.payload), {}
        report = b71.benchmark(self.payload, {"modelFingerprint": "different-definition"}, api,
                               lambda name, value: files.update({name: copy.deepcopy(value)}))
        self.assertEqual(api.calls, [])
        self.assertEqual(report["code"], "B71_REFERENCE_MODEL_DEFINITION_CHANGED")
        self.assertIn("report.json", files)

    def test_comparison_failure_preserves_completed_control_without_retry(self):
        api, files = FakeOllama(self.payload), {}
        original = api.request
        def request(endpoint, payload=None):
            body = original(endpoint, payload)
            if endpoint == "/api/chat" and len(api.calls) == 3:
                body["done_reason"] = "length"  # First short-prompt response.
            return body
        api.request = request
        with patch("builtins.print"):
            report = b71.benchmark(self.payload, {}, api,
                                   lambda name, value: files.update({name: copy.deepcopy(value)}),
                                   clock=lambda: api.clock, observe=lambda _: {})
        self.assertTrue(report["controlPassed"])
        self.assertEqual(len(api.calls), 3)
        self.assertEqual(len(report["rows"]), 2)
        self.assertEqual(report["rows"][-1]["done_reason"], "length")
        self.assertEqual(report["status"], "FAILED_OR_INCOMPLETE")
        self.assertIsNone(report["differenceShortMinusReference"]["meanWallMs"])

    def test_interruption_preserves_intent_and_result_without_retry(self):
        api, report, files = self.run_case("interrupt")
        self.assertEqual(len(api.calls), 1)
        self.assertEqual(report["code"], "B71_INTERRUPTED")
        self.assertIn("result-control-SYN-B4-01-reference.json", files)

    def test_main_uses_separate_private_marker_and_never_changes_b7(self):
        with tempfile.TemporaryDirectory() as directory:
            home = pathlib.Path(directory)
            old = home / ".indexus-b7"
            old.mkdir(mode=0o700)
            marker = old / "b7-started.json"
            marker.write_text('{"untouched":true}')
            api = FakeOllama(self.payload)
            argv = ["b71", "--run-b71", "--previous-run", str(old / "run-TEST")]
            with patch.object(sys, "argv", argv), patch.dict(b71.os.environ, {}, clear=True), \
                    patch.object(b71.pathlib.Path, "home", return_value=home), \
                    patch.object(b71.b7, "host_is_ai_server", return_value=True), \
                    patch.object(b71, "load_previous", return_value=(self.payload, {"mock": True})), \
                    patch.object(b71.b7, "Ollama", return_value=api), \
                    patch.object(b71.b7, "hardware", return_value={}), \
                    patch.object(b71.b7, "runtime_observation", return_value={}), \
                    patch.object(b71.signal, "signal"), patch("builtins.print"):
                self.assertEqual(b71.main(), 0)
                with self.assertRaisesRegex(b71.B7Error, "B71_ALREADY_STARTED"):
                    b71.main()
            self.assertEqual(len(api.calls), 41)
            self.assertEqual(marker.read_text(), '{"untouched":true}')
            base = home / ".indexus-b71"
            run = pathlib.Path(json.loads((base / "b71-started.json").read_text())["runDir"])
            for filename in run.iterdir():
                self.assertEqual(filename.stat().st_mode & 0o777, 0o600)
            self.assertEqual(base.stat().st_mode & 0o777, 0o700)
            self.assertIn("report.md", [p.name for p in run.iterdir()])

    def test_previous_evidence_fixture_pins_and_read_only_behavior(self):
        with tempfile.TemporaryDirectory() as directory:
            home = pathlib.Path(directory)
            run = home / ".indexus-b7" / "run-TEST"
            run.mkdir(parents=True, mode=0o700)
            previous = {"fixtureSha256": b71.digest(self.payload), "model": b71.b7.MODEL,
                        "modelUnchanged": True,
                        "before": {"modelDigest": b71.MODEL_DIGEST}, "after": {"modelDigest": b71.MODEL_DIGEST},
                        "rows": [{"wallMs": 117624, "timings": {"eval_count": 512},
                                  "content": "PRIVATE_OUTPUT_SENTINEL"}]}
            for name, value in (("plan.json", {"fixture": self.payload}), ("report.json", previous)):
                (run / name).write_text(json.dumps(value))
                (run / name).chmod(0o600)
            original = {p.name: p.read_bytes() for p in run.iterdir()}
            with patch.object(b71.pathlib.Path, "home", return_value=home), \
                    patch.object(b71, "FIXTURE_SHA256", b71.digest(self.payload)):
                payload, safe = b71.load_previous(run)
                self.assertEqual(payload, self.payload)
                self.assertNotIn("PRIVATE_", json.dumps(safe))
                with self.assertRaises(b71.B7Error):
                    b71.load_previous(home / "somewhere-else")
                (run / "plan.json").write_text(json.dumps({"fixture": {**self.payload, "referencePrompt": "changed"}}))
                with self.assertRaisesRegex(b71.B7Error, "ORIGINAL_SYNTHETIC"):
                    b71.load_previous(run)
                (run / "plan.json").write_bytes(original["plan.json"])
            self.assertEqual({p.name: p.read_bytes() for p in run.iterdir()}, original)

    def test_cli_refuses_non_ai_host_before_opening_inputs(self):
        child = subprocess.run([sys.executable, str(HERE / "ai-gateway-b71.py"), "--run-b71",
                                "--previous-run", "/not-found"], capture_output=True, text=True)
        self.assertEqual(child.returncode, 1)
        self.assertIn("B71_AI_SERVER_ONLY", child.stderr)


if __name__ == "__main__":
    unittest.main()
