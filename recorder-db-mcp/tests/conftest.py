import os
import sys
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="mcp-data-"))
os.environ.setdefault("DB_URL", os.environ.get("TEST_DB_URL", "postgresql://u:p@127.0.0.1:1/none"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import server  # noqa: E402


@pytest.fixture(scope="session")
def srv():
    return server


@pytest.fixture(scope="session")
def db(srv):
    if not os.environ.get("TEST_DB_URL"):
        pytest.skip("TEST_DB_URL (read-only role on a test database) not set")
    return srv
