"""
AI Creator Studio — Backend Entry Point (src/app.py)
Re-exports FastAPI application instance from main
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from main import app

__all__ = ["app"]
