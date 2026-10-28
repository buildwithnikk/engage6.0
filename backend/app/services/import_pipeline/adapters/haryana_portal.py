"""Adapter for Haryana Government Citizen Services (Antyodaya Saral / saralharyana.gov.in)."""

from __future__ import annotations

from typing import Any
from app.services.import_pipeline.adapters.base import BaseSourceAdapter


class HaryanaPortalAdapter(BaseSourceAdapter):
    source_key = "haryana_saral"
    name = "Antyodaya Saral Portal (Government of Haryana)"
    official_url = "https://saralharyana.gov.in"
    source_type = "portal"
    jurisdiction = "state"
    state_code = "HR"

    def fetch_candidates(self) -> list[dict[str, Any]]:
        """Structured candidate data from official Haryana portal guidelines.

        Data remains unverified (draft/pending) until an admin reviewer verifies it.
        """
        return [
            {
                "slug": "haryana-post-matric-scholarship-sc-students",
                "official_name": "Haryana Post-Matric Scholarship Scheme for SC Students",
                "department": "Department of Social Justice and Empowerment, Welfare of SCs & BCs, Haryana",
                "jurisdiction": "state",
                "state_code": "HR",
                "benefit_summary": (
                    "Reimbursement of compulsory non-refundable course fees and monthly maintenance allowance "
                    "for Scheduled Caste students pursuing post-matriculation or higher degree courses in Haryana."
                ),
                "eligibility_rules": {
                    "version": "1",
                    "all": [
                        {"type": "state_in", "fact": "state_code", "values": ["HR"]},
                        {"type": "age_min", "fact": "age", "value": 16},
                        {"type": "income_max", "fact": "annual_income", "value": 250000},
                        {"type": "category_in", "fact": "caste_category", "values": ["SC"]},
                        {"type": "is_true", "fact": "is_student"},
                    ],
                },
                "required_documents": [
                    {"id": "ppp_id", "name": "Parivar Pehchan Patra (Family ID) / Haryana Resident Certificate", "mandatory": True},
                    {"id": "caste_cert", "name": "Scheduled Caste (SC) Certificate", "mandatory": True},
                    {"id": "income_cert", "name": "Income Certificate / PPP Verified Income", "mandatory": True},
                    {"id": "fee_receipt", "name": "Current Year College Admission Fee Receipt", "mandatory": True},
                    {"id": "bank_account", "name": "Aadhaar-seeded Bank Account Details", "mandatory": True},
                ],
                "official_apply_url": "https://saralharyana.gov.in",
                "source_url": "https://saralharyana.gov.in",
            }
        ]
