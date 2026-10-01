import asyncio
from playwright.async_api import async_playwright

async def find_validation_errors():
    url = "https://job-boards.greenhouse.io/gitlab/jobs/8556658002"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        
        # Click submit with minimal fill to reveal required red messages
        btn = await page.query_selector("#submit_app")
        if btn:
            await btn.click()
            await asyncio.sleep(3)

        combos = await page.query_selector_all("[role='combobox'], [class*='select'], select")
        print(f"TOTAL COMBOBOX / CUSTOM SELECTS ON FORM: {len(combos)}")
        for cb in combos:
            p_txt = await cb.evaluate("el => (el.closest('.field') || el.closest('fieldset') || el.closest('div') || el.parentElement).innerText")
            print(f"SELECT QUESTION: {p_txt.strip().replace('\n', ' ')[:120]}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(find_validation_errors())
