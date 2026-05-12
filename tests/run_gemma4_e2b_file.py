from pathlib import Path
import faulthandler
import importlib.util
import importlib.metadata
import os
import platform
import sys
import time


FILE_PATH = Path(r"C:\Users\paul2\Downloads\flowcrusade_access_build_spec.md")
REPO_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = REPO_ROOT / "models" / "gemma-4-E2B-it"
RUNNER_PATH = REPO_ROOT / "server" / "gemma_runner.py"
CACHE_DIR = MODEL_DIR / ".cache" / "huggingface"


def log(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


def import_runner():
    spec = importlib.util.spec_from_file_location("gemma_runner", RUNNER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["gemma_runner"] = module
    spec.loader.exec_module(module)
    return module


def resolve_torch_dtype(torch, dtype):
    if dtype == "float16":
        return torch.float16
    if dtype == "bfloat16":
        return torch.bfloat16
    if dtype == "float32":
        return torch.float32
    return "auto"


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


def load_model_with_logs():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(CACHE_DIR)
    os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR)
    os.environ["HF_HUB_CACHE"] = str(CACHE_DIR / "hub")
    os.environ["HF_ASSETS_CACHE"] = str(CACHE_DIR / "assets")
    os.environ["PYTHONNOUSERSITE"] = "1"
    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    os.environ.setdefault("HF_ENABLE_PARALLEL_LOADING", "false")
    os.environ.setdefault("HF_PARALLEL_LOADING_WORKERS", "1")
    os.environ.setdefault("PYTHONFAULTHANDLER", "1")

    log(f"Python: {sys.executable}")
    avoid_windows_wmi_hang()
    faulthandler.enable()
    faulthandler.dump_traceback_later(15, repeat=True)

    log("Importing torch...")
    import torch
    log(f"torch imported: {torch.__version__}")

    log("Importing transformers AutoConfig and AutoProcessor...")
    from transformers import AutoConfig, AutoProcessor
    log(f"transformers imported: {importlib.metadata.version('transformers')}")

    log(f"cuda available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        log(f"gpu: {torch.cuda.get_device_name(0)}")

    log("Loading model config...")
    AutoConfig.from_pretrained(str(MODEL_DIR), local_files_only=True, trust_remote_code=True)

    log("Loading processor/tokenizer...")
    processor = AutoProcessor.from_pretrained(
        str(MODEL_DIR),
        local_files_only=True,
        trust_remote_code=True,
    )

    log("Resolving Gemma model class...")
    try:
        from transformers import AutoModelForMultimodalLM as AutoModel
    except Exception:
        from transformers import AutoModelForImageTextToText as AutoModel

    log("Loading model weights. This can be slow for the 10GB safetensors file...")
    model = AutoModel.from_pretrained(
        str(MODEL_DIR),
        torch_dtype=resolve_torch_dtype(torch, "float16"),
        device_map=None,
        local_files_only=True,
        trust_remote_code=True,
    )

    if torch.cuda.is_available():
        log("Dispatching model with accelerate auto device map...")
        try:
            from accelerate import dispatch_model, infer_auto_device_map

            total_vram = torch.cuda.get_device_properties(0).total_memory
            safe_vram = int(total_vram * 0.82)
            device_map = infer_auto_device_map(
                model,
                max_memory={0: safe_vram, "cpu": "64GiB"},
                no_split_module_classes=getattr(type(model), "_no_split_modules", None) or [],
            )
            model = dispatch_model(model, device_map=device_map)
            log(f"Device map: {device_map}")
        except Exception as exc:
            log(f"Auto dispatch failed, continuing with default placement: {exc}")

    log("Model loaded.")
    faulthandler.cancel_dump_traceback_later()
    return processor, model


def main():
    file_text = FILE_PATH.read_text(encoding="utf-8-sig")

    prompt = f"""
Read this file and output a concise summary.

File name: {FILE_PATH.name}

File content:
{file_text}
""".strip()

    log("Loading Gemma 4 E2B...")
    processor, model = load_model_with_logs()

    runner = import_runner()
    log("Generating output...")
    output = runner.generate(processor, model, prompt, images=[], max_new_tokens=512)

    print("\n=== Gemma 4 E2B Output ===")
    print(output)


if __name__ == "__main__":
    main()
