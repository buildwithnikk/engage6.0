"""Adapter for National Scholarship Portal (NSP / scholarships.gov.in)."""

from __future__ import annotations

from typing import Any
from app.services.import_pipeline.adapters.base import BaseSourceAdapter


class NationalScholarshipAdapter(BaseSourceAdapter):
    source_key = "nsp_central"
    name = "National Scholarship Portal (Government of India)"
    official_url = "https://scholarships.gov.in"
    source_type = "portal"
    jurisdiction = "central"
    state_code = None

    def fetch_candidates(self) -> list[dict[str, Any]]:
        """Structured candidate data from verified NSP guidelines.

        Data is marked as unverified (draft/pending) until an admin reviews it.
        """
        return [
            {
                "slug": "central-sector-scholarship-college-students",
                "official_name": "Central Sector Scheme of Scholarship for College and University Students",
                "department": "Department of Higher Education, Ministry of Education",
                "jurisdiction": "central",
                "state_code": None,
                "benefit_summary": (
                    "Financial assistance to meritorious students from low-income families pursuing regular "
                    "degree courses: ₹12,000 per annum for graduation and ₹20,000 per annum for post-graduation."
                ),
                "eligibility_rules": {
                    "version": "1",
                    "all": [
                        {"type": "age_min", "fact": "age", "value": 17},
                        {"type": "age_max", "fact": "age", "value": 26},
                        {"type": "income_max", "fact": "annual_income", "value": 450000},
                        {"type": "is_true", "fact": "is_student"},
                    ],
                },
                "required_documents": [
                    {"id": "income_cert", "name": "Income Certificate", "mandatory": True},
                    {"id": "marksheet_12", "name": "Class 12 Passing Marksheet", "mandatory": True},
                    {"id": "bank_passbook", "name": "Bank Passbook with Account Number & IFSC", "mandatory": True},
                    {"id": "aadhaar", "name": "Aadhaar Card", "mandatory": True},
                    {"id": "college_bonafide", "name": "Bonafide Student Certificate from College", "mandatory": True},
                ],
                "official_apply_url": "https://scholarships.gov.in",
                "source_url": "https://scholarships.gov.in",
            }
        ]
