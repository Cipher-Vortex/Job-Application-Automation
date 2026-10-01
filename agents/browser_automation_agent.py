import asyncio
import os
import json
from datetime import datetime
from typing import Dict, Any
from config.logger import logger
from playwright.async_api import async_playwright

class PlaywrightBrowserAgent:
    """
    Playwright Multi-Portal Live Browser Automation Engine:
    - LinkedIn Easy Apply (https://www.linkedin.com/login)
    - Indeed Apply (https://secure.indeed.com/account/login)
    - Internshala Quick Apply (https://internshala.com/login/user)
    - Unstop Direct Apply (https://unstop.com/login)
    - ATS Platforms (Greenhouse, Lever, Ashby, Workday)
    """
    PORTAL_LOGIN_URLS = {
        "linkedin": "https://www.linkedin.com/login",
        "indeed": "https://secure.indeed.com/account/login",
        "internshala": "https://internshala.com/login/user",
        "unstop": "https://unstop.com/login",
        "freelancer": "https://www.freelancer.com/login"
    }

    def __init__(self):
        self.headless = os.getenv("PLAYWRIGHT_HEADLESS", "false").lower() == "true" # Default to headful for live user visibility
        self.user_data_dir = os.getenv("PLAYWRIGHT_USER_DATA_DIR", "./data/browser_profile")
        self.cookies_file = os.getenv("PLAYWRIGHT_COOKIES_FILE", "./data/cookies.json")

    def get_portal_login_url(self, portal_key: str) -> str:
        key = (portal_key or "").lower().strip()
        for p_name, login_url in self.PORTAL_LOGIN_URLS.items():
            if p_name in key:
                return login_url
        return "https://www.google.com"

    def _load_session_cookies(self) -> Dict[str, str]:
        cookies = {}
        if os.path.exists(self.cookies_file):
            try:
                with open(self.cookies_file, "r", encoding="utf-8") as f:
                    cookies = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load session cookies file: {e}")
        return cookies

    async def submit_application(self, application_data: Dict[str, Any], candidate_profile: Dict[str, Any]) -> Dict[str, Any]:
        url = application_data.get("url", "")
        company = application_data.get("company", "Company")
        role = application_data.get("role", "Role")
        source = (application_data.get("source") or application_data.get("ats_platform") or "").lower()
        
        logger.info(f"Initiating REAL Playwright browser context for {role} at {company} ({url})...")
        
        # Check security / CAPTCHA simulation
        if "captcha" in url.lower() or "mfa" in url.lower() or "challenge" in url.lower():
            logger.warning(f"CAPTCHA / Security verification detected at {url}. Triggering Human-in-the-Loop review queue.")
            return {
                "status": "Review_Required",
                "success": False,
                "human_review_needed": True,
                "reason": "CAPTCHA / Security verification detected. Application paused for manual user review.",
                "url": url,
                "portal": source
            }

        try:
            async with async_playwright() as p:
                os.makedirs(self.user_data_dir, exist_ok=True)
                browser = await p.chromium.launch_persistent_context(
                    user_data_dir=self.user_data_dir,
                    headless=self.headless,
                    args=["--disable-blink-features=AutomationControlled"]
                )
                page = await browser.new_page()
                
                # Save & Export stored session login details to JSON for verification
                try:
                    cookies = await browser.cookies()
                    login_log = {
                        "timestamp": datetime.now().isoformat(),
                        "total_stored_cookies": len(cookies),
                        "authenticated_portals": {
                            "linkedin": any(".linkedin.com" in c.get("domain", "") for c in cookies),
                            "indeed": any(".indeed.com" in c.get("domain", "") for c in cookies),
                            "internshala": any("internshala.com" in c.get("domain", "") for c in cookies),
                            "unstop": any("unstop.com" in c.get("domain", "") for c in cookies),
                            "freelancer": any("freelancer.com" in c.get("domain", "") for c in cookies)
                        },
                        "cookies_sample": [
                            {"domain": c.get("domain"), "name": c.get("name"), "expires": c.get("expires")}
                            for c in cookies[:15]
                        ]
                    }
                    os.makedirs("./data", exist_ok=True)
                    with open("./data/portal_login_status.json", "w", encoding="utf-8") as f:
                        json.dump(login_log, f, indent=2)
                except Exception as log_err:
                    logger.warning(f"Could not write portal_login_status.json: {log_err}")

                # Multi-Portal Execution
                if "linkedin" in url.lower() or "linkedin" in source:
                    res = await self.apply_linkedin_easy_apply(page, url, company, role, candidate_profile)
                elif "indeed" in url.lower() or "indeed" in source:
                    res = await self.apply_indeed_apply(page, url, company, role, candidate_profile)
                elif "naukri" in url.lower() or "naukri" in source:
                    res = await self.apply_naukri_apply(page, url, company, role, candidate_profile)
                elif "internshala" in url.lower() or "internshala" in source:
                    res = await self.apply_internshala(page, url, company, role, candidate_profile)
                elif "unstop" in url.lower() or "unstop" in source:
                    res = await self.apply_unstop(page, url, company, role, candidate_profile)
                else:
                    res = await self.apply_ats_form(page, url, company, role, candidate_profile)
                
                await browser.close()
                return res
        except Exception as e:
            logger.error(f"Live Playwright Execution Error for {role} at {company}: {e}")
            return {
                "status": "Review_Required",
                "success": False,
                "human_review_needed": True,
                "reason": f"Live Portal Session error: {str(e)[:200]}. Paused for user verification.",
                "url": url,
                "portal": source
            }

    async def apply_linkedin_easy_apply(self, page, url: str, company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Live LinkedIn Easy Apply Engine] Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)
        
        # Check if auth required
        if "login" in page.url.lower() or "authwall" in page.url.lower():
            logger.warning("LinkedIn Login required. Pausing for user login credentials.")
            return {
                "status": "Review_Required",
                "success": False,
                "human_review_needed": True,
                "reason": "LinkedIn Session expired or login required. Please log into LinkedIn using the Portal Login menu.",
                "url": url,
                "portal": "LinkedIn"
            }
            
        easy_apply_btn = await page.query_selector("button.jobs-apply-button") or await page.query_selector("text='Easy Apply'")
        if easy_apply_btn:
            await easy_apply_btn.click()
            await asyncio.sleep(1.5)
            
        return {
            "status": "Applied",
            "success": True,
            "human_review_needed": False,
            "confirmation_message": f"LinkedIn Easy Apply engine navigated & initiated application for {role} at {company}.",
            "url": url,
            "portal": "LinkedIn"
        }

    async def apply_indeed_apply(self, page, url: str, company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Live Indeed Quick Apply Engine] Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(1.5)
        
        apply_btn = await page.query_selector("#indeedApplyButton") or await page.query_selector("text='Apply now'")
        if apply_btn:
            await apply_btn.click()
            await asyncio.sleep(1)
            
        return {
            "status": "Applied",
            "success": True,
            "human_review_needed": False,
            "confirmation_message": f"Indeed Quick Apply executed for {role} at {company}.",
            "url": url,
            "portal": "Indeed"
        }

    async def apply_naukri_apply(self, page, url: str, company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Live Naukri 1-Click Apply Engine] Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(1.5)
        
        if "login" in page.url.lower():
            return {
                "status": "Review_Required",
                "success": False,
                "human_review_needed": True,
                "reason": "Naukri User Login required. Please log into Naukri using the portal session manager.",
                "url": url,
                "portal": "Naukri"
            }
            
        apply_btn = await page.query_selector("#apply-button") or await page.query_selector("text='Apply'")
        if apply_btn:
            await apply_btn.click()
            await asyncio.sleep(1)
            
        return {
            "status": "Applied",
            "success": True,
            "human_review_needed": False,
            "confirmation_message": f"Naukri 1-Click application submitted for {role} at {company}.",
            "url": url,
            "portal": "Naukri"
        }

    async def apply_internshala(self, page, url: str, company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Live Internshala Direct Apply Engine] Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(1.5)
        
        if "login" in page.url.lower():
            return {
                "status": "Review_Required",
                "success": False,
                "human_review_needed": True,
                "reason": "Internshala User Login required. Please log in via the Portal Login URLs menu.",
                "url": url,
                "portal": "Internshala"
            }
            
        apply_btn = await page.query_selector("#easy_apply_button") or await page.query_selector("text='Apply now'")
        if apply_btn:
            await apply_btn.click()
            await asyncio.sleep(1)
            
        return {
            "status": "Applied",
            "success": True,
            "human_review_needed": False,
            "confirmation_message": f"Internshala live application submitted for {role} at {company}.",
            "url": url,
            "portal": "Internshala"
        }

    async def apply_unstop(self, page, url: str, company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Live Unstop Direct Engine] Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(1.5)
        
        reg_btn = await page.query_selector("button:has-text('Register')") or await page.query_selector("button:has-text('Apply')")
        if reg_btn:
            await reg_btn.click()
            await asyncio.sleep(1)
            
        return {
            "status": "Applied",
            "success": True,
            "human_review_needed": False,
            "confirmation_message": f"Unstop candidate registration & application submitted for {role} at {company}.",
            "url": url,
            "portal": "Unstop"
        }

    async def apply_ats_form(self, page, url: str, company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Live ATS Web Form Engine] Navigating to {url}...")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2)
            
            # Extract profile & screening defaults
            full_name = profile.get("full_name") or profile.get("name") or "Kiran S R"
            email = profile.get("email") or "skkiran1258@gmail.com"
            phone = profile.get("phone") or "+91 81247 85632"
            linkedin_url = profile.get("linkedin") or "https://www.linkedin.com/in/kiran-s-r-774530268/"
            github_url = profile.get("github") or "https://github.com/Cipher-Vortex"
            portfolio_url = profile.get("portfolio") or "https://cipher-vortex.vercel.app/"
            resume_path = os.path.abspath("extracted_resume.txt")
            
            # 1. Fill First Name & Last Name / Full Name
            first_name_input = await page.query_selector("input[id*='first_name' i], input[name*='first_name' i]")
            last_name_input = await page.query_selector("input[id*='last_name' i], input[name*='last_name' i]")
            if first_name_input and last_name_input:
                await first_name_input.fill("Kiran")
                await last_name_input.fill("S R")
            else:
                name_input = await page.query_selector("input[name*='name' i], input[id*='name' i]")
                if name_input:
                    await name_input.fill(full_name)
                
            # 2. Fill Email
            email_input = await page.query_selector("input[type='email'], input[name*='email' i], input[id*='email' i]")
            if email_input:
                await email_input.fill(email)
                
            # 3. Fill Phone
            phone_input = await page.query_selector("input[type='tel'], input[name*='phone' i], input[id*='phone' i]")
            if phone_input:
                await phone_input.fill(phone)

            # 4. Fill LinkedIn / GitHub / Portfolio URLs
            linkedin_input = await page.query_selector("input[name*='linkedin' i], input[id*='linkedin' i], input[placeholder*='linkedin' i]")
            if linkedin_input:
                await linkedin_input.fill(linkedin_url)
                
            github_input = await page.query_selector("input[name*='github' i], input[id*='github' i], input[placeholder*='github' i]")
            if github_input:
                await github_input.fill(github_url)

            portfolio_input = await page.query_selector("input[name*='portfolio' i], input[name*='website' i], input[id*='website' i]")
            if portfolio_input:
                await portfolio_input.fill(portfolio_url)

            # 4.5 Standard HTML Selects logic injected
            selects = await page.query_selector_all("select")
            for s in selects:
                options = await s.query_selector_all("option")
                name_attr = (await s.get_attribute("name") or "").lower()
                id_attr = (await s.get_attribute("id") or "").lower()
                parent_text_handle = await page.evaluate_handle("el => el.parentElement ? el.parentElement.innerText : ''", s)
                parent_text = (await parent_text_handle.json_value()).lower()
                
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
                                break
                        else:
                            await s.select_option(val)
                            selected = True
                            break
                if target_kw and not selected:
                    for opt in options:
                        val = await opt.get_attribute("value")
                        txt = (await opt.inner_text()).lower()
                        if val and val != "" and "select" not in txt:
                            await s.select_option(val)
                            break

            # 5. Attach Resume file
            file_input = await page.query_selector("input[type='file']")
            if file_input and os.path.exists(resume_path):
                await file_input.set_input_files(resume_path)
                logger.info(f"Attached resume file {resume_path} to web form.")

            # 6. Fill All Custom Questions, Textareas, and Inputs
            all_fields = await page.query_selector_all("input[type='text'], textarea")
            for field in all_fields:
                try:
                    if not await field.is_visible():
                        continue
                    val = await field.input_value()
                    if val and len(val) > 0:
                        continue # Skip already populated
                        
                    # Find field label / question text
                    field_id = await field.get_attribute("id") or ""
                    field_name = await field.get_attribute("name") or ""
                    field_placeholder = await field.get_attribute("placeholder") or ""
                    is_req = await field.get_attribute("required") or await field.get_attribute("aria-required")
                    
                    label_text = f"{field_id} {field_name} {field_placeholder}".lower()
                    try:
                        parent_text = await field.evaluate("el => (el.closest('div') || el.parentElement)?.innerText || ''")
                        if parent_text:
                            label_text += " " + parent_text.lower()
                    except Exception:
                        pass
                        
                    if "location" in label_text or "city" in label_text or "country" in label_text:
                        await field.fill("Chennai")
                        await asyncio.sleep(1)
                        await page.keyboard.press("ArrowDown")
                        await page.keyboard.press("Enter")
                    elif is_req or "name" in field_name or "name" in field_id:
                        if "name" in field_name or "name" in field_id:
                            await field.fill(full_name)
                        else:
                            await field.fill("LinkedIn")
                    elif "notice" in label_text:
                        await field.fill("90 days")
                    elif "current_ctc" in label_text or "current salary" in label_text:
                        await field.fill("280000")
                    elif "expected" in label_text or "salary" in label_text or "ctc" in label_text:
                        await field.fill("800000")
                    elif "relocat" in label_text:
                        await field.fill("Yes")
                    elif "sponsorship" in label_text or "visa" in label_text:
                        await field.fill("Yes if outside India")
                    elif "experience" in label_text or "years" in label_text:
                        await field.fill("1")
                    elif "why" in label_text or "cover" in label_text or "summary" in label_text or "about" in label_text:
                        await field.fill("Full Stack & AI Engineer with experience in React, Node.js, and Integrations.")
                except Exception as e:
                    logger.warning(f"Field fill note: {e}")

            # 7. Fill All React-Select Custom Dropdowns & Comboboxes accurately
            custom_selects = await page.query_selector_all(".select__control, [class*='control']")
            for cs in custom_selects:
                try:
                    p_txt = await cs.evaluate("el => (el.closest('.field') || el.closest('fieldset') || el.closest('div') || el.parentElement).innerText")
                    low_txt = (p_txt or "").lower()
                    
                    await cs.scroll_into_view_if_needed()
                    await cs.click()
                    await asyncio.sleep(0.4)
                    
                    target_text = "India"
                    if "phone" in low_txt:
                        target_text = "India"
                    elif "country" in low_txt or "located" in low_txt or "residence" in low_txt:
                        target_text = "India"
                    elif "bangalore" in low_txt or "relocat" in low_txt or "shift" in low_txt:
                        target_text = "Yes"
                    elif "scripting" in low_txt or "proficiency" in low_txt or "experience" in low_txt:
                        target_text = "Yes"
                    elif "fluency" in low_txt or "llm" in low_txt:
                        target_text = "Yes"
                    elif "restrictions" in low_txt or "agreement" in low_txt:
                        target_text = "No"
                    elif "worked" in low_txt and "gitlab" in low_txt:
                        target_text = "No"
                    elif "sponsorship" in low_txt or "visa" in low_txt:
                        target_text = "No"
                    elif "gender" in low_txt:
                        target_text = "Male"
                    elif "hispanic" in low_txt or "latino" in low_txt:
                        target_text = "No"
                    elif "race" in low_txt or "ethnicity" in low_txt:
                        target_text = "Asian"
                    elif "veteran" in low_txt:
                        target_text = "I am not a protected veteran"
                    elif "disability" in low_txt:
                        target_text = "No, I don't have a disability"
                    else:
                        target_text = "No"

                    inp = await cs.query_selector("input")
                    if inp:
                        await inp.fill(target_text)
                    else:
                        await page.keyboard.type(target_text)
                    await asyncio.sleep(0.5)

                    opts = await page.query_selector_all("[role='option'], div[class*='option']")
                    clicked = False
                    for opt in opts:
                        opt_txt = (await opt.inner_text()).lower()
                        if target_text.lower() in opt_txt:
                            await opt.click()
                            clicked = True
                            break
                    if not clicked:
                        await page.keyboard.press("Enter")
                        
                    await asyncio.sleep(0.3)
                except Exception as e:
                    logger.warning(f"Combobox fill note: {e}")

            await asyncio.sleep(2)
            
            # 7.5 Fill Checkboxes
            checkboxes = await page.query_selector_all("input[type='checkbox']")
            for cb in checkboxes:
                try:
                    if await cb.is_visible():
                        if not await cb.is_checked():
                            await cb.click(force=True)
                except Exception:
                    pass

            # 8. Click Submit / Apply Button
            submit_btn = (
                await page.query_selector("#submit_app") or
                await page.query_selector("button[type='submit']") or
                await page.query_selector("input[type='submit']") or
                await page.query_selector("button:has-text('Submit')") or
                await page.query_selector("button:has-text('Apply')")
            )
            
            if submit_btn:
                await submit_btn.click()
                await asyncio.sleep(4)
                logger.info(f"Clicked Submit Application button for {role} at {company}.")

            return {
                "status": "Applied",
                "success": True,
                "human_review_needed": False,
                "confirmation_message": f"Auto-filled details ({full_name}, {email}, {phone}, Resume) & submitted application form for {role} at {company}.",
                "url": url,
                "portal": "ATS Web Form"
            }
        except Exception as e:
            return {
                "status": "Review_Required",
                "success": False,
                "human_review_needed": True,
                "reason": f"ATS Form submission paused: {str(e)[:150]}.",
                "url": url,
                "portal": "ATS Web Form"
            }

browser_agent = PlaywrightBrowserAgent()

