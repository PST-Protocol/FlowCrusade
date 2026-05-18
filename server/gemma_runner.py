#!/usr/bin/env python3
"""Local Gemma runner for FlowCrusade.

This script intentionally loads only from a local model directory. It never
downloads weights at request time, which keeps the app's inference path local.
"""

from __future__ import annotations

import argparse
import base64
import gc
import importlib
import io
import json
import os
import re
import sys
import time
import traceback
from contextlib import nullcontext
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


SUPPORTED_IMAGE_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/webp",
    "image/bmp",
    "image/gif",
    "image/tiff",
    "image/tif",
    "image/apng",
}
MAX_IMAGE_SIDE = 1800


def load_request(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def normalize_image_for_model(raw: bytes, mime_type: str):
    from PIL import Image, ImageOps

    if mime_type in {"image/heic", "image/heif"}:
        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except Exception as exc:
            raise RuntimeError(
                "HEIC/HEIF images require pillow-heif. Convert the photo to JPG/PNG or install pillow-heif."
            ) from exc

    with Image.open(io.BytesIO(raw)) as opened:
        image = ImageOps.exif_transpose(opened)
        image.load()

    if image.mode != "RGB":
        image = image.convert("RGB")

    if max(image.size) > MAX_IMAGE_SIDE:
        image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))

    return image.copy()


def build_prompt_and_images(parts: list[dict]) -> tuple[str, list[object]]:
    text_chunks: list[str] = []
    images: list[object] = []

    for part in parts:
        if isinstance(part.get("text"), str):
            text_chunks.append(part["text"])
            continue

        inline_data = part.get("inlineData") or part.get("inline_data")
        if not inline_data:
            continue

        mime_type = inline_data.get("mimeType") or inline_data.get("mime_type") or "application/octet-stream"
        mime_type = str(mime_type or "application/octet-stream").lower()
        if mime_type.startswith("image/"):
            if mime_type not in SUPPORTED_IMAGE_MIME_TYPES and mime_type not in {"image/heic", "image/heif"}:
                raise RuntimeError(f"Unsupported native image input: {mime_type}")

            try:
                raw = base64.b64decode(inline_data.get("data") or "")
                image = normalize_image_for_model(raw, mime_type)
                images.append(image)
                width, height = image.size
                text_chunks.append(
                    f"[Native image input {len(images)}: {mime_type}, {width}x{height}. "
                    "Inspect screenshots, photos, and handwriting directly.]"
                )
            except Exception as exc:  # pragma: no cover - defensive runtime reporting
                raise RuntimeError(f"Native image input could not be decoded: {mime_type}, {exc}") from exc
        else:
            text_chunks.append(f"[Uploaded file kept local but not passed as pixels: {mime_type}]")

    return "\n\n".join(chunk for chunk in text_chunks if chunk).strip(), images


def dependency_report() -> dict:
    report: dict[str, object] = {
        "python": sys.executable,
        "pythonVersion": sys.version.replace("\n", " "),
    }
    for name in ("torch", "torchvision", "transformers", "accelerate", "PIL"):
        try:
            module = importlib.import_module(name)
            report[name] = getattr(module, "__version__", "installed")
        except Exception as exc:  # pragma: no cover - diagnostic path
            report[name] = f"{type(exc).__name__}: {exc}"

    try:
        import transformers

        report["hasAutoModelForMultimodalLM"] = hasattr(transformers, "AutoModelForMultimodalLM")
        report["hasAutoModelForImageTextToText"] = hasattr(transformers, "AutoModelForImageTextToText")
        report["hasGemma4Processor"] = hasattr(transformers, "Gemma4Processor")
        report["hasGemma4ForConditionalGeneration"] = hasattr(transformers, "Gemma4ForConditionalGeneration")
    except Exception:
        pass

    return report


def resolve_torch_dtype(torch_module, dtype: str):
    normalized = (dtype or "auto").lower()
    if normalized == "auto":
        return "auto"
    if normalized in ("float16", "fp16", "half"):
        return torch_module.float16
    if normalized in ("bfloat16", "bf16"):
        return torch_module.bfloat16
    if normalized in ("float32", "fp32", "full"):
        return torch_module.float32
    raise ValueError(f"Unsupported dtype: {dtype}")


def normalize_device_map(device_map: str) -> str:
    normalized = (device_map or "auto").strip().lower()
    if normalized in {"gpu", "cuda", "cuda:0", "mps"}:
        return "auto"
    if normalized in {"auto", "balanced", "balanced_low_0", "sequential", "cpu"}:
        return normalized
    return "auto"


