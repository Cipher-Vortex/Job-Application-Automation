from typing import Dict, Any, List

class SkillGapAnalyzerAgent:
    """
    Skill Gap Analyzer & Personalized Learning Roadmap Generator:
    Compares recurring missing skills across target jobs and creates actionable learning paths with free resources.
    """
    def analyze_skill_gaps(self, candidate_skills: List[str], target_jobs: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_required = []
        for job in target_jobs:
            all_required.extend(job.get("tech_stack", []))
            
        cand_set = set(s.lower() for s in candidate_skills)
        missing_counts = {}
        for req in all_required:
            if req.lower() not in cand_set:
                missing_counts[req] = missing_counts.get(req, 0) + 1

        sorted_missing = sorted(missing_counts.items(), key=lambda x: x[1], reverse=True)
        
        roadmap = []
        for skill, count in sorted_missing[:5]:
            roadmap.append({
                "skill": skill,
                "frequency_in_jd": f"{count} jobs require this",
                "learning_time_estimate": "3-5 Days",
                "recommended_free_resources": [
                    f"Official {skill} Documentation & Quickstart Guide",
                    f"FreeCodeCamp {skill} Deep-Dive Tutorial on YouTube",
                    f"GitHub Open Source Sample Project for {skill}"
                ]
            })

        return {
            "total_jobs_analyzed": len(target_jobs),
            "top_missing_skills": [s[0] for s in sorted_missing[:5]],
            "learning_roadmap": roadmap
        }

skill_gap_agent = SkillGapAnalyzerAgent()
