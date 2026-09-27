"""
session_manager.py — Quản lý Google Session Cookies cho Google Flow

Lưu trữ và tái sử dụng cookies sau khi đăng nhập Google một lần.
Cookies được lưu vào file JSON để dùng lại giữa các lần khởi động server.
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Đường dẫn lưu cookie session
SESSION_DIR = Path(__file__).parent.parent / ".sessions"
SESSION_FILE = SESSION_DIR / "google_flow_session.json"


def ensure_session_dir():
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    # Thêm .gitignore để không commit cookies lên git
    gitignore = SESSION_DIR / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text("*\n")


def save_cookies(cookies: list[dict]) -> None:
    """Lưu cookies vào file JSON."""
    ensure_session_dir()
    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump({"cookies": cookies}, f, indent=2)
    logger.info(f"✅ Đã lưu {len(cookies)} cookies vào {SESSION_FILE}")


def load_cookies() -> Optional[list[dict]]:
    """Đọc cookies từ file. Trả về None nếu chưa có session."""
    if not SESSION_FILE.exists():
        return None
    try:
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        cookies = data.get("cookies", [])
        if cookies:
            logger.info(f"📂 Đã tải {len(cookies)} cookies từ session đã lưu")
            return cookies
    except Exception as e:
        logger.warning(f"Lỗi đọc session file: {e}")
    return None


def clear_cookies() -> None:
    """Xoá session (dùng khi cần đăng nhập lại)."""
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()
        logger.info("🗑️ Đã xoá session cookies")


def has_valid_session() -> bool:
    """Kiểm tra xem có session đã lưu không."""
    return SESSION_FILE.exists() and SESSION_FILE.stat().st_size > 10
