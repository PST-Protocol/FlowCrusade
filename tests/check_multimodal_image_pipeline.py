import base64
import importlib.util
import io
import os
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = REPO_ROOT / "server" / "gemma_runner.py"
CACHE_DIR = REPO_ROOT / "models" / ".cache" / "huggingface"


def import_runner():
    spec = importlib.util.spec_from_file_location("gemma_runner", RUNNER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["gemma_runner"] = module
    spec.loader.exec_module(module)
    return module


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(CACHE_DIR))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(CACHE_DIR))
    os.environ.setdefault("HF_HUB_CACHE", str(CACHE_DIR / "hub"))
    os.environ.setdefault("HF_ASSETS_CACHE", str(CACHE_DIR / "assets"))

    runner = import_runner()
    # A tiny but normally shaped PNG. The runner should decode it to a real image object
    # before model generation, proving the native multimodal path is wired.
    from PIL import Image

    image_buffer = io.BytesIO()
    Image.new("RGB", (32, 24), "white").save(image_buffer, format="PNG")
    png_base64 = base64.b64encode(image_buffer.getvalue()).decode("ascii")
    prompt, images = runner.build_prompt_and_images(
        [
            {"text": "Read the uploaded screenshot and extract visible assignment requirements."},
            {
                "inlineData": {
                    "mimeType": "image/png",
                    "data": png_base64,
                }
            },
        ]
    )

    assert "Native image input 1" in prompt
    assert len(images) == 1
    assert images[0].mode == "RGB"
    assert images[0].size == (32, 24)

    model_dir = REPO_ROOT / "models" / "gemma-4-E2B-it"
    if (model_dir / "config.json").exists():
        from transformers import AutoProcessor

        processor = AutoProcessor.from_pretrained(
            str(model_dir),
            local_files_only=True,
            trust_remote_code=True,
            use_fast=False,
        )
        image_token = getattr(processor, "image_token", "<|image|>")
        inputs = runner.tokenize_messages(
            processor,
            [{"role": "user", "content": f"Summarize this screenshot.\n{image_token}"}],
            images,
        )
        assert "input_ids" in inputs
        assert "pixel_values" in inputs
        assert inputs["pixel_values"].shape[0] == 1

        manual_inputs = runner.build_manual_image_text_inputs(
            processor,
            processor.apply_chat_template(
                [{"role": "user", "content": f"Summarize this screenshot.\n{image_token}"}],
                add_generation_prompt=True,
                tokenize=False,
            ),
            images,
        )
        assert "input_ids" in manual_inputs
        assert "pixel_values" in manual_inputs
        assert "mm_token_type_ids" in manual_inputs

    print("Multimodal image pipeline OK: native image decoded for Gemma.")


if __name__ == "__main__":
    main()
