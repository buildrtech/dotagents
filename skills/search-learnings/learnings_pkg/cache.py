import glob
import hashlib
import os
import pickle

import numpy as np

from . import parser
from . import embedder

CACHE_FILENAME = ".learnings_index"


def _hash_file(filepath):
    """Return SHA256 hex digest of a file's contents."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def _get_md_files(learnings_dir):
    """Return sorted list of .md files excluding README.md."""
    pattern = os.path.join(learnings_dir, "*.md")
    files = []
    for filepath in sorted(glob.glob(pattern)):
        if os.path.basename(filepath).lower() != "readme.md":
            files.append(filepath)
    return files


def _compute_hashes(md_files):
    """Return dict mapping filepath -> SHA256 hash."""
    return {f: _hash_file(f) for f in md_files}


def _load_cache(cache_path):
    """Load cache from disk. Returns None if missing or corrupt."""
    if not os.path.exists(cache_path):
        return None
    try:
        with open(cache_path, "rb") as f:
            data = pickle.load(f)
        if not isinstance(data, dict):
            return None
        if not all(k in data for k in ("file_hashes", "entries", "embeddings")):
            return None
        return data
    except Exception:
        return None


def _save_cache(cache_path, file_hashes, entries, embeddings):
    """Save cache to disk."""
    with open(cache_path, "wb") as f:
        pickle.dump({
            "file_hashes": file_hashes,
            "entries": entries,
            "embeddings": embeddings,
        }, f)


def load_or_update(learnings_dir, force=False):
    """Load cached entries/embeddings or update as needed.

    Returns (entries, embeddings) tuple.
    """
    cache_path = os.path.join(learnings_dir, CACHE_FILENAME)
    md_files = _get_md_files(learnings_dir)
    current_hashes = _compute_hashes(md_files)

    if not md_files:
        return [], np.array([])

    cached = None if force else _load_cache(cache_path)

    if cached is not None and cached["file_hashes"] == current_hashes:
        return cached["entries"], cached["embeddings"]

    # Determine which files changed
    if cached is not None and not force:
        old_hashes = cached["file_hashes"]
        unchanged_files = {f for f, h in current_hashes.items() if old_hashes.get(f) == h}
        changed_files = {f for f in current_hashes if f not in unchanged_files}

        # Keep entries/embeddings from unchanged files
        kept_entries = []
        kept_indices = []
        for i, entry in enumerate(cached["entries"]):
            if entry.source_file in unchanged_files:
                kept_entries.append(entry)
                kept_indices.append(i)

        if kept_indices and cached["embeddings"].size > 0:
            kept_embeddings = cached["embeddings"][kept_indices]
        else:
            kept_embeddings = np.array([])

        # Parse and embed changed files
        new_entries = []
        for filepath in sorted(changed_files):
            new_entries.extend(parser.parse_file(filepath))

        if new_entries:
            new_embeddings = embedder.embed_entries(new_entries)
            all_entries = kept_entries + new_entries
            if kept_embeddings.size > 0:
                all_embeddings = np.vstack([kept_embeddings, new_embeddings])
            else:
                all_embeddings = new_embeddings
        else:
            all_entries = kept_entries
            all_embeddings = kept_embeddings
    else:
        # Full re-index
        all_entries = parser.parse_learnings(learnings_dir)
        if not all_entries:
            _save_cache(cache_path, current_hashes, [], np.array([]))
            return [], np.array([])
        all_embeddings = embedder.embed_entries(all_entries)

    _save_cache(cache_path, current_hashes, all_entries, all_embeddings)
    return all_entries, all_embeddings
