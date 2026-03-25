#!/usr/bin/env python3
"""
Build and install skills and extensions for AI coding agents.

Pi-first. Builds from ./skills and ./pi-extensions, installs to configured targets.

Requires Python 3.11+.
"""

import argparse
import os
import re
import shutil
import sys
from pathlib import Path

if sys.version_info < (3, 11):
    sys.exit("Error: Python 3.11+ required")

import tomllib

# --- Colors ---
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
BOLD = "\033[1m"
DIM = "\033[2m"
NC = "\033[0m"

# --- Paths ---
ROOT = Path(__file__).parent.parent
SKILLS_DIR = ROOT / "skills"
EXTENSIONS_DIR = ROOT / "pi-extensions"
BUILD_DIR = ROOT / "build"
CONFIGS_DIR = ROOT / "configs"
GLOBAL_AGENTS_MD = CONFIGS_DIR / "AGENTS.md"
CONFIG_FILE = ROOT / "install.toml"

HOME = Path.home()
TARGET_PATHS = {
    "pi": {
        "skills": HOME / ".pi" / "agent" / "skills",
        "extensions": HOME / ".pi" / "agent" / "extensions",
    },
    "claude": {
        "skills": HOME / ".claude" / "skills",
    },
    "codex": {
        "skills": HOME / ".codex" / "skills",
    },
    "amp": {
        "skills": HOME / ".amp" / "skills",
    },
}

VALID_TARGETS = list(TARGET_PATHS.keys())


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def load_config() -> dict:
    """Load configuration from install.toml."""
    defaults = {
        "targets": ["pi"],
        "exclude": [],
        "exclude-extensions": [],
        "overrides": {},
    }
    if not CONFIG_FILE.exists():
        return defaults

    with open(CONFIG_FILE, "rb") as f:
        data = tomllib.load(f)

    targets = data.get("targets", ["pi"])
    for t in targets:
        if t not in VALID_TARGETS:
            print(f"{YELLOW}Warning: Unknown target '{t}' in install.toml{NC}")

    return {
        "targets": [t for t in targets if t in VALID_TARGETS],
        "exclude": data.get("exclude", []),
        "exclude-extensions": data.get("exclude-extensions", []),
        "overrides": data.get("overrides", {}),
    }


# ---------------------------------------------------------------------------
# Frontmatter processing
# ---------------------------------------------------------------------------


def apply_frontmatter_overrides(content: str, overrides: dict[str, str]) -> str:
    """Add or replace frontmatter fields based on overrides dict."""
    if not overrides:
        return content

    frontmatter_pattern = r"^---\s*\n(.*?)\n---"
    match = re.match(frontmatter_pattern, content, re.DOTALL)
    if not match:
        return content

    frontmatter = match.group(1)

    for key, value in overrides.items():
        if isinstance(value, bool):
            yaml_value = "true" if value else "false"
        else:
            yaml_value = str(value)

        field_pattern = rf"^{re.escape(key)}:\s*.*$"
        if re.search(field_pattern, frontmatter, re.MULTILINE):
            frontmatter = re.sub(
                field_pattern,
                f"{key}: {yaml_value}",
                frontmatter,
                flags=re.MULTILINE,
            )
        else:
            frontmatter += f"\n{key}: {yaml_value}"

    return content[: match.start(1)] + frontmatter + content[match.end(1) :]


