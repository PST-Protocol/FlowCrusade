import faulthandler
import importlib.metadata
import os
import platform
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = REPO_ROOT / "models" / ".cache" / "huggingface"


def log(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


def avoid_windows_wmi_hang():
    if os.name != "nt":
        return

    platform.system = lambda: "Windows"
    platform.win32_ver = lambda: ("10", "10.0", "", "Multiprocessor Free")
    platform.machine = lambda: "AMD64"
    platform.processor = lambda: "AMD64"
    platform.node = lambda: os.environ.get("COMPUTERNAME", "")
    platform.release = lambda: "10"
    platform.version = lambda: "10.0"
    try:
        platform.uname = lambda: platform.uname_result(
            "Windows",
            os.environ.get("COMPUTERNAME", ""),
            "10",
            "10.0",
            "AMD64",
            "AMD64",
        )
    except AttributeError:
        platform.uname = lambda: ("Windows", os.environ.get("COMPUTERNAME", ""), "10", "10.0", "AMD64", "AMD64")


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(CACHE_DIR)
    os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR)
    os.environ["HF_HUB_CACHE"] = str(CACHE_DIR / "hub")
    os.environ["HF_ASSETS_CACHE"] = str(CACHE_DIR / "assets")
    os.environ["PYTHONNOUSERSITE"] = "1"

    faulthandler.enable()
    faulthandler.dump_traceback_later(30, repeat=True)

    log(f"Python: {sys.executable}")
    avoid_windows_wmi_hang()

    log("Importing torch...")
    import torch
    log(f"torch imported: {torch.__version__}")
    log(f"cuda available: {torch.cuda.is_available()}")

    log("Importing transformers...")
    import transformers
    log(f"transformers imported: {importlib.metadata.version('transformers')}")
    log(f"has AutoModelForMultimodalLM: {hasattr(transformers, 'AutoModelForMultimodalLM')}")
    log(f"has AutoModelForImageTextToText: {hasattr(transformers, 'AutoModelForImageTextToText')}")

    faulthandler.cancel_dump_traceback_later()
    log("Import check finished.")


if __name__ == "__main__":
    main()
