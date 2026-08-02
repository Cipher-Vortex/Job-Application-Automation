import unittest
import os
import json
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.job_parser_agent import job_parser_agent
from agents.semantic_matching_agent import semantic_matcher
from agents.resume_optimization_agent import resume_optimizer
from agents.cover_letter_agent import cover_letter_agent
from agents.salary_intelligence_agent import salary_intelligence_agent
from agents.offer_comparison_agent import offer_comparator

class TestJobPilotAgents(unittest.TestCase):
    def setUp(self):
        base_dir = os.path.join(os.path.dirname(__file__), "../data/user_profile")
        def r(f):
            with open(os.path.join(base_dir, f), "r", encoding="utf-8") as fp:
                return json.load(fp)
        self.mock_candidate = {
            "profile": r("profile.json"),
            "experience": r("experience.json"),
            "education": r("education.json"),
            "skills": r("skills.json"),
            "projects": r("projects.json")
        }
        self.mock_raw_job = {
            "id": "job_test",
            "title": "Full Stack Engineer (React & Node.js)",
            "company": "SaaSify Technologies",
            "salary_raw": "₹12,00,000 - ₹18,00,000 PER ANNUM",
            "tech_stack": ["React", "Node.js", "TypeScript", "Express", "MongoDB", "REST APIs"],
            "description": "We are seeking a high-performing Full Stack Engineer proficient in the MERN stack (React, Node.js, Express, MongoDB)."
        }

    def test_job_parser(self):
        parsed = job_parser_agent.parse_job(self.mock_raw_job)
        self.assertEqual(parsed["title"], "Full Stack Engineer (React & Node.js)")
        self.assertEqual(parsed["salary_min"], 1200000.0)
        self.assertEqual(parsed["salary_max"], 1800000.0)
        self.assertIn("React", parsed["tech_stack"])

    def test_semantic_matching(self):
        parsed = job_parser_agent.parse_job(self.mock_raw_job)
        eval_res = semantic_matcher.evaluate(self.mock_candidate, parsed)
        self.assertGreaterEqual(eval_res["overall_match_score"], 70.0)
        self.assertGreaterEqual(eval_res["skill_match"], 70.0)

    def test_salary_intelligence(self):
        parsed = job_parser_agent.parse_job(self.mock_raw_job)
        sal = salary_intelligence_agent.analyze_compensation(parsed)
        self.assertIn(sal["classification"], ["Above Market", "Excellent Offer", "Fair"])
        self.assertEqual(sal["jd_salary_average"], 1500000.0)

    def test_resume_optimizer(self):
        parsed = job_parser_agent.parse_job(self.mock_raw_job)
        res = resume_optimizer.optimize_resume(self.mock_candidate, "Full Stack", parsed)
        self.assertGreater(res["ats_score"], 85.0)

    def test_cover_letter_generation(self):
        parsed = job_parser_agent.parse_job(self.mock_raw_job)
        letter = cover_letter_agent.generate_cover_letter(self.mock_candidate, parsed)
        self.assertIn("SaaSify Technologies", letter)
        self.assertIn("Kiran S R", letter)

    def test_offer_comparator(self):
        offers = [
            {"company": "CompA", "role": "SDE", "base_inr": 1200000, "bonus_inr": 100000, "esop_val_inr": 200000, "remote": True},
            {"company": "CompB", "role": "Frontend", "base_inr": 900000, "bonus_inr": 50000, "esop_val_inr": 0, "remote": False}
        ]
        res = offer_comparator.compare_offers(offers)
        self.assertEqual(res["recommended_offer"]["company"], "CompA")

if __name__ == "__main__":
    unittest.main()
