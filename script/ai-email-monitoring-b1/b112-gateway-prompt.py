"""Operator-only B1.12 SYSTEM handoff fix. No inference, model or CRM writes."""
import ast
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

MODEL = "indexus-email-monitoring:v1"
SOURCE_SHA = "406d1adf3b415d5cf3efbbaf2b9bb7eb8ae545811b7def0db63475c7a8345b6b"
MODEL_SHA = "458394524be09c0ce6abf474ed1c2703aab52311a44b53ab9c7fad2628f92f72"
POLICY_SHA = "50619c06ebd79369b5bd2d584dddeba057b4df2da378168ca32d729a095b298f"
UNIT = "indexus-ai-gateway.service"

def sha(data):
    return hashlib.sha256(data).hexdigest()

def require(ok, code):
    if not ok:
        raise RuntimeError(code)

def fingerprint(profile):
    return (profile.st_dev, profile.st_ino, profile.st_uid, profile.st_gid,
        profile.st_mode, profile.st_size, profile.st_mtime_ns, profile.st_ctime_ns)

def transform(source, policy):
    tree = ast.parse(source)
    expression = ast.dump(ast.parse("[m.model_dump() for m in payload.messages]", mode="eval").body)
    candidates = [n for n in ast.walk(tree) if isinstance(n, ast.Assign)
        and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)
        and n.targets[0].id == "messages" and ast.dump(n.value) == expression]
    require(len(candidates) == 1, "B112_MESSAGES_ASSIGNMENT_NOT_UNIQUE")
    node = candidates[0]
    owners = [(n, field, value.index(node)) for n in ast.walk(tree)
        for field, value in ast.iter_fields(n) if isinstance(value, list) and node in value]
    require(len(owners) == 1, "B112_MESSAGES_BLOCK_NOT_UNIQUE")
    owner, field, index = owners[0]
    body = getattr(owner, field)
    require(index + 1 < len(body), "B112_PAYLOAD_NOT_ADJACENT")
    following = body[index + 1]
    targets = following.targets if isinstance(following, ast.Assign) else [getattr(following, "target", None)]
    require(any(isinstance(t, ast.Name) and t.id == "ollama_payload" for t in targets)
        and isinstance(getattr(following, "value", None), ast.Dict), "B112_PAYLOAD_NOT_ADJACENT")
    fields = {k.value: v for k, v in zip(following.value.keys, following.value.values) if isinstance(k, ast.Constant)}
    require(ast.dump(fields.get("messages", ast.Constant(None))) == ast.dump(ast.Name(id="messages", ctx=ast.Load()))
        and ast.dump(fields.get("model", ast.Constant(None))) == ast.dump(ast.parse("payload.model", mode="eval").body),
        "B112_PAYLOAD_MAPPING_CHANGED")
    lines = source.splitlines(keepends=True)
    require(lines[node.end_lineno - 1].endswith(b"\n"), "B112_SOURCE_NEWLINE_REQUIRED")
    indent = lines[node.lineno - 1][:node.col_offset]
    require(not indent.strip(), "B112_MESSAGES_INDENT_CHANGED")
    offset = sum(map(len, lines[:node.end_lineno]))
    inserted = (indent + ("if payload.model == " + repr(MODEL) + ":\n").encode()
        + indent + b"    messages = [{'role': 'system', 'content': " + repr(policy).encode()
        + b"}] + [message for message in messages if message.get('role') != 'system']\n")
    updated = source[:offset] + inserted + source[offset:]
    changed = ast.parse(updated)
    sanitized = copy.deepcopy(changed)
    # Locate the original assignment structurally and remove ONLY its new sibling.
    for n in ast.walk(sanitized):
        for key, values in ast.iter_fields(n):
            if isinstance(values, list):
                for i, value in enumerate(values):
                    if isinstance(value, ast.Assign) and ast.dump(value) == ast.dump(node):
                        require(i + 1 < len(values) and isinstance(values[i + 1], ast.If), "B112_INSERTION_NOT_VERIFIED")
                        del values[i + 1]
                        require(ast.dump(tree) == ast.dump(sanitized), "B112_NON_EMAIL_CHANGE_REFUSED")
                        compile(updated, "main.py", "exec")
                        return updated
    raise RuntimeError("B112_INSERTION_NOT_VERIFIED")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError("B112_METADATA_REDIRECT_REFUSED")

def model_policy(base):
    u = urllib.parse.urlsplit(base)
    require(u.scheme == "http" and u.hostname in ("127.0.0.1", "localhost") and u.port == 11434
        and u.path in ("", "/") and not (u.username or u.password or u.query or u.fragment), "B112_OLLAMA_URL_REFUSED")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    def metadata(route, value=None):
        body = None if value is None else json.dumps(value).encode()
        request = urllib.request.Request(base.rstrip("/") + route, data=body,
            headers={"Content-Type": "application/json"} if body else {})
        with opener.open(request, timeout=15) as response:
            data = response.read(4 * 1024 * 1024 + 1)
        require(len(data) <= 4 * 1024 * 1024, "B112_METADATA_TOO_LARGE")
        return json.loads(data)
    models = [m for m in metadata("/api/tags").get("models", []) if m.get("name") == MODEL]
    require(len(models) == 1 and models[0].get("digest", "").removeprefix("sha256:") == MODEL_SHA, "B112_MODEL_DIGEST_CHANGED")
    policy = metadata("/api/show", {"model": MODEL}).get("system")
    require(isinstance(policy, str) and sha(policy.encode()) == POLICY_SHA, "B112_MODEL_POLICY_CHANGED")
    return policy

def command(args):
    return subprocess.check_output(args, text=True, timeout=70, stderr=subprocess.DEVNULL).strip()

