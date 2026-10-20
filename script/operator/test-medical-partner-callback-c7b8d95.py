"""Local fixtures only. No production process, database, network or sudo access."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import sys
import tempfile

SCRIPT = (Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name("promote-medical-partner-callback-c7b8d95.sh")).read_text()
REAL_NODE = shutil.which("node")
REAL_PYTHON = shutil.which("python3")
ENV = {**os.environ, "DANGEROUSLY_ALLOW_GIT": "1"}

def run_case(mode):
    with tempfile.TemporaryDirectory(prefix="indexus-promotion-fixture-") as td:
        root = Path(td)
        app, run, bins = root/"app", root/"stage-run", root/"bin"
        for p in [app, run, bins]:
            p.mkdir(mode=0o700)
        stage = run/"stage"
        stage.mkdir()
        backup = app/"data"/"private-backup"
        backup.mkdir(parents=True, mode=0o700)
        for name in ["database.dump", "runtime-dist.tar.gz"]:
            (backup/name).write_text("existing opaque fixture backup")
        def git(*args):
            return subprocess.check_output(["git", *args], cwd=app, env=ENV).decode().strip()
        git("init", "-q")
        git("config", "user.name", "Fixture")
        git("config", "user.email", "fixture@example.invalid")
        (app/"server").mkdir()
        (app/"server/existing.ts").write_text("export const version = 'original';\n")
        git("add", "server")
        git("commit", "-qm", "fixture original")
        base = git("rev-parse", "HEAD")
        (app/"server/existing.ts").write_text("export const version = 'candidate';\n")
        (app/"server/added.ts").write_text("export const added = true;\n")
        git("add", "server")
        git("commit", "-qm", "fixture candidate")
        target, tree = git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}")
        shutil.copytree(app/"server", stage/"server")
        git("checkout", "-q", "-B", "release-fixture", base)
        # The service's runtime and operator files are deliberately untracked.
        (app/"operator-note.txt").write_text("must survive")
        (app/".env").write_text("OPAQUE_FIXTURE_CONFIGURATION=keep\n")
        (stage/"script").mkdir()
        for checker in ["check-release-imports.cjs", "check-release-exports.cjs"]:
            (stage/"script"/checker).write_text('console.log("FIXTURE_CONTRACT_OK");\n')
        for dist, label in [(app/"dist", "original"), (stage/"dist", "candidate")]:
            (dist/"public/assets").mkdir(parents=True)
            (dist/"index.cjs").write_text(f'const version="{label}";\n')
            (dist/"public/index.html").write_text(f"<html>{label}</html>\n")
            (dist/f"public/assets/{label}.js").write_text(label)
        old_hash = hashlib.sha256((app/"dist/index.cjs").read_bytes()).hexdigest()
        (run/"base.txt").write_text(base+"\n")
        (run/"target.txt").write_text(target+"\n")
        (run/"backup.txt").write_text(str(backup)+"\n")
        (run/"build.sha256").write_text("".join(
            hashlib.sha256(p.read_bytes()).hexdigest()+"  "+str(p.relative_to(stage))+"\n"
            for p in sorted((stage/"dist").rglob("*")) if p.is_file()))
        error_log = root/"service-error.log"
        error_log.write_text("TypeError: OLD_ERROR_MUST_NOT_APPEAR\n")
        initial = {"pid": os.getpid(), "status": "online", "restart_time": 10, "reads": 0}
        (root/"state.json").write_text(json.dumps(initial))
        # Provider/system shims exist only inside this private fixture directory.
        shim = r'''
import json, os, pathlib, sys
r=pathlib.Path(os.environ["FIXTURE_ROOT"]); mode=os.environ["FIXTURE_MODE"]
cmd=pathlib.Path(sys.argv[0]).name; a=sys.argv[1:]; app=r/"app"
if cmd=="sudo":
    if a[:2]==["-u","postgres"]: a=a[2:]
    if a[:3]==["stat","-c","%U:%a"]: print("root:700"); sys.exit(0)
    os.execvp(a[0],a)
if cmd=="findmnt": print("/dev/sdb1"); sys.exit(0)
if cmd=="df":
    print("Filesystem 1B-blocks Used Available Use% Mounted")
    print("fixture 9999999999999 0 "+("0" if mode=="diskfull" else "9999999999999")+" 0% /")
    sys.exit(0)
if cmd=="psql":
    q=a[-1]
    if "pg_database_size" in q: print("100")
    elif "CALLBACK_SCHEMA" in q: print("CALLBACK_SCHEMA=0" if mode=="schemafail" else "CALLBACK_SCHEMA=4")
    elif "to_regclass" in q: print("t")
    elif "SELECT COALESCE" in q: print("compatible" if mode=="ownerfail" else "legacy")
    else: raise Exception("Unexpected fixture SQL")
    sys.exit(0)
if cmd=="pg_dump":
    if mode=="dumpfail": print("Simulated backup failure",file=sys.stderr); sys.exit(1)
    print("CREATE TABLE fixture();" if "--schema-only" in a else "PGDMP-fixture")
    sys.exit(0)
if cmd=="pg_restore":
    assert pathlib.Path(a[-1]).read_text().startswith("PGDMP")
    sys.exit(0)
if cmd=="sleep": sys.exit(0)
if cmd=="pm2":
    p=r/"state.json"; s=json.loads(p.read_text())
    candidate="candidate" in (app/"dist/index.cjs").read_text()
    if a==["jlist"]:
        s["reads"]+=1
        if mode=="unstable" and candidate and s["status"]=="online" and s["reads"]>=2:
            s["pid"]+=1; s["restart_time"]+=1
        p.write_text(json.dumps(s))
        print(json.dumps([{"name":"indexus-crm","pm_id":4,"pid":s["pid"],
          "pm2_env":{"status":s["status"],"restart_time":s["restart_time"],
           "exec_mode":"fork_mode","pm_cwd":str(app),"pm_exec_path":str(app/"dist/index.cjs"),
           "pm_err_log_path":str(r/"service-error.log"),"SECRET_FIXTURE_ENV":"DO_NOT_EMIT_FIXTURE_ENV"}}]))
    elif a==["stop","4"]:
        s["status"]="stopped"; s["pid"]=0; p.write_text(json.dumps(s))
    elif a==["restart","4"]:
        s.update(status="online",pid=os.getppid()+100,restart_time=s["restart_time"]+1,reads=0)
        if mode=="startupfail" and candidate:
            s.update(status="errored",pid=0)
            with open(r/"service-error.log","a") as f:
                f.write("x"*200000+"\nTypeError: missingFixtureRoutes is not a function\n")
                f.write("Error: bearer MOCK_CREDENTIAL_MUST_NOT_APPEAR\n")
                f.write("Error: person@example.invalid +421912345678\n    at fixture (/private/test.cjs:1:2)\n")
        p.write_text(json.dumps(s))
    else: raise Exception("Unexpected PM2 fixture command")
    sys.exit(0)
if cmd=="curl":
    candidate="candidate" in (app/"dist/index.cjs").read_text()
    if "transition-readiness" in a[-1]: print("200" if mode=="badprotected" else "401",end="")
    else:
        out=a[a.index("-o")+1]
        pathlib.Path(out).write_bytes((app/"dist/public/index.html").read_bytes())
        print("200",end="")
    sys.exit(0)
raise Exception("Unexpected shim")
'''
        for name in ["sudo","findmnt","df","psql","pg_dump","pg_restore","sleep","pm2","curl"]:
            p=bins/name
            p.write_text(f"#!{REAL_PYTHON}\n"+shim)
            p.chmod(0o700)
        # Derive a test-only copy; production pins and checks are never loosened.
        source=SCRIPT.replace("/var/www/indexus-crm/data/.indexus-operator-backups/mp-callback-0b1bc1c-to-785f07e-ccFcrWms",str(backup))
        source=source.replace("/var/www/indexus-crm",str(app))
        source=source.replace("/home/seman/.cache/indexus-release-stage/mp-callback-c7b8d95-vOJ1EKsk",str(run))
        source=source.replace("0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e",base).replace("c7b8d95010c5b883c92e66bee8fefecbd2296dd0",target)
        source=source.replace("c3e08ddbbf1ba4a5afbec507131b4a9f4133010c",tree).replace("6d65e9750789b4b4608d0e81b59f3a49af0e520dd0df618e0c849aba6d23054b",old_hash)
        source=source.replace("== seman","== "+pwd.getpwuid(os.getuid()).pw_name).replace("len(paths) == 131","len(paths) == 2")
        source=source.replace("SECONDS+120","SECONDS+2").replace("SECONDS+90","SECONDS+2")
        test_script=root/"promotion.sh"; test_script.write_text(source)
        if mode=="collision": (app/"server/added.ts").write_text("operator-owned collision\n")
        if mode=="tampered": (stage/"server/existing.ts").write_text("tampered\n")
        env={**ENV,"PATH":str(bins)+":"+os.environ["PATH"],"FIXTURE_ROOT":str(root),"FIXTURE_MODE":mode}
        result=subprocess.run(["bash",str(test_script)],cwd=app,env=env,text=True,capture_output=True,timeout=45)
        output=result.stdout+result.stderr
        try:
            if mode=="success":
                assert result.returncode==0 and "DEPLOY_OK" in output, output
                assert git("rev-parse","HEAD")==target
                assert (app/"dist/public/assets/original.js").is_file()
                assert (app/"dist/public/assets/candidate.js").is_file()
                recovery=Path((run/"recovery.txt").read_text().strip())
                assert (recovery/"database.dump").is_file() and (recovery/"runtime-before.tar").is_file()
                assert (recovery/"runtime/dist/index.cjs").read_text()=='const version="original";\n'
            else:
                assert result.returncode!=0, output
                assert git("rev-parse","HEAD")==base, output
                assert (app/"dist/index.cjs").read_text()=='const version="original";\n',output
                assert "ROLLBACK_OK" in output if mode in {"startupfail","unstable","badprotected"} else "PRECHECK_FAILED" in output, output
                if mode=="startupfail":
                    assert "missingFixtureRoutes is not a function" in output,output
                    for secret in ["OLD_ERROR_MUST_NOT_APPEAR","MOCK_CREDENTIAL_MUST_NOT_APPEAR","person@example.invalid","+421912345678"]:
                        assert secret not in output,output
                if mode=="collision": assert (app/"server/added.ts").read_text()=="operator-owned collision\n"
                else: assert not (app/"server/added.ts").exists()
            assert (app/"operator-note.txt").read_text()=="must survive"
            assert (app/".env").read_text()=="OPAQUE_FIXTURE_CONFIGURATION=keep\n"
            assert "DO_NOT_EMIT_FIXTURE_ENV" not in output,output
        except AssertionError:
            print(output)
            raise
        print("PASS",mode)

for mode in ["success","startupfail","unstable","badprotected","collision","tampered","diskfull","dumpfail","schemafail","ownerfail"]:
    run_case(mode)
