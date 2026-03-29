import os
import jwt
import uuid
import base64
import json
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import aiohttp
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.discovery import build

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "eventos-dev-secret")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# OAuth scopes — openid/email/profile for login, gmail.send for email
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.send",
]


# ──────────────────────────────────────────────
# OAuth Flow (manual — no PKCE to avoid code_verifier issues)
# ──────────────────────────────────────────────

def get_google_auth_url() -> str:
    """Generate the Google OAuth consent URL manually."""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"https://accounts.google.com/o/oauth2/auth?{urllib.parse.urlencode(params)}"


async def handle_google_callback(code: str) -> dict:
    """
    Exchange the auth code for tokens via direct HTTP POST,
    fetch user info, save to DB.
    """
    from backend.db import database

    # Exchange code for tokens via HTTP POST (no PKCE needed)
    async with aiohttp.ClientSession() as session:
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        async with session.post("https://oauth2.googleapis.com/token", data=token_data) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(f"Token exchange failed: {error_text}")
            tokens = await resp.json()

    access_token = tokens.get("access_token", "")
    refresh_token = tokens.get("refresh_token", "")

    # Fetch user profile from Google
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with session.get("https://www.googleapis.com/oauth2/v2/userinfo", headers=headers) as resp:
            user_info = await resp.json()

    google_id = user_info.get("id", "")
    email = user_info.get("email", "")
    name = user_info.get("name", "")
    picture = user_info.get("picture", "")

    # Upsert user in MongoDB
    user_doc = {
        "google_id": google_id,
        "email": email,
        "name": name,
        "picture": picture,
        "gmail_access_token": access_token,
        "gmail_refresh_token": refresh_token,
        "gmail_token_uri": "https://oauth2.googleapis.com/token",
        "gmail_client_id": GOOGLE_CLIENT_ID,
        "gmail_client_secret": GOOGLE_CLIENT_SECRET,
        "updated_at": datetime.utcnow().isoformat(),
    }

    # Check if user already exists
    existing = await database.get_one_document("users", {"google_id": google_id})
    if existing:
        user_id = existing.get("id", existing.get("_id", str(uuid.uuid4())))
        await database.update_document("users", {"google_id": google_id}, user_doc)
    else:
        user_id = str(uuid.uuid4())
        user_doc["id"] = user_id
        user_doc["created_at"] = datetime.utcnow().isoformat()
        await database.insert_document("users", user_doc)

        # Auto-create a starter project for new users
        await database.insert_document("projects", {
            "id": str(uuid.uuid4()),
            "name": f"{name.split()[0] if name else 'My'}'s First Event",
            "event_type": "general",
            "attendee_count": 100,
            "status": "planning",
            "owner_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
        })

    # Generate JWT
    payload = {
        "user_id": user_id,
        "google_id": google_id,
        "email": email,
        "name": name,
        "picture": picture,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return {
        "token": token,
        "user": {
            "id": user_id,
            "google_id": google_id,
            "email": email,
            "name": name,
            "picture": picture,
        },
    }


# ──────────────────────────────────────────────
# JWT Verification
# ──────────────────────────────────────────────

def decode_jwt(token: str) -> Optional[dict]:
    """Decode and verify a JWT token. Returns the payload or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def get_current_user(authorization: str = "") -> Optional[dict]:
    """
    Extract user from Authorization header.
    Returns user dict or None if not authenticated.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization[7:]  # Strip "Bearer "
    payload = decode_jwt(token)
    if not payload:
        return None

    return {
        "user_id": payload.get("user_id"),
        "google_id": payload.get("google_id"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "picture": payload.get("picture"),
    }


# ──────────────────────────────────────────────
# Gmail API — Send emails from user's account
# ──────────────────────────────────────────────

async def send_gmail(
    user_id: str,
    to_email: str,
    subject: str,
    body: str,
    html_body: str = "",
) -> dict:
    """
    Send an email from the user's Gmail account using their stored OAuth tokens.
    Returns: {"status": "sent"|"failed", "message_id": "...", "from": "..."}
    """
    from backend.db import database

    # Get user's tokens from DB
    user = await database.get_one_document("users", {"id": user_id})
    if not user:
        # Try by google_id
        user = await database.get_one_document("users", {"google_id": user_id})

    if not user:
        return {"status": "failed", "error": "User not found"}

    access_token = user.get("gmail_access_token", "")
    refresh_token = user.get("gmail_refresh_token", "")

    if not access_token and not refresh_token:
        return {"status": "failed", "error": "No Gmail tokens — user needs to re-authenticate"}

    try:
        # Build credentials
        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=user.get("gmail_token_uri", "https://oauth2.googleapis.com/token"),
            client_id=user.get("gmail_client_id", GOOGLE_CLIENT_ID),
            client_secret=user.get("gmail_client_secret", GOOGLE_CLIENT_SECRET),
            scopes=SCOPES,
        )

        # Refresh if expired
        if creds.expired or not creds.valid:
            creds.refresh(GoogleAuthRequest())
            # Update stored tokens
            await database.update_document(
                "users",
                {"id": user_id},
                {"gmail_access_token": creds.token},
            )

        # Build the email message
        if html_body:
            message = MIMEMultipart("alternative")
            message.attach(MIMEText(body, "plain"))
            message.attach(MIMEText(html_body, "html"))
        else:
            message = MIMEText(body)

        message["to"] = to_email
        message["from"] = user.get("email", "")
        message["subject"] = subject

        # Encode the message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        # Send via Gmail API
        service = build("gmail", "v1", credentials=creds)
        sent_message = service.users().messages().send(
            userId="me",
            body={"raw": raw_message},
        ).execute()

        return {
            "status": "sent",
            "message_id": sent_message.get("id", ""),
            "from": user.get("email", ""),
        }

    except Exception as e:
        return {"status": "failed", "error": str(e)}
