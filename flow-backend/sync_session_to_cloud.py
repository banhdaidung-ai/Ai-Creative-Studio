#!/usr/bin/env python3
"""
sync_session_to_cloud.py — Đồng bộ Cookie Google Flow từ máy Mac lên Oracle Cloud (10 giây)

Cách dùng:
    python3 sync_session_to_cloud.py --url https://<ip>.sslip.io --token <FLOW_ACCESS_TOKEN>

Tuỳ chọn:
    --relogin : Buộc mở trình duyệt Chrome trên Mac để đăng nhập lại Google trước khi đẩy lên Cloud.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from session_manager import SESSION_FILE, load_cookies
from setup_session import manual_login_and_save


def normalize_base_url(raw_url: str) -> str:
    url = raw_url.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


def push_session(base_url: str, token: str, cookies: list[dict]) -> None:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Flow-Token"] = token

    print(f"📤 Đang đẩy {len(cookies)} cookies lên {base_url} ...")
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{base_url}/api/import-session",
                headers=headers,
                json={"cookies": cookies},
            )
            if resp.status_code == 401:
                print("❌ Sai hoặc thiếu mã bảo mật FLOW_ACCESS_TOKEN (HTTP 401).")
                sys.exit(1)
            resp.raise_for_status()
            data = resp.json()
            print(f"✅ Server phản hồi: {data.get('message', 'Đã lưu session!')}")

            status_resp = client.get(f"{base_url}/api/session-status", headers=headers)
            status_resp.raise_for_status()
            status_data = status_resp.json()
            if status_data.get("has_session"):
                print("🎉 Xác nhận thành công: Oracle Cloud Backend đã sẵn sàng tạo ảnh & video 24/7!")
            else:
                print(f"⚠️ Cảnh báo trạng thái session: {status_data}")
    except httpx.HTTPStatusError as exc:
        print(f"❌ Server trả về lỗi HTTP {exc.response.status_code}: {exc.response.text}")
        sys.exit(1)
    except httpx.RequestError as exc:
        print(f"❌ Không kết nối được tới {base_url}: {exc}")
        print("   Hãy kiểm tra VM Oracle đang chạy và đã mở cổng 80/443 trong VCN Security List.")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Đồng bộ Cookie Google Flow lên Oracle Cloud Backend")
    parser.add_argument(
        "--url",
        default=os.getenv("FLOW_CLOUD_URL", ""),
        help="URL HTTPS của Oracle Cloud Backend (vd: https://129-150-10-20.sslip.io)",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("FLOW_ACCESS_TOKEN", ""),
        help="Mã FLOW_ACCESS_TOKEN tạo khi chạy deploy-oracle.sh",
    )
    parser.add_argument(
        "--relogin",
        action="store_true",
        help="Mở lại Chrome để đăng nhập Google và lấy cookie mới trước khi đồng bộ",
    )
    args = parser.parse_args()

    cloud_url = args.url.strip()
    if not cloud_url:
        cloud_url = input("🔗 Nhập URL HTTPS của Oracle Cloud Backend (vd https://xxx.sslip.io): ").strip()
    if not cloud_url:
        print("❌ Thiếu URL backend.")
        sys.exit(1)
    base_url = normalize_base_url(cloud_url)

    token = args.token.strip()
    if not token:
        token = input("🔑 Nhập mã FLOW_ACCESS_TOKEN (bấm Enter nếu không cài token): ").strip()

    cookies = None if args.relogin else load_cookies()
    if not cookies:
        if args.relogin:
            print("🌐 Đang mở Chrome để đăng nhập lại Google Flow...")
        else:
            print(f"ℹ️ Chưa thấy cookie tại {SESSION_FILE}. Đang mở Chrome để đăng nhập lần đầu...")
        asyncio.run(manual_login_and_save())
        cookies = load_cookies()

    if not cookies:
        print("❌ Không lấy được Google Flow cookies.")
        sys.exit(1)

    push_session(base_url, token, cookies)


if __name__ == "__main__":
    main()
