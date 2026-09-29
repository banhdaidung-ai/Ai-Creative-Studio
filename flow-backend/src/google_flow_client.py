"""
google_flow_client.py — Module tương tác Google Flow qua Playwright

Luồng hoạt động:
1. Khởi động browser Chromium (headless hoặc có UI để login lần đầu)
2. Đăng nhập Google bằng tài khoản của user (chỉ cần 1 lần, lưu cookies)
3. Điều hướng đến flow.google.com
4. Submit prompt và tham số generation
5. Chờ kết quả (ảnh / video) và trả về URL/base64

KHÔNG cần API key — dùng gói cước Google Flow của tài khoản người dùng.
"""

import asyncio
import base64
import logging
import os
import re
import time
import io
import uuid
from pathlib import Path
from typing import Optional, Union

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    async_playwright,
)

import sys
_client_dir = str(Path(__file__).parent)
if _client_dir not in sys.path:
    sys.path.insert(0, _client_dir)

from session_manager import load_cookies, save_cookies, has_valid_session
from watermark_remover import has_gemini_watermark, remove_gemini_watermark

logger = logging.getLogger(__name__)

# ── Cấu hình ──────────────────────────────────────────────────────────────────
FLOW_URL = "https://flow.google.com"
GOOGLE_LOGIN_URL = "https://accounts.google.com"

# Tài khoản Google (set trong .env — chỉ dùng lần đầu để login)
GOOGLE_EMAIL = os.getenv("GOOGLE_EMAIL", "")
GOOGLE_PASSWORD = os.getenv("GOOGLE_PASSWORD", "")

# Thư mục lưu ảnh/video tạm
MEDIA_DIR = Path(__file__).parent.parent / "media_cache"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

# Singleton browser instance
_playwright: Optional[Playwright] = None
_browser: Optional[Browser] = None
_context: Optional[BrowserContext] = None

# Google Flow hỗ trợ 5 tỉ lệ khung hình nguyên bản:
FLOW_NATIVE_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"]

# Mapping thông minh từ tỉ lệ người dùng chọn sang tỉ lệ tương ứng tối ưu nhất trên Google Flow
RATIO_TO_FLOW_MAP = {
    "1:1": "1:1",
    "16:9": "16:9",
    "9:16": "9:16",
    "4:3": "4:3",
    "3:4": "3:4",
    "2:3": "3:4",     # Khổ chân dung / Pinterest: Flow sinh 3:4 rồi backend tự động Center Crop chuẩn 2:3
    "4:5": "3:4",     # Khổ Instagram Portrait: Flow sinh 3:4 rồi crop chuẩn 4:5
    "3:2": "4:3",     # Khổ nhiếp ảnh ngang: Flow sinh 4:3 rồi crop chuẩn 3:2
    "21:9": "16:9",   # Khổ rạp phim / ultrawide: Flow sinh 16:9 rồi crop 21:9
}

ASPECT_RATIO_MAP = RATIO_TO_FLOW_MAP


def enforce_aspect_ratio(image_bytes: bytes, target_ratio: str) -> tuple[bytes, int, int]:
    """
    Đảm bảo ảnh đầu ra có CHÍNH XÁC tỷ lệ khung hình target_ratio (ví dụ "2:3", "3:2", "4:5", "16:9", "1:1").
    Nếu ảnh gốc từ Flow lệch tỷ lệ (do Flow chỉ hỗ trợ 1:1, 16:9, 9:16, 4:3, 3:4),
    thực hiện Smart Center Crop giữ nguyên chất lượng 100%, không bị kéo dãn hay mất chi tiết chính.
    Trả về (processed_bytes, width, height).
    """
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(image_bytes))
        orig_w, orig_h = im.size

        if not target_ratio or ":" not in target_ratio:
            return image_bytes, orig_w, orig_h

        parts = target_ratio.split(":")
        rw, rh = float(parts[0]), float(parts[1])
        if rw <= 0 or rh <= 0:
            return image_bytes, orig_w, orig_h

        target_aspect = rw / rh
        current_aspect = orig_w / orig_h

        # Nếu tỷ lệ đã chuẩn (chênh lệch dưới 1.5%), không cần crop
        if abs(current_aspect - target_aspect) < 0.015:
            return image_bytes, orig_w, orig_h

        logger.info(
            f"📐 Kích hoạt Smart Center Crop: ảnh gốc {orig_w}x{orig_h} ({current_aspect:.3f}) "
            f"-> cắt chuẩn xác tỷ lệ {target_ratio} ({target_aspect:.3f})"
        )

        if current_aspect > target_aspect:
            # Ảnh gốc bè ngang hơn target -> cắt bớt 2 bên trái/phải
            new_w = int(orig_h * target_aspect)
            left = (orig_w - new_w) // 2
            box = (left, 0, left + new_w, orig_h)
        else:
            # Ảnh gốc cao hơn target -> cắt bớt trên/dưới
            new_h = int(orig_w / target_aspect)
            top = (orig_h - new_h) // 2
            box = (0, top, orig_w, top + new_h)

        cropped_im = im.crop(box)
        out_buf = io.BytesIO()
        save_format = im.format if im.format in ["PNG", "JPEG", "WEBP"] else "PNG"
        if save_format == "JPEG":
            cropped_im.save(out_buf, format="JPEG", quality=98, subsampling=0)
        else:
            cropped_im.save(out_buf, format="PNG", optimize=True)

        final_bytes = out_buf.getvalue()
        final_w, final_h = cropped_im.size
        logger.info(f"✨ Đã crop thành công tỷ lệ {target_ratio}: {final_w}x{final_h} ({len(final_bytes)} bytes)")
        return final_bytes, final_w, final_h
    except Exception as e:
        logger.warning(f"Lỗi khi điều chỉnh tỷ lệ ảnh sang {target_ratio}: {e}")
        return image_bytes, 1024, 1024



def is_visually_similar(
    ref_image_path_or_bytes: Union[str, Path, bytes],
    candidate_bytes: bytes,
    threshold: float = 2.0
) -> tuple[bool, float]:
    """
    So sánh độ tương đồng trực quan giữa ảnh tham chiếu và ảnh ứng viên bằng Pillow.
    Nếu diff < threshold (thang 0-255), ảnh ứng viên thực chất là bản sao/re-encode của ảnh tham chiếu.
    Trả về (is_similar, diff_score).
    """
    try:
        from PIL import Image, ImageChops, ImageStat
        if isinstance(ref_image_path_or_bytes, (str, Path)):
            im1 = Image.open(ref_image_path_or_bytes).convert("RGB")
        else:
            im1 = Image.open(io.BytesIO(ref_image_path_or_bytes)).convert("RGB")

        im2 = Image.open(io.BytesIO(candidate_bytes)).convert("RGB")

        size = (64, 64)
        im1_thumb = im1.resize(size, Image.Resampling.LANCZOS)
        im2_thumb = im2.resize(size, Image.Resampling.LANCZOS)

        diff = ImageChops.difference(im1_thumb, im2_thumb)
        stat = ImageStat.Stat(diff)
        avg_diff = sum(stat.mean) / len(stat.mean)

        return (avg_diff < threshold), avg_diff
    except Exception as e:
        logger.warning(f"Lỗi đối chiếu trực quan ảnh: {e}")
        return False, 999.0

