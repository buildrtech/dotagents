import glob
import os
import re
from dataclasses import dataclass


@dataclass
class Entry:
    title: str
    content: str
    source_file: str
    full_text: str


def parse_learnings(learnings_dir):
    """Parse all markdown files in the learnings directory into entries."""
    entries = []
    pattern = os.path.join(learnings_dir, "*.md")

    for filepath in sorted(glob.glob(pattern)):
        basename = os.path.basename(filepath)
        if basename.lower() == "readme.md":
            continue
        entries.extend(parse_file(filepath))

    return entries


def parse_file(filepath):
    """Parse a single markdown file into entries, splitting on ## [ boundaries."""
    with open(filepath, "r") as f:
        text = f.read()

    entries = []
    # Split on lines starting with ## [
    parts = re.split(r"(?=^## \[)", text, flags=re.MULTILINE)

    for part in parts:
        part = part.strip()
        if not part.startswith("## ["):
            continue

        lines = part.split("\n", 1)
        title = lines[0].strip()
        content = lines[1].strip() if len(lines) > 1 else ""
        full_text = f"{title}\n{content}" if content else title

        entries.append(Entry(
            title=title,
            content=content,
            source_file=filepath,
            full_text=full_text,
        ))

    return entries