def is_mps_available(torch_module) -> bool:
    return getattr(torch_module.backends, "mps", None) is not None and torch_module.backends.mps.is_available()


def parse_memory_bytes(value: str | None) -> int | None:
    if not value:
        return None

    raw = value.strip().lower()
    try:
        if raw.endswith("gib"):
            return int(float(raw[:-3]) * 1024**3)
        if raw.endswith("gb"):
            return int(float(raw[:-2]) * 1000**3)
        if raw.endswith("mib"):
            return int(float(raw[:-3]) * 1024**2)
        if raw.endswith("mb"):
            return int(float(raw[:-2]) * 1000**2)
        return int(raw)
    except ValueError:
        return None


def format_gib(num_bytes: int) -> str:
    return f"{max(1, int(num_bytes / 1024**3))}GiB"


def resolve_gpu_max_memory(torch_module, gpu_memory_fraction: float, gpu_max_memory: str | None):
    explicit_bytes = parse_memory_bytes(gpu_max_memory)
    if explicit_bytes:
        return format_gib(explicit_bytes)

    total_vram = torch_module.cuda.get_device_properties(0).total_memory
    total_gib = total_vram / 1024**3
    default_fraction = 0.52 if total_gib <= 12.5 else 0.64
    fraction = gpu_memory_fraction if 0 < gpu_memory_fraction <= 0.95 else default_fraction
    usable = int(total_vram * min(fraction, default_fraction if gpu_memory_fraction <= 0 else fraction))

    # Leave a real KV-cache/activation buffer. This matters more than squeezing
    # an extra layer onto a 12GB card and avoids the recurring 1.4GiB OOM.
    reserve = int((2.2 if total_gib <= 12.5 else 3.0) * 1024**3)
    usable = min(usable, max(int(total_vram - reserve), int(total_vram * 0.45)))
    return format_gib(usable)


def build_torchao_quantization_config(quantization: str, cuda_available: bool):
    normalized = (quantization or "none").strip().lower()
    if normalized in {"", "none", "off", "false", "0"}:
        return None
    if normalized not in {"auto", "torchao", "torchao-int4", "int4", "int4_weight_only"}:
        return None
    if not cuda_available:
        return None

    try:
        from transformers import TorchAoConfig
        from torchao.quantization import Int4WeightOnlyConfig

        return TorchAoConfig(quant_type=Int4WeightOnlyConfig(group_size=128))
    except Exception as exc:
        print(f"TorchAO int4 quantization unavailable; falling back to non-quantized load. {type(exc).__name__}: {exc}", file=sys.stderr)
        return None


def should_try_manual_int8(quantization: str, cuda_available: bool) -> bool:
    normalized = (quantization or "none").strip().lower()
    return cuda_available and normalized in {"auto", "torchao", "torchao-int8", "int8", "int8_weight_only"}


def try_manual_torchao_int8(model, torch_module, quantization: str) -> bool:
    if not should_try_manual_int8(quantization, torch_module.cuda.is_available()):
        return False

    try:
        from torchao.quantization import int8_weight_only, quantize_
    except Exception as exc:
        print(f"Manual TorchAO int8 quantization unavailable. {type(exc).__name__}: {exc}", file=sys.stderr)
        return False

    linear_cls = torch_module.nn.Linear

    def filter_fn(module, fqn):
        return isinstance(module, linear_cls) and (not fqn or fqn.startswith("language_model."))

    try:
        quantize_(model, int8_weight_only(group_size=128), filter_fn=filter_fn)
        print("Using manual TorchAO int8 weight-only quantization for language layers.", file=sys.stderr)
        return True
    except Exception as exc:
        print(f"Manual TorchAO int8 quantization failed. {type(exc).__name__}: {exc}", file=sys.stderr)
        return False


def from_pretrained_with_dtype(auto_model, model_dir: Path, dtype_value, **kwargs):
    try:
        return auto_model.from_pretrained(str(model_dir), dtype=dtype_value, **kwargs)
    except TypeError:
        return auto_model.from_pretrained(str(model_dir), torch_dtype=dtype_value, **kwargs)


