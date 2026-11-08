#!/usr/bin/env python3
"""Build/check the portable handoff using an explicit, credential-free source list."""
import argparse
import datetime
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASE = "5b00b67d2378d8f7f29073ab4fc58d1d833742f8"
OUTPUT = ROOT / "docs/handoff"
SOURCES = [
    ".gitignore", "README.md", "package.json",
    "docs/telegram-web-app-implementation.md", "docs/bosla-domain.md",
    "docs/local-testing.md", "docs/pr-165-review.md", "docs/staging.md",
    "docs/staging-acceptance.md", "docs/agent-environment-handoff.md",
    "docs/handoff/README.md", "scripts/build-agent-handoff.py",
    "packages/bot/scripts/set-webhook.ts", "packages/bot/src/config/environment.ts",
    "packages/bot/wrangler.staging.toml", "packages/db/tsconfig.json",
    "packages/testing/README.md", "packages/testing/package.json",
    "packages/testing/src/convex-emulator.ts", "packages/testing/src/telegram/dashboard.ts",
    "packages/testing/test/robustness.test.ts", "packages/testing/test/web-app.test.ts",
    "packages/testing/scripts/manual-import.ts", "packages/testing/scripts/prepare-local.ts",
    "packages/testing/src/staging-classifier.ts", "packages/testing/test/staging-classifier.test.ts",
    "packages/testing/wrangler.staging-classifier.toml",
]


def git(*args, env=None):
    return subprocess.check_output(["git", *args], cwd=ROOT, env=env)


def assert_no_known_secrets(payload):
    secret_names = {
        "BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "CONVEX_AUTH_PRIVATE_KEY",
        "TEST_CONVEX_AUTH_PRIVATE_KEY", "GROQ_API_KEY", "CONVEX_DEPLOY_KEY",
    }
    # Compare privately against values available on the build machine; never emit them.
    for filename in (".env.staging.local", ".env.sim.local", ".env.staging.bosla.local"):
        config = ROOT / filename
        if not config.exists():
            continue
        for line in config.read_text().splitlines():
            if "=" not in line or line.lstrip().startswith("#"):
                continue
            name, value = line.split("=", 1)
            value = value.strip().strip("'\"")
            if name in secret_names and len(value) > 8 and value.encode() in payload:
                raise SystemExit("A private configuration value was found; bundle creation stopped.")
    if re.search(rb"\b\d{6,}:[A-Za-z0-9_-]{25,}\b", payload):
        raise SystemExit("A possible Telegram bot token was found; review source privately.")


def build_patch():
    for source in SOURCES:
        if not (ROOT / source).is_file():
            raise SystemExit(f"Missing handoff source: {source}")
    with tempfile.TemporaryDirectory(prefix="halaqabot-handoff-index-") as folder:
        env = {**os.environ, "GIT_INDEX_FILE": str(Path(folder) / "index")}
        git("read-tree", BASE, env=env)
        git("add", "--", *SOURCES, env=env)
        expected_tree = git("write-tree", env=env)
        patch = git("diff", "--cached", "--binary", "--full-index", "--no-ext-diff", BASE, env=env)
        assert_no_known_secrets(patch)
        filename = Path(folder) / "changes.patch"
        filename.write_bytes(patch)
        git("read-tree", BASE, env=env)
        git("apply", "--cached", "--check", str(filename), env=env)
        git("apply", "--cached", str(filename), env=env)
        if git("write-tree", env=env) != expected_tree:
            raise SystemExit("Patch round-trip did not reproduce the selected source tree.")
        return patch


def archive_bytes(files):
    output = io.BytesIO()
    # Stable metadata keeps a rebuild reviewable and allows --check after committing.
    with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w") as tar:
            for name, content in sorted(files.items()):
                info = tarfile.TarInfo("halaqabot-agent-handoff/" + name)
                info.size, info.mode, info.mtime = len(content), 0o644, 0
                tar.addfile(info, io.BytesIO(content))
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the committed bundle without rewriting it")
    parser.add_argument("--snapshot-date", help="ISO date; --check defaults to the existing manifest's date")
    args = parser.parse_args()
    existing = OUTPUT / "manifest.json"
    snapshot_date = args.snapshot_date
    if snapshot_date is None and args.check and existing.exists():
        snapshot_date = json.loads(existing.read_text())["snapshot_date"]
    snapshot_date = snapshot_date or datetime.date.today().isoformat()
    datetime.date.fromisoformat(snapshot_date)
    patch = build_patch()
    metadata = {
        "repository": "https://github.com/MoAndBee/HalaqaBot.git",
        "base_commit": BASE,
        "source_branch": "codex/pr-165-staging-handoff",
        "source_repository": "https://github.com/mohanad-80/HalaqaBot.git",
        "snapshot_date": snapshot_date,
        "patch_sha256": hashlib.sha256(patch).hexdigest(),
        "source_paths": SOURCES,
        "contains_secrets": False,
    }
    files = {
        "README.md": b"Read docs/agent-environment-handoff.md first. Apply the patch only to its pinned base, not on top of the stacked environment branch. Obtain credentials privately.\n",
        "manifest.json": (json.dumps(metadata, indent=2) + "\n").encode(),
        "pr-165-environment.patch": patch,
    }
    for source in SOURCES:
        if source.startswith("docs/") and source.endswith(".md"):
            files[source] = (ROOT / source).read_bytes()
    archive = archive_bytes(files)
    # Scan uncompressed contents as well; compression is not a secret filter.
    assert_no_known_secrets(b"\n".join(files.values()))
    filename = "halaqabot-agent-handoff.tar.gz"
    checksum = hashlib.sha256(archive).hexdigest()
    outputs = {
        filename: archive,
        "manifest.json": (json.dumps({**metadata, "archive_sha256": checksum}, indent=2) + "\n").encode(),
        "SHA256SUMS": f"{checksum}  {filename}\n".encode(),
    }
    if args.check:
        stale = [name for name, data in outputs.items() if not (OUTPUT / name).exists() or (OUTPUT / name).read_bytes() != data]
        if stale:
            raise SystemExit("Handoff bundle needs rebuilding: " + ", ".join(stale))
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for name, data in outputs.items():
            (OUTPUT / name).write_bytes(data)
    print(f"{'Verified' if args.check else 'Built'} handoff: {len(SOURCES)} source files; clean-index patch round-trip; secret scan passed.")


if __name__ == "__main__":
    main()
