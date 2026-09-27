#!/usr/bin/env python3
"""
setup_session.py — Script chạy 1 lần để đăng nhập Google và lưu session

Chạy script này khi:
- Lần đầu setup
- Session hết hạn (thường sau 7-14 ngày)
- Sau khi đổi mật khẩu Google

Cách dùng:
    cd /Users/banhdaidung/Documents/Ai Creative/backend
    source .venv/bin/activate
    python setup_session.py
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from playwright.async_api import async_playwright
from session_manager import save_cookies, SESSION_FILE


async def manual_login_and_save():
    """
    Mở browser có UI để sếp tự đăng nhập Google.
    Sau khi đăng nhập xong, cookies sẽ được lưu tự động.
    """
    print("=" * 60)
    print("🔐 Google Flow Session Setup")
    print("=" * 60)
    print()
    print("Trình duyệt sẽ mở ra. Vui lòng:")
    print("  1. Đăng nhập bằng Google Account của bạn")
    print("  2. Truy cập vào flow.google.com")
    print("  3. Đảm bảo bạn đã ở trong dashboard của Google Flow")
    print("  4. Quay lại terminal này và nhấn ENTER")
    print()
    print("⚠️  Lưu ý: Không cần đóng browser thủ công")
    print()

    async with async_playwright() as p:
        # Chạy headful (có UI) để user đăng nhập thủ công
        browser = await p.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )

        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/128.0.0.0 Safari/537.36"
            ),
        )

        page = await context.new_page()

        # Mở Google Flow
        await page.goto("https://flow.google.com", wait_until="domcontentloaded")
        print("🌐 Trình duyệt đã mở flow.google.com")
        print()
        print("👉 Hãy đăng nhập vào Google Account của bạn trong cửa sổ trình duyệt...")
        print()

        # Chờ user đăng nhập
        input("✅ Sau khi đã đăng nhập và thấy dashboard Flow, nhấn ENTER ở đây: ")

        # Thu thập cookies
        cookies = await context.cookies()
        google_cookies = [c for c in cookies if "google" in c.get("domain", "")]

        if google_cookies:
            save_cookies(cookies)
            print()
            print(f"✅ Đã lưu {len(cookies)} cookies ({len(google_cookies)} Google cookies)")
            print(f"📁 Session file: {SESSION_FILE}")
            print()
            print("🎉 Setup hoàn tất! Backend sẽ tự động sử dụng session này.")
            print("   Session thường có hiệu lực 7-14 ngày.")
        else:
            print("❌ Không tìm thấy Google cookies. Vui lòng đảm bảo đã đăng nhập.")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(manual_login_and_save())
