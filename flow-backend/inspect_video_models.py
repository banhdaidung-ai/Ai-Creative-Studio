import asyncio
from playwright.async_api import async_playwright

async def inspect():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        context = browser.contexts[0]
        pages = context.pages
        page = None
        for p_item in pages:
            if "flow.google.com" in p_item.url:
                page = p_item
                break
        
        if not page:
            print("No flow page found")
            return
            
        print("Flow page:", page.url)
        # Click on Video tab
        video_tab = await page.query_selector('button:has-text("Video"), [role="tab"]:has-text("Video")')
        if video_tab:
            await video_tab.click()
            await page.wait_for_timeout(2000)
            
            # Find model dropdown in video mode
            # Look for elements with arrow_drop_down or aria-label
            buttons = await page.query_selector_all('button')
            btn_texts = []
            for b in buttons:
                t = (await b.inner_text()).strip()
                if t:
                    btn_texts.append(t)
            print("Buttons in Video mode:", btn_texts)
            
            # Click model dropdown if exists
            model_btn = await page.query_selector('button:has-text("Veo"), [aria-label*="mô hình"], [aria-label*="model"]')
            if model_btn:
                await model_btn.click()
                await page.wait_for_timeout(1000)
                menu_items = await page.query_selector_all('[role="menuitem"], .cdk-overlay-pane button, [role="option"]')
                items = [await m.inner_text() for m in menu_items]
                print("Video Model dropdown items:", items)
        else:
            print("Video tab not found")

asyncio.run(inspect())
