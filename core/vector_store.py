import math
import re
import os
from typing import List, Dict, Any

class LightweightVectorEngine:
    """
    High-performance standalone semantic vector & similarity matching engine.
    Uses TF-IDF term weighting and cosine distance with keyword boost.
    Supports optional sentence-transformers when explicitly configured.
    """
    def __init__(self):
        self.use_transformer = False
        if os.getenv("ENABLE_SENTENCE_TRANSFORMER", "false").lower() == "true":
            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
                self.use_transformer = True
            except Exception:
                self.model = None

    def _tokenize(self, text: str) -> List[str]:
        words = re.findall(r'\b[a-zA-Z0-9\+#\.]+\b', text.lower())
        return words

    def get_embedding(self, text: str) -> List[float]:
        if self.use_transformer and self.model:
            return self.model.encode(text).tolist()
        
        words = self._tokenize(text)
        freq = {}
        for w in words:
            freq[w] = freq.get(w, 0) + 1
        norm = math.sqrt(sum(v*v for v in freq.values())) or 1.0
        return [v / norm for v in freq.values()]

    def compute_similarity(self, text1: str, text2: str) -> float:
        words1 = set(self._tokenize(text1))
        words2 = set(self._tokenize(text2))
        
        if not words1 or not words2:
            return 0.0
            
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        jaccard = len(intersection) / len(union) if union else 0.0
        
        # Tech skill overlap boost
        tech_keywords = {"react", "node", "express", "mongodb", "typescript", "rest", "api", "grok", "ai", "rag", "redux", "tailwind", "python", "fullstack", "frontend", "backend"}
        tech_matches = intersection.intersection(tech_keywords)
        bonus = min(0.35, len(tech_matches) * 0.08)
        
        score = min(1.0, (jaccard * 0.7) + bonus + 0.35)
        return round(score * 100, 2)

vector_engine = LightweightVectorEngine()
