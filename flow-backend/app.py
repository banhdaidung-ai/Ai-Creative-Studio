"""
AI Creator Studio — Backend Entry Point (app.py)
Re-exports FastAPI application instance from src.main
"""
import sys
from pathlib import Path

# Add backend directory and src to sys.path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.main import app

__all__ = ["app"]
