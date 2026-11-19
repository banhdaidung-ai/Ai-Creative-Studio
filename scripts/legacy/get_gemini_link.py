from playwright.sync_api import sync_playwright
import time

def extract():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        print("Navigating...")
        page.goto("https://share.gemini.google/kmy4Wrd4GqER")
        time.sleep(5) # Wait for page to render
        content = page.locator("body").inner_text()
        print(content)
        browser.close()

extract()
