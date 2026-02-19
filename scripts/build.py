#!/usr/bin/env python3
"""
Build and install custom skills for AI coding agents.

Reads plugins.toml for external repos, builds skills from those plus ./skills,
and installs them for:
- Claude Code (~/.claude/skills)
- OpenCode, Pi, Codex (~/.agents/skills)

Requires Python 3.11+ (uses tomllib from stdlib).
"""

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

if sys.version_info < (3, 11):
    sys.exit("Error: Python 3.11+ required (for tomllib)")

import tomllib

# Directories
ROOT = Path(__file__).parent.parent
SKILLS_DIR = ROOT / "skills"
BUILD_DIR = ROOT / "build"
EXTERNAL_DIR = BUILD_DIR / "external"
CONFIGS_DIR = ROOT / "configs"
GLOBAL_AGENTS_MD = CONFIGS_DIR / "AGENTS.md"
CONFIG_FILE = ROOT / "plugins.toml"

# Installation paths
HOME = Path.home()
INSTALL_PATHS = {
    "claude": HOME / ".claude" / "skills",
    "unified": HOME / ".agents" / "skills",  # opencode, pi, codex
}


def plugin_dir_name(name: str) -> str:
    """Convert plugin name (owner/repo) to directory name (owner-repo)."""
    return name.replace("/", "-")


@dataclass
class Plugin:
    name: str  # owner/repo
    url: str
    ref: str | None = None
    skills_path: list[str] = field(default_factory=lambda: ["skills/*"])
    skills: list[str] = field(default_factory=list)
    alias: str | None = None

    @property
    def dir_name(self) -> str:
        return plugin_dir_name(self.name)

    @classmethod
    def from_dict(cls, name: str, data: dict) -> "Plugin":
        def as_list(val) -> list[str]:
            if val is None:
                return []
            if isinstance(val, str):
                return [val]
            return list(val)

        return cls(
            name=name,
            url=data["url"],
            ref=data.get("ref"),
            skills_path=as_list(data.get("skills_path", "skills/*")),
            skills=as_list(data.get("skills")),
            alias=data.get("alias"),
        )


def load_config() -> dict[str, Plugin]:
    if not CONFIG_FILE.exists():
        return {}
    with open(CONFIG_FILE, "rb") as f:
        data = tomllib.load(f)
    return {name: Plugin.from_dict(name, cfg) for name, cfg in data.items()}


def fetch_plugin(plugin: Plugin) -> Path:
    """Shallow-clone a plugin repo into build/external/. Returns clone path."""
    dest = EXTERNAL_DIR / plugin.dir_name
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    cmd = ["git", "clone", "--depth", "1"]
    if plugin.ref:
        cmd += ["--branch", plugin.ref]
    cmd += [plugin.url, str(dest)]

    print(f"  Cloning {plugin.name}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    Error cloning {plugin.name}: {result.stderr.strip()}")
        return None
    return dest


def find_skill_md(directory: Path) -> Path | None:
    """Find SKILL.md (case-insensitive) in a directory."""
    for f in directory.iterdir():
        if f.is_file() and f.name.lower() == "skill.md":
            return f
    return None


def glob_paths(base: Path, patterns: list[str]) -> list[Path]:
    results = []
    for pattern in patterns:
        if pattern == ".":
            results.append(base)
        else:
            results.extend(base.glob(pattern))
    return sorted(set(results))


def discover_skills(plugin: Plugin, clone_dir: Path) -> list[tuple[str, Path]]:
    """Discover skill directories from a cloned plugin."""
    if not plugin.skills:
        return []

    include_all = "*" in plugin.skills
    items = []

    for path in glob_paths(clone_dir, plugin.skills_path):
        if not path.is_dir():
            continue
        if not find_skill_md(path):
            continue
        name = path.name
        if not include_all and name not in plugin.skills:
            continue
        final_name = f"{plugin.alias}-{name}" if plugin.alias else name
        items.append((final_name, path))

    return items


def extract_description(content: str) -> str:
    """Extract a description from the first non-heading paragraph of markdown."""
    import re

    # Strip any frontmatter
    stripped = re.sub(r"^---\s*\n.*?\n---\s*\n?", "", content, flags=re.DOTALL)

    for line in stripped.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line == "---":
            continue
        # First real paragraph line — truncate if long
        if len(line) > 200:
            line = line[:197] + "..."
        return line

    return "No description available."


def ensure_frontmatter(content: str, name: str) -> str:
    """Ensure SKILL.md has valid frontmatter with name and description.

    - Missing frontmatter: inject it (derive description from first paragraph)
    - Existing frontmatter missing fields: add them
    - Existing name wrong: fix it
    """
    import re

    frontmatter_pattern = r"^---\s*\n(.*?)\n---"
    match = re.match(frontmatter_pattern, content, re.DOTALL)

    if not match:
        # No frontmatter at all — inject
        desc = extract_description(content)
        frontmatter = f"---\nname: {name}\ndescription: {desc}\n---\n\n"
        return frontmatter + content

    frontmatter = match.group(1)
    changed = False

    # Fix or add name
    name_pattern = r"^name:\s*(.+)$"
    name_match = re.search(name_pattern, frontmatter, re.MULTILINE)
    if name_match:
        current_name = name_match.group(1).strip().strip("\"'")
        if current_name != name:
            frontmatter = re.sub(
                name_pattern, f"name: {name}", frontmatter, flags=re.MULTILINE
            )
            changed = True
    else:
        frontmatter = f"name: {name}\n" + frontmatter
        changed = True

    # Fix or add description
    desc_pattern = r"^description:\s*(.+)$"
    desc_match = re.search(desc_pattern, frontmatter, re.MULTILINE)
    if not desc_match:
        desc = extract_description(content)
        frontmatter += f"\ndescription: {desc}"
        changed = True

    if not changed:
        return content

    return content[: match.start(1)] + frontmatter + content[match.end(1) :]


