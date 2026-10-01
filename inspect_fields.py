import asyncio
from playwright.async_api import async_playwright

async def inspect_required_fields():
    url = "https://job-boards.greenhouse.io/cloudflare/jobs/8097321?gh_jid=8097321"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        
        req_inputs = await page.query_selector_all("[required], [aria-required='true'], label:has-text('*')")
        print(f"Total required indicators found: {len(req_inputs)}")
        for el in req_inputs:
            txt = await el.inner_text()
            print("REQUIRED FIELD:", txt.strip().replace('\n', ' '))
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_required_fields())
