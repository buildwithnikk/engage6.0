"""Validation and safety inspection for uploaded documents."""

from __future__ import annotations

import io

from PIL import Image
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError, PdfReadError

from app.core.config import get_settings


class DocumentValidationError(Exception):
    """Validation failed on document upload."""

    def __init__(self, message: str, error_code: str = "invalid_document"):
        super().__init__(message)
        self.error_code = error_code


MAGIC_BYTES = {
    "application/pdf": b"%PDF-",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
}


def inspect_and_validate_upload(
    content: bytes,
    declared_content_type: str | None,
    original_filename: str | None,
) -> tuple[str, int]:
    """Inspect magic bytes, verify against declared type and deep parse limits.

    Returns:
        (validated_media_type, page_count)
    """
    settings = get_settings()

    if len(content) == 0:
        raise DocumentValidationError("Uploaded file is empty.", "empty_file")

    if len(content) > settings.document_max_file_size:
        raise DocumentValidationError(
            f"File exceeds maximum allowed size of {settings.document_max_file_size // (1024 * 1024)} MiB.",
            "file_too_large",
        )

    # Detect media type by magic bytes
    detected_type: str | None = None
    for m_type, magic in MAGIC_BYTES.items():
        if content.startswith(magic):
            detected_type = m_type
            break

    if detected_type is None:
        raise DocumentValidationError(
            "Unsupported file format. Only PDF, JPEG, and PNG are allowed.",
            "unsupported_media_type",
        )

    # Check against declared content type if provided
    if declared_content_type and declared_content_type.lower() != detected_type:
        # If declared as octet-stream or differing, enforce the detected signature
        pass

    # Deep inspection by format
    if detected_type == "application/pdf":
        page_count = _validate_pdf(content, settings.document_max_pages)
    else:
        page_count = _validate_image(content, detected_type, settings.document_max_pixels_per_page)

    return detected_type, page_count


def _validate_pdf(content: bytes, max_pages: int) -> int:
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise DocumentValidationError(
                "Password-protected and encrypted PDFs are not supported.",
                "encrypted_pdf",
            )
        pages = len(reader.pages)
        if pages == 0:
            raise DocumentValidationError("PDF has no readable pages.", "empty_pdf")
        if pages > max_pages:
            raise DocumentValidationError(
                f"PDF exceeds the maximum limit of {max_pages} pages (has {pages}).",
                "too_many_pages",
            )
        return pages
    except (FileNotDecryptedError, PdfReadError) as exc:
        raise DocumentValidationError(
            f"Corrupt or malformed PDF: {exc}", "corrupt_pdf"
        ) from exc
    except Exception as exc:
        if isinstance(exc, DocumentValidationError):
            raise
        raise DocumentValidationError("Unable to parse PDF structure.", "corrupt_pdf") from exc


def _validate_image(content: bytes, expected_type: str, max_pixels: int) -> int:
    try:
        img = Image.open(io.BytesIO(content))
        img.verify()  # Fast integrity verify

        # Reopen for size inspection since verify() closes/invalidates some attributes
        img = Image.open(io.BytesIO(content))
        width, height = img.size
        pixels = width * height
        if pixels > max_pixels:
            raise DocumentValidationError(
                f"Image dimensions exceed maximum allowed pixels ({pixels:,} > {max_pixels:,}).",
                "image_too_large",
            )
        return 1
    except Exception as exc:
        if isinstance(exc, DocumentValidationError):
            raise
        raise DocumentValidationError("Corrupt or invalid image file.", "corrupt_image") from exc
