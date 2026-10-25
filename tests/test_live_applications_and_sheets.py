import unittest
import os
import json
import sys
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.browser_automation_agent import PlaywrightBrowserAgent
from backend.main import is_blacklisted_employer, _run_autonomous_batch_apply, AUTO_APPLY_STATE
from services.google_sheets_service import GoogleSheetsSyncService

class TestLiveApplicationsAndSheets(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.agent = PlaywrightBrowserAgent()

    def test_pdf_resume_resolution(self):
        """Verifies that the agent resolves the genuine PDF resume rather than raw text dump."""
        resume_path = self.agent.get_resume_path()
        self.assertTrue(os.path.exists(resume_path), f"Resume path {resume_path} does not exist.")
        self.assertTrue(resume_path.lower().endswith(".pdf"), f"Expected PDF resume, got: {resume_path}")

    def test_headless_mode_detection(self):
        """Verifies that headless mode is correctly detected or configurable."""
        with patch.dict(os.environ, {"PLAYWRIGHT_HEADLESS": "true"}):
            agent_headless = PlaywrightBrowserAgent()
            self.assertTrue(agent_headless.headless)

        with patch.dict(os.environ, {"PLAYWRIGHT_HEADLESS": "false"}):
            agent_headful = PlaywrightBrowserAgent()
            self.assertFalse(agent_headful.headless)

    def test_blacklisted_employer_safeguard(self):
        """Verifies that Onemodo Technologies (current employer) is strictly excluded."""
        self.assertTrue(is_blacklisted_employer("Onemodo Technologies Services Pvt Ltd"))
        self.assertTrue(is_blacklisted_employer("Onemodo"))
        self.assertTrue(is_blacklisted_employer("ONEMODO TECHNOLOGIES"))
        self.assertFalse(is_blacklisted_employer("GitLab"))
        self.assertFalse(is_blacklisted_employer("Stripe"))

    @patch("backend.main.discovery_agent.discover_jobs")
    @patch("backend.main.rag_db.get_applications")
    @patch("backend.main.semantic_matcher.evaluate")
    @patch("backend.main.browser_agent.submit_application", new_callable=AsyncMock)
    @patch("backend.main.rag_db.record_application")
    @patch("backend.main.sheets_agent.log_application")
    async def test_autonomous_batch_apply_calls_browser(
        self, mock_sheets_log, mock_rag_record, mock_submit_app, mock_eval, mock_get_apps, mock_discover
    ):
        """Verifies that autonomous auto-apply invokes browser_agent and does not falsely mark Applied on error."""
        AUTO_APPLY_STATE["enabled"] = True
        AUTO_APPLY_STATE["is_running"] = False

        mock_get_apps.return_value = []
        mock_eval.return_value = {"overall_match_score": 94.5}

        mock_discover.return_value = [
            {
                "id": "job_sample_ai",
                "title": "Full Stack Engineer (React, Node.js)",
                "company": "Supabase",
                "url": "https://boards.greenhouse.io/supabase/jobs/12345",
                "source": "greenhouse",
                "tech_stack": ["React", "Node.js", "TypeScript", "REST APIs", "SQL"],
                "description": "Seeking Full Stack Engineer proficient in React, Node.js, and TypeScript."
            }
        ]

        # Simulate browser requiring manual CAPTCHA review
        mock_submit_app.return_value = {
            "status": "Review_Required",
            "success": False,
            "human_review_needed": True,
            "reason": "Cloudflare Turnstile verification detected.",
            "url": "https://boards.greenhouse.io/supabase/jobs/12345"
        }

        await _run_autonomous_batch_apply()

        # Browser submit MUST be called
        self.assertTrue(mock_submit_app.called, "browser_agent.submit_application was never called!")
        call_args = mock_submit_app.call_args[0]
        self.assertEqual(call_args[0]["company"], "Supabase")

        # RAG and Sheets must record the REAL status ('Review_Required'), NOT a fake 'Applied'
        recorded_app = mock_rag_record.call_args[0][0]
        self.assertEqual(recorded_app["status"], "Review_Required")

    def test_google_sheets_payload_structure(self):
        """Verifies Google Sheets row structure contains all 11 detailed columns."""
        service = GoogleSheetsSyncService()
        test_app = {
            "id": "app_test_123",
            "company": "Cloudflare",
            "role": "Full Stack AI Engineer",
            "location": "Global Remote",
            "remoteType": "Remote",
            "jobType": "Full-Time",
            "salaryRaw": "$120,000 - $160,000 USD",
            "matchScore": 96.5,
            "status": "Applied",
            "url": "https://boards.greenhouse.io/cloudflare/jobs/8097321"
        }

        import tempfile
        temp_csv = tempfile.NamedTemporaryFile(mode="w+", delete=False, suffix=".csv")
        temp_csv.close()
        os.remove(temp_csv.name)
        service.csv_export_path = temp_csv.name
        service._ensure_csv_headers()

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.getcode.return_value = 200
            mock_urlopen.return_value.__enter__.return_value = mock_resp

            result = service.sync_application_row(test_app)
            self.assertTrue(result)

        # Verify local CSV contains detailed headers and row
        self.assertTrue(os.path.exists(service.csv_export_path))
        with open(service.csv_export_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            self.assertGreaterEqual(len(lines), 2)
            header = lines[0]
            self.assertIn("Timestamp", header)
            self.assertIn("Company", header)
            self.assertIn("Job / Project Title", header)
            self.assertIn("Salary / Contract Rate", header)
            self.assertIn("Match Score %", header)

if __name__ == "__main__":
    unittest.main()
