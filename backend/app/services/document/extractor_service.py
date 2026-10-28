"""Text extraction and deterministic field parsing for documents.

Combines native PDF text extraction, pypdfium2 rasterization, and local Tesseract
OCR (English + Hindi). Extracts candidate fields for the eligibility questionnaire.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
import re
import shutil
from typing import Any

from PIL import Image, ImageOps
import pypdf
import pypdfium2
import pytesseract

EXTRACTOR_VERSION = "sahayak-ocr-v1.0.0"

# State lookup dictionary: English name / Hindi name -> 2-letter state code
STATE_LOOKUP = {
    "uttar pradesh": "UP",
    "उत्तर प्रदेश": "UP",
    "up": "UP",
    "maharashtra": "MH",
    "महाराष्ट्र": "MH",
    "mh": "MH",
    "bihar": "BR",
    "बिहार": "BR",
    "br": "BR",
    "karnataka": "KA",
    "कर्नाटक": "KA",
    "ka": "KA",
    "delhi": "DL",
    "दिल्ली": "DL",
    "dl": "DL",
    "rajasthan": "RJ",
    "राजस्थान": "RJ",
    "rj": "RJ",
    "madhya pradesh": "MP",
    "मध्य प्रदेश": "MP",
    "mp": "MP",
    "gujarat": "GJ",
    "गुजरात": "GJ",
    "gj": "GJ",
    "west bengal": "WB",
    "पश्चिम बंगाल": "WB",
    "wb": "WB",
    "tamil nadu": "TN",
    "तमिलनाडु": "TN",
    "tn": "TN",
    "kerala": "KL",
    "केरल": "KL",
    "kl": "KL",
    "punjab": "PB",
    "पंजाब": "PB",
    "pb": "PB",
    "haryana": "HR",
    "हरियाणा": "HR",
    "hr": "HR",
}


def is_tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def get_available_tesseract_languages() -> list[str]:
    if not is_tesseract_available():
        return []
    try:
        return pytesseract.get_languages()
    except Exception:
        return []


def resolve_ocr_languages() -> str:
    langs = get_available_tesseract_languages()
    chosen: list[str] = []
    if "eng" in langs:
        chosen.append("eng")
    if "hin" in langs:
        chosen.append("hin")
    return "+".join(chosen) if chosen else "eng"


def extract_document_text(
    file_path: Path, media_type: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """Extract page text and candidate fields from a local document.

    Returns:
        (pages, candidates, warnings)
    """
    pages: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    warnings: list[str] = []

    ocr_lang = resolve_ocr_languages()
    if not is_tesseract_available():
        warnings.append("Local Tesseract OCR binary not found. Scanned pages cannot be parsed.")
    elif "hin" not in ocr_lang:
        warnings.append("Hindi OCR language pack not installed; running English only.")

    if media_type == "application/pdf":
        _extract_pdf(file_path, ocr_lang, pages, warnings)
    else:
        _extract_image(file_path, ocr_lang, pages, warnings)

    # Parse candidate fields from all page texts
    for p in pages:
        page_num = p["page"]
        text = p["text"]
        method = p["method"]
        page_candidates = parse_candidates_from_text(text, page_num, method)
        candidates.extend(page_candidates)

    return pages, candidates, warnings


def _extract_pdf(
    file_path: Path,
    ocr_lang: str,
    pages: list[dict[str, Any]],
    warnings: list[str],
) -> None:
    # 1. Native text extraction via pypdf
    native_pages: list[str] = []
    try:
        reader = pypdf.PdfReader(str(file_path))
        for page in reader.pages:
            t = page.extract_text() or ""
            native_pages.append(t.strip())
    except Exception as exc:
        warnings.append(f"Native PDF text extraction failed: {exc}")

    # 2. Check each page: if sparse/empty, render and OCR with pypdfium2
    pdfium_doc = None
    try:
        pdfium_doc = pypdfium2.PdfDocument(str(file_path))
    except Exception:
        pass

    for idx, native_text in enumerate(native_pages, start=1):
        # If native text has 20 or more non-whitespace characters, use it
        clean = "".join(native_text.split())
        if len(clean) >= 20:
            pages.append({
                "page": idx,
                "text": native_text,
                "method": "native_pdf",
            })
        else:
            # Need OCR rasterization
            if is_tesseract_available() and pdfium_doc is not None and idx <= len(pdfium_doc):
                try:
                    pdf_page = pdfium_doc.get_page(idx - 1)
                    # Render page at 150 DPI (scale ~2.08)
                    pil_img = pdf_page.render(scale=2.0).to_pil()
                    ocr_text = pytesseract.image_to_string(pil_img, lang=ocr_lang)
                    pages.append({
                        "page": idx,
                        "text": ocr_text.strip(),
                        "method": "tesseract_ocr",
                    })
                except Exception as exc:
                    warnings.append(f"OCR failed on page {idx}: {exc}")
                    pages.append({
                        "page": idx,
                        "text": native_text,
                        "method": "native_pdf",
                    })
            else:
                pages.append({
                    "page": idx,
                    "text": native_text,
                    "method": "native_pdf",
                })


def _extract_image(
    file_path: Path,
    ocr_lang: str,
    pages: list[dict[str, Any]],
    warnings: list[str],
) -> None:
    if not is_tesseract_available():
        pages.append({
            "page": 1,
            "text": "",
            "method": "unavailable",
        })
        return

    try:
        img = Image.open(file_path)
        img = ImageOps.exif_transpose(img)  # Normalize orientation
        ocr_text = pytesseract.image_to_string(img, lang=ocr_lang)
        pages.append({
            "page": 1,
            "text": ocr_text.strip(),
            "method": "tesseract_ocr",
        })
    except Exception as exc:
        warnings.append(f"Image OCR extraction error: {exc}")
        pages.append({
            "page": 1,
            "text": "",
            "method": "failed",
        })


def parse_candidates_from_text(text: str, page: int, method: str) -> list[dict[str, Any]]:
    """Parse allowlisted questionnaire candidate fields (age, annual_income, state_code)."""
    candidates: list[dict[str, Any]] = []

    # 1. Date of Birth -> Age
    dob_match = _find_dob(text)
    if dob_match:
        dob_str, raw_snippet = dob_match
        age = _calculate_age(dob_str)
        if age is not None:
            candidates.append({
                "field": "age",
                "value": age,
                "raw_text": raw_snippet,
                "page": page,
                "method": method,
                "confidence": None,
            })

    # 2. Annual Income
    income = _find_annual_income(text)
    if income:
        amount, raw_snippet = income
        candidates.append({
            "field": "annual_income",
            "value": amount,
            "raw_text": raw_snippet,
            "page": page,
            "method": method,
            "confidence": None,
        })

    # 3. State Code
    state = _find_state(text)
    if state:
        code, raw_snippet = state
        candidates.append({
            "field": "state_code",
            "value": code,
            "raw_text": raw_snippet,
            "page": page,
            "method": method,
            "confidence": None,
        })

    return candidates


def _find_dob(text: str) -> tuple[str, str] | None:
    # Pattern 1: explicit label followed by date
    label_patterns = [
        r"(?i)(?:DOB|Date of Birth|जन्म तिथि|D\.O\.B\.|जन्म तारीख)[\s:]*([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.][12][0-9]{3})",
        r"(?i)(?:DOB|Date of Birth|जन्म तिथि|D\.O\.B\.)[\s:]*([12][0-9]{3}[\/\-.][0-1]?[0-9][\/\-.][0-3]?[0-9])",
    ]
    for pattern in label_patterns:
        m = re.search(pattern, text)
        if m:
            return m.group(1), m.group(0)

    # Pattern 2: standalone dates formatted as DD/MM/YYYY
    general_pattern = r"\b([0-3][0-9][\/\-.][0-1][0-9][\/\-.][12][0-9]{3})\b"
    m = re.search(general_pattern, text)
    if m:
        return m.group(1), m.group(0)

    return None


def _calculate_age(date_str: str) -> int | None:
    date_str = date_str.replace("-", "/").replace(".", "/")
    parts = date_str.split("/")
    try:
        if len(parts[0]) == 4:  # YYYY/MM/DD
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
        else:  # DD/MM/YYYY
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])

        born = dt.date(year, month, day)
        today = dt.date.today()
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        if 0 <= age <= 125:
            return age
    except (ValueError, TypeError):
        pass
    return None


def _find_annual_income(text: str) -> tuple[int, str] | None:
    patterns = [
        r"(?i)(?:Annual Income|वार्षिक आय|Total Income|Gross Income|कुल आय)[\s:₹RsINR.]*([0-9,]+)",
        r"(?i)(?:Income|आय)[\s:₹RsINR.]*([0-9,]+)\s*(?:per annum|p\.a\.|वार्षिक)?",
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            raw_val = m.group(1).replace(",", "")
            try:
                val = int(raw_val)
                if val >= 1000:  # Reasonable minimum annual income threshold
                    return val, m.group(0)
            except ValueError:
                pass
    return None


def _find_state(text: str) -> tuple[str, str] | None:
    text_lower = text.lower()
    for name, code in STATE_LOOKUP.items():
        # Match whole word
        pattern = rf"\b{re.escape(name)}\b"
        m = re.search(pattern, text_lower)
        if m:
            return code, m.group(0)
    return None
