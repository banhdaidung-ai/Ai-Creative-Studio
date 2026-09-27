import asyncio
import sys

sys.path.insert(0, "flow-backend")
sys.path.insert(0, "flow-backend/src")
from google_flow_client import get_browser_context, ensure_in_project

async def inspect_models():
    ctx = await get_browser_context()
    page = await ctx.new_page()
    await ensure_in_project(page)
    await asyncio.sleep(2)
    
    # Click settings trigger button
    settings_btn = await page.wait_for_selector(
        '[aria-label="Điều kiện kích hoạt cài đặt"], button.settings-trigger-button',
        timeout=10000
    )
    print("Found settings button:", settings_btn)
    await settings_btn.click()
    await asyncio.sleep(1)
    
    # 1. Inspect Image Models
    img_mode = await page.query_selector('button:has-text("Hình ảnh"), button:has-text("image")')
    if img_mode:
        await img_mode.click()
        await asyncio.sleep(0.5)
    
    # Open model dropdown
    model_dd = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
    if model_dd:
        await model_dd.click()
        await asyncio.sleep(0.8)
        img_models = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('.cdk-overlay-pane [role="menuitem"], .cdk-overlay-pane button, mat-option'))
                .map(el => (el.innerText || '').trim())
                .filter(Boolean);
        }""")
        print("Image Models on Flow:", img_models)
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)
        
    # Inspect Aspect Ratios available for Image
    img_ratios = await page.evaluate("""() => {
        return Array.from(document.querySelectorAll('.cdk-overlay-pane button, [aria-label*="khung hình"] button, button:has-text("1:1"), button:has-text("16:9"), button:has-text("9:16"), button:has-text("3:4"), button:has-text("4:3"), button:has-text("2:3"), button:has-text("3:2")'))
            .map(el => (el.innerText || el.getAttribute('aria-label') || '').trim())
            .filter(Boolean);
    }""")
    print("Image Ratios in Settings:", img_ratios)
    
    # 2. Inspect Video Models
    vid_mode = await page.query_selector('button:has-text("Video"), button:has-text("videocam")')
    if vid_mode:
        await vid_mode.click()
        await asyncio.sleep(0.5)
        
    model_dd = await page.query_selector('[aria-label="Chọn nhóm mô hình"]')
    if model_dd:
        await model_dd.click()
        await asyncio.sleep(0.8)
        vid_models = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('.cdk-overlay-pane [role="menuitem"], .cdk-overlay-pane button, mat-option'))
                .map(el => (el.innerText || '').trim())
                .filter(Boolean);
        }""")
        print("Video Models on Flow:", vid_models)
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)
        
    vid_ratios = await page.evaluate("""() => {
        return Array.from(document.querySelectorAll('.cdk-overlay-pane button'))
            .map(el => (el.innerText || el.getAttribute('aria-label') || '').trim())
            .filter(Boolean);
    }""")
    print("Video Settings options:", vid_ratios)
    
    await page.close()

if __name__ == "__main__":
    asyncio.run(inspect_models())