def fix_skill_frontmatter_name(content: str, expected_name: str) -> str:
    """Fix SKILL.md frontmatter `name` to match directory name."""
    frontmatter_pattern = r"^---\s*\n(.*?)\n---"
    match = re.match(frontmatter_pattern, content, re.DOTALL)
    if not match:
        return content

    frontmatter = match.group(1)
    name_pattern = r"^name:\s*(.+)$"
    name_match = re.search(name_pattern, frontmatter, re.MULTILINE)
    if not name_match:
        return content

    current_name = name_match.group(1).strip().strip("\"'")
    if current_name == expected_name:
        return content

    new_frontmatter = re.sub(
        name_pattern, f"name: {expected_name}", frontmatter, flags=re.MULTILINE
    )
    return content[: match.start(1)] + new_frontmatter + content[match.end(1) :]


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def build_skill(
    name: str, source: Path, overrides: dict[str, dict] | None = None
) -> bool:
    """Build a single skill from source directory."""
    skill_md = source / "SKILL.md"
    if not skill_md.exists():
        print(f"    {YELLOW}Warning: {source} has no SKILL.md, skipping{NC}")
        return False

    raw_content = skill_md.read_text()
    dest = BUILD_DIR / "skills" / name
    dest.mkdir(parents=True, exist_ok=True)

    skill_content = fix_skill_frontmatter_name(raw_content, name)

    if overrides and name in overrides:
        skill_content = apply_frontmatter_overrides(skill_content, overrides[name])

    (dest / "SKILL.md").write_text(skill_content)

    for item in source.iterdir():
        if item.name == "SKILL.md":
            continue
        dest_item = dest / item.name
        if item.is_dir():
            shutil.copytree(item, dest_item, dirs_exist_ok=True)
        else:
            shutil.copy(item, dest_item)

    return True


def build_extension(name: str, source: Path) -> bool:
    """Build a single extension (file or directory) to build/."""
    dest_dir = BUILD_DIR / "extensions"
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest = dest_dir / name
    if source.is_dir():
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(source, dest)
    else:
        shutil.copy(source, dest)

    return True


def build(config: dict) -> tuple[list[str], list[str]]:
    """Build skills and extensions to build/. Returns (skill_names, extension_names)."""
    exclude_skills = set(config["exclude"])
    exclude_extensions = set(config["exclude-extensions"])
    overrides = config["overrides"]

    # Clean build subdirectories
    for subdir in ["skills", "extensions"]:
        build_sub = BUILD_DIR / subdir
        if build_sub.exists():
            shutil.rmtree(build_sub)

    # Build skills
    built_skills = []
    if SKILLS_DIR.exists():
        for skill_dir in sorted(SKILLS_DIR.iterdir()):
            if not skill_dir.is_dir():
                continue
            if skill_dir.name in exclude_skills:
                print(f"    {DIM}Excluded skill: {skill_dir.name}{NC}")
                continue
            if build_skill(skill_dir.name, skill_dir, overrides):
                built_skills.append(skill_dir.name)

    # Build extensions
    built_extensions = []
    if EXTENSIONS_DIR.exists():
        for item in sorted(EXTENSIONS_DIR.iterdir()):
            if item.name.startswith("."):
                continue
            ext_name = item.name
            # Match exclusions with or without .ts suffix
            exclude_key = ext_name.removesuffix(".ts") if item.is_file() else ext_name
            if exclude_key in exclude_extensions or ext_name in exclude_extensions:
                print(f"    {DIM}Excluded extension: {ext_name}{NC}")
                continue
            if item.is_file() and not item.name.endswith(".ts"):
                continue
            if build_extension(ext_name, item):
                built_extensions.append(ext_name)

    return built_skills, built_extensions


# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------


def describe_existing(path: Path) -> str:
    """Describe what currently exists at a path."""
    if path.is_symlink():
        target = os.readlink(path)
        return f"symlink → {target}"
    elif path.is_dir():
        return "directory"
    elif path.is_file():
        return "file"
    return "exists"


def find_conflicts(
    config: dict, built_skills: list[str], built_extensions: list[str]
) -> dict:
    """Check for conflicts at install destinations. Returns conflict info per target."""
    conflicts = {}

    for target in config["targets"]:
        target_conflicts = {"skills": {}, "extensions": {}}
        paths = TARGET_PATHS[target]

        skills_dest = paths.get("skills")
        if skills_dest:
            for name in built_skills:
                dest = skills_dest / name
                if dest.exists() or dest.is_symlink():
                    target_conflicts["skills"][name] = describe_existing(dest)

        extensions_dest = paths.get("extensions")
        if extensions_dest:
            for name in built_extensions:
                dest = extensions_dest / name
                if dest.exists() or dest.is_symlink():
                    target_conflicts["extensions"][name] = describe_existing(dest)

        conflicts[target] = target_conflicts

    return conflicts


