from typing import Dict, Any

class CoverLetterAgent:
    """
    Personalized Cover Letter Generator incorporating candidate details, achievements, and JD context.
    """
    def generate_cover_letter(self, candidate_profile: Dict[str, Any], parsed_job: Dict[str, Any]) -> str:
        name = candidate_profile.get("profile", {}).get("name", "Kiran S R")
        company = parsed_job.get("company", "Hiring Team")
        role = parsed_job.get("title", "Full Stack Engineer")
        tech_stack = ", ".join(parsed_job.get("tech_stack", ["React", "Node.js", "REST APIs"]))
        
        cover_letter = f"""Dear Hiring Team at {company},

I am writing to express my strong enthusiasm for the {role} position at {company}. As a Full Stack Engineer with hands-on experience building production-grade MERN stack applications and AI-integrated platforms, I am excited about the opportunity to contribute to your engineering goals.

During my recent Frontend Developer internship at Zupper, I engineered a reusable React component library of 20+ components that reduced duplicate engineering work by 30%. Additionally, I optimized frontend load times by 25% through memoization and code splitting. In my full-stack projects, such as Cerebrum (an AI-powered note-taking platform), I integrated the Grok API (xAI) and built RAG retrieval pipelines, while in my Travel Booking platform, I reduced database query latency by 40% using MongoDB compound indexing.

I am particularly drawn to {company}'s focus on engineering excellence and modern technologies like {tech_stack}. My background aligns seamlessly with your requirements, and I am eager to bring my problem-solving skills, API design experience, and dedication to your team.

Thank you for your time and consideration. I welcome the opportunity to discuss how my technical skills and project experience can deliver value to {company}.

Sincerely,
{name}
skkiran1258@gmail.com | +91 81247 85632 | Bengaluru, India
"""
        return cover_letter

cover_letter_agent = CoverLetterAgent()
