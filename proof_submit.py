import asyncio
import os
from playwright.async_api import async_playwright

async def submit_and_take_screenshot():
    url = "https://job-boards.greenhouse.io/gitlab/jobs/8556658002"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("Navigating to:", url)
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        # 1. Fill First & Last Name
        fn = await page.query_selector("input[id*='first_name']")
        if fn: await fn.fill("Kiran")
        ln = await page.query_selector("input[id*='last_name']")
        if ln: await ln.fill("S R")

        # 2. Email & Phone
        em = await page.query_selector("input[id*='email']")
        if em: await em.fill("skkiran1258@gmail.com")
        ph = await page.query_selector("input[id*='phone']")
        if ph: await ph.fill("+918124785632")

        # 3. Attach Resume
        resume = os.path.abspath("extracted_resume.txt")
        file_inp = await page.query_selector("input[type='file']")
        if file_inp and os.path.exists(resume):
            await file_inp.set_input_files(resume)

        # 4. Fill custom text inputs
        inputs = await page.query_selector_all("input[type='text'], textarea")
        for inp in inputs:
            try:
                txt = (await inp.get_attribute("id") or "").lower()
                if "notice" in txt: await inp.fill("90 days")
                elif "salary" in txt or "ctc" in txt: await inp.fill("800000")
            except Exception:
                pass

        await asyncio.sleep(2)
        screenshot_before = "screenshot_before_submit.png"
        await page.screenshot(path=screenshot_before, full_page=True)
        print("Saved screenshot before submit:", os.path.abspath(screenshot_before))

        # 5. Click Submit
        btn = await page.query_selector("#submit_app, button[type='submit']")
        if btn:
            print("Clicking submit button...")
            await btn.click()
            await asyncio.sleep(5)

        screenshot_after = "screenshot_after_submit.png"
        await page.screenshot(path=screenshot_after, full_page=True)
        print("Saved screenshot after submit:", os.path.abspath(screenshot_after))
        print("Final URL:", page.url)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(submit_and_take_screenshot())
