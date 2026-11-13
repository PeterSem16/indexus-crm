"""Offline B7 tests. All responses and timing samples below are MOCKED."""
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
spec = importlib.util.spec_from_file_location("b7", HERE / "ai-gateway-b7.py")
b7 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b7)
from ai_gateway_b7_core import B7Error, digest, score, timings, markdown


class FakeOllama:
    def __init__(self, payload, fault=None):
        self.payload, self.fault, self.calls, self.reads = payload, fault, [], 0
        self.clock = 0

    def snapshot(self):
        self.reads += 1
        return dict(fingerprint="changed" if self.fault == "drift" and self.reads > 1 else "original",
                    modelDigest="a" * 64, quantization="MOCK_ONLY_Q4", parameters={})

    def resident(self):
        return {"digest": "a" * 64, "context_length": 4096} if self.calls else None

    def request(self, endpoint, payload=None):
        if endpoint == "/api/version":
            return {"version": "MOCK_NOT_A_REAL_SERVER"}
        assert endpoint == "/api/chat"
        self.calls.append(copy.deepcopy(payload))
        if self.fault == "transport":
            raise B7Error("B7_LOCAL_TRANSPORT_ERROR")
        prompt = payload["messages"][0]["content"]
        variant = "reference" if prompt == self.payload["referencePrompt"] else "short"
        doc = next(d for d in self.payload["corpus"] if d["text"] == payload["messages"][1]["content"])
        actual = copy.deepcopy(doc["expected"])
        self.clock += 15 if variant == "reference" else 8
        if self.fault == "accuracy" and variant == "short":
            actual["document_id"] = "WRONG"
        result = dict(model=b7.MODEL, done=True, done_reason="stop",
                      message={"role": "assistant", "content": json.dumps(actual)},
                      total_duration=8000000000, load_duration=1000000,
                      prompt_eval_duration=1000000000, eval_duration=6000000000,
                      prompt_eval_count=800 if variant == "reference" else 400, eval_count=100)
        if self.fault == "timing":
            del result["load_duration"]
        if self.fault == "truncated":
            result["done_reason"] = "length"
        return result