# ── Browser lifecycle ─────────────────────────────────────────────────────────

async def get_browser_context() -> BrowserContext:
    """Lấy hoặc tạo browser context với cookies đã lưu."""
    global _playwright, _browser, _context

    if _context is not None:
        try:
            # Kiểm tra context còn sống không
            await _context.pages()
            return _context
        except Exception:
            _context = None

    if _playwright is None:
        _playwright = await async_playwright().start()

    if _browser is None or not _browser.is_connected():
        # Chạy Chromium — headless=False khi cần login thủ công lần đầu
        _browser = await _playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )

    # Tạo context với cookies đã lưu
    _context = await _browser.new_context(
        viewport={"width": 1280, "height": 800},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/128.0.0.0 Safari/537.36"
        ),
        locale="vi-VN",
    )

    # Load saved cookies
    cookies = load_cookies()
    if cookies:
        await _context.add_cookies(cookies)
        logger.info("🍪 Loaded saved session cookies")

    return _context


async def close_browser():
    """Dọn dẹp khi shutdown."""
    global _playwright, _browser, _context
    if _context:
        await _context.close()
        _context = None
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None


# ── Authentication ─────────────────────────────────────────────────────────────

async def is_logged_in(page: Page) -> bool:
    """Kiểm tra xem đã đăng nhập Google Flow chưa."""
    try:
        await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)

        url = page.url
        logger.debug(f"Current URL after goto Flow: {url}")

        # Nếu bị redirect về Google login → chưa đăng nhập
        if "accounts.google.com" in url or "signin" in url.lower():
            return False

        # Kiểm tra có phần tử của Flow dashboard không
        try:
            await page.wait_for_selector(
                'input[placeholder], textarea[placeholder], [data-testid="prompt-input"], .prompt-input',
                timeout=8000
            )
            return True
        except Exception:
            # Flow có thể load khác nhau — kiểm tra bằng URL
            return "flow.google.com" in url

    except Exception as e:
        logger.warning(f"Login check error: {e}")
        return False


async def login_with_cookies_or_credentials(page: Page) -> bool:
    """
    Đăng nhập vào Google Flow.
    - Thử dùng cookies trước
    - Nếu thất bại: dùng email/password từ .env
    - Nếu cần 2FA: chạy headful để user tự xử lý
    """
    # Thử kiểm tra xem cookies hiện tại có hợp lệ không
    if await is_logged_in(page):
        logger.info("✅ Session cookies hợp lệ, đã đăng nhập Google Flow")
        return True

    logger.info("🔐 Cookies hết hạn hoặc chưa có — bắt đầu đăng nhập...")

    if not GOOGLE_EMAIL or not GOOGLE_PASSWORD:
        raise RuntimeError(
            "Chưa cấu hình GOOGLE_EMAIL và GOOGLE_PASSWORD trong .env. "
            "Vui lòng thêm thông tin đăng nhập Google vào file backend/.env"
        )

    try:
        # Mở Google Sign-In
        await page.goto(
            f"https://accounts.google.com/signin/v2/identifier?continue={FLOW_URL}",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        await asyncio.sleep(1)

        # Nhập email
        email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
        await email_input.fill(GOOGLE_EMAIL)
        await page.click('#identifierNext, button[jsname="LgbsSe"]')
        await asyncio.sleep(2)

        # Nhập password
        pw_input = await page.wait_for_selector('input[type="password"]', timeout=10000)
        await pw_input.fill(GOOGLE_PASSWORD)
        await page.click('#passwordNext, button[jsname="LgbsSe"]')
        await asyncio.sleep(4)

        # Kiểm tra lại sau login
        current_url = page.url
        if "myaccount.google.com" in current_url or "flow.google.com" in current_url:
            logger.info("✅ Đăng nhập Google thành công!")

            # Lưu cookies cho lần sau
            cookies = await page.context.cookies()
            save_cookies(cookies)
            return True

        # Có thể cần 2FA — thông báo
        if "challenge" in current_url or "2fa" in current_url.lower():
            logger.warning("⚠️ Tài khoản yêu cầu xác minh 2 bước!")
            raise RuntimeError(
                "Google yêu cầu xác minh 2 bước. Vui lòng chạy lệnh setup_session.py "
                "để đăng nhập thủ công một lần."
            )

        logger.warning(f"Login redirect to unexpected URL: {current_url}")
        return False

    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"Lỗi đăng nhập: {e}")
        raise RuntimeError(f"Không thể đăng nhập Google: {str(e)}")


# ── Project Editor Helpers ───────────────────────────────────────────────────

async def ensure_in_project(page: Page):
    """
    Đảm bảo browser đang mở một project editor mới và sạch của Google Flow.
    Luôn tạo project mới hoặc mở trang chủ rồi bấm New project để không bị dính nhân vật/ảnh cũ.
    """
    if "/project/" in page.url:
        return

    await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=25000)
    await asyncio.sleep(1.5)

    # 1. Thử bấm "New project" hoặc "Dự án mới" để luôn có không gian làm việc sạch
    try:
        new_proj_btn = (
            page.get_by_text("New project")
            or page.get_by_text("Dự án mới")
            or page.get_by_text("+ Dự án mới")
        )
        if await new_proj_btn.count() > 0:
            await new_proj_btn.first.click()
            await page.wait_for_url("**/project/**", timeout=15000)
            await asyncio.sleep(2)
            logger.info(f"✨ Đã tạo project mới sạch sẽ: {page.url}")
            return
    except Exception as e:
        logger.debug(f"Không thể bấm New project bằng get_by_text: {e}")

    # 2. Thử các nút Start Creating hoặc selector khác (kể cả tiếng Việt)
    start_btn = await page.query_selector(
        'button:has-text("Start Creating"), button:has-text("Bắt đầu"), [aria-label*="New project"], [role="button"]:has-text("New project"), button:has-text("Dự án mới"), [role="button"]:has-text("Dự án mới"), div:has-text("+ Dự án mới")'
    )
    if start_btn:
        await start_btn.click()
        try:
            await page.wait_for_url("**/project/**", timeout=15000)
            await asyncio.sleep(2)
            logger.info(f"✨ Đã vào project mới qua Start Creating / Dự án mới: {page.url}")
            return
        except Exception:
            pass

    # 3. Fallback chờ trang tự redirect vào project nếu có
    try:
        await page.wait_for_url("**/project/**", timeout=10000)
    except Exception:
        pass


