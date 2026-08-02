from typing import Dict, Any, List

class OfferComparisonEngine:
    """
    Offer Comparison Engine:
    Evaluates multiple offers by Total Compensation, Base vs ESOP, Work Flexibility, Growth Trajectory, and Benefits.
    """
    def compare_offers(self, offers: List[Dict[str, Any]]) -> Dict[str, Any]:
        ranked = []
        for offer in offers:
            base = offer.get("base_inr", 0)
            bonus = offer.get("bonus_inr", 0)
            esop = offer.get("esop_val_inr", 0)
            total_comp = base + bonus + (esop * 0.25)
            
            flexibility = 95 if offer.get("remote") else 75
            growth = offer.get("growth_score", 85)
            
            final_rating = round((total_comp / 100000) * 0.5 + (flexibility * 0.25) + (growth * 0.25), 2)
            ranked.append({
                "company": offer.get("company"),
                "role": offer.get("role"),
                "base_salary": base,
                "total_annual_comp": total_comp,
                "remote_flexibility": f"{flexibility}%",
                "final_evaluation_score": final_rating
            })
            
        ranked.sort(key=lambda x: x["final_evaluation_score"], reverse=True)
        return {
            "recommended_offer": ranked[0] if ranked else None,
            "offer_rankings": ranked
        }

offer_comparator = OfferComparisonEngine()
