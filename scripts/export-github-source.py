"""Export reviewed project sources without credentials, data, or workspace history."""
from pathlib import Path
import re
import shutil
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "generated-artifacts/github-source"
ROOT_FILES = {
    ".gitignore", ".replitignore", ".npmrc", "README.md", "README_LOCAL_AR.md",
    "replit.md", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "tsconfig.json", "tsconfig.base.json", "start-nasaem-local.bat",
}
PREFIXES = (
    "artifacts/api-server/", "artifacts/nasaem-inventory/",
    "artifacts/nasaem-presentation/", "lib/", "scripts/", "docs/",
)
FORBIDDEN_PARTS = {
    "node_modules", "dist", "nasaem-data", "backups", "nasaem-backups",
    "attached_assets", ".agents", ".local", ".cache",
}

def allowed(name):
    parts = Path(name).parts
    if any(part in FORBIDDEN_PARTS for part in parts):
        return False
    if any(part.startswith(".env") for part in parts):
        return False
    if Path(name).suffix.lower() in {".pem", ".key", ".zip", ".pdf", ".pptx", ".db", ".sqlite", ".sqlite3", ".log", ".tsbuildinfo"}:
        return False
    return name in ROOT_FILES or name.startswith(PREFIXES)

if not (DEST / ".git").is_dir():
    raise SystemExit("Clone the existing export repository before running this command.")

tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
selected = {name for name in tracked if name and allowed(name)}
# Include this exporter and the current update notes before their local checkpoint.
selected.update({"scripts/export-github-source.py", "docs/UPDATES.md"})
for name in selected:
    source, target = ROOT / name, DEST / name
    if source.is_symlink() or not source.is_file():
        raise SystemExit(f"Refusing missing or symbolic source: {name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

# Remove obsolete exported source files, while retaining repository-only release
# documentation/workflows and the destination's own Git history.
previous = subprocess.check_output(["git", "ls-files", "-z"], cwd=DEST).decode().split("\0")
for name in previous:
    if name and allowed(name) and name not in selected:
        (DEST / name).unlink(missing_ok=True)

# Strip environment sections without reading or logging their values.
lines, skipping, assignment = [], False, ""
for line in (ROOT / ".replit").read_text().splitlines(keepends=True):
    if assignment:
        assignment += line
        try:
            tomllib.loads(assignment)
            assignment = ""
        except tomllib.TOMLDecodeError:
            pass
        continue
    section = re.match(r"^\s*\[{1,2}([^\]]+)\]", line)
    if section:
        skipping = bool({"env", "userenv"} & set(section.group(1).split(".")))
    if skipping:
        continue
    if re.match(r'^\s*(env|userenv|"env"|"userenv")\s*=', line):
        try:
            tomllib.loads(line)
        except tomllib.TOMLDecodeError:
            assignment = line
        continue
    lines.append(line)
if assignment:
    raise SystemExit("Unterminated environment assignment; refusing export.")
config = "".join(lines)
parsed = tomllib.loads(config)
def check_env_sections(node):
    if isinstance(node, dict):
        if {"env", "userenv"} & node.keys():
            raise SystemExit("Refusing an export containing environment values.")
        for value in node.values():
            check_env_sections(value)
    elif isinstance(node, list):
        for value in node:
            check_env_sections(value)
check_env_sections(parsed)
(DEST / ".replit").write_text(config)
print(f"Exported {len(selected)} source files and sanitized .replit; no environment values exported.")