async def configure_flow_settings(
    page: Page,
    mode: str,
    aspect_ratio: str,
    duration: int = 5,
    model_name: str = "google-flow-nano-banana-pro"
):
    """
    Cấu hình mode (Ảnh / Video), Model trên Google Flow (Nano Banana Pro / 2 / 2 Lite hoặc Veo 3.1 / Omni Flash),
    Tỷ lệ khung hình và Thời lượng.
    """
    try:
        settings_btn = await page.wait_for_selector(
            '[aria-label="Điều kiện kích hoạt cài đặt"], button:has-text("Nano Banana"), button:has-text("Video ·"), button:has-text("Omni")',
            timeout=8000
        )
        if not settings_btn:
            logger.warning("Không tìm thấy nút cài đặt Flow")
            return

        await settings_btn.click()
        await asyncio.sleep(0.6)

        # 1. Chọn Mode (Hình ảnh vs Video)
        if mode == "image":
            img_mode_btn = await page.query_selector('button:has-text("Hình ảnh"), button:has-text("image")')
            if img_mode_btn:
                await img_mode_btn.click()
                await asyncio.sleep(0.4)

            # Chọn model Image trên Google Flow
            model_dd = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
            if model_dd:
                await model_dd.click()
                await asyncio.sleep(0.4)
                
                target_model_text = "Nano Banana Pro"
                m_lower = (model_name or "").lower()
                if "lite" in m_lower:
                    target_model_text = "Nano Banana 2 Lite"
                elif "nano-banana-2" in m_lower and "pro" not in m_lower:
                    target_model_text = "Nano Banana 2"
                elif "pro" in m_lower:
                    target_model_text = "Nano Banana Pro"

                model_opt = (
                    await page.query_selector(f'[role="menuitem"]:has-text("{target_model_text}")')
                    or await page.query_selector(f'text="{target_model_text}"')
                    or await page.query_selector('text="Nano Banana Pro"')
                    or await page.query_selector('text="Nano Banana 2"')
                )
                if model_opt:
                    await model_opt.click()
                    logger.info(f"🎯 Đã chọn mô hình ảnh Flow: {target_model_text}")
                    await asyncio.sleep(0.3)
                else:
                    await page.keyboard.press("Escape")
        else:  # video mode
            vid_mode_btn = await page.query_selector('button:has-text("Video"), button:has-text("videocam")')
            if vid_mode_btn:
                await vid_mode_btn.click()
                await asyncio.sleep(0.4)

            # Chọn model Video trên Google Flow: Veo 3.1 (Quality / Fast / Lite) hoặc Omni 1.1 Flash
            model_dd = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
            if model_dd:
                await model_dd.click()
                await asyncio.sleep(0.4)

                target_video_text = "Veo 3.1 - Quality"
                vm_lower = (model_name or "").lower()
                if "omni" in vm_lower:
                    target_video_text = "Omni 1.1 Flash"
                elif "fast" in vm_lower:
                    target_video_text = "Veo 3.1 - Fast"
                elif "lite" in vm_lower:
                    target_video_text = "Veo 3.1 - Lite"
                elif "quality" in vm_lower:
                    target_video_text = "Veo 3.1 - Quality"

                veo_opt = (
                    await page.query_selector(f'[role="menuitem"]:has-text("{target_video_text}")')
                    or await page.query_selector(f'text="{target_video_text}"')
                    or await page.query_selector('text="Veo 3.1 - Quality"')
                    or await page.query_selector('text="Veo 3.1 - Fast"')
                )
                if veo_opt:
                    await veo_opt.click()
                    logger.info(f"🎯 Đã chọn mô hình video Flow: {target_video_text}")
                    await asyncio.sleep(0.3)
                else:
                    await page.keyboard.press("Escape")

            # Độ phân giải 720p cho video nếu có
            res_btn = await page.query_selector('button:has-text("720p")')
            if res_btn:
                await res_btn.click()
                await asyncio.sleep(0.2)

            # Duration cho video (4, 6, 8, 10 giây)
            dur_btn = await page.query_selector(f'button:has-text("{duration} giây")')
            if dur_btn:
                await dur_btn.click()
                await asyncio.sleep(0.2)

        # 2. Aspect Ratio: Map thông minh sang 1 trong 5 tỉ lệ Flow hỗ trợ (16:9, 1:1, 9:16, 4:3, 3:4)
        flow_ratio = RATIO_TO_FLOW_MAP.get(aspect_ratio, "1:1")
        logger.info(f"📐 Tỷ lệ người dùng chọn: '{aspect_ratio}' -> Map sang nút Flow: '{flow_ratio}'")

        # Tìm và click nút tỷ lệ trên Flow (thử cả text, aria-label và icon class)
        ratio_btn = (
            await page.query_selector(f'button:has-text("{flow_ratio}")')
            or await page.query_selector(f'[aria-label*="{flow_ratio}"]')
        )
        if not ratio_btn:
            icon_name = {
                "16:9": "crop_16_9",
                "4:3": "crop_landscape",
                "1:1": "crop_square",
                "3:4": "crop_portrait",
                "9:16": "crop_9_16"
            }.get(flow_ratio, "")
            if icon_name:
                ratio_btn = await page.query_selector(f'button:has-text("{icon_name}")')

        if ratio_btn:
            await ratio_btn.click()
            logger.info(f"✅ Đã bấm chọn tỷ lệ {flow_ratio} trên giao diện Google Flow")
            await asyncio.sleep(0.3)
        else:
            logger.warning(f"⚠️ Không tìm thấy nút tỷ lệ {flow_ratio} trên giao diện Flow")

        # Đóng popup cài đặt
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.4)
        backdrop = await page.query_selector('.cdk-overlay-backdrop')
        if backdrop:
            try:
                await backdrop.click(force=True)
            except Exception:
                await page.keyboard.press("Escape")
    except Exception as e:
        logger.debug(f"configure_flow_settings bypass: {e}")
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass


async def _get_all_media_urls(page: Page) -> set[str]:
    """Lấy danh sách các URL media hiện có trên Google Flow."""
    try:
        urls = await page.evaluate('''() => {
            const imgs = Array.from(document.querySelectorAll('img')).map(e => e.src).filter(src => src && !src.includes('gstatic') && !src.includes('googlelogo'));
            const vids = Array.from(document.querySelectorAll('video')).map(e => e.src).filter(Boolean);
            return imgs.concat(vids);
        }''')
        return set(urls)
    except Exception:
        return set()


