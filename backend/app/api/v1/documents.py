"""Visitor endpoints for document upload, extraction status, and questionnaire confirmation."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Annotated
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings, get_settings
from app.db.session import get_sessionmaker
from app.models.document import (
    DOCUMENT_MEDIA_TYPES,
    Document,
    DocumentExtraction,
    DocumentJob,
    DocumentSession,
)
from app.schemas.document import (
    ConfirmAnswersRequest,
    ConfirmAnswersResponse,
    DocumentExtractionResponse,
    DocumentSessionResponse,
    DocumentStatusResponse,
    DocumentUploadResponse,
    ExtractionCandidate,
    PageTextItem,
)
from app.services.document import (
    session_service,
    storage_service,
    validation_service,
    worker_service,
)
from app.services.document.authorization import (
    get_current_document_session,
    require_doc_csrf,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])


def _run_worker_in_background() -> None:
    """Execute queued document jobs in a background task."""
    try:
        session_factory = get_sessionmaker()
        with session_factory() as db:
            worker_service.run_one_pending_job(db)
    except Exception as exc:
        logger.error("Background worker execution failed: %s", exc)


@router.post(
    "/document-sessions",
    response_model=DocumentSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize an anonymous document session",
    description="Creates an anonymous visitor session, sets an HttpOnly cookie, and returns a CSRF token.",
)
def create_session(
    response: Response,
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentSessionResponse:
    doc_session, raw_token, raw_csrf = session_service.create_document_session(db)
    db.commit()

    response.set_cookie(
        key=settings.document_session_cookie_name,
        value=raw_token,
        httponly=True,
        secure=settings.admin_cookie_secure,
        samesite=settings.admin_cookie_samesite,
        max_age=7200,
        path="/",
    )

    return DocumentSessionResponse(
        session_id=doc_session.id,
        csrf_token=raw_csrf,
        expires_at=doc_session.expires_at,
        max_file_size=settings.document_max_file_size,
        allowed_media_types=list(DOCUMENT_MEDIA_TYPES),
        max_pages=settings.document_max_pages,
        max_active_documents=settings.document_max_active_per_session,
    )


@router.get(
    "/document-sessions/current",
    response_model=DocumentSessionResponse,
    summary="Get current document session info",
    description="Returns session metadata and a fresh CSRF token for the active visitor.",
)
def get_current_session_info(
    doc_session: Annotated[DocumentSession, Depends(get_current_document_session)],
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentSessionResponse:
    fresh_csrf = session_service.refresh_csrf_token(db, doc_session)
    db.commit()

    return DocumentSessionResponse(
        session_id=doc_session.id,
        csrf_token=fresh_csrf,
        expires_at=doc_session.expires_at,
        max_file_size=settings.document_max_file_size,
        allowed_media_types=list(DOCUMENT_MEDIA_TYPES),
        max_pages=settings.document_max_pages,
        max_active_documents=settings.document_max_active_per_session,
    )


@router.delete(
    "/document-sessions/current",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Terminate document session and delete all session data",
)
def delete_current_session(
    response: Response,
    doc_session: Annotated[DocumentSession, Depends(require_doc_csrf)],
    db: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    # Delete all storage files for this session's documents
    docs = db.execute(
        select(Document).where(Document.session_id == doc_session.id)
    ).scalars().all()
    for doc in docs:
        storage_service.delete_file(doc.storage_key)

    db.delete(doc_session)
    db.commit()

    response.delete_cookie(key=settings.document_session_cookie_name, path="/")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a document for OCR and field extraction",
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    consent: bool = Form(...),
    doc_session: DocumentSession = Depends(require_doc_csrf),
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> DocumentUploadResponse:
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User consent is required before processing documents.",
        )

    # Check active document limit for this session
    active_count = db.execute(
        select(func.count(Document.id)).where(Document.session_id == doc_session.id)
    ).scalar_one()

    if active_count >= settings.document_max_active_per_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Active document limit reached (maximum {settings.document_max_active_per_session}). Please remove an existing document before uploading a new one.",
        )

    # Read and inspect content
    content = await file.read(settings.document_max_file_size + 1024)
    if len(content) > settings.document_max_file_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.document_max_file_size // (1024 * 1024)} MiB.",
        )

    try:
        media_type, page_count = validation_service.inspect_and_validate_upload(
            content=content,
            declared_content_type=file.content_type,
            original_filename=file.filename,
        )
    except validation_service.DocumentValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # Store file securely on disk
    storage_key = str(uuid.uuid4())
    storage_service.save_file(storage_key, content)

    now = dt.datetime.now(dt.UTC)
    expires_at = now + dt.timedelta(minutes=settings.document_retention_minutes)

    # Sanitize original filename (keep only basename)
    safe_name = file.filename.split("/")[-1].split("\\")[-1] if file.filename else None

    document = Document(
        session_id=doc_session.id,
        storage_key=storage_key,
        original_filename=safe_name,
        media_type=media_type,
        file_size=len(content),
        page_count=page_count,
        status="uploaded",
        expires_at=expires_at,
    )
    db.add(document)
    db.flush()

    job = DocumentJob(
        document_id=document.id,
        status="queued",
    )
    db.add(job)
    db.commit()

    # Trigger worker in background
    background_tasks.add_task(_run_worker_in_background)

    return DocumentUploadResponse(
        id=document.id,
        status=document.status,
        media_type=document.media_type,
        file_size=document.file_size,
        page_count=document.page_count,
        expires_at=document.expires_at,
        created_at=document.created_at,
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentStatusResponse,
    summary="Get document processing status",
)
def get_document_status(
    document_id: uuid.UUID,
    doc_session: Annotated[DocumentSession, Depends(get_current_document_session)],
    db: Annotated[Session, Depends(get_session)],
) -> DocumentStatusResponse:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.session_id == doc_session.id,
    )
    document = db.execute(stmt).scalars().first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    # Get warnings and error code if available
    job_stmt = (
        select(DocumentJob)
        .where(DocumentJob.document_id == document.id)
        .order_by(DocumentJob.created_at.desc())
    )
    latest_job = db.execute(job_stmt).scalars().first()

    ext_stmt = select(DocumentExtraction).where(DocumentExtraction.document_id == document.id)
    extraction = db.execute(ext_stmt).scalars().first()

    warnings = extraction.warnings if extraction else []
    error_code = latest_job.error_code if latest_job and latest_job.status == "failed" else None

    return DocumentStatusResponse(
        id=document.id,
        status=document.status,
        media_type=document.media_type,
        file_size=document.file_size,
        page_count=document.page_count,
        expires_at=document.expires_at,
        created_at=document.created_at,
        error_code=error_code,
        warnings=warnings,
    )


@router.get(
    "/documents/{document_id}/extraction",
    response_model=DocumentExtractionResponse,
    summary="Get document extracted text and candidate fields",
)
def get_document_extraction(
    document_id: uuid.UUID,
    doc_session: Annotated[DocumentSession, Depends(get_current_document_session)],
    db: Annotated[Session, Depends(get_session)],
) -> DocumentExtractionResponse:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.session_id == doc_session.id,
    )
    document = db.execute(stmt).scalars().first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    ext_stmt = select(DocumentExtraction).where(DocumentExtraction.document_id == document.id)
    extraction = db.execute(ext_stmt).scalars().first()

    pages = (
        [PageTextItem(**p) for p in extraction.page_text]
        if extraction and extraction.page_text
        else []
    )
    candidates = (
        [ExtractionCandidate(**c) for c in extraction.candidate_fields]
        if extraction and extraction.candidate_fields
        else []
    )
    warnings = extraction.warnings if extraction else []
    extractor_ver = extraction.extractor_version if extraction else "none"

    return DocumentExtractionResponse(
        document_id=document.id,
        status=document.status,
        extractor_version=extractor_ver,
        pages=pages,
        candidates=candidates,
        warnings=warnings,
        confirmed_answers=document.confirmed_answers or {},
    )


@router.post(
    "/documents/{document_id}/confirm",
    response_model=ConfirmAnswersResponse,
    summary="Explicitly confirm extracted or corrected answers",
)
def confirm_document_answers(
    document_id: uuid.UUID,
    payload: ConfirmAnswersRequest,
    doc_session: Annotated[DocumentSession, Depends(require_doc_csrf)],
    db: Annotated[Session, Depends(get_session)],
) -> ConfirmAnswersResponse:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.session_id == doc_session.id,
    )
    document = db.execute(stmt).scalars().first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    document.confirmed_answers = payload.answers
    db.commit()

    return ConfirmAnswersResponse(
        document_id=document.id,
        confirmed_answers=document.confirmed_answers,
        status=document.status,
    )


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document and cancel its processing",
)
def delete_document(
    document_id: uuid.UUID,
    doc_session: Annotated[DocumentSession, Depends(require_doc_csrf)],
    db: Annotated[Session, Depends(get_session)],
) -> Response:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.session_id == doc_session.id,
    )
    document = db.execute(stmt).scalars().first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    # Cancel any active jobs
    jobs = db.execute(
        select(DocumentJob).where(DocumentJob.document_id == document.id)
    ).scalars().all()
    for job in jobs:
        if job.status in ("queued", "processing"):
            job.status = "canceled"

    # Delete storage file
    storage_service.delete_file(document.storage_key)

    # Delete document record (cascades to jobs and extractions)
    db.delete(document)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