def build_skill(name: str, source: Path) -> bool:
    """Build a single skill into build/skills/."""
    skill_md = find_skill_md(source)
    if not skill_md:
        print(f"    Warning: {source} has no SKILL.md, skipping")
        return False

    raw_content = skill_md.read_text()

    dest = BUILD_DIR / "skills" / name
    dest.mkdir(parents=True, exist_ok=True)

    skill_content = ensure_frontmatter(raw_content, name)
    (dest / "SKILL.md").write_text(skill_content)

    for item in source.iterdir():
        if item.name.lower() == "skill.md":
            continue
        dest_item = dest / item.name
        if item.is_dir():
            shutil.copytree(item, dest_item, dirs_exist_ok=True)
        else:
            shutil.copy(item, dest_item)

    return True


def fetch_plugins(plugins: dict[str, Plugin]) -> dict[str, Path]:
    """Clone all plugin repos. Returns {name: clone_path}."""
    if not plugins:
        return {}
    print("Fetching plugins...")
    clones = {}
    for plugin in plugins.values():
        clone_dir = fetch_plugin(plugin)
        if clone_dir:
            clones[plugin.name] = clone_dir
    return clones


def build_skills(plugins: dict[str, Plugin], clones: dict[str, Path]) -> None:
    """Build all skills from plugins and ./skills."""
    print("Building skills...")

    skills_build = BUILD_DIR / "skills"
    if skills_build.exists():
        shutil.rmtree(skills_build)
    skills_build.mkdir(parents=True)

    built = set()

    # Plugin skills first
    for plugin in plugins.values():
        clone_dir = clones.get(plugin.name)
        if not clone_dir:
            continue
        for name, path in discover_skills(plugin, clone_dir):
            if name in built:
                print(f"    Warning: '{name}' already exists, skipping duplicate from {plugin.name}")
                continue
            if build_skill(name, path):
                print(f"  {name} (from {plugin.name})")
                built.add(name)

    # Local skills override plugin skills
    if SKILLS_DIR.exists():
        for skill_dir in sorted(SKILLS_DIR.iterdir()):
            if not skill_dir.is_dir():
                continue
            name = skill_dir.name
            if name in built:
                print(f"  {name} (local override)")
            if build_skill(name, skill_dir):
                if name not in built:
                    print(f"  {name}")
                built.add(name)

    print(f"  Built {len(built)} skills")


def install_skills() -> None:
    """Install built skills to configured agent directories."""
    print("Installing skills...")

    source = BUILD_DIR / "skills"
    if not source.exists():
        print("  No skills built, run 'make build' first")
        return

    for name, dest in INSTALL_PATHS.items():
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True, exist_ok=True)

        count = 0
        for skill_dir in sorted(source.iterdir()):
            if not skill_dir.is_dir():
                continue
            shutil.copytree(skill_dir, dest / skill_dir.name)
            count += 1

        print(f"  {name}: {count} skills -> {dest}")


def install_global_agents_md() -> None:
    """Install global AGENTS.md for unified agents path."""
    print("Installing global AGENTS.md...")

    if not GLOBAL_AGENTS_MD.exists():
        print("  No AGENTS.md found in configs/, skipping")
        return

    dest = HOME / ".agents" / "AGENTS.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(GLOBAL_AGENTS_MD, dest)
    print(f"  Installed to {dest}")


def clean() -> None:
    """Remove all installed artifacts."""
    print("Cleaning installed artifacts...")

    for path in INSTALL_PATHS.values():
        if path.exists():
            shutil.rmtree(path)
            print(f"  Removed {path}")

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
        print("  Removed build directory")

    agents_md_path = HOME / ".agents" / "AGENTS.md"
    if agents_md_path.exists():
        agents_md_path.unlink()
        print(f"  Removed {agents_md_path}")

    print("  Done")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build and install AI agent skills")
    parser.add_argument(
        "command",
        choices=["build", "install", "install-skills", "clean"],
        help="Command to run",
    )
    args = parser.parse_args()

    plugins = load_config()

    if args.command == "build":
        clones = fetch_plugins(plugins)
        build_skills(plugins, clones)
    elif args.command == "install":
        clones = fetch_plugins(plugins)
        build_skills(plugins, clones)
        install_skills()
        install_global_agents_md()
        print("\nAll done!")
    elif args.command == "install-skills":
        clones = fetch_plugins(plugins)
        build_skills(plugins, clones)
        install_skills()
    elif args.command == "clean":
        clean()


if __name__ == "__main__":
    main()