async def _upload_single_reference_image(page: Page, reference_image_path: str) -> set[str]:
    """
    Tải một file ảnh tham chiếu lên Google Flow và bấm 'Thêm vào câu lệnh'.
    Sau khi thêm, đóng sạch mọi overlay drawer và backdrop để không cản trở thao tác tiếp theo.
    Trả về tập hợp các URL liên quan đến ảnh tham chiếu để loại trừ triệt để khỏi kết quả tạo.
    """
    ref_urls: set[str] = set()
    if not reference_image_path or not Path(reference_image_path).exists():
        return ref_urls

    try:
        logger.info(f"📤 Bắt đầu tải ảnh tham chiếu lên Flow: {reference_image_path}")
        urls_before = await _get_all_media_urls(page)

        add_btn = await page.query_selector(
            '[aria-label="Thêm thành phần vào ô nhập câu lệnh"], [aria-label*="Thêm"], [aria-label*="Add"]'
        )
        if not add_btn:
            logger.warning("Không tìm thấy nút 'Thêm thành phần vào ô nhập câu lệnh'")
            return ref_urls

        await add_btn.click(force=True)
        await asyncio.sleep(0.8)

        # Tìm nút tải lên trong drawer
        upload_btn = await page.wait_for_selector(
            'button.sidebar-upload-btn, button:has-text("Tải nội dung nghe nhìn lên"), [role="button"]:has-text("Tải")',
            timeout=8000
        )
        if not upload_btn:
            logger.warning("Không tìm thấy nút 'Tải nội dung nghe nhìn lên'")
            await page.keyboard.press("Escape")
            return ref_urls

        async with page.expect_file_chooser(timeout=8000) as fc_info:
            await upload_btn.click(force=True)
        file_chooser = await fc_info.value
        await file_chooser.set_files(reference_image_path)
        logger.info("📁 Đã chọn file ảnh tham chiếu, đang tải lên Google Flow...")

        # Chờ nút 'Thêm vào câu lệnh' xuất hiện và ĐƯỢC ENABLE (hết trạng thái disabled khi file xử lý xong)
        add_to_prompt = await page.wait_for_selector(
            'button:has-text("Thêm vào câu lệnh"):not([disabled]):not(.mat-mdc-button-disabled), .detail-add-to-prompt-btn:not([disabled]):not(.mat-mdc-button-disabled)',
            timeout=35000
        )
        if add_to_prompt:
            await add_to_prompt.click()
            logger.info("✅ Đã bấm 'Thêm vào câu lệnh' thành công khi nút đã kích hoạt!")
            await asyncio.sleep(1.5)
        else:
            logger.warning("Không tìm thấy nút 'Thêm vào câu lệnh' khả dụng")

        # Thu thập các URL mới xuất hiện sau khi upload
        urls_after = await _get_all_media_urls(page)
        ref_urls.update(urls_after - urls_before)

        # Thu thập thêm các URL của ảnh thumbnail trong ô prompt chip
        chip_urls = await page.evaluate('''() => {
            const imgs = Array.from(document.querySelectorAll(
                '.prompt-input img, [contenteditable] img, [role="textbox"] img, .chip img, [aria-label*="Xóa"] img, [aria-label*="Remove"] img, .detail-image-preview img'
            )).map(e => e.src).filter(Boolean);
            return imgs;
        }''')
        ref_urls.update(chip_urls)

        # Thu thập thêm các URL của tile ảnh tải lên trên canvas
        ref_filename = Path(reference_image_path).name.lower()
        uploaded_tile_urls = await page.evaluate('''(refName) => {
            const urls = [];
            const fileExtRegex = /\\.(jpe?g|png|webp|gif|bmp)(\\?|$)/i;
            const uploadKeywords = ['ảnh đã tải lên', 'tệp tải lên', 'tải lên', 'uploaded', 'upload', 'reference', 'tham chiếu'];
            document.querySelectorAll('flow-grid-tile-container, .tile-container').forEach(tile => {
                const label = (tile.getAttribute('aria-label') || '').toLowerCase();
                const title = (tile.getAttribute('title') || '').toLowerCase();
                const text = (tile.innerText || '').toLowerCase();
                const isUploaded = fileExtRegex.test(label) || fileExtRegex.test(title) ||
                                  (refName && (label.includes(refName) || title.includes(refName))) ||
                                  uploadKeywords.some(kw => label.includes(kw) || title.includes(kw) || text.includes(kw));
                if (isUploaded) {
                    tile.querySelectorAll('img').forEach(img => {
                        if (img.src) urls.push(img.src);
                    });
                }
            });
            return urls;
        }''', ref_filename)
        ref_urls.update(uploaded_tile_urls)
        logger.info(f"🔍 Đã ghi nhận {len(ref_urls)} URL của ảnh tham chiếu để loại trừ.")

        # Đóng mọi backdrop/drawer còn sót lại
        try:
            backdrop = await page.query_selector('.cdk-overlay-backdrop')
            if backdrop:
                await page.keyboard.press("Escape")
                await asyncio.sleep(0.4)
        except Exception:
            pass

        return ref_urls

    except Exception as e:
        logger.warning(f"Lỗi khi tải ảnh tham chiếu: {e}")
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass
        return ref_urls


async def _upload_reference_images(page: Page, reference_image_paths: list[str]) -> set[str]:
    """
    Tải nhiều ảnh tham chiếu lên Google Flow (ví dụ: Ảnh mẫu người mẫu + Ảnh bối cảnh/trang phục).
    Đính kèm từng ảnh thành các chip riêng biệt trong ô prompt.
    Trả về toàn bộ URL liên quan đến các ảnh tham chiếu đã tải lên để loại trừ triệt để.
    """
    all_ref_urls: set[str] = set()
    valid_paths = [p for p in reference_image_paths if p and Path(p).exists()]
    if not valid_paths:
        return all_ref_urls

    for idx, path in enumerate(valid_paths):
        logger.info(f"📤 Đang đính kèm ảnh tham chiếu #{idx + 1}/{len(valid_paths)} vào Flow: {path}")
        urls = await _upload_single_reference_image(page, path)
        all_ref_urls.update(urls)
        await asyncio.sleep(1.0)

    # Đảm bảo dọn sạch overlay sau khi tải xong tất cả
    try:
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.3)
    except Exception:
        pass

    return all_ref_urls


# ── Prompt Optimization for Google Flow ─────────────────────────────────────────

