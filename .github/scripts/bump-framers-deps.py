#!/usr/bin/env python3
"""
Bump all `@framers/*` explicit-version pins in `package.json` files to
`^<latest>` from the npm registry.

Behavior:
- Walks every `package.json` under the working directory (excluding
  `node_modules` and `.git`).
- Discovers every unique `@framers/*` dep name referenced.
- Queries npm for each package's latest published version.
- Replaces each explicit pin (caret, tilde, range, exact) with
  `^<latest>`. Does NOT touch `workspace:*` pins.
- No-ops when the pin already matches.
- Prints a per-package diff summary to stderr.
- Exits 0 on success regardless of whether any files changed.

Designed to run inside GitHub Actions; no external Python deps beyond
the standard library + `npm` on PATH.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

DEP_PATTERN = re.compile(r'"@framers/[a-z0-9-]+"')


def find_pkg_files() -> list[Path]:
    """Return every package.json under cwd, skipping node_modules + .git."""
    result = subprocess.run(
        [
            "find", ".", "-name", "package.json",
            "-not", "-path", "*/node_modules/*",
            "-not", "-path", "*/.git/*",
        ],
        capture_output=True, text=True, check=True,
    )
    return [Path(p) for p in result.stdout.strip().split("\n") if p]


def find_framers_deps(pkg_files: list[Path]) -> list[str]:
    """Discover every unique `@framers/<name>` referenced across package.json files."""
    deps: set[str] = set()
    for path in pkg_files:
        try:
            text = path.read_text()
        except OSError:
            continue
        for match in DEP_PATTERN.findall(text):
            deps.add(match.strip('"'))
    return sorted(deps)


def query_latest_versions(pkgs: list[str]) -> dict[str, str]:
    """Look up latest npm-published version for each package; skip unpublished."""
    versions: dict[str, str] = {}
    for pkg in pkgs:
        try:
            proc = subprocess.run(
                ["npm", "view", pkg, "version"],
                capture_output=True, text=True, timeout=30,
            )
            ver = proc.stdout.strip()
            # `npm view` returns empty when the package is unpublished and a
            # warning string when the registry is unhappy; only accept output
            # that starts with a digit (a real semver value).
            if ver and ver[0].isdigit():
                versions[pkg] = ver
        except (subprocess.TimeoutExpired, OSError):
            continue
    return versions


def bump_file(path: Path, versions: dict[str, str]) -> int:
    """Apply pin updates to one file. Return number of pins changed."""
    try:
        text = path.read_text()
    except OSError:
        return 0
    new_text = text
    changes = 0
    for pkg, latest in versions.items():
        target = f"^{latest}"
        # Match `"@framers/<pkg>": "<non-workspace>"`. The negative
        # lookahead `(?!workspace:)` preserves workspace protocol pins.
        pattern = re.compile(
            rf'("{re.escape(pkg)}"\s*:\s*)"(?!workspace:)([^"]+)"'
        )

        def replace(match: re.Match[str], _target: str = target) -> str:
            old_pin = match.group(2)
            if old_pin == _target:
                return match.group(0)
            return f'{match.group(1)}"{_target}"'

        new_candidate, n = pattern.subn(replace, new_text)
        if new_candidate != new_text:
            # Count actual line-level diffs caused by this package.
            for old_line, new_line in zip(new_text.split("\n"), new_candidate.split("\n")):
                if old_line != new_line:
                    changes += 1
            new_text = new_candidate
    if new_text != text:
        path.write_text(new_text)
    return changes


def main() -> int:
    pkg_files = find_pkg_files()
    framers_deps = find_framers_deps(pkg_files)
    print(
        f"Found {len(framers_deps)} unique @framers/* packages across {len(pkg_files)} files",
        file=sys.stderr,
    )

    versions = query_latest_versions(framers_deps)
    print(
        f"Resolved {len(versions)} packages to latest npm-published versions",
        file=sys.stderr,
    )

    total_changes = 0
    files_changed = 0
    for path in pkg_files:
        changed = bump_file(path, versions)
        if changed > 0:
            files_changed += 1
            total_changes += changed
    print(
        f"Updated {files_changed} files, applied {total_changes} pin bumps",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
