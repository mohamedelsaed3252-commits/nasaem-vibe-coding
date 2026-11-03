"""Create a reviewed source snapshot and a delivery ZIP, without shop data."""

import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "generated-artifacts"
SOURCE = OUT / "github-source"
ARCHIVE = OUT / "Nasaem-Project-Mohamed-El_saed.zip"
ROOT_FILES = {
    "README.md", "README_LOCAL_AR.md", "replit.md", ".gitignore", ".replitignore",
    ".replit", ".npmrc", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "tsconfig.json", "tsconfig.base.json", "start-nasaem-local.bat",
}
SOURCE_ROOTS = (
    "artifacts/api-server/", "artifacts/nasaem-inventory/",
    "artifacts/nasaem-presentation/", "lib/", "scripts/", "docs/", "presentations/",
    ".github/workflows/",
)
BLOCKED = {
    "node_modules", "dist", ".git", ".local", ".agents", "nasaem-data",
    "__pycache__", "backups", "attached_assets",
}
DELIVERABLES = [
    ("pdf/Nasaem-Presentation-Mohamed-El_saed.pdf", "presentations/pdf/Nasaem-Presentation-Mohamed-El_saed.pdf"),
    ("pdf/Nasaem-Project-Idea-Mohamed-El_saed.pdf", "presentations/pdf/Nasaem-Project-Idea-Mohamed-El_saed.pdf"),
    ("powerpoint/Nasaem-Presentation-Mohamed-El_saed.pptx", "presentations/powerpoint/Nasaem-Presentation-Mohamed-El_saed.pptx"),
]
SECRET_PATTERNS = [
    rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    rb"\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}",
    rb"\bsk_(?:live|test)_[A-Za-z0-9]{16,}",
    rb"postgres(?:ql)?://[^:\s/]+:[^@\s]+@",
]


def allowed(name):
    path = Path(name)
    return (
        (name in ROOT_FILES or name.startswith(SOURCE_ROOTS))
        and not any(part in BLOCKED for part in path.parts)
        and not path.name.startswith(".env")
        and path.suffix not in {".pem", ".key", ".pyc", ".tsbuildinfo", ".pdf", ".pptx", ".zip"}
    )


def export_bytes(name):
    path = ROOT / name
    if path.is_symlink():
        raise ValueError(f"Review symlink before exporting: {name}")
    data = path.read_bytes()
    if name == ".replit":
        # User environment tables can contain account identifiers. Never export them.
        lines, omit = [], False
        for line in data.decode().splitlines():
            if line.startswith("["):
                omit = line.startswith("[userenv")
            if not omit:
                lines.append(line)
        data = ("\n".join(lines).rstrip() + "\n").encode()
    if b"\0" not in data:
        if any(re.search(pattern, data) for pattern in SECRET_PATTERNS):
            raise ValueError(f"Potential credential found; export stopped at {name}")
    return data


def build():
    for src, _ in DELIVERABLES:
        if not (OUT / "delivery" / src).is_file():
            raise FileNotFoundError(f"Prepare the deliverable before packaging: {src}")
    tracked_and_new = subprocess.check_output([
        "git", "ls-files", "--cached", "--others", "--exclude-standard", "-z",
    ], cwd=ROOT).decode().split("\0")
    names = sorted({name for name in tracked_and_new if name and allowed(name)})
    content = {name: export_bytes(name) for name in names}
    if SOURCE.exists():
        # Preserve an isolated export repository on repeated packaging.
        # Workspace Git history is never copied into this directory.
        for child in SOURCE.iterdir():
            if child.name == ".git":
                continue
            if child.is_dir() and not child.is_symlink():
                shutil.rmtree(child)
            else:
                child.unlink()
    SOURCE.mkdir(parents=True, exist_ok=True)
    manifest = []
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in content.items():
            target = SOURCE / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            archive.writestr(f"nasaem/{name}", data)
            manifest.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        for src, dest in DELIVERABLES:
            path = OUT / "delivery" / src
            archive.write(path, f"nasaem/{dest}")
            manifest.append({"path": dest, "bytes": path.stat().st_size,
                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        archive.writestr("nasaem/DELIVERY-MANIFEST.json",
                         json.dumps(manifest, indent=2, ensure_ascii=False))
    with zipfile.ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        assert all(not any(p in BLOCKED for p in Path(n).parts) for n in archive.namelist())
    assert b"[userenv" not in (SOURCE / ".replit").read_bytes()
    print(f"Source snapshot: {len(content)} files under {SOURCE.relative_to(ROOT)}")
    print(f"Delivery ZIP: {ARCHIVE.relative_to(ROOT)} ({ARCHIVE.stat().st_size:,} bytes)")
    print("Excluded: shop data, credentials, personal attachments, caches, Git history.")


if __name__ == "__main__":
    build()
