#!/usr/bin/env python3
"""Download the configured Gemma model into the repo-local models directory."""

from __future__ import annotations

import os
import sys
from pathlib import Path


DEFAULT_MODEL_ID = "google/gemma-4-E2B-it"
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_DIR = REPO_ROOT / "models" / "gemma-4-E2B-it"


def main() -> int:
    model_id = os.environ.get("GEMMA_MODEL_ID", DEFAULT_MODEL_ID)
    model_dir = Path(os.environ.get("GEMMA_MODEL_DIR", str(DEFAULT_MODEL_DIR))).expanduser()
    if not model_dir.is_absolute():
        model_dir = REPO_ROOT / model_dir

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")

    try:
        from huggingface_hub import snapshot_download
    except Exception:
        print(
            "Missing huggingface_hub. Install it with: python -m pip install -U huggingface_hub",
            file=sys.stderr,
        )
        return 1

    model_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {model_id} into {model_dir}")
    snapshot_download(
        repo_id=model_id,
        local_dir=str(model_dir),
        local_dir_use_symlinks=False,
        token=token,
        resume_download=True,
    )
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