def load_model(model_dir: Path, device_map: str, dtype: str, gpu_memory_fraction: float, gpu_max_memory: str | None, cpu_max_memory: str, quantization: str):
    cache_dir = model_dir / ".cache" / "huggingface"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(cache_dir))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(cache_dir))
    os.environ.setdefault("HF_HUB_CACHE", str(cache_dir / "hub"))
    os.environ.setdefault("HF_ASSETS_CACHE", str(cache_dir / "assets"))
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")

    try:
        import torch
        from transformers import AutoConfig, AutoProcessor, AutoTokenizer
    except Exception as exc:
        raise RuntimeError(
            "Missing local inference dependencies. Install or upgrade transformers, torch, torchvision, accelerate, and pillow. "
            f"dependency_report={json.dumps(dependency_report(), ensure_ascii=False)}"
        ) from exc

    try:
        AutoConfig.from_pretrained(str(model_dir), local_files_only=True, trust_remote_code=True)
    except Exception as exc:
        raise RuntimeError(
            "Transformers could not load the Gemma config. This usually means the installed Transformers build "
            "does not support model_type=gemma4 yet. Try installing Transformers from source: "
            "python -m pip install -U git+https://github.com/huggingface/transformers.git. "
            f"dependency_report={json.dumps(dependency_report(), ensure_ascii=False)} original_error={type(exc).__name__}: {exc}"
        ) from exc

    try:
        processor = AutoProcessor.from_pretrained(str(model_dir), local_files_only=True, trust_remote_code=True, use_fast=False)
        if hasattr(processor, "tokenizer"):
            processor.tokenizer = AutoTokenizer.from_pretrained(
                str(model_dir),
                local_files_only=True,
                trust_remote_code=True,
                use_fast=False,
            )
    except Exception as exc:
        raise RuntimeError(
            "Transformers could not instantiate the Gemma processor from the local model directory. "
            f"dependency_report={json.dumps(dependency_report(), ensure_ascii=False)} original_error={type(exc).__name__}: {exc}"
        ) from exc

    try:
        from transformers import AutoModelForMultimodalLM as AutoModel
    except Exception:
        try:
            from transformers import AutoModelForImageTextToText as AutoModel
        except Exception as exc:
            raise RuntimeError(
                "Transformers does not expose a Gemma 4 compatible multimodal AutoModel class. "
                "Try installing Transformers from source: "
                "python -m pip install -U git+https://github.com/huggingface/transformers.git. "
                f"dependency_report={json.dumps(dependency_report(), ensure_ascii=False)}"
            ) from exc

    normalized_device_map = normalize_device_map(device_map)

    # Load to CPU with device_map=None to avoid the transformers 5.x Windows
    # access violation in core_model_loading._materialize_copy (triggered when
    # device_map is set during from_pretrained). After loading we use accelerate
    # dispatch_model to split layers across GPU+CPU so the model fits even when
    # it exceeds available VRAM.
    dtype_value = resolve_torch_dtype(torch, dtype)

    quantization_config = build_torchao_quantization_config(quantization, torch.cuda.is_available())
    if quantization_config is not None and normalized_device_map != "cpu":
        try:
            model = from_pretrained_with_dtype(
                AutoModel,
                model_dir,
                dtype_value,
                device_map="cuda:0",
                local_files_only=True,
                trust_remote_code=True,
                quantization_config=quantization_config,
            )
            model.eval()
            return processor, model
        except Exception as exc:
            print(f"TorchAO int4 quantized load failed; falling back to stable load. {type(exc).__name__}: {exc}", file=sys.stderr)

    use_mps = normalized_device_map != "cpu" and not torch.cuda.is_available() and is_mps_available(torch)
    try:
        load_kwargs = {
            "device_map": "mps" if use_mps else None,
            "local_files_only": True,
            "trust_remote_code": True,
        }
        model = from_pretrained_with_dtype(AutoModel, model_dir, dtype_value, **load_kwargs)
    except Exception as exc:
        raise RuntimeError(
            "Transformers could not instantiate the Gemma model from the local model directory. "
            f"dependency_report={json.dumps(dependency_report(), ensure_ascii=False)} original_error={type(exc).__name__}: {exc}"
        ) from exc

    model.eval()

    manual_int8 = try_manual_torchao_int8(model, torch, quantization)
    if manual_int8 and normalized_device_map != "cpu" and torch.cuda.is_available():
        try:
            model = model.to("cuda")
            return processor, model
        except Exception as exc:
            print(f"Manual int8 model could not move fully to CUDA; falling back to auto placement. {type(exc).__name__}: {exc}", file=sys.stderr)
            try:
                model = model.to("cpu")
            except Exception:
                pass

    if normalized_device_map != "cpu" and torch.cuda.is_available():
        try:
            from accelerate import dispatch_model, infer_auto_device_map

            gpu_memory = resolve_gpu_max_memory(torch, gpu_memory_fraction, gpu_max_memory)
            computed_map = infer_auto_device_map(
                model,
                max_memory={0: gpu_memory, "cpu": cpu_max_memory or "48GiB"},
                no_split_module_classes=getattr(type(model), "_no_split_modules", None) or [],
            )
            if any(str(device).lower() in {"cpu", "disk"} for device in computed_map.values()):
                print(
                    f"Auto device map requires CPU offload at gpu_memory={gpu_memory}; keeping model on CPU to avoid Windows meta-device dispatch errors.",
                    file=sys.stderr,
                )
            else:
                model = dispatch_model(model, device_map=computed_map)
        except Exception:
            pass

    return processor, model


