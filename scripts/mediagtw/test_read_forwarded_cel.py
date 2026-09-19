import csv
import gzip
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
READER = HERE / "read-forwarded-cel.py"
spec = importlib.util.spec_from_file_location("reader", READER)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class ReaderTests(unittest.TestCase):
    def write_rows(self, path, rows, zipped=False):
        opener = gzip.open if zipped else open
        with opener(path, "wt", encoding="utf-8", newline="") as output:
            csv.writer(output, quoting=csv.QUOTE_ALL).writerows(rows)

    def test_rotation_order_redaction_and_fractional_time(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / "IndexusForwarded.csv"
            old_channel = "PJSIP/+441234-00000001"
            local_channel = "Local/secret-name@context-0001;1"
            row_old = ["CHAN_START", "1700000000.000001", "u1", "l1", old_channel, "",
                       "", '{"bridge_id":"b-1","secret":"phone 123"}']
            row_new = ["HANGUP", "1700000001.123456", "u1", "l1", local_channel,
                       f"{old_channel}, {local_channel}", "", '{"hangupcause":16,"dialstatus":"ANSWER"}']
            self.write_rows(Path(str(base) + ".2.gz"), [row_old], zipped=True)
            self.write_rows(base, [row_new])
            events = reader.read_events(base)
            self.assertEqual([event["eventType"] for event in events], ["CHAN_START", "HANGUP"])
            self.assertEqual(events[0]["eventTime"], "2023-11-14T22:13:20.000001Z")
            self.assertRegex(events[0]["channel"], r"^PJSIP/[0-9a-f]{64}$")
            self.assertRegex(events[1]["channel"], r"^Local/[0-9a-f]{64}$")
            self.assertNotIn("+441234", json.dumps(events))
            self.assertEqual(events[0]["extra"], '{"bridge_id":"b-1"}')
            self.assertEqual(len(events[1]["peer"].split(",")), 2)

    def test_bad_timestamp_is_explicit_without_row_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / "IndexusForwarded.csv"
            secret = "PJSIP/441234"
            self.write_rows(base, [["ANSWER", "not-a-time", "u", "l", secret, "", "", "{}"]])
            with self.assertRaisesRegex(reader.InputError, "malformed timestamp") as raised:
                reader.read_events(base)
            self.assertNotIn(secret, str(raised.exception))

    def test_permission_failure_does_not_leak_path_or_data(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / "private-phone-name.csv"
            base.write_text("sensitive subscriber data", encoding="utf-8")
            with mock.patch("builtins.open", side_effect=PermissionError("secret path/data")):
                with self.assertRaisesRegex(reader.InputError, "^CEL spool cannot be read$") as raised:
                    reader.read_events(base)
            message = str(raised.exception)
            self.assertNotIn(str(base), message)
            self.assertNotIn("secret", message)

    def test_arguments_rejected(self):
        result = subprocess.run([sys.executable, READER, "anything"], text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.assertEqual(result.returncode, 2)
        self.assertIn("arguments are not accepted", result.stderr)

    def test_malformed_row_and_row_bound_are_not_partial(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / "IndexusForwarded.csv"
            self.write_rows(base, [["too", "short"]])
            with self.assertRaisesRegex(reader.InputError, "malformed CEL row"):
                reader.read_events(base)
            row = ["ANSWER", "1.000000", "u", "l", "", "", "", "{}"]
            self.write_rows(base, [row, row])
            original = reader.MAX_ROWS
            reader.MAX_ROWS = 1
            try:
                with self.assertRaisesRegex(reader.InputError, "row limit"):
                    reader.read_events(base)
            finally:
                reader.MAX_ROWS = original


if __name__ == "__main__":
    unittest.main()