def count_conflicts(conflicts: dict) -> int:
    """Count total number of conflicts across all targets."""
    total = 0
    for target_conf in conflicts.values():
        total += len(target_conf["skills"]) + len(target_conf["extensions"])
    return total


def print_plan(
    config: dict,
    built_skills: list[str],
    built_extensions: list[str],
    conflicts: dict,
):
    """Print install plan for all targets."""
    for target in config["targets"]:
        paths = TARGET_PATHS[target]
        target_conf = conflicts[target]

        print(f"\n  {BOLD}[{target}]{NC}")

        skills_dest = paths.get("skills")
        if skills_dest and built_skills:
            print(f"    Skills → {skills_dest}/")
            for name in built_skills:
                if name in target_conf["skills"]:
                    desc = target_conf["skills"][name]
                    print(f"      {name:<30} {YELLOW}(exists: {desc}){NC}")
                else:
                    print(f"      {name:<30} {GREEN}(new){NC}")

        extensions_dest = paths.get("extensions")
        if extensions_dest and built_extensions:
            print(f"    Extensions → {extensions_dest}/")
            for name in built_extensions:
                if name in target_conf["extensions"]:
                    desc = target_conf["extensions"][name]
                    print(f"      {name:<30} {YELLOW}(exists: {desc}){NC}")
                else:
                    print(f"      {name:<30} {GREEN}(new){NC}")


def install_items(
    source_dir: Path, dest_dir: Path, items: list[str], wipe: bool = False
):
    """Copy items from build/ to a destination directory."""
    if wipe and dest_dir.exists():
        shutil.rmtree(dest_dir)

    dest_dir.mkdir(parents=True, exist_ok=True)

    for name in items:
        source = source_dir / name
        dest = dest_dir / name

        # Remove existing
        if dest.is_symlink() or dest.exists():
            if dest.is_dir() and not dest.is_symlink():
                shutil.rmtree(dest)
            else:
                dest.unlink()

        # Copy
        if source.is_dir():
            shutil.copytree(source, dest)
        else:
            shutil.copy(source, dest)


def do_install(mode: str):
    """Main install flow: build, check conflicts, preview or install."""
    config = load_config()
    targets = config["targets"]

    print(f"{BLUE}=== dotagents installer ==={NC}")
    print(f"Targets: {', '.join(targets)}")
    print(f"Mode: {mode}")

    # Build
    print(f"\n{BLUE}Building...{NC}")
    built_skills, built_extensions = build(config)
    print(
        f"\n  {GREEN}Built {len(built_skills)} skills, {len(built_extensions)} extensions{NC}"
    )

    if not built_skills and not built_extensions:
        print(f"\n{YELLOW}Nothing to install.{NC}")
        return

    # Check conflicts
    conflicts = find_conflicts(config, built_skills, built_extensions)
    conflict_count = count_conflicts(conflicts)

    # Print plan
    print(f"\n{BLUE}Install plan:{NC}")
    print_plan(config, built_skills, built_extensions, conflicts)

    # Preview: stop here
    if mode == "preview":
        print()
        if conflict_count > 0:
            print(f"{YELLOW}{conflict_count} items already exist at destinations.{NC}")
        print(
            f"Run {BOLD}make install overwrite{NC} to install (overwriting conflicts)."
        )
        print(
            f"Run {BOLD}make install wipe{NC} to wipe destinations first, then install."
        )
        return

    # Overwrite: copy items individually, replacing conflicts
    if mode == "overwrite":
        print(f"\n{BLUE}Installing...{NC}")
        for target in targets:
            paths = TARGET_PATHS[target]

            skills_dest = paths.get("skills")
            if skills_dest and built_skills:
                install_items(BUILD_DIR / "skills", skills_dest, built_skills)
                print(
                    f"  {GREEN}✓{NC} {target} skills: {len(built_skills)} installed"
                )

            extensions_dest = paths.get("extensions")
            if extensions_dest and built_extensions:
                install_items(
                    BUILD_DIR / "extensions", extensions_dest, built_extensions
                )
                print(
                    f"  {GREEN}✓{NC} {target} extensions: {len(built_extensions)} installed"
                )

    # Wipe: nuke destination directories, then install
    elif mode == "wipe":
        print(f"\n{BLUE}Wiping destinations and installing...{NC}")
        for target in targets:
            paths = TARGET_PATHS[target]

            skills_dest = paths.get("skills")
            if skills_dest and built_skills:
                install_items(
                    BUILD_DIR / "skills", skills_dest, built_skills, wipe=True
                )
                print(
                    f"  {GREEN}✓{NC} {target} skills: wiped and installed {len(built_skills)}"
                )

            extensions_dest = paths.get("extensions")
            if extensions_dest and built_extensions:
                install_items(
                    BUILD_DIR / "extensions",
                    extensions_dest,
                    built_extensions,
                    wipe=True,
                )
                print(
                    f"  {GREEN}✓{NC} {target} extensions: wiped and installed {len(built_extensions)}"
                )

    # Install global AGENTS.md for non-pi targets
    install_global_agents_md(targets)

    print(f"\n{GREEN}=== Done ==={NC}")