def tokenize_messages(processor, messages: list[dict], images: list[object]):
    if not images:
        rendered = processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=False,
        )
        if isinstance(rendered, list):
            rendered = "\n".join(str(item) for item in rendered)

        rendered_text = str(rendered).encode("utf-8", errors="replace").decode("utf-8")
        tokenizer = getattr(processor, "tokenizer", processor)
        try:
            return tokenizer(rendered_text, return_tensors="pt")
        except Exception as exc:
            if "TextEncodeInput" not in str(exc):
                raise

            backend = getattr(tokenizer, "_tokenizer", None)
            if backend is None:
                raise

            import torch

            try:
                encoded = backend.encode(rendered_text, add_special_tokens=False)
            except TypeError:
                encoded = backend.encode_batch([rendered_text], add_special_tokens=False)[0]
            input_ids = torch.tensor([encoded.ids], dtype=torch.long)
            return {
                "input_ids": input_ids,
                "attention_mask": torch.ones_like(input_ids),
            }

    rendered = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=False,
    )
    if isinstance(rendered, list):
        rendered = "\n".join(str(item) for item in rendered)

    try:
        return processor(
            images=images,
            text=[str(rendered)],
            return_tensors="pt",
        )
    except Exception as exc:
        if "TextEncodeInput" not in str(exc):
            raise RuntimeError(f"Gemma image/text processor failed: {type(exc).__name__}: {exc}") from exc

        try:
            return processor(
                images=images,
                text=str(rendered),
                return_tensors="pt",
            )
        except Exception as retry_exc:
            try:
                return build_manual_image_text_inputs(processor, str(rendered), images)
            except Exception as manual_exc:
                raise RuntimeError(
                    "Gemma image/text processor failed after string retry and manual token fallback: "
                    f"{type(manual_exc).__name__}: {manual_exc}"
                ) from manual_exc


def build_manual_image_text_inputs(processor, rendered: str, images: list[object]):
    """Fallback for Gemma4Processor tokenizer edge cases on image prompts."""
    import torch

    image_inputs = processor.image_processor(images, return_tensors="pt")
    num_soft_tokens = image_inputs.pop("num_soft_tokens_per_image", None)
    if num_soft_tokens is None:
        raise RuntimeError("Gemma image processor did not return num_soft_tokens_per_image.")

    image_token = getattr(processor, "image_token", "<|image|>")
    boi_token = getattr(processor, "boi_token", "<|image>")
    eoi_token = getattr(processor, "eoi_token", "<image|>")

    replacements = [
        f"{boi_token}{image_token * int(token_count.item() if hasattr(token_count, 'item') else token_count)}{eoi_token}"
        for token_count in num_soft_tokens
    ]
    replacement_iter = iter(replacements)
    expanded_text = re.sub(re.escape(image_token), lambda _: next(replacement_iter), str(rendered))

    tokenizer = getattr(processor, "tokenizer", processor)
    try:
        text_inputs = tokenizer(text=[expanded_text], return_tensors="pt")
    except Exception:
        input_ids = tokenizer.encode(expanded_text, add_special_tokens=False, return_tensors="pt")
        text_inputs = {
            "input_ids": input_ids,
            "attention_mask": torch.ones_like(input_ids),
        }

    if hasattr(processor, "create_mm_token_type_ids"):
        text_inputs["mm_token_type_ids"] = processor.create_mm_token_type_ids(text_inputs["input_ids"])

    return {**text_inputs, **image_inputs}


