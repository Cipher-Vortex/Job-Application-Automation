import datetime
from typing import Dict, Any, List

class RecruiterCRMAgent:
    """
    Recruiter Relationship Manager (CRM):
    Tracks recruiter contacts, touchpoints, message drafts, and follow-up schedules.
    """
    def __init__(self):
        self.contacts = [
            {
                "id": "rec_1",
                "name": "Ananya Sharma",
                "company": "SaaSify Technologies",
                "email": "ananya.sharma@saasify.io",
                "linkedin": "https://linkedin.com/in/ananya-sharma-recruiter",
                "status": "In Communication",
                "last_contacted": "2026-08-01",
                "next_follow_up": "2026-08-05",
                "notes": "Discussed Full Stack Engineer role. Highly interested in Cerebrum AI project."
            },
            {
                "id": "rec_2",
                "name": "Rohan Mehta",
                "company": "Innovate AI Labs",
                "email": "rohan.m@innovateai.com",
                "linkedin": "https://linkedin.com/in/rohan-mehta-ta",
                "status": "Initial Outreach Sent",
                "last_contacted": "2026-07-30",
                "next_follow_up": "2026-08-04",
                "notes": "Sent custom note regarding React / Next.js frontend lead position."
            }
        ]

    def get_all_contacts(self) -> List[Dict[str, Any]]:
        return self.contacts

    def generate_outreach_draft(self, recruiter_name: str, company: str, role: str) -> str:
        return f"""Hi {recruiter_name},

I noticed that {company} is actively hiring for a {role}. As a Full Stack Engineer with internship experience shipping production MERN applications, optimizing DB query performance by 40%, and integrating AI/RAG features using Grok API, I would love to connect and share how my technical background aligns with your team's goals.

Looking forward to connecting!

Best regards,
Kiran S R
skkiran1258@gmail.com
"""

recruiter_crm = RecruiterCRMAgent()
