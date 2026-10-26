import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "JobPilot AI"
    ENVIRONMENT: str = "production"
    PORT: int = 8000
    NODE_PORT: int = 3000
    DATABASE_URL: str = "sqlite:///./jobpilot.db"
    
    # AI Engine Configuration
    AI_PROVIDER: str = "ollama"  # ollama | groq | openrouter | mock
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    
    # Embeddings Configuration
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    
    # Browser Automation
    PLAYWRIGHT_HEADLESS: bool = True
    HUMAN_IN_THE_LOOP_MODE: bool = True
    AUTO_APPLY_THRESHOLD: float = 85.0
    
    # Integrations
    GOOGLE_SHEETS_SPREADSHEET_ID: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    DISCORD_WEBHOOK_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
