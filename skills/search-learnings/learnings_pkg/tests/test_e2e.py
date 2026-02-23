import os
import subprocess
import tempfile
import textwrap

import pytest

CLI_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "bin", "learnings")
)

BUGS_AND_GOTCHAS = textwrap.dedent("""\
    # Bugs and Gotchas

    ## [2026-02-12] ECS execute-command requires --interactive

    Context: Tried to pipe pg_dump output through ecs execute-command non-interactively.
    Lesson: Always use SSM port forwarding for data transfer, not ecs exec.

    ## [2026-02-11] Docker build cache invalidation with COPY

    Context: Adding a new file to a COPY directory invalidated all subsequent layers.
    Lesson: Use .dockerignore aggressively and order COPY commands from least to most frequently changed.
""")

WORKFLOW = textwrap.dedent("""\
    # Workflow

    ## [2026-02-10] Pre-push hooks over pre-commit

    Context: Full lint suite is too slow for pre-commit.
    Lesson: Use pre-push hooks for bin/lint, bypass with --no-verify.

    ## [2026-02-09] Always rebase before merging feature branches

    Context: Merge commits made git history hard to bisect.
    Lesson: Use git pull --rebase and rebase feature branches onto main before merge.
""")


def run_cli(repo_dir, *args):
    """Run the learnings CLI in the given repo directory."""
    result = subprocess.run(
        [CLI_PATH, *args],
        cwd=repo_dir,
        capture_output=True,
        text=True,
    )
    return result.stdout, result.stderr, result.returncode


@pytest.fixture
def learnings_repo(tmp_path):
    """Create a temporary git repo with sample learnings files."""
    subprocess.run(["git", "init", str(tmp_path)], capture_output=True, check=True)

    learnings_dir = tmp_path / "docs" / "learnings"
    learnings_dir.mkdir(parents=True)

    (learnings_dir / "bugs-and-gotchas.md").write_text(BUGS_AND_GOTCHAS)
    (learnings_dir / "workflow.md").write_text(WORKFLOW)

    return tmp_path


def test_search_returns_relevant_result(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "search", "docker build caching")
    assert rc == 0
    assert "Docker build cache" in stdout
    assert "Score:" in stdout


def test_cache_hit_returns_same_results(learnings_repo):
    stdout1, _, _ = run_cli(learnings_repo, "search", "docker build caching")
    cache_file = learnings_repo / "docs" / "learnings" / ".learnings_index"
    assert cache_file.exists()

    stdout2, _, _ = run_cli(learnings_repo, "search", "docker build caching")
    assert stdout1 == stdout2


def test_different_query_returns_different_result(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "search", "git rebase workflow")
    assert rc == 0
    assert "rebase" in stdout.lower()


def test_specific_query_matches_specific_entry(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "search", "ecs execute command")
    assert rc == 0
    assert "ECS" in stdout


def test_irrelevant_query_returns_no_results(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "search", "quantum physics")
    assert rc == 0
    assert "No results above similarity threshold" in stdout


def test_n_flag_limits_results(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "search", "docker build caching", "-n", "1")
    assert rc == 0
    assert "---" not in stdout
    assert "Score:" in stdout


def test_file_modification_triggers_reindex(learnings_repo):
    # Initial search to build cache
    run_cli(learnings_repo, "search", "docker")

    # Append a new entry
    bugs_file = learnings_repo / "docs" / "learnings" / "bugs-and-gotchas.md"
    with open(bugs_file, "a") as f:
        f.write(textwrap.dedent("""
            ## [2026-02-13] Terraform state locking with DynamoDB

            Context: Two CI jobs ran terraform apply simultaneously and corrupted state.
            Lesson: Always configure DynamoDB state locking for shared Terraform backends.
        """))

    stdout, _, rc = run_cli(learnings_repo, "search", "terraform state locking")
    assert rc == 0
    assert "Terraform" in stdout


