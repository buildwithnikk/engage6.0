"""Private local storage service for uploaded documents.

Stores files in a secure directory outside web roots with 0700 permissions.
Storage keys are random UUIDs; uploaded filenames are never used as filesystem paths.
"""

from __future__ import annotations

import os
from pathlib import Path
import re

from app.core.config import get_settings

SAFE_KEY_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


class StorageError(Exception):
    """Base storage error."""


class InvalidStorageKeyError(StorageError):
    """Storage key contains illegal characters or path traversal."""


def get_storage_dir() -> Path:
    settings = get_settings()
    directory = Path(settings.document_storage_dir).resolve()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Ensure permissions are restrictive
    try:
        os.chmod(directory, 0o700)
    except OSError:
        pass
    return directory


def resolve_file_path(storage_key: str) -> Path:
    if not storage_key or not SAFE_KEY_PATTERN.match(storage_key):
        raise InvalidStorageKeyError("Invalid storage key format.")
    root = get_storage_dir()
    path = (root / storage_key).resolve()
    if not str(path).startswith(str(root)):
        raise InvalidStorageKeyError("Path traversal detected.")
    return path


def save_file(storage_key: str, content: bytes) -> Path:
    path = resolve_file_path(storage_key)
    path.write_bytes(content)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return path


def read_file(storage_key: str) -> bytes:
    path = resolve_file_path(storage_key)
    if not path.is_file():
        raise StorageError(f"File '{storage_key}' not found in storage.")
    return path.read_bytes()


def delete_file(storage_key: str) -> bool:
    try:
        path = resolve_file_path(storage_key)
        if path.is_file():
            path.unlink()
            return True
        return False
    except InvalidStorageKeyError:
        return False
    except OSError as exc:
        raise StorageError(f"Failed to delete file: {exc}") from exc


def cleanup_storage_files(valid_keys: set[str]) -> int:
    """Remove any orphaned files on disk whose keys are not in valid_keys."""
    root = get_storage_dir()
    deleted = 0
    if not root.is_dir():
        return 0
    for child in root.iterdir():
        if child.is_file() and child.name not in valid_keys:
            try:
                child.unlink()
                deleted += 1
            except OSError:
                pass
    return deleted
