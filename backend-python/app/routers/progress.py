from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import analyze_face
from ..auth import get_current_user
from ..database import get_db
from ..models import Analysis, ProgressPhoto, User
from ..schemas import ProgressPhotoOut
from ..storage import delete_image, upload_image

router = APIRouter(prefix="/api/progress", tags=["progress"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 8 * 1024 * 1024


@router.get("/photos", response_model=list[ProgressPhotoOut])
def list_photos(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProgressPhotoOut]:
    photos = db.scalars(
        select(ProgressPhoto)
        .where(ProgressPhoto.user_id == user.id)
        .order_by(ProgressPhoto.photo_date.desc(), ProgressPhoto.id.desc())
    ).all()
    return [ProgressPhotoOut.model_validate(p) for p in photos]


@router.post("/photos", response_model=ProgressPhotoOut, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    photo_date: date | None = Form(None),
    notes: str | None = Form(None),
    run_analysis: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressPhotoOut:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, or WEBP image.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large. Maximum size is 8 MB.")

    image_url = upload_image(data, file.content_type)
    analysis_id: int | None = None

    if run_analysis:
        try:
            result = analyze_face(data, file.content_type)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if result.get("valid_face", True):
            analysis = Analysis(user_id=user.id, image_url=image_url, result_json=result)
            db.add(analysis)
            db.commit()
            db.refresh(analysis)
            analysis_id = analysis.id

    photo = ProgressPhoto(
        user_id=user.id,
        photo_date=photo_date or date.today(),
        image_url=image_url,
        analysis_id=analysis_id,
        notes=notes,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return ProgressPhotoOut.model_validate(photo)


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    photo = db.get(ProgressPhoto, photo_id)
    if photo is None or photo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Photo not found.")
    image_url = photo.image_url
    db.delete(photo)
    db.commit()
    delete_image(image_url)
