import asyncio
from playwright.async_api import async_playwright
from src.session_manager import load_cookies
from src.google_flow_client import FLOW_URL

async def inspect():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="vi-VN"
        )
        cookies = load_cookies()
        if cookies:
            await context.add_cookies(cookies)
        
        page = await context.new_page()
        await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)
        
        # Click new project if needed
        new_proj_btn = page.get_by_text("New project")
        if await new_proj_btn.count() > 0:
            await new_proj_btn.first.click()
            await page.wait_for_url("**/project/**", timeout=15000)
            await asyncio.sleep(2)
            
        print("Page URL:", page.url)
        settings_btn = await page.wait_for_selector(
            '[aria-label="Điều kiện kích hoạt cài đặt"], button:has-text("Nano Banana"), button:has-text("Video ·")',
            timeout=8000
        )
        if not settings_btn:
            print("No settings button found")
            await browser.close()
            return

        # 1. Inspect Image settings
        await settings_btn.click()
        await asyncio.sleep(0.5)
        img_tab = await page.query_selector('button:has-text("Hình ảnh")')
        if img_tab:
            await img_tab.click()
            await asyncio.sleep(0.5)
        
        model_dd = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
        image_models = []
        if model_dd:
            await model_dd.click()
            await asyncio.sleep(0.5)
            items = await page.query_selector_all('[role="menuitem"], .cdk-overlay-pane button')
            for it in items:
                t = (await it.inner_text()).strip()
                if t:
                    image_models.append(t)
            await page.keyboard.press("Escape")
        print("IMAGE MODELS FOUND:", image_models)

        # 2. Inspect Video settings
        await settings_btn.click()
        await asyncio.sleep(0.5)
        vid_tab = await page.query_selector('button:has-text("Video"), button:has-text("videocam")')
        video_models = []
        video_durations = []
        video_ratios = []
        if vid_tab:
            await vid_tab.click()
            await asyncio.sleep(0.5)
            
            # Models
            v_model_dd = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
            if v_model_dd:
                await v_model_dd.click()
                await asyncio.sleep(0.5)
                v_items = await page.query_selector_all('[role="menuitem"], .cdk-overlay-pane button')
                for it in v_items:
                    t = (await it.inner_text()).strip()
                    if t:
                        video_models.append(t)
                await page.keyboard.press("Escape")
                
            # Get video durations & ratios
            all_btns = await page.query_selector_all('.cdk-overlay-pane button, [role="dialog"] button')
            for b in all_btns:
                t = (await b.inner_text()).strip()
                if "giây" in t or "s" in t:
                    video_durations.append(t)
                elif any(r in t for r in ["16:9", "9:16", "1:1", "4:3", "3:4", "2:3", "3:2"]):
                    video_ratios.append(t)

        print("VIDEO MODELS FOUND:", video_models)
        print("VIDEO DURATIONS FOUND:", video_durations)
        print("VIDEO RATIOS FOUND:", video_ratios)
        
        await browser.close()

asyncio.run(inspect())
