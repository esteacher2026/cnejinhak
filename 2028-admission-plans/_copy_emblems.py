"""
Collect university emblems from source folder, normalize filenames to {대학명}.png/jpg/gif,
and copy into ./emblems/.

Strategy:
- Sources are scanned recursively from D:/진학자료/기타/기타/대학 엠블런
- Filename normalization strips:
  - "_preview_rev_1", "-removebg-preview", " 5" etc. trailing tokens
  - "[크기변환]" prefix
- For each university, prefer the top-level "_preview_rev_1" version if available,
  otherwise fall back to the subfolder versions.
- Output extension preserved (top-level are .png, subfolder ones may be .jpg/.gif/.png).
- Print a final report: matched / unmatched university names from data/universities.json.
"""
import json
import os
import re
import shutil
from pathlib import Path

SRC = Path(r"D:/진학자료/기타/기타/대학 엠블런")
DST = Path(r"D:/claude/cnejinhak/2028-admission-plans/emblems")
DATA = Path(r"D:/claude/cnejinhak/2028-admission-plans/data/universities.json")


def normalize(stem: str) -> str:
    """Strip noise tokens from a filename stem to recover the university name."""
    s = stem
    s = s.replace("[크기변환]", "")
    s = re.sub(r"-removebg-preview", "", s)
    s = re.sub(r"_preview_rev_\d+", "", s)
    s = re.sub(r"\s+\d+$", "", s)  # trailing " 5" etc
    return s.strip()


def quality(path: Path) -> int:
    """Higher = preferred. Top-level + rev_1 PNG with bg removed is best."""
    name = path.name
    score = 0
    if path.parent == SRC:
        score += 100  # top-level files are curated
    if "_preview_rev_1" in name:
        score += 50
    if "-removebg-preview" in name:
        score += 40
    if path.suffix.lower() == ".png":
        score += 20
    elif path.suffix.lower() == ".gif":
        score += 5
    return score


def main():
    DST.mkdir(parents=True, exist_ok=True)
    # Clear existing copies so the script is idempotent
    for f in DST.glob("*"):
        if f.is_file():
            f.unlink()

    # Walk source, collect all image files keyed by normalized name
    candidates: dict[str, list[Path]] = {}
    for p in SRC.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".gif"}:
            continue
        nm = normalize(p.stem)
        candidates.setdefault(nm, []).append(p)

    # Pick best candidate per normalized name (but don't copy yet — only copy
    # the ones actually matched to a university below).
    chosen: dict[str, Path] = {nm: max(lst, key=quality) for nm, lst in candidates.items()}

    # Cross-check with universities.json
    data = json.loads(DATA.read_text(encoding="utf-8"))
    uni_names = [u["name"] for u in data]

    # Manual aliases for renamed or otherwise mismatched institutions.
    # Maps data-name -> existing emblem key in `chosen`.
    ALIASES = {
        "경상국립대학교": "경상대학교",
        "한경국립대학교": "한경대학교",
        "한국공학대학교": "한국산업기술대학교",  # renamed in 2022
        "한국에너지공과대학교": "한국에너지공대",
        "한국침례신학대학교": "침례신학대학교",
        "가톨릭꽃동네대학교": "꽃동네대학교",
        "서울기독대학교": "서울기독교대학교",
        "신경주대학교": "경주대학교",
    }

    def lookup_emblem(name: str) -> str | None:
        if name in chosen:
            return name
        # strip parenthesized suffix: "건국대학교(글로컬)" -> "건국대학교"
        base = re.sub(r"\(.*?\)\s*$", "", name).strip()
        if base != name and base in chosen:
            return base
        # strip leading "국립" prefix: "국립공주대학교" -> "공주대학교"
        if name.startswith("국립"):
            stripped = name[2:]
            if stripped in chosen:
                return stripped
        # manual alias
        if name in ALIASES and ALIASES[name] in chosen:
            return ALIASES[name]
        return None

    matched = []
    unmatched = []
    # Map data-name -> emblem filename (with extension). Also collect the set
    # of emblem keys actually used so we only copy those.
    manifest: dict[str, str] = {}
    used_keys: set[str] = set()
    for nm in uni_names:
        hit = lookup_emblem(nm)
        if hit:
            matched.append((nm, hit))
            best = chosen[hit]
            ext = best.suffix.lower()
            if ext == ".jpeg":
                ext = ".jpg"
            manifest[nm] = f"{hit}{ext}"
            used_keys.add(hit)
        else:
            unmatched.append(nm)

    # Copy only the emblems that an actual university entry references.
    for key in used_keys:
        best = chosen[key]
        ext = best.suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        shutil.copy2(best, DST / f"{key}{ext}")
    (DST.parent / "data" / "emblems.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    report = []
    report.append(f"Total emblems collected: {len(chosen)}")
    report.append(f"Total universities in data: {len(uni_names)}")
    report.append(f"Matched: {len(matched)}  Unmatched: {len(unmatched)}")
    report.append("")
    report.append("=== Unmatched universities ===")
    for nm in unmatched:
        report.append(f"  - {nm}")
    report.append("")
    report.append("=== Emblems with no matching university (orphans) ===")
    matched_emblems = {hit for _, hit in matched}
    for nm in sorted(chosen.keys()):
        if nm not in matched_emblems:
            report.append(f"  - {nm}")
    Path("_emblem_report.txt").write_text("\n".join(report), encoding="utf-8")
    print("Report written to _emblem_report.txt")


if __name__ == "__main__":
    main()
