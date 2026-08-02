from config.logger import logger
from typing import Dict, Any

class NotificationDispatcherAgent:
    """
    Multi-channel notification dispatcher (Telegram, Discord, Webhook, Console).
    Sends immediate alerts for Human-in-the-Loop review requests (CAPTCHAs), interview invites, and high-match job postings.
    """
    def send_alert(self, title: str, message: str, payload: Dict[str, Any] = None):
        logger.info(f"========== NOTIFICATION ALERT: {title} ==========")
        logger.info(message)
        if payload:
            logger.info(f"Payload: {payload}")
        logger.info("==================================================")

notification_agent = NotificationDispatcherAgent()
