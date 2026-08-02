import re
from typing import Dict, Any

class JobParserAgent:
    """
    Parses raw Job Descriptions into structured JSON metadata.
    Extracts salary range, experience, stack, remote type, and ATS platform.
    """
    def parse_job(self, raw_job: Dict[str, Any]) -> Dict[str, Any]:
        description = raw_job.get("description", "")
        title = raw_job.get("title", "")
        salary_raw = raw_job.get("salary_raw", "")
        
        # Salary extraction regex
        salary_min, salary_max = None, None
        inr_match = re.search(r'₹?\s*([\d,]+)\s*(?:-|to)\s*₹?\s*([\d,]+)', salary_raw)
        if inr_match:
            try:
                salary_min = float(inr_match.group(1).replace(",", ""))
                salary_max = float(inr_match.group(2).replace(",", ""))
            except ValueError:
                pass

        # Tech stack detection
        stack_keywords = ["React", "Node.js", "Express", "MongoDB", "TypeScript", "Next.js", "Redux", "Tailwind", "REST", "Grok", "RAG", "Python", "JWT", "OAuth"]
        detected_stack = [kw for kw in stack_keywords if kw.lower() in (description + title).lower()]
        if not detected_stack and raw_job.get("tech_stack"):
            detected_stack = raw_job.get("tech_stack")

        return {
            "id": raw_job.get("id"),
            "title": title,
            "company": raw_job.get("company"),
            "department": raw_job.get("department", "Engineering"),
            "location": raw_job.get("location", "Remote"),
            "remote_type": raw_job.get("remote_type", "Remote"),
            "url": raw_job.get("url"),
            "source": raw_job.get("source"),
            "ats_platform": raw_job.get("ats_platform"),
            "salary_raw": salary_raw,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "currency": "INR",
            "experience_required": raw_job.get("experience_required", "1+ Years"),
            "tech_stack": list(set(detected_stack)),
            "description": description
        }

job_parser_agent = JobParserAgent()
