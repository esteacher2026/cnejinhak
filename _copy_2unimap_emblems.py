"""
Copy 전문대 emblems from source folder into 2unimap-emblems/, normalized
to {대학명}.{ext}, and write a manifest 2unimap-emblems.json.

The 2unimap.html page consumes the manifest and replaces its inline
procollege.kr `logo` URLs with local files where available, falling back
to the remote URL for the few unmatched institutions.

Re-runnable: clears the destination folder each run so removing a name
from 2unimap.html (or fixing an alias) prunes correctly.
"""
import json
import re
import shutil
from pathlib import Path

SRC = Path(r"D:/진학자료/기타/기타/대학 엠블런")
ROOT = Path(r"D:/claude/cnejinhak")
DST = ROOT / "2unimap-emblems"
HTML = ROOT / "2unimap.html"
MANIFEST = ROOT / "2unimap-emblems.js"


def normalize(stem: str) -> str:
    s = stem
    s = s.replace("[크기변환]", "")
    s = re.sub(r"-removebg-preview", "", s)
    s = re.sub(r"_preview_rev_\d+", "", s)
    s = re.sub(r"\s+\d+$", "", s)
    return s.strip()


def quality(path: Path) -> int:
    name = path.name
    score = 0
    if path.parent == SRC:
        score += 100
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
    for f in DST.glob("*"):
        if f.is_file():
            f.unlink()

    # Collect all source images, dedupe to best candidate per normalized name
    candidates: dict[str, list[Path]] = {}
    for p in SRC.rglob("*"):
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif"}:
            candidates.setdefault(normalize(p.stem), []).append(p)
    chosen: dict[str, Path] = {nm: max(lst, key=quality) for nm, lst in candidates.items()}

    # Extract DATA from 2unimap.html
    text = HTML.read_text(encoding="utf-8")
    m = re.search(r"const\s+DATA\s*=\s*(\[.*?\]);", text, flags=re.DOTALL)
    if not m:
        raise SystemExit("Could not locate `const DATA = [...]` in 2unimap.html")
    data = json.loads(m.group(1))

    # Aliases for 전문대 names that differ from the source-folder names
    ALIASES = {
        "재능대학교": "인천재능대학교",
        "아주자동차대학교": "아주자동차대학",
        "한국골프과학기술대학교": "한국골프대학교",
    }

    def lookup(name: str) -> str | None:
        if name in chosen:
            return name
        base = re.sub(r"\(.*?\)\s*$", "", name).strip()
        if base != name and base in chosen:
            return base
        if name in ALIASES and ALIASES[name] in chosen:
            return ALIASES[name]
        return None

    manifest: dict[str, str] = {}
    used_keys: set[str] = set()
    unmatched: list[str] = []
    for d in data:
        nm = d["name"]
        hit = lookup(nm)
        if hit:
            best = chosen[hit]
            ext = best.suffix.lower()
            if ext == ".jpeg":
                ext = ".jpg"
            manifest[nm] = f"{hit}{ext}"
            used_keys.add(hit)
        else:
            unmatched.append(nm)

    for key in used_keys:
        best = chosen[key]
        ext = best.suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        shutil.copy2(best, DST / f"{key}{ext}")

    # Emit as JS so 2unimap.html can <script src=...> it synchronously.
    MANIFEST.write_text(
        "window.EMBLEMS = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    total_bytes = sum(
        (DST / f"{key}{('.jpg' if chosen[key].suffix.lower() == '.jpeg' else chosen[key].suffix.lower())}").stat().st_size
        for key in used_keys
    )
    print(f"전문대 in 2unimap.html: {len(data)}")
    print(f"Local emblems matched:  {len(manifest)}")
    print(f"Unmatched (use remote): {len(unmatched)}  → {unmatched}")
    print(f"Files copied: {len(used_keys)}  Size: {total_bytes/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
