from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import summarize_changes
from ..auth import get_current_user
from ..database import get_db
from ..models import Analysis, User
from ..services import diff_analyses

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("/changes")
def changes(
    previous_id: int | None = Query(None),
    current_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    previous: Analysis | None = None
    current: Analysis | None = None

    if previous_id is not None or current_id is not None:
        if previous_id is None or current_id is None:
            raise HTTPException(status_code=400, detail="Provide both previous_id and current_id.")
        previous = db.get(Analysis, previous_id)
        current = db.get(Analysis, current_id)
        if (
            previous is None
            or current is None
            or previous.user_id != user.id
            or current.user_id != user.id
        ):
            raise HTTPException(status_code=404, detail="Analysis not found.")
        if previous.id == current.id:
            raise HTTPException(status_code=400, detail="Pick two different analyses.")
        if previous.created_at > current.created_at:
            previous, current = current, previous
    else:
        analyses = db.scalars(
            select(Analysis)
            .where(Analysis.user_id == user.id)
            .order_by(Analysis.created_at.desc(), Analysis.id.desc())
            .limit(2)
        ).all()
        if len(analyses) < 2:
            raise HTTPException(
                status_code=400,
                detail="You need at least two saved analyses to see what changed.",
            )
        current, previous = analyses[0], analyses[1]

    diff = diff_analyses(previous.result_json, current.result_json)

    ai_summary: dict | None = None
    ai_error: str | None = None
    try:
        ai_summary = summarize_changes(previous.result_json, current.result_json)
    except RuntimeError as exc:
        ai_error = str(exc)

    return {
        "previous": {
            "id": previous.id,
            "created_at": previous.created_at.isoformat(),
            "image_url": previous.image_url,
            "result": previous.result_json,
        },
        "current": {
            "id": current.id,
            "created_at": current.created_at.isoformat(),
            "image_url": current.image_url,
            "result": current.result_json,
        },
        "diff": diff,
        "ai": ai_summary,
        "ai_error": ai_error,
    }
