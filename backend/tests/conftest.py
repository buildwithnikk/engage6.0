"""Test isolation.

Settings load from `backend/.env` in normal operation. That makes tests depend on
whether the developer running them happens to have a local database configured:
before anyone created a `.env`, `test_health_shape_and_unconfigured_database`
passed; the moment local PostgreSQL was set up, it failed, because the file
supplied a DATABASE_URL that `monkeypatch.delenv` cannot remove.

So the whole suite ignores `.env`. Tests control their own environment with
`monkeypatch.setenv` / `delenv` and nothing else, which means they behave the same
on a developer machine with a database and on CI without one.
"""

import pytest

from app.core import config


@pytest.fixture(autouse=True, scope="session")
def _ignore_dotenv_file():
    original = config.Settings.model_config.get("env_file")
    config.Settings.model_config["env_file"] = None
    yield
    config.Settings.model_config["env_file"] = original


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    """Settings are cached; a test that changes the environment needs a fresh read."""
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()