def format_flow_prompt(
    prompt: str,
    has_reference: bool = False,
    num_references: int = 1,
    has_model_and_bg: bool = False,
) -> str:
    """
    Tối ưu prompt cho Google Flow (Imagen 3 / Nano Banana Pro).
    Đảm bảo chất lượng thương mại đẳng cấp studio lookbook.
    
    Phân tích thông minh các tác vụ e-commerce:
    1. THAY ĐỔI BỐI CẢNH (Background Replacement):
       - Bắt buộc GIỮ NGUYÊN 100% người mẫu (khuôn mặt, thần thái, vóc dáng, tư thế)
       - ĐẶC BIỆT: Bắt buộc GIỮ NGUYÊN 100% TOÀN BỘ TRANG PHỤC (áo, quần/váy, tất, giày, phụ kiện)
       - Xóa sạch phông nền cũ (studio trắng), ghép người mẫu sang bối cảnh mới từ ảnh tham chiếu hoặc mô tả.
    2. ĐỔI MÀU ÁO / QUẦN:
       - Chỉ đổi màu áo theo yêu cầu, giữ nguyên kiểu dáng, người mẫu và bối cảnh.
    3. MẶC THỬ ĐỒ / TRY-ON:
       - Giữ khuôn mặt và vóc dáng người mẫu, thay trang phục theo mẫu đồ tham chiếu.
    4. TẠO ẢNH CHUNG:
       - Bảo toàn danh tính người mẫu và trang phục gốc, nâng cấp ánh sáng thương mại cao cấp.
    """
    clean_prompt = prompt.strip()
    
    studio_quality_suffix = (
        "masterpiece, 8k uhd resolution, Hasselblad medium format commercial photography, "
        "natural lighting, soft diffused shadows, razor-sharp focus, "
        "natural photorealistic textures, true-to-life skin tones, highly detailed"
    )

    if not has_reference:
        if not any(kw in clean_prompt.lower() for kw in ["8k", "photorealistic", "studio lighting", "hasselblad"]):
            return f"{clean_prompt}, {studio_quality_suffix}"
        return clean_prompt

    lower_p = clean_prompt.lower()

    # 1. Phát hiện tác vụ THAY ĐỔI BỐI CẢNH / GHÉP NỀN (Background replacement)
    is_bg_change = any(kw in lower_p for kw in [
        "thay bối cảnh", "đổi bối cảnh", "chuyển bối cảnh", "ghép bối cảnh",
        "bối cảnh ở hình tham chiếu", "bối cảnh hình tham chiếu", "bối cảnh tham chiếu",
        "bối cảnh mới", "bối cảnh khác",
        "thay nền", "đổi nền", "chuyển nền", "ghép nền",
        "nền ở hình tham chiếu", "nền hình tham chiếu", "nền tham chiếu",
        "nền mới", "nền khác", "nền ngoài trời", "nền trong nhà",
        "thay background", "đổi background", "chuyển background", "ghép background",
        "background ở hình tham chiếu", "background hình tham chiếu", "background tham chiếu",
        "background mới", "background khác",
        "đặt vào bối cảnh", "đưa vào bối cảnh", "ghép vào bối cảnh",
        "đặt vào nền", "đưa vào nền", "ghép vào nền",
        "ngoại cảnh", "ngoài trời", "sân vườn", "công viên", "đường phố",
        "quán cafe", "quán cà phê", "bãi biển", "resort", "hồ bơi",
        "phố đi bộ", "trung tâm thương mại", "phòng khách", "ban công",
        "change background", "replace background", "swap background",
        "new background", "different background", "outdoor background",
        "garden background", "park background", "street background",
        "background from reference", "scene from reference"
    ])

    if is_bg_change:
        if has_model_and_bg or num_references >= 2:
            bg_instruction = (
                "CRITICAL FASHION COMPOSITION & CLOTHING PRESERVATION RULES:\n"
                "1. SUBJECT & CLOTHING PRESERVATION: Strictly preserve the exact female model from the first reference image. "
                "Maintain her exact facial features, natural Asian beauty, radiant smile, hairstyle, headband, and body pose completely intact. "
                "ABSOLUTELY CRITICAL: PRESERVE HER ENTIRE ORIGINAL CLOTHING AND OUTFIT 100% IDENTICAL — DO NOT change, alter, or replace her top garment, "
                "skirt, pants, shorts, socks, footwear/shoes, or accessories. Her outfit must remain exactly identical to the first reference image without any modifications.\n"
                "2. BACKGROUND REPLACEMENT: Completely remove the studio white background. "
                "Seamlessly place this exact model (wearing her exact original outfit) into the target outdoor background environment shown in the second reference image (such as the outdoor garden, lush green lawn, trees, pathway, and natural greenery).\n"
                "3. LIGHTING & REALISM: Integrate her naturally with warm daylight, natural soft directional shadows, realistic contact shadows beneath her shoes on the ground, "
                "and zero white halos or edge artifacts. Razor-sharp commercial lookbook fashion photography."
            )
        else:
            bg_instruction = (
                "CRITICAL FASHION COMPOSITION & CLOTHING PRESERVATION RULES:\n"
                "1. SUBJECT & CLOTHING PRESERVATION: Strictly preserve the exact female model from the reference image. "
                "Maintain her identical facial features, smile, hair, and body pose completely intact. "
                "ABSOLUTELY CRITICAL: PRESERVE HER ENTIRE ORIGINAL CLOTHING AND OUTFIT 100% IDENTICAL — DO NOT change, alter, or replace her top garment, "
                "skirt, pants, shorts, socks, footwear/shoes, or accessories. Every piece of clothing must remain exactly as in the reference image.\n"
                "2. BACKGROUND REPLACEMENT: Completely remove the original plain studio background. "
                f"Seamlessly place this exact model in her original outfit into the requested environment: {clean_prompt}.\n"
                "3. LIGHTING & REALISM: Realistic environmental sunlight and ambient shadows matching the new scene, "
                "natural ground shadows beneath her shoes, zero white halos, razor-sharp focus."
            )
        return f"{clean_prompt}. {bg_instruction} {studio_quality_suffix}"

    # 2. Phát hiện tác vụ ĐỔI MÀU ÁO / TRANG PHỤC
    color_map = {
        "tím than": "navy blue / deep dark purple-blue",
        "xanh tím than": "navy blue",
        "xanh than": "navy blue",
        "xanh dương": "royal blue",
        "xanh lam": "blue",
        "xanh da trời": "sky blue",
        "xanh lá": "emerald green",
        "xanh lục": "emerald green",
        "xanh rêu": "olive green",
        "xanh mint": "mint green",
        "xanh bạc hà": "mint green",
        "đỏ": "vibrant red",
        "đỏ tươi": "vibrant red",
        "đỏ đô": "burgundy / maroon red",
        "đỏ rượu": "burgundy",
        "đỏ mận": "maroon",
        "hồng": "soft pink",
        "hồng phấn": "soft pastel pink",
        "vàng": "yellow",
        "vàng tươi": "bright yellow",
        "vàng mù tạt": "mustard yellow",
        "cam": "vibrant orange",
        "trắng": "pure white",
        "đen": "solid black",
        "xám": "heather grey",
        "ghi": "grey",
        "be": "cream / beige",
        "màu be": "beige",
        "kem": "cream",
        "nâu": "chocolate brown",
        "nâu tây": "rich warm brown"
    }

    detected_color = None
    for vi_col, en_col in color_map.items():
        if vi_col in lower_p:
            detected_color = en_col
            break

    is_color_edit = any(kw in lower_p for kw in [
        "đổi màu áo", "thay màu áo", "đổi màu quần", "thay màu quần",
        "đổi màu váy", "thay màu váy", "đổi màu", "thay màu",
        "chuyển sang màu", "thành màu"
    ])

    if is_color_edit:
        target_color = detected_color if detected_color else "new specified color"
        edit_instruction = (
            f"Modify ONLY the color of the target garment from the reference image: change it to {target_color}. "
            "CRITICAL: Keep the exact same female model, same face, same hairstyle, same body pose, "
            "same lower garment, same accessories, and same background as the reference image. "
            f"{studio_quality_suffix}."
        )
        return f"{clean_prompt}. {edit_instruction}"

    # 3. Mặc định cho ảnh có tham chiếu: Bảo toàn người mẫu, khuôn mặt, tư thế và trang phục gốc
    return f"{clean_prompt}. Based on the reference image, strictly preserve the model's identity, facial features, body pose, and original outfit style. {studio_quality_suffix}."


# ── Image Generation ───────────────────────────────────────────────────────────

