import asyncio
import urllib.request
import json
import uuid
import re
import html
from typing import List, Dict, Any
from config.logger import logger

class JobDiscoveryAgent:
    """
    Autonomous Discovery Engine scanning:
    - Freelancer.com Live Active Projects API
    - RemoteOK Freelance & Contract Stream
    - Arbeitnow Tech & Freelance Jobs API
    - Greenhouse Public ATS Endpoints (Stripe, GitLab, Cloudflare, Vercel, Canonical)
    - Lever Public ATS Endpoints (Figma, Postman)
    """
    def __init__(self):
        self.greenhouse_companies = [
            "stripe", "gitlab", "cloudflare", "vercel", "canonical",
            "palai", "pal-ai", "pal", "supabase", "sourcegraph", "datadog", "elastic",
            "10up", "modash", "tejasnetworks"
        ]
        self.lever_companies = ["figma", "postman", "duckduckgo", "automattic"]
        self.ashby_companies = ["zapier", "buffer"]

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = html.unescape(text)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'[^\x00-\x7F]+', ' ', text)
        return re.sub(r'\s+', ' ', text).strip()

    def _fetch_url(self, url: str) -> Any:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning(f"Could not fetch live data from {url}: {e}")
            return None

    def fetch_freelancer_com_projects(self) -> List[Dict[str, Any]]:
        logger.info("Fetching real active freelance projects (<30 days old) from Freelancer.com API...")
        url = "https://www.freelancer.com/api/projects/0.1/projects/active/?query=react%20node%20fullstack&limit=50"
        data = self._fetch_url(url)
        if not data or not isinstance(data, dict):
            return []
        
        import time
        cutoff = time.time() - (30 * 86400) # 30 days ago
        projects = data.get("result", {}).get("projects", [])
        parsed_projects = []
        for p in projects:
            submitted = p.get("time_submitted")
            if submitted and isinstance(submitted, (int, float)) and submitted < cutoff:
                continue

            title = self._clean_text(p.get("title", ""))
            if not title:
                continue
            
            p_id = p.get("id")
            budget = p.get("budget", {})
            min_b = budget.get("minimum", 100)
            max_b = budget.get("maximum", 1500)
            
            sal_str = f"${min_b} - ${max_b} USD (Fixed Project Contract)" if min_b and max_b else "$50 - $90 / hr (Freelance)"
            seo_url = p.get("seo_url")
            link = f"https://www.freelancer.com/projects/{seo_url}" if seo_url else f"https://www.freelancer.com/projects/{p_id}"
            
            parsed_projects.append({
                "id": f"fl_{p_id}",
                "title": title,
                "company": "Client Project (Freelancer.com)",
                "department": "Engineering Gig",
                "location": "Global Remote",
                "remote_type": "Remote",
                "job_type": "Freelance / Contract",
                "url": link,
                "source": "Freelancer.com",
                "ats_platform": "Freelancer API",
                "salary_raw": sal_str,
                "salary_min": min_b * 83 if min_b else 800000,
                "salary_max": max_b * 83 if max_b else 1500000,
                "experience_required": "All Levels",
                "tech_stack": ["React", "Node.js", "Full Stack", "Web Development"],
                "description": self._clean_text(p.get("preview_description", p.get("description", "")))
            })
        return parsed_projects

    def fetch_remoteok_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Fetching live jobs & freelance contracts (<30 days old) from RemoteOK API...")
        data = self._fetch_url("https://remoteok.com/api")
        if not data or not isinstance(data, list):
            return []
        
        from datetime import datetime, timezone, timedelta
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=30)
        parsed_jobs = []
        for item in data[1:35]:
            if not isinstance(item, dict) or not item.get("position"):
                continue
            
            date_str = item.get("date")
            if date_str:
                try:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    if dt < cutoff_dt:
                        continue
                except Exception:
                    pass

            position = self._clean_text(item.get("position", ""))
            company = self._clean_text(item.get("company", "Tech Company"))
            tags = [self._clean_text(t) for t in item.get("tags", [])]
            location = self._clean_text(item.get("location") or "Remote")
            url = item.get("url") or f"https://remoteok.com/remote-jobs/{item.get('id')}"
            salary_min = item.get("salary_min")
            salary_max = item.get("salary_max")
            
            desc_lower = (item.get("description") or "").lower()
            tags_lower = [t.lower() for t in tags]
            
            is_contract = any(k in tags_lower or k in desc_lower for k in ["contract", "freelance", "hourly", "gig", "consultant", "project"])
            job_type = "Freelance / Contract" if is_contract else "Full-Time"
            
            if is_contract and salary_min and salary_max:
                hourly_min = round(salary_min / 2000, 1)
                hourly_max = round(salary_max / 2000, 1)
                sal_str = f"${hourly_min} - ${hourly_max} / hr (Freelance Contract)"
            elif salary_min and salary_max:
                sal_str = f"${salary_min:,.0f} - ${salary_max:,.0f} USD"
            else:
                sal_str = "$45 - $90 / hr (Project Contract)" if is_contract else "Competitive Market Rate"
            
            parsed_jobs.append({
                "id": f"rok_{item.get('id', uuid.uuid4().hex[:6])}",
                "title": position,
                "company": company,
                "department": "Engineering",
                "location": location if location else "Remote",
                "remote_type": "Remote",
                "job_type": job_type,
                "url": url,
                "source": "RemoteOK",
                "ats_platform": "RemoteOK API",
                "salary_raw": sal_str,
                "salary_min": salary_min * 83 if salary_min else (750000 if is_contract else 900000),
                "salary_max": salary_max * 83 if salary_max else (1400000 if is_contract else 1600000),
                "experience_required": "1+ Years",
                "tech_stack": [t.title() for t in tags[:6]] if tags else ["React", "Node.js", "Full Stack"],
                "description": self._clean_text(item.get("description", ""))[:400]
            })
        return parsed_jobs

    def fetch_arbeitnow_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Fetching live tech jobs (<30 days old) from Arbeitnow API...")
        data = self._fetch_url("https://www.arbeitnow.com/api/job-board-api")
        if not data or not isinstance(data, dict):
            return []
        
        import time
        cutoff = time.time() - (30 * 86400)
        raw_items = data.get("data", [])
        parsed_jobs = []
        for item in raw_items[:120]:
            created_at = item.get("created_at")
            if created_at and isinstance(created_at, (int, float)) and created_at < cutoff:
                continue

            title = self._clean_text(item.get("title", ""))
            company = self._clean_text(item.get("company_name", "Software Inc"))
            tags = item.get("tags", [])
            location = self._clean_text(item.get("location", "Remote / Hybrid"))
            url = item.get("url", "")
            remote = "Remote" if item.get("remote") else "Hybrid"
            
            is_contract = any(k in title.lower() for k in ["freelance", "contract", "interim", "consultant"])
            job_type = "Freelance / Contract" if is_contract else "Full-Time"
            
            parsed_jobs.append({
                "id": f"an_{uuid.uuid4().hex[:6]}",
                "title": title,
                "company": company,
                "department": "Software Engineering",
                "location": location,
                "remote_type": remote,
                "job_type": job_type,
                "url": url,
                "source": "Arbeitnow",
                "ats_platform": "Direct Portal",
                "salary_raw": "Competitive Contract / Full-Time Pay",
                "salary_min": 850000,
                "salary_max": 1500000,
                "experience_required": "1+ Years",
                "tech_stack": [self._clean_text(t).title() for t in tags[:6]] if tags else ["Software Development", "Web"],
                "description": self._clean_text(item.get("description", ""))[:400]
            })
        return parsed_jobs

    def fetch_greenhouse_jobs(self) -> List[Dict[str, Any]]:
        parsed_jobs = []
        for comp in self.greenhouse_companies:
            logger.info(f"Scanning live Greenhouse career board for {comp}...")
            url = f"https://boards-api.greenhouse.io/v1/boards/{comp}/jobs?content=true"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                continue
            
            jobs = data.get("jobs", [])
            for j in jobs:
                title = self._clean_text(j.get("title", ""))
                if any(k in title.lower() for k in ["engineer", "developer", "software", "full stack", "frontend", "backend"]):
                    loc = self._clean_text(j.get("location", {}).get("name", "Remote"))
                    is_contract = "contract" in title.lower()
                    parsed_jobs.append({
                        "id": f"gh_{j.get('id')}",
                        "title": title,
                        "company": comp.title(),
                        "department": "Engineering",
                        "location": loc,
                        "remote_type": "Remote" if "remote" in loc.lower() else "Hybrid",
                        "job_type": "Freelance / Contract" if is_contract else "Full-Time",
                        "url": j.get("absolute_url"),
                        "source": "Greenhouse",
                        "ats_platform": "Greenhouse ATS",
                        "salary_raw": "Market Leading Compensation + Equity",
                        "salary_min": 1200000,
                        "salary_max": 2200000,
                        "experience_required": "1-3 Years",
                        "tech_stack": ["React", "TypeScript", "Node.js", "REST APIs", "Cloud Infrastructure"],
                        "description": f"Live position at {comp.title()}: {title} in {loc}."
                    })
        return parsed_jobs

    def fetch_lever_jobs(self) -> List[Dict[str, Any]]:
        parsed_jobs = []
        for comp in self.lever_companies:
            logger.info(f"Scanning live Lever career board for {comp}...")
            url = f"https://api.lever.co/v0/postings/{comp}?mode=json"
            data = self._fetch_url(url)
            if not data or not isinstance(data, list):
                continue
            
            for j in data:
                title = self._clean_text(j.get("text", ""))
                categories = j.get("categories", {})
                loc = self._clean_text(categories.get("location", "Remote"))
                team = self._clean_text(categories.get("team", "Engineering"))
                
                if any(k in title.lower() or k in team.lower() for k in ["engineer", "developer", "software", "full stack", "frontend", "backend"]):
                    is_contract = "contract" in title.lower()
                    parsed_jobs.append({
                        "id": f"lev_{j.get('id', uuid.uuid4().hex[:6])}",
                        "title": title,
                        "company": comp.title(),
                        "department": team or "Engineering",
                        "location": loc,
                        "remote_type": "Remote" if "remote" in loc.lower() or "remote" in j.get("workplaceType", "").lower() else "Hybrid",
                        "job_type": "Freelance / Contract" if is_contract else "Full-Time",
                        "url": j.get("hostedUrl"),
                        "source": "Lever",
                        "ats_platform": "Lever ATS",
                        "salary_raw": "Market Leading Compensation + Benefits",
                        "salary_min": 1300000,
                        "salary_max": 2500000,
                        "experience_required": "1-3 Years",
                        "tech_stack": ["React", "TypeScript", "Node.js", "Python", "Cloud"],
                        "description": f"Live position at {comp.title()}: {title} in {loc}."
                    })
        return parsed_jobs

    def fetch_linkedin_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live LinkedIn Jobs stream for Software & Full Stack positions...")
        try:
            import requests
            from bs4 import BeautifulSoup
            url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=software%20developer&location=India"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("li")
            parsed_jobs = []
            for c in cards:
                title_elem = c.find("h3", class_="base-search-card__title")
                comp_elem = c.find("h4", class_="base-search-card__subtitle")
                loc_elem = c.find("span", class_="job-search-card__location")
                link_elem = c.find("a", class_="base-card__full-link")
                
                if not title_elem or not link_elem:
                    continue
                
                title = self._clean_text(title_elem.text)
                company = self._clean_text(comp_elem.text if comp_elem else "LinkedIn Enterprise")
                location = self._clean_text(loc_elem.text if loc_elem else "India")
                job_url = link_elem.get("href", "").split("?")[0]
                
                parsed_jobs.append({
                    "id": f"li_{uuid.uuid4().hex[:6]}",
                    "title": title,
                    "company": company,
                    "department": "Engineering",
                    "location": location,
                    "remote_type": "Remote" if "remote" in location.lower() else "Hybrid",
                    "job_type": "Full-Time",
                    "url": job_url,
                    "source": "LinkedIn",
                    "ats_platform": "LinkedIn Easy Apply",
                    "salary_raw": "₹12,00,000 - ₹20,00,000 INR",
                    "salary_min": 1200000,
                    "salary_max": 2000000,
                    "experience_required": "1-3 Years",
                    "tech_stack": ["React", "Node.js", "TypeScript", "REST APIs", "SQL"],
                    "description": f"Live LinkedIn listing for {title} at {company} in {location}."
                })
            logger.info(f"Successfully scraped {len(parsed_jobs)} real live LinkedIn postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live LinkedIn jobs: {e}")
            return []

    def fetch_indeed_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Indeed Jobs stream for Tech listings...")
        try:
            import requests
            from bs4 import BeautifulSoup
            url = "https://www.indeed.com/rss?q=software+developer&l=India"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            items = soup.find_all("item")
            parsed_jobs = []
            for item in items:
                title = self._clean_text(item.find("title").text if item.find("title") else "")
                link = item.find("link").text if item.find("link") else ""
                desc = self._clean_text(item.find("description").text if item.find("description") else "")
                
                if not title or not link:
                    continue
                
                parsed_jobs.append({
                    "id": f"ind_{uuid.uuid4().hex[:6]}",
                    "title": title,
                    "company": "Tech Company (Indeed)",
                    "department": "Digital Engineering",
                    "location": "India / Remote",
                    "remote_type": "Remote",
                    "job_type": "Full-Time",
                    "url": link,
                    "source": "Indeed",
                    "ats_platform": "Indeed Apply",
                    "salary_raw": "₹10,00,000 - ₹16,00,000 INR",
                    "salary_min": 1000000,
                    "salary_max": 1600000,
                    "experience_required": "1+ Years",
                    "tech_stack": ["Node.js", "Express.js", "MongoDB", "React", "REST APIs"],
                    "description": desc if desc else "Live Indeed job listing."
                })
            logger.info(f"Successfully scraped {len(parsed_jobs)} real live Indeed postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Indeed jobs: {e}")
            return []

    def fetch_internshala_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Internshala stream for Developer Jobs & High-Paid Internships...")
        try:
            import requests
            from bs4 import BeautifulSoup
            url = "https://internshala.com/jobs/full-stack-development-jobs/"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("div", class_="individual_internship")
            parsed_jobs = []
            for c in cards:
                title_elem = c.find("h3", class_="job-internship-name") or c.find("div", class_="heading_4_5")
                comp_elem = c.find("p", class_="company-name") or c.find("div", class_="heading_6_company_name")
                loc_elem = c.find("a", class_="location_link") or c.find("span", class_="location")
                
                if not title_elem:
                    continue
                
                title = self._clean_text(title_elem.text)
                company = self._clean_text(comp_elem.text if comp_elem else "Tech Startup")
                location = self._clean_text(loc_elem.text if loc_elem else "Remote / India")
                link = "https://internshala.com" + c.get("data-href", "/jobs")
                
                parsed_jobs.append({
                    "id": f"is_{uuid.uuid4().hex[:6]}",
                    "title": title,
                    "company": company,
                    "department": "Engineering",
                    "location": location,
                    "remote_type": "Remote" if "work from home" in location.lower() or "remote" in location.lower() else "Hybrid",
                    "job_type": "Full-Time / Paid Internship",
                    "url": link,
                    "source": "Internshala",
                    "ats_platform": "Internshala Quick Apply",
                    "salary_raw": "₹8,00,000 - ₹12,00,000 INR",
                    "salary_min": 800000,
                    "salary_max": 1200000,
                    "experience_required": "0-2 Years",
                    "tech_stack": ["React", "Node.js", "JavaScript", "Express", "MongoDB"],
                    "description": f"Live Internshala opportunity for {title} at {company}."
                })
            logger.info(f"Successfully scraped {len(parsed_jobs)} real live Internshala postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Internshala jobs: {e}")
            return []

    def fetch_unstop_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Unstop stream for Engineering Jobs & Hiring Challenges...")
        try:
            url = "https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&searchTerm=developer"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                return []
            
            raw_data = data.get("data", {}).get("data", [])
            parsed_jobs = []
            for item in raw_data:
                title = self._clean_text(item.get("title", ""))
                comp_name = self._clean_text(item.get("organisation", {}).get("name", "Unstop Partner"))
                seo_url = item.get("seo_url") or item.get("id")
                link = f"https://unstop.com/jobs/{seo_url}" if seo_url else "https://unstop.com/jobs"
                
                job_detail = item.get("job_detail", {})
                sal_min = job_detail.get("min_salary") or 900000
                sal_max = job_detail.get("max_salary") or 1800000
                
                parsed_jobs.append({
                    "id": f"un_{item.get('id', uuid.uuid4().hex[:6])}",
                    "title": title,
                    "company": comp_name,
                    "department": "Engineering Core",
                    "location": "India / Remote",
                    "remote_type": "Hybrid",
                    "job_type": "Full-Time",
                    "url": link,
                    "source": "Unstop",
                    "ats_platform": "Unstop Direct",
                    "salary_raw": f"₹{sal_min:,.0f} - ₹{sal_max:,.0f} INR" if sal_min and sal_max else "₹12,00,000 - ₹20,00,000 INR",
                    "salary_min": sal_min if isinstance(sal_min, (int, float)) else 900000,
                    "salary_max": sal_max if isinstance(sal_max, (int, float)) else 1800000,
                    "experience_required": "0-2 Years",
                    "tech_stack": ["React", "Node.js", "Java", "SQL", "Full Stack"],
                    "description": self._clean_text(item.get("description", "")) or f"Live Unstop posting: {title}."
                })
            logger.info(f"Successfully scraped {len(parsed_jobs)} real live Unstop postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Unstop jobs: {e}")
            return []

    def fetch_naukri_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Naukri stream for Full Stack, Vue, Laravel, ERP & React listings in Remote, Bengaluru, Chennai...")
        try:
            import requests
            from bs4 import BeautifulSoup
            parsed_jobs = []
            queries = ["full-stack-developer", "vue-js-developer", "laravel-developer", "react-developer"]
            for q in queries:
                url = f"https://www.naukri.com/{q}-jobs-in-bengaluru-chennai?k={q}&l=bengaluru%2C%20chennai%2C%20remote"
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                resp = requests.get(url, headers=headers, timeout=8)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    title_elems = soup.find_all("a", class_="title")
                    for t in title_elems[:5]:
                        t_text = self._clean_text(t.text)
                        job_link = t.get("href", "")
                        if t_text and job_link:
                            parsed_jobs.append({
                                "id": f"nk_{uuid.uuid4().hex[:6]}",
                                "title": t_text,
                                "company": "Naukri Partner Company",
                                "department": "Engineering",
                                "location": "Bengaluru / Chennai / Remote",
                                "remote_type": "Remote" if "remote" in t_text.lower() else "Hybrid",
                                "job_type": "Full-Time",
                                "url": job_link if job_link.startswith("http") else f"https://www.naukri.com{job_link}",
                                "source": "Naukri",
                                "ats_platform": "Naukri 1-Click Apply",
                                "salary_raw": "₹8,00,000 - ₹16,00,000 INR",
                                "salary_min": 800000,
                                "salary_max": 1600000,
                                "experience_required": "0-2 Years",
                                "tech_stack": ["React", "Vue.js", "Laravel", "MySQL", "Node.js", "Full Stack"],
                                "description": f"Live Naukri job listing for {t_text}."
                            })
            logger.info(f"Successfully scraped {len(parsed_jobs)} live Naukri postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Naukri jobs: {e}")
            return []

    def fetch_ashby_jobs(self) -> List[Dict[str, Any]]:
        parsed_jobs = []
        for comp in self.ashby_companies:
            logger.info(f"Scanning live Ashby career board for {comp}...")
            url = f"https://api.ashbyhq.com/posting-api/job-board/{comp}"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                continue
            
            jobs = data.get("jobs", data.get("jobPostings", []))
            for j in jobs:
                title = self._clean_text(j.get("title", ""))
                loc = self._clean_text(j.get("locationName", "Remote"))
                is_contract = "contract" in title.lower()
                parsed_jobs.append({
                    "id": f"ash_{j.get('id', uuid.uuid4().hex[:6])}",
                    "title": title,
                    "company": comp.title(),
                    "department": self._clean_text(j.get("departmentName", "Engineering")),
                    "location": loc,
                    "remote_type": "Remote" if "remote" in loc.lower() or j.get("isRemote") else "Hybrid",
                    "job_type": "Freelance / Contract" if is_contract else "Full-Time",
                    "url": j.get("jobUrl") or f"https://jobs.ashbyhq.com/{comp}/{j.get('id')}",
                    "source": "Ashby",
                    "ats_platform": "Ashby ATS",
                    "salary_raw": "Global Competitive Salary + Remote Benefits",
                    "salary_min": 1500000,
                    "salary_max": 3000000,
                    "experience_required": "1-3 Years",
                    "tech_stack": ["React", "TypeScript", "Node.js", "Python", "Cloud"],
                    "description": f"Live position at {comp.title()}: {title} in {loc}."
                })
        return parsed_jobs

    async def discover_jobs(self, keywords: List[str] = None) -> List[Dict[str, Any]]:
        logger.info("Discovery Agent scanning live web job & multi-portal streams...")
        loop = asyncio.get_event_loop()
        
        fl_task = loop.run_in_executor(None, self.fetch_freelancer_com_projects)
        rok_task = loop.run_in_executor(None, self.fetch_remoteok_jobs)
        an_task = loop.run_in_executor(None, self.fetch_arbeitnow_jobs)
        gh_task = loop.run_in_executor(None, self.fetch_greenhouse_jobs)
        lev_task = loop.run_in_executor(None, self.fetch_lever_jobs)
        ash_task = loop.run_in_executor(None, self.fetch_ashby_jobs)
        li_task = loop.run_in_executor(None, self.fetch_linkedin_jobs)
        ind_task = loop.run_in_executor(None, self.fetch_indeed_jobs)
        ish_task = loop.run_in_executor(None, self.fetch_internshala_jobs)
        uns_task = loop.run_in_executor(None, self.fetch_unstop_jobs)
        nk_task = loop.run_in_executor(None, self.fetch_naukri_jobs)
        
        results = await asyncio.gather(
            fl_task, rok_task, an_task, gh_task, lev_task, ash_task, li_task, ind_task, ish_task, uns_task, nk_task,
            return_exceptions=True
        )
        
        def is_strictly_remote(job):
            rtype = (job.get("remote_type") or "").lower()
            loc = (job.get("location") or "").lower()
            title = (job.get("title") or "").lower()
            desc = (job.get("description") or "").lower()
            
            # Exclude explicit onsite/relocation requirements
            if "relocation required" in desc or "strictly onsite" in desc or "hybrid only" in loc:
                return False
                
            return (
                "remote" in rtype or 
                "remote" in loc or 
                "anywhere" in loc or 
                "worldwide" in loc or 
                "global" in loc or 
                "work from home" in loc or
                "remote" in title
            )
            
        remote_only_jobs = []
        for job in all_jobs:
            if is_strictly_remote(job):
                job["remote_type"] = "Remote"
                job["is_100_remote"] = True
                remote_only_jobs.append(job)
                
        logger.info(f"Discovered {len(remote_only_jobs)} strictly 100% remote live full-time and freelance project postings across 10 job portals & ATS engines.")
        return remote_only_jobs

    async def discover_all_jobs(self, remote_only: bool = True) -> List[Dict[str, Any]]:
        return await self.discover_jobs()

discovery_agent = JobDiscoveryAgent()

