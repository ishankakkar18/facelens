import base64
import json
import re
from typing import Any

import httpx

from .config import get_settings

SYSTEM_PROMPT = """You are FaceLens, a kind, evidence-informed skin and grooming coach.
You analyze a single selfie and return a supportive, practical report.

Hard rules:
- Never diagnose a medical condition. You may mention visible signs and suggest seeing a dermatologist when appropriate.
- Never rate attractiveness or call anyone ugly/pretty. Use neutral, inclusive language.
- Do not guess ethnicity, sex, or identity. Do not comment on weight.
- Keep advice realistic, affordable, and non-invasive. No surgery or extreme procedures.
- Suggestions must be concrete and safe: skincare, grooming, sleep, hydration, sun protection, posture, stress.
- If the photo does not contain a clear, front-facing human face, return an "error" object instead of guessing.

Return ONLY valid JSON matching the requested shape."""

USER_PROMPT = """Analyze the face in this photo.

Return JSON with exactly these keys:
{
  "valid_face": true,
  "overall_description": "2-4 warm, descriptive sentences about the face and its overall character",
  "estimated_age_range": "e.g. 25-32 (an estimate, not a fact)",
  "facial_shape": "e.g. oval, round, square, heart, diamond, oblong",
  "symmetry_notes": "neutral observations about facial balance",
  "skin": {
    "tone": "neutral description",
    "texture": "neutral description",
    "concerns": ["short visible concerns, e.g. mild redness, dryness, uneven tone"]
  },
  "features": {
    "eyes": "short neutral note",
    "nose": "short neutral note",
    "lips": "short neutral note",
    "jawline": "short neutral note"
  },
  "strengths": ["3-5 genuine strengths"],
  "areas_to_improve": ["2-4 gentle, actionable focus areas"],
  "suggestions": {
    "skincare": ["3-5 specific steps/products types"],
    "grooming": ["2-4 specific grooming ideas"],
    "lifestyle": ["2-4 habits: sleep, hydration, sun, posture, stress"],
    "professional": ["when/why to see a dermatologist, if relevant; empty array if not"]
  },
  "disclaimer": "This is a general wellness analysis, not medical advice."
}

If no clear face is present, return:
{"valid_face": false, "error": "reason"}
"""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    # Remove markdown fences if the model adds them.
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


CHANGE_PROMPT = """Compare two FaceLens skin/grooming reports for the same person:
- PREVIOUS (older)
- CURRENT (newer)

Return JSON with exactly these keys:
{
  "summary": "3-5 supportive sentences describing what changed and what it likely means",
  "improved": ["things that look better now"],
  "worsened": ["things that look worse or need attention"],
  "unchanged": ["things that stayed about the same"],
  "next_focus": ["2-4 concrete priorities for the next period"]
}

Be gentle and factual. Never diagnose. If the reports contain no meaningful difference,
say so plainly and keep the lists short. Return ONLY JSON."""


def summarize_changes(previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Copy backend/.env.example to backend/.env and add your key."
        )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent"
    )
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": CHANGE_PROMPT},
                    {"text": "PREVIOUS:\n" + json.dumps(previous, ensure_ascii=False)},
                    {"text": "CURRENT:\n" + json.dumps(current, ensure_ascii=False)},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
            "maxOutputTokens": 1024,
        },
    }

    with httpx.Client(timeout=90) as client:
        response = client.post(url, params={"key": settings.gemini_api_key}, json=payload)

    if response.status_code != 200:
        detail = response.text[:500]
        raise RuntimeError(f"Gemini API error ({response.status_code}): {detail}")

    data = response.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini returned an unexpected response shape.") from exc

    parsed = _extract_json(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("Gemini returned invalid JSON.")
    return parsed


def analyze_face(image_bytes: bytes, mime_type: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Copy backend/.env.example to backend/.env and add your key."
        )

    b64 = base64.b64encode(image_bytes).decode("ascii")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent"
    )
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": USER_PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": b64}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
            "maxOutputTokens": 2048,
        },
    }

    with httpx.Client(timeout=90) as client:
        response = client.post(url, params={"key": settings.gemini_api_key}, json=payload)

    if response.status_code != 200:
        detail = response.text[:500]
        raise RuntimeError(f"Gemini API error ({response.status_code}): {detail}")

    data = response.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini returned an unexpected response shape.") from exc

    parsed = _extract_json(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("Gemini returned invalid JSON.")
    return parsed
