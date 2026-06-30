import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

GROQ_API_KEY = os.getenv("Groq", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
HOST = "0.0.0.0"
PORT = 8000
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "https://acid-rebel.github.io"]
