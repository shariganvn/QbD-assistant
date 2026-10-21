import subprocess
import sys


def test_help_runs():
    cmd = [sys.executable, "-m", "qbd_core", "--help"]
    out = subprocess.run(cmd, capture_output=True, text=True)
    assert out.returncode == 0
    assert "qbd_core" in out.stdout
