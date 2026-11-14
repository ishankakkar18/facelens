import hashlib
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..ai import analyze_face
from ..auth import get_optional_user
from ..database import get_db
from ..models import Analysis, Consent, User
from ..services import create_habits_from_analysis
from ..storage import upload_image

router = APIRouter(prefix="/api", tags=["analyze"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB

# Very small in-memory rate limiter: 6 requests / 10 min / IP.
WINDOW_SECONDS = 600
MAX_REQUESTS = 6
_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(ip: str) -> None:
    now = time.time()
    bucket = _hits[ip]
    while bucket and now - bucket[0] > WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many analyses. Please wait a few minutes.")
    bucket.append(now)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hash_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()[:32]


@router.post("/analyze")
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    consent: bool = Form(...),
    save: bool = Form(False),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> dict:
    ip = _client_ip(request)
    _rate_limit(ip)

    if not consent:
        raise HTTPException(status_code=400, detail="You must consent to photo analysis first.")
    if save and user is None:
        raise HTTPException(status_code=401, detail="Log in to save analyses to your history.")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, or WEBP image.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large. Maximum size is 8 MB.")

    db.add(Consent(user_id=user.id if user else None, ip_hash=_hash_ip(ip)))
    db.commit()

    try:
        result = analyze_face(data, file.content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not result.get("valid_face", True):
        raise HTTPException(
            status_code=422,
            detail=result.get("error", "No clear, front-facing face was detected. Try another selfie."),
        )

    analysis_id: int | None = None
    image_url: str | None = None

    if save and user is not None:
        image_url = upload_image(data, file.content_type)
        record = Analysis(user_id=user.id, image_url=image_url, result_json=result)
        db.add(record)
        db.commit()
        db.refresh(record)
        analysis_id = record.id
        create_habits_from_analysis(db, user.id, record.id, result)

    return {"id": analysis_id, "image_url": image_url, "result": result}
