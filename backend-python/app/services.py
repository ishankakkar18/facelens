from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Habit


def create_habits_from_analysis(
    db: Session,
    user_id: int,
    analysis_id: int,
    result: dict,
) -> list[Habit]:
    """Turn an analysis' suggestions into trackable habits, skipping duplicates."""
    suggestions = result.get("suggestions") or {}
    existing_titles = {
        title.strip().lower()
        for title in db.scalars(select(Habit.title).where(Habit.user_id == user_id)).all()
    }

    created: list[Habit] = []
    for category in ("skincare", "grooming", "lifestyle", "professional"):
        for item in suggestions.get(category) or []:
            title = str(item).strip()
            if not title or title.lower() in existing_titles:
                continue
            habit = Habit(
                user_id=user_id,
                title=title[:255],
                category=category,
                source="ai",
                source_analysis_id=analysis_id,
            )
            db.add(habit)
            created.append(habit)
            existing_titles.add(title.lower())

    if created:
        db.commit()
        for habit in created:
            db.refresh(habit)
    return created


def diff_analyses(previous: dict, current: dict) -> dict:
    """Field-level set differences used by the comparison cards."""

    def as_set(value) -> set[str]:
        if not value:
            return set()
        if isinstance(value, str):
            return {value.strip().lower()}
        return {str(v).strip().lower() for v in value if str(v).strip()}

    prev_skin = previous.get("skin") or {}
    curr_skin = current.get("skin") or {}

    prev_concerns = as_set(prev_skin.get("concerns"))
    curr_concerns = as_set(curr_skin.get("concerns"))
    prev_strengths = as_set(previous.get("strengths"))
    curr_strengths = as_set(current.get("strengths"))
    prev_focus = as_set(previous.get("areas_to_improve"))
    curr_focus = as_set(current.get("areas_to_improve"))

    return {
        "concerns_added": sorted(curr_concerns - prev_concerns),
        "concerns_removed": sorted(prev_concerns - curr_concerns),
        "strengths_added": sorted(curr_strengths - prev_strengths),
        "strengths_removed": sorted(prev_strengths - curr_strengths),
        "focus_added": sorted(curr_focus - prev_focus),
        "focus_removed": sorted(prev_focus - curr_focus),
        "skin_tone": {
            "previous": prev_skin.get("tone"),
            "current": curr_skin.get("tone"),
        },
        "skin_texture": {
            "previous": prev_skin.get("texture"),
            "current": curr_skin.get("texture"),
        },
    }
