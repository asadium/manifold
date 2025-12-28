import os
from dotenv import load_dotenv

load_dotenv()

API_PREFIX: str = os.getenv("API_PREFIX", "/api")
PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Deploy Portal")

