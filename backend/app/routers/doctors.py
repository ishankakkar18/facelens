from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Dermatologist, DoctorQuestion, DoctorVisit, User
from ..schemas import (
    DermatologistOut,
    DoctorQuestionAnswer,
    DoctorQuestionCreate,
    DoctorQuestionOut,
    DoctorVisitCreate,
    DoctorVisitOut,
    DoctorVisitUpdate,
)

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("", response_model=list[DermatologistOut])
def list_dermatologists(
    city: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DermatologistOut]:
    query = select(Dermatologist)
    if city:
        query = query.where(Dermatologist.city.ilike(f"%{city.strip()}%"))
    rows = db.scalars(query.order_by(Dermatologist.city.asc(), Dermatologist.name.asc())).all()
    return [DermatologistOut.model_validate(r) for r in rows]


@router.get("/cities", response_model=list[str])
def list_cities(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[str]:
    rows = db.scalars(select(Dermatologist.city).distinct().order_by(Dermatologist.city.asc())).all()
    return list(rows)


# --- Questions ---
@router.get("/questions", response_model=list[DoctorQuestionOut])
def list_questions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DoctorQuestionOut]:
    rows = db.scalars(
        select(DoctorQuestion)
        .where(DoctorQuestion.user_id == user.id)
        .order_by(DoctorQuestion.created_at.desc())
    ).all()
    return [DoctorQuestionOut.model_validate(r) for r in rows]


@router.post("/questions", response_model=DoctorQuestionOut, status_code=201)
def create_question(
    payload: DoctorQuestionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DoctorQuestionOut:
    question = DoctorQuestion(user_id=user.id, question=payload.question.strip())
    db.add(question)
    db.commit()
    db.refresh(question)
    return DoctorQuestionOut.model_validate(question)


@router.patch("/questions/{question_id}", response_model=DoctorQuestionOut)
def answer_question(
    question_id: int,
    payload: DoctorQuestionAnswer,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DoctorQuestionOut:
    question = db.get(DoctorQuestion, question_id)
    if question is None or question.user_id != user.id:
        raise HTTPException(status_code=404, detail="Question not found.")
    question.answer = payload.answer.strip()
    question.status = "answered"
    question.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(question)
    return DoctorQuestionOut.model_validate(question)


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    question = db.get(DoctorQuestion, question_id)
    if question is None or question.user_id != user.id:
        raise HTTPException(status_code=404, detail="Question not found.")
    db.delete(question)
    db.commit()


# --- Visits ---
@router.get("/visits", response_model=list[DoctorVisitOut])
def list_visits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DoctorVisitOut]:
    rows = db.scalars(
        select(DoctorVisit)
        .where(DoctorVisit.user_id == user.id)
        .order_by(DoctorVisit.visit_date.desc(), DoctorVisit.id.desc())
    ).all()
    return [DoctorVisitOut.model_validate(r) for r in rows]


@router.post("/visits", response_model=DoctorVisitOut, status_code=201)
def create_visit(
    payload: DoctorVisitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DoctorVisitOut:
    visit = DoctorVisit(user_id=user.id, **payload.model_dump())
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return DoctorVisitOut.model_validate(visit)


@router.patch("/visits/{visit_id}", response_model=DoctorVisitOut)
def update_visit(
    visit_id: int,
    payload: DoctorVisitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DoctorVisitOut:
    visit = db.get(DoctorVisit, visit_id)
    if visit is None or visit.user_id != user.id:
        raise HTTPException(status_code=404, detail="Visit not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(visit, field, value)
    db.commit()
    db.refresh(visit)
    return DoctorVisitOut.model_validate(visit)


@router.delete("/visits/{visit_id}", status_code=204)
def delete_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    visit = db.get(DoctorVisit, visit_id)
    if visit is None or visit.user_id != user.id:
        raise HTTPException(status_code=404, detail="Visit not found.")
    db.delete(visit)
    db.commit()