def install_global_agents_md(targets: list[str]):
    """Install global AGENTS.md for targets that use it."""
    if not GLOBAL_AGENTS_MD.exists():
        return

    # Only install for targets that use the unified ~/.agents/ path
    unified_targets = [t for t in targets if t in ("codex", "amp")]
    if not unified_targets:
        return

    dest = HOME / ".agents" / "AGENTS.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(GLOBAL_AGENTS_MD, dest)
    print(f"  Installed AGENTS.md → {dest}")


# ---------------------------------------------------------------------------
# Build-only
# ---------------------------------------------------------------------------


def do_build():
    """Build skills and extensions to build/ without installing."""
    config = load_config()
    print(f"{BLUE}Building...{NC}")
    built_skills, built_extensions = build(config)
    print(
        f"\n{GREEN}Built {len(built_skills)} skills, {len(built_extensions)} extensions → {BUILD_DIR}/{NC}"
    )


# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------


def do_clean():
    """Remove dotagents-managed items from install destinations."""
    config = load_config()
    targets = config["targets"]

    print(f"{BLUE}Cleaning dotagents items...{NC}")

    # Collect our skill and extension names from source
    our_skills = set()
    if SKILLS_DIR.exists():
        for d in SKILLS_DIR.iterdir():
            if d.is_dir():
                our_skills.add(d.name)

    our_extensions = set()
    if EXTENSIONS_DIR.exists():
        for item in EXTENSIONS_DIR.iterdir():
            if item.name.startswith("."):
                continue
            if item.is_dir() or (item.is_file() and item.name.endswith(".ts")):
                our_extensions.add(item.name)

    for target in targets:
        paths = TARGET_PATHS[target]

        skills_dest = paths.get("skills")
        if skills_dest and skills_dest.exists():
            removed = 0
            for name in our_skills:
                dest = skills_dest / name
                if dest.exists() or dest.is_symlink():
                    if dest.is_dir() and not dest.is_symlink():
                        shutil.rmtree(dest)
                    else:
                        dest.unlink()
                    removed += 1
            if removed:
                print(f"  {target} skills: removed {removed}")

        extensions_dest = paths.get("extensions")
        if extensions_dest and extensions_dest.exists():
            removed = 0
            for name in our_extensions:
                dest = extensions_dest / name
                if dest.exists() or dest.is_symlink():
                    if dest.is_dir() and not dest.is_symlink():
                        shutil.rmtree(dest)
                    else:
                        dest.unlink()
                    removed += 1
            if removed:
                print(f"  {target} extensions: removed {removed}")

    # Clean build directory
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
        print(f"  Removed {BUILD_DIR}/")

    print(f"{GREEN}Done{NC}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Build and install AI agent skills and extensions"
    )
    parser.add_argument(
        "command",
        choices=["build", "install", "clean"],
        help="Command to run",
    )
    parser.add_argument(
        "mode",
        nargs="?",
        default="preview",
        choices=["preview", "overwrite", "wipe"],
        help="Install mode: preview (default), overwrite, or wipe",
    )
    args = parser.parse_args()

    if args.command == "build":
        do_build()
    elif args.command == "install":
        do_install(args.mode)
    elif args.command == "clean":
        do_clean()


if __name__ == "__main__":
    main()
