import asyncio
from playwright.async_api import async_playwright
from agents.browser_automation_agent import browser_agent
from config.candidate_profile import CANDIDATE_PROFILE

async def take_final_proof():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        job = {
            'url': 'https://job-boards.greenhouse.io/gitlab/jobs/8556658002',
            'company': 'GitLab',
            'role': 'AI Engineer (Remote)',
            'source': 'greenhouse'
        }
        await browser_agent.apply_ats_form(page, job['url'], job['company'], job['role'], CANDIDATE_PROFILE)
        await page.screenshot(path="final_submitted_proof.png", full_page=True)
        print("FINAL SCREENSHOT SAVED: final_submitted_proof.png | URL:", page.url)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(take_final_proof())
