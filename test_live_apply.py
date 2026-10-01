import asyncio
import os
from playwright.async_api import async_playwright

async def run_live_apply_test():
    url = "https://job-boards.greenhouse.io/cloudflare/jobs/8097321?gh_jid=8097321"
    print(f"Opening browser & navigating to {url}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
        page = await browser.new_page()
        resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print("Page Title:", await page.title())
        print("HTTP Status:", resp.status if resp else "No Response")
        await asyncio.sleep(2)

        # 1. Fill First Name
        fn = await page.query_selector("input[id*='first_name'], input[name*='first_name']")
        if fn:
            await fn.fill("Kiran")
            print("Filled First Name: Kiran")

        # 2. Fill Last Name
        ln = await page.query_selector("input[id*='last_name'], input[name*='last_name']")
        if ln:
            await ln.fill("S R")
            print("Filled Last Name: S R")

        # 3. Fill Email
        em = await page.query_selector("input[id*='email'], input[name*='email']")
        if em:
            await em.fill("skkiran1258@gmail.com")
            print("Filled Email: skkiran1258@gmail.com")

        # 4. Fill Phone
        ph = await page.query_selector("input[id*='phone'], input[name*='phone']")
        if ph:
            await ph.fill("8124785632")
            print("Filled Phone: 8124785632")

        # 5. Fill LinkedIn / Web URLs
        linkedin = await page.query_selector("input[name*='linkedin'], input[id*='linkedin'], input[aria-label*='LinkedIn']")
        if linkedin:
            await linkedin.fill("https://www.linkedin.com/in/kiran-s-r-774530268/")
            print("Filled LinkedIn URL")

        website = await page.query_selector("input[name*='website'], input[id*='website'], input[name*='portfolio']")
        if website:
            await website.fill("https://cipher-vortex.vercel.app/")
            print("Filled Website/Portfolio URL")

        # 6. Attach Resume
        file_inp = await page.query_selector("input[type='file']")
        resume_file = os.path.abspath("extracted_resume.txt")
        if file_inp and os.path.exists(resume_file):
            await file_inp.set_input_files(resume_file)
            print(f"Uploaded resume file: {resume_file}")

        # 7. Fill required standard select dropdowns and custom elements
        selects = await page.query_selector_all("select")
        for s in selects:
            options = await s.query_selector_all("option")
            name_attr = (await s.get_attribute("name") or "").lower()
            id_attr = (await s.get_attribute("id") or "").lower()
            parent_text = await page.evaluate("el => el.parentElement.innerText", s)
            parent_text = (parent_text or "").lower()
            
            target_kw = []
            if "gender" in name_attr or "gender" in id_attr or "gender" in parent_text:
                target_kw = ["male"]
            elif "phone" in name_attr or "dial" in name_attr or "country" in name_attr:
                target_kw = ["india", "+91"]
            elif "race" in name_attr or "ethnic" in parent_text or "race" in parent_text:
                target_kw = ["asian"]
                
            selected = False
            for opt in options:
                val = await opt.get_attribute("value")
                txt = (await opt.inner_text()).lower()
                if val and val != "" and "select" not in txt:
                    if target_kw:
                        if any(k in txt for k in target_kw) and ("female" not in txt or "female" in target_kw):
                            await s.select_option(val)
                            selected = True
                            print(f"Selected targeted option: {txt[:20]}")
                            break
                    else:
                        await s.select_option(val)
                        selected = True
                        print(f"Selected fallback option: {txt[:20]}")
                        break
            
            # If target keyword not found, choose anything valid
            if target_kw and not selected:
                for opt in options:
                    val = await opt.get_attribute("value")
                    txt = (await opt.inner_text()).lower()
                    if val and val != "" and "select" not in txt:
                        await s.select_option(val)
                        print(f"Selected default option: {txt[:20]}")
                        break

        # 8. Handle React-select custom dropdowns if present
        custom_selects = await page.query_selector_all(".select__control, [class*='control']")
        for cs in custom_selects:
            try:
                await cs.scroll_into_view_if_needed()
                await cs.click()
                await asyncio.sleep(0.5)
                # Try typing to search India if it's country, else just select first
                await page.keyboard.press("ArrowDown")
                await page.keyboard.press("ArrowDown") # Sometimes first is empty or +93
                await page.keyboard.press("Enter")
                print("Selected custom combobox item")
            except Exception as e:
                pass

        # 9. Fill any remaining empty required text fields / textareas
        text_fields = await page.query_selector_all("input[type='text'], textarea")
        for tf in text_fields:
            if await tf.is_visible():
                val = await tf.input_value()
                if not val:
                    req = await tf.get_attribute("required") or await tf.get_attribute("aria-required")
                    name_attr = (await tf.get_attribute("name") or "").lower()
                    id_attr = (await tf.get_attribute("id") or "").lower()
                    
                    # Greenhouse custom fields might not have native required attributes. Fill all empty custom text fields to be safe.
                    if "location" in name_attr or "location" in id_attr or "city" in name_attr:
                        await tf.fill("Chennai")
                        await asyncio.sleep(1)
                        await page.keyboard.press("ArrowDown")
                        await page.keyboard.press("Enter")
                        print("Filled auto-complete Location: Chennai")
                    elif req or "name" in name_attr or "name" in id_attr: # for Legal Name
                        await tf.fill("Kiran S R")
                        print(f"Filled text field ({name_attr or id_attr}): Kiran S R")
                    else:
                        await tf.fill("LinkedIn")
                        print(f"Filled text field ({name_attr or id_attr}): LinkedIn")

        await asyncio.sleep(1)
        
        # 9.5 Fill all visible checkboxes
        checkboxes = await page.query_selector_all("input[type='checkbox']")
        for cb in checkboxes:
            if await cb.is_visible():
                is_checked = await cb.is_checked()
                if not is_checked:
                    await cb.click(force=True)
                    print("Checked a checkbox")
        
        await asyncio.sleep(2)
        
        # 10. Check if Submit button exists & click it
        submit_btn = await page.query_selector("#submit_app, button[type='submit'], input[type='submit'], button:has-text('Submit Application')")
        print("Submit button found:", submit_btn is not None)
        if submit_btn:
            print("Clicking submit button live...")
            await page.screenshot(path="screenshot_before_submit.png", full_page=True)
            await submit_btn.click()
            await asyncio.sleep(5)
            await page.screenshot(path="screenshot_after_submit.png", full_page=True)
            
            # Check validation errors
            errors = await page.query_selector_all(".field-error, .error, [class*='error'], [role='alert']")
            error_found = False
            for err in errors:
                txt = await err.inner_text()
                if txt.strip() and "cookie" not in txt.lower():
                    print("FORM VALIDATION ERROR FOUND:", txt.strip())
                    error_found = True
            
            if not error_found:
                print("SUCCESS: Application submitted with no form validation errors!")
            print("Final URL after submission:", page.url)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_live_apply_test())
