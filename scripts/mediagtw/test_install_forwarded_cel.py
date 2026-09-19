import hashlib
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
INSTALLER = HERE / "install-forwarded-cel.sh"


class InstallerTests(unittest.TestCase):
    def fixture(self, root: Path, dateformat=""):
        etc = root / "etc/asterisk"
        etc.mkdir(parents=True)
        (etc / "cel.conf").write_text(
            "[general]\n"
            "enable=no\n"
            "events=USER_DEFINED\n"
            "apps=queue\n"
            f"dateformat={dateformat}\n",
            encoding="utf-8",
        )
        (etc / "cel_custom.conf").write_text(
            "[mappings]\nLegacy.csv => existing-consumer\n", encoding="utf-8"
        )
        (etc / "modules.conf").write_text("[modules]\nautoload=yes\n", encoding="utf-8")
        marker = root / "etc/asterisk/extensions.conf"
        marker.write_text("dialplan and trunk marker\n", encoding="utf-8")
        cli = root / "fake-asterisk"
        cli.write_text(
            "#!/bin/sh\n"
            "if [ \"${ASTERISK_FAKE_FAIL:-}\" = yes ]; then\n"
            "  case \"$2\" in *'module show'*) echo '0 modules loaded'; exit 0;; esac\n"
            "  exit 9\n"
            "fi\n"
            "echo 'cel_custom.so custom CEL 0 Running core'\n",
            encoding="utf-8",
        )
        cli.chmod(0o755)
        return marker

    def run_installer(self, root: Path, **extra):
        env = dict(os.environ, INDEXUS_INSTALL_TEST_ROOT=str(root), **extra)
        return subprocess.run(
            [INSTALLER], env=env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

    @staticmethod
    def digest(path: Path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def test_idempotent_rerun_and_no_dialplan_or_trunk_touch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = self.fixture(root)
            marker_before = (self.digest(marker), marker.stat().st_mtime_ns)
            first = self.run_installer(root)
            self.assertEqual(first.returncode, 0, first.stderr)
            tracked = [
                root / "etc/asterisk/cel.conf",
                root / "etc/asterisk/cel_custom.conf",
                root / "usr/local/libexec/indexus-read-forwarded-cel",
                root / "var/log/asterisk/cel-custom/IndexusForwarded.csv",
            ]
            before = [(self.digest(path), path.stat().st_mtime_ns) for path in tracked]
            second = self.run_installer(root)
            self.assertEqual(second.returncode, 0, second.stderr)
            after = [(self.digest(path), path.stat().st_mtime_ns) for path in tracked]
            self.assertEqual(before, after)
            self.assertEqual(marker_before, (self.digest(marker), marker.stat().st_mtime_ns))
            cel = tracked[0].read_text(encoding="utf-8")
            self.assertIn("USER_DEFINED", cel)
            self.assertIn("LINKEDID_END", cel)
            self.assertIn("apps=queue,dial", cel)

    def test_refused_preflight_leaves_every_file_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, dateformat="%F %T")
            files = sorted(path for path in root.rglob("*") if path.is_file())
            before = {path.relative_to(root): self.digest(path) for path in files}
            result = self.run_installer(root)
            self.assertNotEqual(result.returncode, 0)
            after_files = sorted(path for path in root.rglob("*") if path.is_file())
            after = {path.relative_to(root): self.digest(path) for path in after_files}
            self.assertEqual(before, after)

    def test_post_edit_failure_rolls_back_only_installer_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = self.fixture(root)
            libexec = root / "usr/local/libexec"
            spool = root / "var/log/asterisk/cel-custom"
            libexec.mkdir(parents=True)
            spool.mkdir(parents=True)
            helper = libexec / "indexus-read-forwarded-cel"
            cel_file = spool / "IndexusForwarded.csv"
            helper.write_text("old helper\n", encoding="utf-8")
            cel_file.write_text("old evidence\n", encoding="utf-8")
            tracked = [root / "etc/asterisk/cel.conf",
                       root / "etc/asterisk/cel_custom.conf", helper, cel_file, marker]
            before = {path: self.digest(path) for path in tracked}
            result = self.run_installer(root, ASTERISK_FAKE_FAIL="yes")
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(before, {path: self.digest(path) for path in tracked})


if __name__ == "__main__":
    unittest.main()