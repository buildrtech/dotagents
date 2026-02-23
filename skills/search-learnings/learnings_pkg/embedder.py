import logging
import os
import warnings

import numpy as np

_model = None


def _get_model():
    global _model
    if _model is None:
        # Suppress noisy warnings from transformers/HF hub/torch
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
        warnings.filterwarnings("ignore", category=FutureWarning)
        logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
        logging.getLogger("transformers").setLevel(logging.ERROR)
        logging.getLogger("huggingface_hub").setLevel(logging.WARNING)

        from sentence_transformers import SentenceTransformer

        # Suppress progress bars and load reports from safetensors/torch
        # Use fd-level redirect to catch C-level output too
        devnull = os.open(os.devnull, os.O_WRONLY)
        old_stdout_fd = os.dup(1)
        old_stderr_fd = os.dup(2)
        os.dup2(devnull, 1)
        os.dup2(devnull, 2)
        try:
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        finally:
            os.dup2(old_stdout_fd, 1)
            os.dup2(old_stderr_fd, 2)
            os.close(old_stdout_fd)
            os.close(old_stderr_fd)
            os.close(devnull)
    return _model


def embed_entries(entries):
    """Batch embed entry full_text fields. Returns np.ndarray of shape (n, dim)."""
    model = _get_model()
    texts = [e.full_text for e in entries]
    if not texts:
        return np.array([])
    return model.encode(texts, show_progress_bar=False)


def embed_query(query):
    """Embed a single query string. Returns np.ndarray of shape (dim,)."""
    model = _get_model()
    return model.encode(query, show_progress_bar=False)