async def generate_image_on_flow(
    prompt: str,
    aspect_ratio: str = "1:1",
    num_images: int = 1,
    reference_image_path: Optional[str] = None,
    job_id: str = "",
    model: str = "google-flow-nano-banana-pro",
    progress_callback=None,
    model_image_path: Optional[str] = None,
    reference_image_paths: Optional[list[str]] = None,
) -> list[dict]:
    """
    Tạo ảnh trên Google Flow sử dụng các model Nano Banana Pro / 2 / 2 Lite.
    Hỗ trợ đa ảnh tham chiếu: Ảnh người mẫu (model_image_path) + Các ảnh bối cảnh/trang phục (reference_image_paths).
    """
    context = await get_browser_context()
    page = await context.new_page()

    try:
        if progress_callback:
            await progress_callback(job_id, 10, "Đang kết nối Google Flow...")

        if not await login_with_cookies_or_credentials(page):
            raise RuntimeError("Không thể đăng nhập vào Google Flow.")

        cookies = await page.context.cookies()
        save_cookies(cookies)

        if progress_callback:
            await progress_callback(job_id, 20, "Đang mở trình soạn thảo Google Flow...")

        await ensure_in_project(page)

        if progress_callback:
            await progress_callback(job_id, 30, f"Đang cấu hình mô hình ({model}) và tỷ lệ ({aspect_ratio})...")

        await configure_flow_settings(page, mode="image", aspect_ratio=aspect_ratio, model_name=model)

        # Xây dựng danh sách ảnh tham chiếu có thứ tự: Ảnh người mẫu đầu tiên, tiếp theo là ảnh bối cảnh
        ordered_paths: list[str] = []
        if model_image_path and Path(model_image_path).exists():
            ordered_paths.append(model_image_path)

        if reference_image_paths:
            for p in reference_image_paths:
                if p and Path(p).exists() and p not in ordered_paths:
                    ordered_paths.append(p)
        elif reference_image_path and Path(reference_image_path).exists() and reference_image_path not in ordered_paths:
            ordered_paths.append(reference_image_path)

        has_ref = len(ordered_paths) > 0
        has_model_and_bg = bool(model_image_path and len(ordered_paths) >= 2)

        # Upload các ảnh tham chiếu lên Google Flow (gắn thành từng chip trong ô prompt)
        ref_urls: set[str] = set()
        if has_ref:
            if progress_callback:
                msg = f"Đang tải {len(ordered_paths)} ảnh tham chiếu (người mẫu & bối cảnh) lên Google Flow..."
                await progress_callback(job_id, 40, msg)
            ref_urls = await _upload_reference_images(page, ordered_paths)
            await asyncio.sleep(1.2)

        if progress_callback:
            await progress_callback(job_id, 48, "Đang chuẩn hóa prompt theo tiêu chuẩn thương mại cao cấp...")

        effective_prompt = format_flow_prompt(
            prompt,
            has_reference=has_ref,
            num_references=len(ordered_paths),
            has_model_and_bg=has_model_and_bg,
        )
        logger.info(f"📝 Prompt gửi tới Google Flow: {effective_prompt}")

        prompt_input = await page.wait_for_selector(
            '[contenteditable="true"], textarea, [role="textbox"]',
            timeout=10000,
        )
        if not prompt_input:
            raise RuntimeError("Không tìm thấy ô nhập câu lệnh trên Google Flow.")

        await prompt_input.click()
        await page.keyboard.press("Meta+A")
        await page.keyboard.press("Backspace")
        await prompt_input.fill(effective_prompt)
        await asyncio.sleep(0.5)

        # Dọn sạch bất kỳ backdrop/overlay nào có thể che chắn pointer events
        try:
            await page.evaluate("""() => {
                document.querySelectorAll('.cdk-overlay-backdrop').forEach(el => el.remove());
                const container = document.querySelector('.cdk-overlay-container');
                if (container) container.style.pointerEvents = 'none';
            }""")
        except Exception:
            pass

        # LẤY TOÀN BỘ URL MEDIA HIỆN CÓ NGAY TRƯỚC KHI BẤM TẠO (bao gồm cả ảnh tham chiếu vừa upload)
        existing_urls = await _get_all_media_urls(page)
        existing_urls.update(ref_urls)

        if progress_callback:
            await progress_callback(job_id, 50, "Đang gửi yêu cầu tạo ảnh đến Nano Banana Pro...")

        # Nhấn nút Bắt đầu tạo
        gen_btn = await page.wait_for_selector(
            '[aria-label="Bắt đầu tạo"], button.generate-icon-button, button[type="submit"]',
            timeout=5000,
        )
        if gen_btn and not await gen_btn.is_disabled():
            try:
                await gen_btn.click(force=True)
            except Exception:
                await page.evaluate("el => el.click()", gen_btn)
        else:
            await prompt_input.press("Enter")

        if progress_callback:
            await progress_callback(job_id, 60, "Nano Banana Pro đang render hình ảnh...")

        # Chờ ảnh mới xuất hiện (loại trừ toàn bộ existing_urls, ref_urls và ảnh tham chiếu gốc)
        images = await _wait_for_new_images(
            page=page,
            existing_urls=existing_urls,
            job_id=job_id,
            progress_callback=progress_callback,
            reference_image_paths=ordered_paths,
            reference_urls=ref_urls,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            timeout=120,
        )

        if not images:
            await page.screenshot(path=str(MEDIA_DIR / f"timeout_{job_id}.png"))
            raise RuntimeError("Google Flow không trả về hình ảnh trong thời gian quy định.")

        if progress_callback:
            await progress_callback(job_id, 100, f"Đã tạo thành công {len(images)} ảnh!")

        return images[:num_images]

    finally:
        await page.close()


