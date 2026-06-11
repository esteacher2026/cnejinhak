from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

import fitz
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
FILES_DIR = ROOT / "files"
TARGET_RE = re.compile(r"^2027-admission-guide-\d+\.pdf$", re.IGNORECASE)
TWO_MB = 2 * 1024 * 1024
SOFT_MAX_MB = 4 * 1024 * 1024


def page_count(path: Path) -> int:
    doc = fitz.open(path)
    try:
        return doc.page_count
    finally:
        doc.close()


def render_bw_pdf(src: Path, dst: Path, dpi: int, threshold: int) -> None:
    in_doc = fitz.open(src)
    out_doc = fitz.open()
    matrix = fitz.Matrix(dpi / 72, dpi / 72)

    try:
        for page in in_doc:
            pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csGRAY, alpha=False)
            image = Image.frombytes("L", (pix.width, pix.height), pix.samples)
            image = ImageOps.autocontrast(image, cutoff=0.5)
            image = image.point(lambda p: 255 if p > threshold else 0, mode="1")

            buffer = io.BytesIO()
            image.save(buffer, format="PNG", optimize=True)

            new_page = out_doc.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(page.rect, stream=buffer.getvalue())

        out_doc.save(dst, garbage=4, deflate=True, clean=True)
    finally:
        out_doc.close()
        in_doc.close()


def compress_one(src: Path, threshold: int) -> dict:
    original_size = src.stat().st_size
    original_pages = page_count(src)

    attempts: list[tuple[int, Path, int]] = []
    with tempfile.TemporaryDirectory(prefix="admission-pdf-compress-") as tmpdir:
        tmp = Path(tmpdir)
        for dpi in (120, 100):
            candidate = tmp / f"{src.stem}-bw{dpi}.pdf"
            render_bw_pdf(src, candidate, dpi=dpi, threshold=threshold)
            if page_count(candidate) != original_pages:
                raise RuntimeError(f"page count changed for {src.name} at {dpi}dpi")
            attempts.append((dpi, candidate, candidate.stat().st_size))
            if candidate.stat().st_size <= TWO_MB:
                break
            if dpi == 120 and candidate.stat().st_size <= SOFT_MAX_MB:
                break

        dpi, candidate, new_size = min(attempts, key=lambda item: (item[2] > SOFT_MAX_MB, item[2]))

        if new_size >= original_size:
            return {
                "file": src.name,
                "status": "kept-original",
                "pages": original_pages,
                "old_bytes": original_size,
                "new_bytes": original_size,
                "dpi": None,
            }

        backup = src.with_suffix(src.suffix + ".compression-backup")
        shutil.copy2(src, backup)
        shutil.copy2(candidate, src)
        backup.unlink()

        return {
            "file": src.name,
            "status": "compressed",
            "pages": original_pages,
            "old_bytes": original_size,
            "new_bytes": new_size,
            "dpi": dpi,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=int, default=190)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        fitz.TOOLS.mupdf_display_errors(False)
    except Exception:
        pass

    files = sorted(
        path for path in FILES_DIR.iterdir()
        if path.is_file() and TARGET_RE.match(path.name) and path.stat().st_size > TWO_MB
    )
    if args.offset:
        files = files[args.offset:]
    if args.limit:
        files = files[: args.limit]

    if args.dry_run:
        summary = {
            "mode": "dry-run",
            "count": len(files),
            "total_mb": round(sum(path.stat().st_size for path in files) / 1024 / 1024, 2),
            "files": [path.name for path in files],
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    results = []
    for index, src in enumerate(files, start=1):
        before_mb = src.stat().st_size / 1024 / 1024
        print(f"[{index}/{len(files)}] {src.name} {before_mb:.2f} MB", flush=True)
        result = compress_one(src, threshold=args.threshold)
        after_mb = result["new_bytes"] / 1024 / 1024
        print(f"  -> {result['status']} {after_mb:.2f} MB dpi={result['dpi']}", flush=True)
        results.append(result)

    report_path = ROOT / "tools" / "compression-report.json"
    report = {
        "target": "2027-admission-guide PDFs over 2MB",
        "threshold": args.threshold,
        "results": results,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    old_total = sum(item["old_bytes"] for item in results)
    new_total = sum(item["new_bytes"] for item in results)
    print(json.dumps({
        "processed": len(results),
        "old_mb": round(old_total / 1024 / 1024, 2),
        "new_mb": round(new_total / 1024 / 1024, 2),
        "saved_mb": round((old_total - new_total) / 1024 / 1024, 2),
        "over_2mb": sum(1 for item in results if item["new_bytes"] > TWO_MB),
        "over_4mb": sum(1 for item in results if item["new_bytes"] > SOFT_MAX_MB),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
