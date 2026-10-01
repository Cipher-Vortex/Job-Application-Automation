import asyncio
from playwright.async_api import async_playwright

async def inspect_gitlab_form():
    url = "https://job-boards.greenhouse.io/gitlab/jobs/8556658002"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        print("\n--- ALL INPUT FIELDS ON GITLAB FORM ---")
        inputs = await page.query_selector_all("input, textarea, select")
        for inp in inputs:
            tag = await inp.evaluate("el => el.tagName")
            inp_id = await inp.get_attribute("id") or ""
            inp_name = await inp.get_attribute("name") or ""
            inp_type = await inp.get_attribute("type") or ""
            placeholder = await inp.get_attribute("placeholder") or ""
            
            # Find parent label or text
            parent_txt = ""
            try:
                parent = await inp.evaluate_handle("el => el.closest('div, label')")
                if parent:
                    parent_txt = (await parent.evaluate("el => el.innerText")).strip().replace('\n', ' ')[:100]
            except Exception:
                pass
                
            print(f"Tag: {tag} | Type: {inp_type} | ID: {inp_id} | Name: {inp_name} | Label: {parent_txt}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_gitlab_form())
