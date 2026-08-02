from typing import Dict, Any, List

class InterviewPrepAgent:
    """
    Generates tailored, company-specific interview prep kits:
    - Technical System Design & Architecture
    - Live Coding & Algorithmic prep topics
    - Behavioral STAR method questions
    - Role-specific deep dives
    """
    def generate_prep_kit(self, company: str, role: str, tech_stack: List[str]) -> Dict[str, Any]:
        return {
            "company": company,
            "role": role,
            "system_design_topics": [
                "Designing a high-throughput REST API with JWT/OAuth token rotation & rate limiting",
                "Indexing strategies in MongoDB for 40% latency reduction under heavy query load",
                "Building a RAG (Retrieval-Augmented Generation) pipeline for fast document search using vector embeddings",
                "Optimizing React client rendering with code-splitting, lazy loading, and memoization"
            ],
            "coding_challenges": [
                "Implement a 5-second debounced auto-save function in React/JavaScript",
                "Write a middleware for Role-Based Access Control (RBAC) in Express.js",
                "Flatten nested JSON structures and build deep search indexers",
                "Implement LRU Cache or Rate Limiter in Node.js"
            ],
            "behavioral_star_questions": [
                {
                    "question": "Tell me about a time you optimized application performance.",
                    "star_answer": "Situation: At Zupper, frontend page loads were slow. Task: Reduce load times. Action: Implemented React memoization and code splitting with React.lazy. Result: Cut load times by ~25% and eliminated redundant re-renders."
                },
                {
                    "question": "How do you handle edge cases when integrating REST APIs?",
                    "star_answer": "Situation: At Jozzby Bazar, backend API contracts had null values and race conditions. Task: Ensure robust UI rendering. Action: Built contract validation schemas, error boundaries, and async state guards. Result: Zero client crashes during edge case API responses."
                }
            ]
        }

interview_prep = InterviewPrepAgent()
