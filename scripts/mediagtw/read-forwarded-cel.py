#!/usr/bin/env python3
"""Read the bounded, retained Indexus CEL CSV set and emit sanitized JSON."""

import csv
import datetime
import decimal
import gzip
import hashlib
import io
import json
import re
import sys
from pathlib import Path

DEFAULT_PATH = "/var/log/asterisk/cel-custom/IndexusForwarded.csv"
MAX_ROWS = 250_000
MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_OUTPUT_BYTES = 32 * 1024 * 1024
FIELDS = (
    "eventType", "eventTime", "uniqueId", "linkedId",
    "channel", "peer", "application", "extra",
)
SAFE_EXTRA = {
    "bridge_id": re.compile(r"^[A-Za-z0-9_.:-]{0,128}$"),
    "dialstatus": re.compile(r"^[A-Za-z0-9_.:-]{0,128}$"),
    "hangupcause": re.compile(r"^[A-Za-z0-9_.:-]{0,128}$"),
}


class InputError(Exception):
    pass


class LimitedReader(io.RawIOBase):
    """Apply one decompressed-byte budget across all retained inputs."""

    def __init__(self, source, budget):
        self.source = source
        self.budget = budget

    def readable(self):
        return True

    def readinto(self, target):
        allowance = self.budget[0]
        data = self.source.read(min(len(target), allowance + 1))
        if len(data) > allowance:
            raise InputError("CEL input byte limit exceeded")
        self.budget[0] -= len(data)
        target[:len(data)] = data
        return len(data)

    def close(self):
        try:
            self.source.close()
        finally:
            super().close()


def retained_files(base: Path):
    candidates = []
    if base.parent.exists():
        escaped = re.escape(base.name)
        pattern = re.compile(rf"^{escaped}\.(\d+)(?:\.gz)?$")
        for item in base.parent.iterdir():
            match = pattern.match(item.name)
            if match and item.is_file():
                candidates.append((int(match.group(1)), item))
    # Higher rotation numbers are older.
    candidates.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in candidates] + ([base] if base.is_file() else [])


def redact_channel(value: str) -> str:
    if not value:
        return ""
    kind = "Local" if value.startswith("Local/") else "PJSIP"
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"{kind}/{digest}"


def redact_peers(value: str) -> str:
    if not value:
        return ""
    return ",".join(redact_channel(part.strip()) for part in value.split(",") if part.strip())


def iso_timestamp(value: str) -> str:
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]{1,6})?", value):
        raise InputError("malformed timestamp")
    try:
        epoch = decimal.Decimal(value)
        seconds = int(epoch)
        fraction = epoch - seconds
        micros = int(fraction * decimal.Decimal(1_000_000))
        moment = datetime.datetime.fromtimestamp(
            seconds, tz=datetime.timezone.utc
        ).replace(microsecond=micros)
    except (ValueError, OverflowError, OSError, decimal.InvalidOperation):
        raise InputError("malformed timestamp") from None
    return moment.isoformat(timespec="microseconds").replace("+00:00", "Z")


def sanitize_extra(value: str) -> str:
    if not value:
        return "{}"
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return "{}"
    if not isinstance(parsed, dict):
        return "{}"
    clean = {}
    for key, validator in SAFE_EXTRA.items():
        item = parsed.get(key)
        if isinstance(item, (int, float)) and not isinstance(item, bool):
            item = str(item)
        if isinstance(item, str) and validator.fullmatch(item):
            clean[key] = item
    return json.dumps(clean, separators=(",", ":"), sort_keys=True)


def read_events(base: Path):
    files = retained_files(base)
    if not files:
        raise InputError("CEL spool is unavailable")
    total_bytes = sum(item.stat().st_size for item in files)
    if total_bytes > MAX_INPUT_BYTES:
        raise InputError("CEL input byte limit exceeded")

    events = []
    estimated_output = len('{"events":[]}') + 1
    input_budget = [MAX_INPUT_BYTES]
    for item in files:
        try:
            binary = gzip.open(item, "rb") if item.suffix == ".gz" else open(item, "rb")
            stream = io.TextIOWrapper(
                io.BufferedReader(LimitedReader(binary, input_budget)),
                encoding="utf-8",
                newline="",
            )
            with stream:
                for row in csv.reader(stream):
                    if len(events) >= MAX_ROWS:
                        raise InputError("CEL row limit exceeded")
                    if len(row) != len(FIELDS):
                        raise InputError("malformed CEL row")
                    event = dict(zip(FIELDS, row))
                    event["eventTime"] = iso_timestamp(event["eventTime"])
                    event["channel"] = redact_channel(event["channel"])
                    event["peer"] = redact_peers(event["peer"])
                    event["extra"] = sanitize_extra(event["extra"])
                    encoded_size = len(
                        json.dumps(event, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
                    )
                    estimated_output += encoded_size + 1
                    if estimated_output > MAX_OUTPUT_BYTES:
                        raise InputError("CEL output byte limit exceeded")
                    events.append(event)
        except (OSError, UnicodeError, csv.Error) as error:
            raise InputError("CEL spool cannot be read") from error
    return events


def main():
    if len(sys.argv) != 1:
        raise InputError("arguments are not accepted")
    events = read_events(Path(DEFAULT_PATH))
    output = json.dumps({"events": events}, ensure_ascii=True, separators=(",", ":"))
    if len(output.encode("utf-8")) > MAX_OUTPUT_BYTES:
        raise InputError("CEL output byte limit exceeded")
    sys.stdout.write(output)


if __name__ == "__main__":
    try:
        main()
    except InputError as error:
        print(f"indexus CEL reader error: {error}", file=sys.stderr)
        raise SystemExit(2)