async def _wait_for_new_images(
    page: Page,
    existing_urls: set[str],
    job_id: str,
    progress_callback,
    reference_image_path: Optional[str] = None,
    reference_image_paths: Optional[list[str]] = None,
    reference_urls: Optional[set[str]] = None,
    prompt: str = "",
    aspect_ratio: str = "1:1",
    timeout: int = 120,
) -> list[dict]:
    """
    Chờ và thu thập ảnh mới xuất hiện sau khi submit.
    Tuyệt đối không lấy ảnh tham chiếu hay tile đang render dở dang.
    Áp dụng enforce_aspect_ratio để đảm bảo tỷ lệ chuẩn xác 100% (ví dụ 2:3, 3:2, 4:5...).
    """
    start = time.time()
    progress_step = 60
    ref_urls = set(reference_urls or [])

    # Tổng hợp danh sách tất cả file tham chiếu để đối chiếu hash và visual similarity
    all_check_paths: list[str] = list(reference_image_paths or [])
    if reference_image_path and reference_image_path not in all_check_paths:
        all_check_paths.append(reference_image_path)

    ref_filenames = [Path(p).name.lower() for p in all_check_paths if p]
    ref_bytes_list: list[bytes] = []
    for p in all_check_paths:
        if p and Path(p).exists():
            try:
                ref_bytes_list.append(Path(p).read_bytes())
            except Exception as e:
                logger.debug(f"Không thể đọc file ảnh tham chiếu {p}: {e}")
    if ref_bytes_list:
        logger.info(f"🛡️ Kích hoạt kiểm tra đối chiếu trực quan {len(ref_bytes_list)} ảnh tham chiếu")

    rendering_seen = False

    while time.time() - start < timeout:
        elapsed = time.time() - start

        # Kiểm tra xem trên canvas có tile nào đang render (%) hoặc spinner không
        render_status = await page.evaluate('''() => {
            const tiles = document.querySelectorAll('flow-grid-tile-container, .tile-container, [role="gridcell"]');
            for (const tile of tiles) {
                const text = tile.innerText || "";
                const ariaLabel = tile.getAttribute('aria-label') || "";
                const m = text.match(/(\\d{1,2})%/) || ariaLabel.match(/(\\d{1,2})%/);
                if (m) {
                    return { rendering: true, progress: parseInt(m[1], 10) };
                }
            }
            // Check for progress indicator or spinner on canvas
            const spinner = document.querySelector('[role="progressbar"], .progress-spinner, .mat-mdc-progress-spinner, [aria-valuenow]');
            if (spinner) {
                const val = spinner.getAttribute('aria-valuenow');
                return { rendering: true, progress: val ? parseInt(val, 10) : null };
            }
            return { rendering: false, progress: null };
        }''')

        if render_status["rendering"]:
            rendering_seen = True
            flow_progress = render_status["progress"]
            if flow_progress is not None:
                current_progress = 60 + int((flow_progress / 100) * 35)
                if progress_callback and current_progress > progress_step:
                    progress_step = current_progress
                    await progress_callback(
                        job_id, current_progress,
                        f"Nano Banana Pro đang render ({flow_progress}%)..."
                    )
            else:
                progress = min(60 + int((elapsed / timeout) * 35), 95)
                if progress_callback and progress > progress_step:
                    progress_step = progress
                    await progress_callback(
                        job_id, progress,
                        f"Nano Banana Pro đang xử lý hình ảnh... ({int(elapsed)}s)"
                    )
            # Đang render: KHÔNG thu thập ảnh, tiếp tục chờ
            await asyncio.sleep(2.0)
            continue

        # Nếu chưa từng thấy rendering và mới dưới 6 giây, tiếp tục chờ tile render xuất hiện
        if not rendering_seen and elapsed < 6:
            progress = min(60 + int((elapsed / timeout) * 35), 95)
            if progress_callback and progress > progress_step:
                progress_step = progress
                await progress_callback(
                    job_id, progress,
                    f"Nano Banana Pro đang chuẩn bị render... ({int(elapsed)}s)"
                )
            await asyncio.sleep(1.0)
            continue

        if progress_callback and progress > progress_step:
            progress_step = progress
            await progress_callback(
                job_id, progress,
                f"Nano Banana Pro đang hoàn tất ảnh... ({int(elapsed)}s)"
            )

        # Lấy các img hoàn chỉnh trên canvas (loại trừ tile đang render, tile ảnh tải lên)
        candidates = await page.evaluate('''(refNames) => {
            const tiles = Array.from(document.querySelectorAll('flow-grid-tile-container, .tile-container'));
            const results = [];
            const fileExtRegex = /\\.(jpe?g|png|webp|gif|bmp)(\\?|$)/i;
            const uploadKeywords = ['ảnh đã tải lên', 'tệp tải lên', 'tải lên', 'uploaded', 'upload', 'reference', 'tham chiếu'];

            // Lấy danh sách img trong prompt chip để loại trừ
            const promptImgs = new Set(
                Array.from(document.querySelectorAll(
                    '.prompt-input img, [contenteditable] img, [role="textbox"] img, .chip img, [aria-label*="Xóa"] img, [aria-label*="Remove"] img, .detail-image-preview img'
                )).map(img => img.src).filter(Boolean)
            );

            tiles.forEach(tile => {
                const ariaLabel = (tile.getAttribute('aria-label') || '').toLowerCase();
                const title = (tile.getAttribute('title') || '').toLowerCase();
                const text = (tile.innerText || '').toLowerCase();

                // 1. Tile còn hiển thị % (đang render dở) -> bỏ qua
                if (/\\b\\d{1,2}%\\b/.test(text) || /\\b\\d{1,2}%\\b/.test(ariaLabel)) return;

                // 2. Tile có aria-label/title kết thúc bằng đuôi ảnh (file upload) -> bỏ qua
                if (fileExtRegex.test(ariaLabel) || fileExtRegex.test(title)) return;

                // 3. Tile trùng tên file tham chiếu vừa upload -> bỏ qua
                for (const refName of (refNames || [])) {
                    if (refName && (ariaLabel.includes(refName) || title.includes(refName))) return;
                }

                // 4. Tile chứa từ khóa tải lên -> bỏ qua
                for (const kw of uploadKeywords) {
                    if (ariaLabel.includes(kw) || title.includes(kw) || text.includes(kw)) return;
                }

                // 5. Thu thập img hợp lệ
                const imgs = tile.querySelectorAll('img');
                imgs.forEach(img => {
                    if (img.src && !img.src.includes('gstatic') && !img.src.includes('googlelogo') && img.src.length > 50 && !promptImgs.has(img.src)) {
                        results.push({
                            src: img.src,
                            ariaLabel: ariaLabel,
                            title: title
                        });
                    }
                });
            });

            return results;
        }''', ref_filenames)

        # Lọc ra các URL chưa từng thấy
        new_candidates = [c for c in candidates if c['src'] not in existing_urls and c['src'] not in ref_urls]

        if new_candidates:
            results = []
            for candidate in new_candidates:
                src = candidate['src']
                try:
                    resp = await page.request.get(src)
                    if resp.status == 200:
                        body = await resp.body()

                        # Kiểm tra độ tương đồng trực quan với tất cả ảnh tham chiếu bằng Pillow
                        # Nếu ảnh có watermark Gemini thì chắc chắn 100% là ảnh do Google Flow AI vừa tạo ra
                        has_wm = has_gemini_watermark(body)
                        if has_wm:
                            logger.info(f"✨ Phát hiện watermark Gemini trên ảnh mới tạo (size: {len(body)} bytes) -> Xác nhận đây là ảnh AI từ Google Flow!")
                        elif ref_bytes_list:
                            is_ref_clone = False
                            for rb in ref_bytes_list:
                                is_same, diff_score = is_visually_similar(rb, body, threshold=2.0)
                                if is_same:
                                    logger.warning(
                                        f"⚠️ Bỏ qua ảnh vì giống hệt ảnh tham chiếu đã tải lên "
                                        f"(diff: {diff_score:.2f} < 2.0, size: {len(body)} bytes)!"
                                    )
                                    is_ref_clone = True
                                    break
                            if is_ref_clone:
                                ref_urls.add(src)
                                existing_urls.add(src)
                                continue
                            else:
                                logger.info(f"✅ Ảnh AI hợp lệ (size: {len(body)} bytes)")

                        # Tự động phát hiện và xóa sạch watermark Google Gemini (nếu có)
                        clean_body = remove_gemini_watermark(body)

                        # Điều chỉnh chuẩn xác tỷ lệ khung hình theo yêu cầu người dùng (ví dụ 2:3, 3:2, 4:5...)
                        cropped_body, final_w, final_h = enforce_aspect_ratio(clean_body, aspect_ratio)

                        img_filename = f"{job_id}_{uuid.uuid4().hex[:6]}.png"
                        img_path = MEDIA_DIR / img_filename
                        img_path.write_bytes(cropped_body)
                        b64 = base64.b64encode(cropped_body).decode("utf-8")
                        results.append({
                            "url": f"data:image/png;base64,{b64}",
                            "download_url": f"/media/{img_filename}",
                            "width": final_w,
                            "height": final_h,
                            "mime_type": "image/png",
                        })
                except Exception as e:
                    logger.warning(f"Lỗi tải ảnh: {e}")

            if results:
                logger.info(f"🎉 Đã thu thập thành công {len(results)} ảnh kết quả do AI tạo (tỷ lệ {aspect_ratio})!")
                return results

        await asyncio.sleep(2.5)

    return []


# ── Video Generation ───────────────────────────────────────────────────────────

