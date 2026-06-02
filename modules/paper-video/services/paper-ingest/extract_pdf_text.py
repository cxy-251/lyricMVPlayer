from __future__ import annotations

import argparse
from pathlib import Path

try:
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover - import-time environment check
    raise SystemExit(
        "pypdf is required for PDF text extraction. "
        "Install it in the active Python runtime with `pip install pypdf`."
    ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract plain text from a PDF file")
    parser.add_argument("--input-pdf", required=True, help="Absolute or relative PDF path")
    parser.add_argument("--output-text", required=True, help="Output text path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_pdf = Path(args.input_pdf).expanduser().resolve()
    output_text = Path(args.output_text).expanduser().resolve()
    output_text.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(input_pdf))
    chunks: list[str] = []

    for page in reader.pages:
        extracted = page.extract_text() or ""
        chunks.append(extracted.strip())

    output_text.write_text("\n\n".join(chunk for chunk in chunks if chunk), encoding="utf-8")


if __name__ == "__main__":
    main()