def generate(processor, model, prompt: str, images: list[object], max_new_tokens: int) -> str:
    prompt = str(prompt or "")
    if images:
        image_token = getattr(processor, "image_token", "<|image|>")
        image_placeholders = "\n".join(str(image_token) for _ in images)
        content = f"{prompt}\n\n{image_placeholders}".strip()
        messages = [{"role": "user", "content": content}]
    else:
        messages = [{"role": "user", "content": prompt}]

    inputs = tokenize_messages(processor, messages, images)

    try:
        input_device = next(model.parameters()).device
    except StopIteration:
        input_device = None
    if input_device is not None:
        if hasattr(inputs, "to"):
            inputs = inputs.to(input_device)
        else:
            inputs = {
                key: value.to(input_device) if hasattr(value, "to") else value
                for key, value in inputs.items()
            }

    input_length = inputs["input_ids"].shape[-1]
    try:
        import torch

        context = torch.inference_mode()
    except Exception:  # pragma: no cover - torch import already validated
        context = nullcontext()

    with context:
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            temperature=None,
            top_p=None,
            top_k=None,
            use_cache=True,
        )
    generated = output[0][input_length:]
    text = processor.decode(generated, skip_special_tokens=True).strip()

    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    gc.collect()
    return text


def run_loaded_request(processor, model, request: dict, model_id: str, max_new_tokens: int) -> dict:
    started = time.time()
    prompt, images = build_prompt_and_images(request.get("parts") or [])
    if not prompt:
        raise RuntimeError("Request did not contain prompt text.")

    text = generate(processor, model, prompt, images, max(1, max_new_tokens))
    return {
        "ok": True,
        "requestId": request.get("requestId"),
        "text": text,
        "meta": {
            "provider": "gemma",
            "model": model_id,
            "local": True,
            "latencyMs": round((time.time() - started) * 1000),
            "imageInputs": len(images),
        },
    }


def serve(args) -> int:
    model_dir = Path(args.model_dir)
    if not (model_dir / "config.json").exists():
        print(f"Model directory is missing config.json: {model_dir}", file=sys.stderr)
        return 2

    try:
        processor, model = load_model(
            model_dir,
            args.device_map,
            args.dtype,
            args.gpu_memory_fraction,
            args.gpu_max_memory,
            args.cpu_max_memory,
            args.quantization,
        )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps({"ready": True, "model": args.model_id}, ensure_ascii=False), flush=True)

    for line in sys.stdin:
        if not line.strip():
            continue

        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("requestId")
            max_new_tokens = int(request.get("maxNewTokens") or args.max_new_tokens)
            response = run_loaded_request(processor, model, request, args.model_id, max_new_tokens)
        except Exception as exc:
            tb = traceback.format_exc()
            response = {
                "ok": False,
                "requestId": request_id,
                "error": str(exc),
                "traceback": tb,
            }
            print(tb, file=sys.stderr, flush=True)

        print(json.dumps(response, ensure_ascii=False), flush=True)

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--request-file")
    parser.add_argument("--max-new-tokens", type=int, default=900)
    parser.add_argument("--device-map", default="cpu")
    parser.add_argument("--dtype", default="float16")
    parser.add_argument("--quantization", default="auto")
    parser.add_argument("--gpu-memory-fraction", type=float, default=0.58)
    parser.add_argument("--gpu-max-memory")
    parser.add_argument("--cpu-max-memory", default="48GiB")
    parser.add_argument("--serve", action="store_true")
    args = parser.parse_args()

    if args.serve:
        return serve(args)

    started = time.time()
    model_dir = Path(args.model_dir)
    if not (model_dir / "config.json").exists():
        print(f"Model directory is missing config.json: {model_dir}", file=sys.stderr)
        return 2
    if not args.request_file:
        print("--request-file is required unless --serve is used.", file=sys.stderr)
        return 2

    request = load_request(Path(args.request_file))
    prompt, images = build_prompt_and_images(request.get("parts") or [])
    if not prompt:
        print("Request did not contain prompt text.", file=sys.stderr)
        return 2

    try:
        processor, model = load_model(
            model_dir,
            args.device_map,
            args.dtype,
            args.gpu_memory_fraction,
            args.gpu_max_memory,
            args.cpu_max_memory,
            args.quantization,
        )
        text = generate(processor, model, prompt, images, max(1, args.max_new_tokens))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "text": text,
                "meta": {
                    "provider": "gemma",
                    "model": args.model_id,
                    "local": True,
                    "latencyMs": round((time.time() - started) * 1000),
                    "imageInputs": len(images),
                },
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