def process():
    pid = int(command(["systemctl", "show", UNIT, "--property=MainPID", "--value"]))
    require(pid > 1 and Path("/proc", str(pid), "cwd").resolve() == Path("/opt/indexus-ai-gateway"), "B112_GATEWAY_PROCESS_MISMATCH")
    return pid

def listeners(pid):
    inodes = set()
    for fd in Path("/proc", str(pid), "fd").iterdir():
        try:
            match = re.fullmatch(r"socket:\[(\d+)\]", os.readlink(fd))
            if match:
                inodes.add(match.group(1))
        except FileNotFoundError:
            pass
    ports = set()
    for table in ("tcp", "tcp6"):
        for line in Path("/proc/net", table).read_text().splitlines()[1:]:
            row = line.split()
            if len(row) > 9 and row[3] == "0A" and row[9] in inodes:
                ports.add(int(row[1].split(":")[1], 16))
    return ports

def atomic(file, data, profile):
    fd, name = tempfile.mkstemp(prefix="B112-stage-", dir=file.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            os.fchmod(handle.fileno(), stat.S_IMODE(profile.st_mode))
            os.fchown(handle.fileno(), profile.st_uid, profile.st_gid)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, file)
    finally:
        if os.path.exists(name):
            os.unlink(name)

def cutover(file, old, new, profile, restart, verify):
    require(file.read_bytes() == old, "B112_GATEWAY_CHANGED_BEFORE_WRITE")
    try:
        atomic(file, new, profile)
        restart()
        return verify()
    except BaseException:
        require(file.read_bytes() in (old, new), "B112_CONCURRENT_CHANGE_MANUAL_RECOVERY_REQUIRED")
        try:
            atomic(file, old, profile)
            restart()
            verify()
        except BaseException:
            raise RuntimeError("B112_RECOVERY_FAILED_KEEP_PRIVATE_BACKUP")
        raise RuntimeError("B112_NEW_GATEWAY_FAILED_ORIGINAL_RESTORED")

def main():
    require(sys.argv[1:] == ["--apply"], "B112_EXPLICIT_APPLY_REQUIRED")
    require(os.geteuid() == 0 and os.uname().nodename.split(".")[0].lower() == "ai", "B112_ROOT_ON_AI_REQUIRED")
    os.umask(0o077)
    lock_fd = os.open("/run/lock/indexus-b112-prompt.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        file = Path("/opt/indexus-ai-gateway/main.py")
        require(not file.is_symlink(), "B112_GATEWAY_SYMLINK_REFUSED")
        profile = file.stat()
        require(stat.S_ISREG(profile.st_mode) and profile.st_uid == 0 and not profile.st_mode & 0o022, "B112_GATEWAY_PERMISSIONS_UNSAFE")
        old = file.read_bytes()
        require(sha(old) == SOURCE_SHA, "B112_GATEWAY_SOURCE_CHANGED")
        old_pid = process()
        ports = listeners(old_pid)
        require(bool(ports), "B112_GATEWAY_LISTENER_NOT_CONFIRMED")
        env = Path("/proc", str(old_pid), "environ").read_bytes()
        found = re.search(rb"(?:^|\0)OLLAMA_BASE_URL=([^\0]*)", env)
        require(found is not None, "B112_OLLAMA_PROCESS_BASE_MISSING")
        policy = model_policy(found.group(1).decode())
        new = transform(old, policy)
        backup = Path(tempfile.mkdtemp(prefix="INDEXUS-B112-prompt-", dir="/root"))
        backup.joinpath("main.py").write_bytes(old)
        backup.joinpath("candidate.py").write_bytes(new)
        require(sha(backup.joinpath("main.py").read_bytes()) == SOURCE_SHA, "B112_BACKUP_INVALID")
        print("B112_PRIVATE_BACKUP " + str(backup), flush=True)
        require(process() == old_pid and fingerprint(file.stat()) == fingerprint(profile), "B112_GATEWAY_CHANGED_DURING_PREPARATION")
        def restart():
            command(["systemctl", "restart", UNIT])
        def verify():
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                try:
                    current = process()
                    if current != old_pid and listeners(current) == ports:
                        time.sleep(1)
                        if process() == current and listeners(current) == ports:
                            return current
                except Exception:
                    pass
                time.sleep(0.5)
            raise RuntimeError("B112_GATEWAY_STARTUP_NOT_VERIFIED")
        new_pid = cutover(file, old, new, profile, restart, verify)
        require(file.read_bytes() == new, "B112_SOURCE_CHANGED_AFTER_RESTART")
        result = {"status": "APPLIED_B112_SYSTEM_NOT_FUNCTIONALLY_VERIFIED", "unit": UNIT,
            "gatewayBeforeSha256": SOURCE_SHA, "gatewayAfterSha256": sha(new), "rulesSha256": POLICY_SHA,
            "ollamaDigest": MODEL_SHA, "oldPid": old_pid, "newPid": new_pid, "listenPorts": sorted(ports),
            "backup": str(backup), "startupCheck": "NEW_PID_SAME_LISTEN_PORTS",
            "otherModelBranchesChanged": False, "modelRebuilt": False, "inferenceCalls": 0,
            "crmAccess": False, "productionRoutingWrites": 0, "ready": False}
        backup.joinpath("result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        code = str(error) if re.fullmatch(r"B112_[A-Z0-9_]+", str(error)) else "B112_APPLY_FAILED_PRIVATE_DETAILS_NOT_PRINTED"
        print(json.dumps({"status": "STOPPED_NOT_READY", "error": code, "inferenceCalls": 0, "ready": False}))
        raise SystemExit(1)
