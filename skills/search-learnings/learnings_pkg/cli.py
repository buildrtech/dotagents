import argparse
import os
import subprocess
import sys

from . import cache
from . import searcher


def _find_learnings_dir():
    """Find docs/learnings/ relative to the git root."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
        git_root = result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: not inside a git repository", file=sys.stderr)
        sys.exit(1)

    learnings_dir = os.path.join(git_root, "docs", "learnings")
    if not os.path.isdir(learnings_dir):
        print(f"Error: no docs/learnings/ directory found at {learnings_dir}", file=sys.stderr)
        sys.exit(1)

    return learnings_dir


def _format_result(entry, score):
    """Format a single search result for display."""
    lines = [entry.title]
    lines.append(f"Source: {entry.source_file}")
    lines.append(f"Score: {score:.2f}")
    if entry.content:
        lines.append("")
        lines.append(entry.content)
    return "\n".join(lines)


def cmd_search(args):
    learnings_dir = _find_learnings_dir()
    entries, embeddings = cache.load_or_update(learnings_dir)

    if not entries:
        print("No learnings entries found.")
        return

    results = searcher.search(args.queries, entries, embeddings, n=args.n)

    if not results:
        print("No results above similarity threshold.")
        return

    formatted = []
    for entry, score in results:
        formatted.append(_format_result(entry, score))

    print("\n\n---\n\n".join(formatted))


def cmd_reindex(args):
    learnings_dir = _find_learnings_dir()
    entries, _ = cache.load_or_update(learnings_dir, force=True)
    print(f"Re-indexed {len(entries)} entries.")


def main():
    p = argparse.ArgumentParser(
        prog="learnings",
        description="Semantic search over docs/learnings/ files",
    )
    sub = p.add_subparsers(dest="command")

    search_p = sub.add_parser("search", help="Search learnings by query")
    search_p.add_argument("queries", nargs="+", help="One or more search query strings")
    search_p.add_argument("-n", type=int, default=5, help="Number of results (default: 5)")

    sub.add_parser("reindex", help="Force full re-index")

    args = p.parse_args()
    if args.command is None:
        p.print_help()
        sys.exit(1)

    if args.command == "search":
        cmd_search(args)
    elif args.command == "reindex":
        cmd_reindex(args)
