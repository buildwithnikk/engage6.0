"""Base adapter interface for government data sources."""

from __future__ import annotations

from abc import ABC, abstractmethod
import datetime as dt
from typing import Any


class BaseSourceAdapter(ABC):
    """Abstract adapter for official government portals.

    Never bypasses CAPTCHA, authentication walls, or invents private endpoints.
    Fetches only public structured data or uses verified offline snapshots.
    """

    source_key: str
    name: str
    official_url: str
    source_type: str = "portal"
    jurisdiction: str = "central"
    state_code: str | None = None

    @abstractmethod
    def fetch_candidates(self) -> list[dict[str, Any]]:
        """Fetch candidate schemes as structured dictionaries ready for staging.

        Each candidate must contain:
        - slug (unique, url-safe)
        - official_name
        - department
        - jurisdiction ('central' or 'state')
        - state_code (if state)
        - benefit_summary
        - eligibility_rules (valid Version 1 rule document)
        - required_documents (list of required document names or dicts)
        - official_apply_url (verified portal url)
        - source_url (verified department / guideline url)
        """
        raise NotImplementedError