def test_reindex_counts_all_entries(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "reindex")
    assert rc == 0
    assert "Re-indexed 4 entries" in stdout


def test_no_args_shows_help(learnings_repo):
    stdout, stderr, rc = run_cli(learnings_repo)
    assert rc == 1
    output = stdout + stderr
    assert "usage:" in output.lower()


def test_readme_excluded(learnings_repo):
    # First verify baseline count
    stdout1, _, _ = run_cli(learnings_repo, "reindex")
    assert "Re-indexed 4 entries" in stdout1

    # Add a README.md with entry-like content
    readme = learnings_repo / "docs" / "learnings" / "README.md"
    readme.write_text(textwrap.dedent("""\
        # Learnings

        ## [2026-02-14] This should be ignored

        Context: README entries should not be indexed.
        Lesson: The parser skips README.md files.
    """))

    stdout2, _, rc = run_cli(learnings_repo, "reindex")
    assert rc == 0
    assert "Re-indexed 4 entries" in stdout2


def test_empty_learnings_dir(learnings_repo):
    # Remove all .md files, leaving only the directory
    learnings_dir = learnings_repo / "docs" / "learnings"
    for f in learnings_dir.glob("*.md"):
        f.unlink()

    stdout, _, rc = run_cli(learnings_repo, "search", "anything")
    assert rc == 0
    assert "No learnings entries found" in stdout


def test_file_deletion_triggers_reindex(learnings_repo):
    # Build cache with both files
    stdout1, _, _ = run_cli(learnings_repo, "reindex")
    assert "Re-indexed 4 entries" in stdout1

    # Delete one file
    (learnings_repo / "docs" / "learnings" / "workflow.md").unlink()

    stdout2, _, rc = run_cli(learnings_repo, "reindex")
    assert rc == 0
    assert "Re-indexed 2 entries" in stdout2


def test_multiple_results_have_separator(learnings_repo):
    # Add entries that are very similar so a single query matches both
    similar_file = learnings_repo / "docs" / "learnings" / "docker-tips.md"
    similar_file.write_text(textwrap.dedent("""\
        # Docker Tips

        ## [2026-02-15] Docker multi-stage builds reduce image size

        Context: Production images were 2GB because build tools were included.
        Lesson: Use multi-stage builds to separate build and runtime stages.

        ## [2026-02-14] Docker layer caching speeds up CI builds

        Context: CI builds were slow because every layer was rebuilt.
        Lesson: Structure Dockerfiles to maximize layer cache reuse.
    """))

    stdout, _, rc = run_cli(learnings_repo, "search", "docker build optimization", "-n", "4")
    assert rc == 0
    assert stdout.count("Score:") >= 2
    assert "---" in stdout


def test_search_output_includes_source_and_content(learnings_repo):
    stdout, _, rc = run_cli(learnings_repo, "search", "docker build caching", "-n", "1")
    assert rc == 0
    assert "Source:" in stdout
    assert "Context:" in stdout
    assert "Lesson:" in stdout


def test_multi_query_improves_recall(learnings_repo):
    # A single narrow query might miss some entries
    stdout_single, _, _ = run_cli(learnings_repo, "search", "ecs execute command")
    single_count = stdout_single.count("Score:")

    # Multiple query variations should match at least as many entries
    stdout_multi, _, rc = run_cli(
        learnings_repo, "search",
        "ecs execute command",
        "aws ecs remote shell",
        "ssm port forwarding",
        "container interactive session",
    )
    assert rc == 0
    multi_count = stdout_multi.count("Score:")
    assert multi_count >= single_count
    assert "ECS" in stdout_multi


def test_no_learnings_dir_errors(tmp_path):
    # Create a git repo without docs/learnings/
    subprocess.run(["git", "init", str(tmp_path)], capture_output=True, check=True)

    _, stderr, rc = run_cli(tmp_path, "search", "anything")
    assert rc == 1
    assert "Error" in stderr
