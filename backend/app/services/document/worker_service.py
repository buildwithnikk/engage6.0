"""PostgreSQL-backed document extraction worker with atomic leasing and hard timeouts."""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import logging
from typing import Any
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document, DocumentExtraction, DocumentJob
from app.services.document import extractor_service, storage_service

logger = logging.getLogger(__name__)

JOB_LEASE_SECONDS = 60
MAX_JOB_ATTEMPTS = 3


def _run_extraction_subprocess(
    storage_key: str, media_type: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """Isolated function run in worker process."""
    file_path = storage_service.resolve_file_path(storage_key)
    return extractor_service.extract_document_text(file_path, media_type)


def claim_next_job(db: Session) -> DocumentJob | None:
    """Atomically claim the next queued or expired-lease job."""
    now = dt.datetime.now(dt.UTC)

    stmt = (
        select(DocumentJob)
        .where(
            or_(
                DocumentJob.status == "queued",
                (DocumentJob.status == "processing") & (DocumentJob.leased_until < now),
            )
        )
        .order_by(DocumentJob.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )

    job = db.execute(stmt).scalars().first()
    if job is None:
        return None

    if job.attempts >= MAX_JOB_ATTEMPTS:
        job.status = "failed"
        job.error_code = "max_retries_exceeded"
        db.flush()
        return None

    job.attempts += 1
    job.status = "processing"
    job.leased_until = now + dt.timedelta(seconds=JOB_LEASE_SECONDS)
    db.flush()
    return job


def process_job(db: Session, job: DocumentJob) -> bool:
    """Process a claimed document job with hard timeout deadline."""
    settings = get_settings()
    now = dt.datetime.now(dt.UTC)

    # 1. Check document existence and expiry
    doc = job.document
    if doc is None or doc.expires_at < now:
        job.status = "canceled"
        job.error_code = "expired_or_deleted"
        db.flush()
        return False

    doc.status = "processing"
    db.flush()

    # 2. Execute extraction with hard deadline via ProcessPoolExecutor
    timeout = settings.document_processing_timeout_seconds
    pages = []
    candidates = []
    warnings = []
    error_code = None

    try:
        with concurrent.futures.ProcessPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                _run_extraction_subprocess,
                doc.storage_key,
                doc.media_type,
            )
            pages, candidates, warnings = future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        error_code = "processing_timeout"
        warnings.append(f"Document processing timed out after {timeout} seconds.")
    except Exception as exc:
        error_code = "extraction_failed"
        warnings.append(f"Extraction failed: {type(exc).__name__}")
        logger.warning("Document extraction failed for %s: %s", doc.id, exc)

    # 3. Re-verify document state (did a concurrent DELETE happen while processing?)
    db.refresh(job)
    db.refresh(doc)
    if job.status == "canceled" or doc.expires_at < dt.datetime.now(dt.UTC):
        # Job was canceled while processing; discard derived results
        job.status = "canceled"
        db.flush()
        return False

    if error_code:
        job.status = "failed"
        job.error_code = error_code
        doc.status = "failed"
    else:
        # Save extraction
        extraction = DocumentExtraction(
            document_id=doc.id,
            extractor_version=extractor_service.EXTRACTOR_VERSION,
            page_text=pages,
            candidate_fields=candidates,
            warnings=warnings,
        )
        db.add(extraction)
        job.status = "completed"
        job.error_code = None
        doc.status = "extracted"

    db.flush()
    return error_code is None


def run_one_pending_job(db: Session) -> bool:
    """Attempt to claim and execute one pending job. Returns True if a job ran."""
    job = claim_next_job(db)
    if job is None:
        return False
    success = process_job(db, job)
    db.commit()
    return success