class TestB7(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        process = subprocess.run(["node", str(HERE / "ai-gateway-b7.test.cjs"), "--mock-fixture-json"],
                                 capture_output=True, check=True, text=True)
        cls.fixture = json.loads(process.stdout)
        cls.payload = b7.validate_fixture(cls.fixture)

    def run_case(self, fault=None):
        api = FakeOllama(self.payload, fault)
        files = {}
        def persist(name, value):
            self.assertNotIn(name, files)
            files[name] = copy.deepcopy(value)
        report = b7.benchmark(self.payload, api, persist, clock=lambda: api.clock,
                              observe=lambda _: {"contextLength": 4096, "inferenceThreads": None})
        return api, report, files

    def test_exact_original_expected_values_and_types(self):
        for doc in self.payload["corpus"]:
            self.assertEqual(score(json.dumps(doc["expected"]), doc["expected"])["correct"], 8)
            for key in doc["expected"]:
                actual = {**doc["expected"], key: "WRONG"}
                self.assertLess(score(json.dumps(actual), doc["expected"])["correct"], 8)
        doc = next(d for d in self.payload["corpus"] if d["expected"]["total_amount"] == 0)
        actual = {**doc["expected"], "total_amount": False}
        result = score(json.dumps(actual), doc["expected"])
        self.assertFalse(result["schemaValid"])
        self.assertEqual(result["correct"], 7)

    def test_no_identifier_repair_extra_keys_or_invalid_json(self):
        doc = self.payload["corpus"][0]
        actual = {**doc["expected"], "document_id": "Objednávka " + doc["expected"]["document_id"]}
        self.assertEqual(score(json.dumps(actual), doc["expected"])["correct"], 7)
        actual = {**doc["expected"], "approved": True}
        self.assertFalse(score(json.dumps(actual), doc["expected"])["schemaValid"])
        for raw in ('{"document_id":"a","document_id":"b"}', '{"total_amount":NaN}',
                    '{"total_amount":1e999}', "not json"):
            self.assertEqual(score(raw, doc["expected"])["correct"], 0)

    def test_native_nanoseconds_and_cache_unknown(self):
        value = dict(total_duration=1000, load_duration=100, prompt_eval_duration=300,
                     eval_duration=600, prompt_eval_count=20, eval_count=10)
        self.assertIsNone(timings(value)["promptTokensPerSecond"])
        self.assertEqual(timings({**value, "prompt_eval_cached_count": 10})["promptTokensPerSecond"], 10 * 1e9 / 300)
        for key in value:
            bad = {**value, key: True}
            with self.assertRaises(B7Error):
                timings(bad)

    def test_forty_calls_paired_order_only_prompt_differs(self):
        api, report, files = self.run_case()
        self.assertEqual(len(api.calls), 40)
        self.assertEqual(report["summary"]["reference"]["correctFields"], 160)
        self.assertEqual(report["summary"]["short"]["correctFields"], 160)
        self.assertTrue(report["targetUnder10Seconds"])
        self.assertEqual(report["summary"]["comparableWarmPairs"], 19)
        self.assertEqual(report["status"], "COMPLETED")
        self.assertLess(report["promptCharacters"]["short"], report["promptCharacters"]["reference"])
        for index in range(20):
            a, b = api.calls[index * 2:index * 2 + 2]
            self.assertEqual(a["messages"][1], b["messages"][1])
            self.assertEqual(a["messages"][0]["content"] == self.payload["referencePrompt"], index % 2 == 0)
            self.assertEqual(set(a), {"model", "stream", "format", "options", "messages"})
            self.assertEqual(a["options"], {"temperature": 0, "num_predict": 512})
            self.assertNotIn("expected", a["messages"][1])
        self.assertEqual(files["reference.json"]["prompt"], self.payload["referencePrompt"])
        self.assertEqual(files["report.json"], report)
        self.assertIn("nie end-to-end", markdown(report))
        self.assertNotIn("Neoverené údaje nahradené", markdown(report))

    def test_faster_is_not_recommended_after_accuracy_loss_or_drift(self):
        for fault in ("accuracy", "drift"):
            api, report, _ = self.run_case(fault)
            self.assertEqual(len(api.calls), 40)
            self.assertFalse(report["targetUnder10Seconds"])
            self.assertIn("KEEP_B6_REFERENCE", report["recommendation"])
        self.assertEqual(self.run_case("accuracy")[1]["summary"]["short"]["correctFields"], 140)

    def test_transport_missing_timings_truncation_fail_without_retry(self):
        for fault in ("transport", "timing", "truncated"):
            api, report, files = self.run_case(fault)
            self.assertEqual(len(api.calls), 1)
            self.assertEqual(report["status"], "FAILED_OR_INCOMPLETE")
            self.assertFalse(report["targetUnder10Seconds"])
            self.assertIn("report.md", files)
            self.assertEqual(api.reads, 2)

    def test_hash_tampering_rejected(self):
        changed = copy.deepcopy(self.fixture)
        changed["payload"]["corpus"][0]["text"] += "changed"
        with self.assertRaisesRegex(B7Error, "HASH_MISMATCH"):
            b7.validate_fixture(changed)

    def test_loopback_endpoint_allowlist_and_redirect_denial(self):
        api = b7.Ollama()
        for endpoint, payload in (("/api/pull", {}), ("/api/chat", None),
                                  ("http://example.com", None), ("/api/ps", {})):
            with self.assertRaisesRegex(B7Error, "OPERATION_FORBIDDEN"):
                api.request(endpoint, payload)
        with self.assertRaisesRegex(B7Error, "REDIRECT_REFUSED"):
            b7.NoRedirect().redirect_request(None)

    def test_cli_refuses_this_environment_without_network(self):
        process = subprocess.run([sys.executable, str(HERE / "ai-gateway-b7.py"), "--run-b7",
                                  "--fixtures", "/does-not-exist"], capture_output=True, text=True)
        self.assertEqual(process.returncode, 1)
        self.assertIn("B7_AI_SERVER_ONLY", process.stderr)

    def test_unknown_threads_never_become_host_cpu_count(self):
        with patch.object(b7.pathlib.Path, "is_dir", return_value=False):
            observed = b7.runtime_observation({"context_length": 4096, "size_vram": 0})
        self.assertIsNone(observed["inferenceThreads"])
        self.assertEqual(observed["contextLength"], 4096)

    def test_complete_main_private_journal_and_no_second_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            home = pathlib.Path(directory)
            fixture = home / "fixtures.json"
            fixture.write_text(json.dumps(self.fixture, ensure_ascii=False))
            api = FakeOllama(self.payload)
            argv = ["b7", "--run-b7", "--fixtures", str(fixture)]
            with patch.object(sys, "argv", argv), patch.dict(b7.os.environ, {}, clear=True), \
                    patch.object(b7.pathlib.Path, "home", return_value=home), \
                    patch.object(b7, "host_is_ai_server", return_value=True), \
                    patch.object(b7, "Ollama", return_value=api), \
                    patch.object(b7, "hardware", return_value={"mock": True}), \
                    patch.object(b7.signal, "signal"), patch("builtins.print"):
                self.assertEqual(b7.main(), 0)
                with self.assertRaisesRegex(B7Error, "B7_ALREADY_STARTED"):
                    b7.main()
            self.assertEqual(len(api.calls), 40)
            base = home / ".indexus-b7"
            marker = json.loads((base / "b7-started.json").read_text())
            run = pathlib.Path(marker["runDir"])
            report = json.loads((run / "report.json").read_text())
            self.assertEqual(report["hardware"], {"mock": True})
            for filename in run.iterdir():
                self.assertEqual(filename.stat().st_mode & 0o777, 0o600)
            self.assertEqual(base.stat().st_mode & 0o777, 0o700)

    def test_network_wrapper_sends_only_local_json_and_does_not_use_proxy_environment(self):
        class Response:
            status = 200
            headers = {"Content-Type": "application/json"}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b'{"version":"MOCK"}'
        api = b7.Ollama()
        with patch.object(api.opener, "open", return_value=Response()) as opened:
            self.assertEqual(api.request("/api/show", {"model": b7.MODEL}), {"version": "MOCK"})
        request = opened.call_args[0][0]
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/show")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(json.loads(request.data), {"model": b7.MODEL})


if __name__ == "__main__":
    unittest.main()
