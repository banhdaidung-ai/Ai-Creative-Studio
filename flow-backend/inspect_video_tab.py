import asyncio
from playwright.async_api import async_playwright
from src.session_manager import load_cookies
from src.google_flow_client import FLOW_URL, ensure_in_project

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
        await ensure_in_project(page)
        
        settings_btn = await page.wait_for_selector(
            '[aria-label="Điều kiện kích hoạt cài đặt"], button:has-text("Nano Banana"), button:has-text("Video ·")',
            timeout=10000
        )
        await settings_btn.click()
        await asyncio.sleep(1)

        # Click Video button
        vid_btn = await page.query_selector('button:has-text("Video"), button:has-text("videocam")')
        if vid_btn:
            print("Clicking Video button...")
            await vid_btn.click()
            await asyncio.sleep(1)
            
            # Check model dropdown in video mode
            model_btn = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
            if model_btn:
                print("Clicking model dropdown in Video mode...")
                await model_btn.click()
                await asyncio.sleep(1)
                opts = await page.query_selector_all('[role="menuitem"], .cdk-overlay-pane button')
                for opt in opts:
                    txt = (await opt.inner_text()).strip()
                    if txt:
                        print("VID MODEL OPTION:", txt)
                await page.keyboard.press("Escape")
            
            # Check all buttons in video settings
            btns = await page.query_selector_all('.cdk-overlay-pane button')
            for b in btns:
                t = (await b.inner_text()).strip()
                if t:
                    print("VID SETTING BTN:", t)
        
        await browser.close()

asyncio.run(inspect())
