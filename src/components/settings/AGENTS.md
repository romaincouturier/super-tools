# Architecture

- Training regulation drafts and immutable PDF versions use dedicated admin-only RPCs over app_settings, excluded from generic autosave; publication atomically archives the prior URL and switches the existing public link, so draft edits cannot replace published documents.