async def generate_video_on_flow(
    prompt: str,
    aspect_ratio: str = "16:9",
    duration: int = 5,
    reference_image_path: Optional[str] = None,
    job_id: str = "",
    model: str = "google-flow-veo-quality",
    progress_callback=None,
) -> Optional[str]:
    """
    Tạo video trên Google Flow với mô hình Veo 3.1 (Quality / Fast / Lite) hoặc Omni 1.1 Flash.
    Hỗ trợ text-to-video và image-to-video.
    Trả về URL video (data URI hoặc http://.../media/...).
    """
    context = await get_browser_context()
    page = await context.new_page()

    try:
        if progress_callback:
            await progress_callback(job_id, 10, "Đang kết nối Google Flow...")

        if not await login_with_cookies_or_credentials(page):
            raise RuntimeError("Không thể đăng nhập vào Google Flow.")

        cookies = await page.context.cookies()
        save_cookies(cookies)

        if progress_callback:
            await progress_callback(job_id, 20, "Đang mở trình soạn thảo Google Flow...")

        await ensure_in_project(page)

        if progress_callback:
            await progress_callback(job_id, 30, f"Đang cấu hình mô hình video ({model})...")

        await configure_flow_settings(page, mode="video", aspect_ratio=aspect_ratio, duration=duration, model_name=model)

        if progress_callback:
            await progress_callback(job_id, 40, "Đang nhập prompt video...")

        prompt_input = await page.wait_for_selector(
            '[contenteditable="true"], textarea, [role="textbox"]',
            timeout=10000,
        )
        if not prompt_input:
            raise RuntimeError("Không tìm thấy ô nhập câu lệnh trên Google Flow.")

        await prompt_input.click()
        await page.keyboard.press("Meta+A")
        await page.keyboard.press("Backspace")
        await prompt_input.fill(prompt)
        await asyncio.sleep(0.5)

        # Upload ảnh tham chiếu cho image-to-video
        ref_urls: set[str] = set()
        if reference_image_path and Path(reference_image_path).exists():
            if progress_callback:
                await progress_callback(job_id, 45, "Đang tải ảnh tham chiếu lên Google Flow...")
            ref_urls = await _upload_reference_image(page, reference_image_path)
            await asyncio.sleep(1.2)

        # Dọn sạch bất kỳ backdrop/overlay nào có thể che chắn pointer events
        try:
            await page.evaluate("""() => {
                document.querySelectorAll('.cdk-overlay-backdrop').forEach(el => el.remove());
                const container = document.querySelector('.cdk-overlay-container');
                if (container) container.style.pointerEvents = 'none';
            }""")
        except Exception:
            pass

        # LẤY TOÀN BỘ URL MEDIA HIỆN CÓ NGAY TRƯỚC KHI BẤM TẠO
        existing_urls = await _get_all_media_urls(page)
        existing_urls.update(ref_urls)

        if progress_callback:
            await progress_callback(job_id, 50, "Đang gửi yêu cầu tạo video (Veo)...")

        gen_btn = await page.wait_for_selector(
            '[aria-label="Bắt đầu tạo"], button.generate-icon-button, button[type="submit"]',
            timeout=5000,
        )
        if gen_btn and not await gen_btn.is_disabled():
            try:
                await gen_btn.click(force=True)
            except Exception:
                await page.evaluate("el => el.click()", gen_btn)
        else:
            await prompt_input.press("Enter")

        if progress_callback:
            await progress_callback(job_id, 60, "Veo đang render video (quá trình có thể mất 1-3 phút)...")

        # Chờ video mới xuất hiện — timeout 300 giây (5 phút)
        video_url = await _wait_for_new_video(page, existing_urls, job_id, progress_callback, timeout=300)

        if not video_url:
            await page.screenshot(path=str(MEDIA_DIR / f"video_timeout_{job_id}.png"))
            raise RuntimeError("Timeout: Veo không hoàn tất video trong 5 phút.")

        if progress_callback:
            await progress_callback(job_id, 100, "Veo đã render xong video!")

        return video_url

    finally:
        await page.close()


async def _wait_for_new_video(
    page: Page,
    existing_urls: set[str],
    job_id: str,
    progress_callback,
    timeout: int = 300,
) -> Optional[str]:
    """Chờ và thu thập video mới tạo trên Google Flow."""
    start = time.time()
    progress_step = 60

    while time.time() - start < timeout:
        elapsed = time.time() - start

        # Kiểm tra xem trên canvas có tile video nào đang render (%) không
        flow_progress = await page.evaluate('''() => {
            const tiles = document.querySelectorAll('flow-grid-tile-container, .tile-container, [role="gridcell"]');
            for (const tile of tiles) {
                const text = tile.innerText || "";
                const m = text.match(/(\\d{1,2})%/);
                if (m) {
                    return parseInt(m[1], 10);
                }
            }
            return null;
        }''')

        if flow_progress is not None:
            current_progress = 60 + int((flow_progress / 100) * 35)
            if progress_callback and current_progress > progress_step:
                progress_step = current_progress
                await progress_callback(
                    job_id, current_progress,
                    f"Veo đang render video ({flow_progress}%)..."
                )
            await asyncio.sleep(2.5)
            continue
        else:
            progress = min(60 + int((elapsed / timeout) * 35), 95)
            if progress_callback and progress > progress_step:
                progress_step = progress
                await progress_callback(
                    job_id, progress,
                    f"Veo đang tạo video... ({int(elapsed)}s / {timeout}s)"
                )

        # Kiểm tra video element hoặc tile mới hoàn thành
        video_items = await page.evaluate('''() => {
            const vids = document.querySelectorAll('flow-grid-tile-container video, video');
            return Array.from(vids).map(v => v.src).filter(src => src && src.length > 20);
        }''')

        found_new = [src for src in video_items if src not in existing_urls]
        if found_new:
            src = found_new[0]
            try:
                # Nếu là blob: fetch nội dung
                if src.startswith("blob:"):
                    b64 = await page.evaluate('''async (src) => {
                        const resp = await fetch(src);
                        const blob = await resp.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }''', src)
                    if b64 and "video" in b64:
                        return b64
                else:
                    # Tải file mp4 về lưu local
                    resp = await page.request.get(src)
                    if resp.status == 200:
                        body = await resp.body()
                        vid_filename = f"{job_id}.mp4"
                        vid_path = MEDIA_DIR / vid_filename
                        vid_path.write_bytes(body)
                        b64 = base64.b64encode(body).decode("utf-8")
                        return f"data:video/mp4;base64,{b64}"
                    return src
            except Exception as e:
                logger.warning(f"Lỗi tải video: {e}")
                return src

        await asyncio.sleep(3)

    return None


# ── Prompt Enhancement ─────────────────────────────────────────────────────────

async def enhance_prompt_simple(prompt: str, mode: str) -> str:
    """
    Tối ưu prompt không cần API — dùng template-based enhancement.
    Nếu có Gemini API key thì dùng, không thì dùng rule-based.
    """
    google_ai_key = os.getenv("GOOGLE_AI_API_KEY", "")

    if google_ai_key:
        import httpx
        system = (
            f"You are an expert AI prompt engineer for {mode} generation. "
            "Enhance the prompt to be more detailed and effective. "
            "Respond with ONLY the enhanced prompt."
        )
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={google_ai_key}",
                    json={
                        "system_instruction": {"parts": [{"text": system}]},
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"maxOutputTokens": 400, "temperature": 0.7},
                    },
                )
                data = resp.json()
                enhanced = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return enhanced
        except Exception:
            pass

    # Rule-based fallback
    additions = {
        "image": ", highly detailed, photorealistic, professional photography, 8K resolution, perfect lighting",
        "video": ", cinematic, smooth motion, professional cinematography, high quality, dynamic",
    }
    return prompt + additions.get(mode, "")
