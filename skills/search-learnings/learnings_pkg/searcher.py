import numpy as np

from . import embedder


def search(queries, entries, embeddings, n=5, threshold=0.5):
    """Search entries by cosine similarity to one or more queries.

    queries can be a string or list of strings. When multiple queries are
    provided, each entry's score is the max similarity across all queries.

    Returns list of (entry, score) tuples, sorted by score descending.
    """
    if not entries or embeddings.size == 0:
        return []

    if isinstance(queries, str):
        queries = [queries]

    # Compute similarities for each query, take the max per entry
    entry_norms = np.linalg.norm(embeddings, axis=1)
    best_scores = np.full(len(entries), -1.0)

    for query in queries:
        query_vec = embedder.embed_query(query)
        query_norm = np.linalg.norm(query_vec)
        norms = entry_norms * query_norm
        norms = np.where(norms == 0, 1, norms)
        similarities = np.dot(embeddings, query_vec) / norms
        best_scores = np.maximum(best_scores, similarities)

    # Filter by threshold and sort
    results = []
    for i, score in enumerate(best_scores):
        if score >= threshold:
            results.append((entries[i], float(score)))

    results.sort(key=lambda x: x[1], reverse=True)
    return results[:n]
