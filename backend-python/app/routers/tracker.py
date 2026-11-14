from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Habit, HabitLog, User
from ..schemas import (
    HabitCreate,
    HabitLogOut,
    HabitLogUpsert,
    HabitOut,
    HabitUpdate,
    TodayHabit,
    TrackerSummary,
)

router = APIRouter(prefix="/api/tracker", tags=["tracker"])


def _owned_habit(habit_id: int, user: User, db: Session) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        raise HTTPException(status_code=404, detail="Habit not found.")
    return habit


@router.get("/habits", response_model=list[HabitOut])
def list_habits(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HabitOut]:
    query = select(Habit).where(Habit.user_id == user.id)
    if not include_inactive:
        query = query.where(Habit.active.is_(True))
    habits = db.scalars(query.order_by(Habit.created_at.asc(), Habit.id.asc())).all()
    return [HabitOut.model_validate(h) for h in habits]


@router.post("/habits", response_model=HabitOut, status_code=201)
def create_habit(
    payload: HabitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitOut:
    habit = Habit(
        user_id=user.id,
        title=payload.title.strip(),
        category=payload.category,
        source="custom",
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return HabitOut.model_validate(habit)


@router.patch("/habits/{habit_id}", response_model=HabitOut)
def update_habit(
    habit_id: int,
    payload: HabitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitOut:
    habit = _owned_habit(habit_id, user, db)
    if payload.title is not None:
        habit.title = payload.title.strip()
    if payload.category is not None:
        habit.category = payload.category
    if payload.active is not None:
        habit.active = payload.active
    db.commit()
    db.refresh(habit)
    return HabitOut.model_validate(habit)


@router.delete("/habits/{habit_id}", status_code=204)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    habit = _owned_habit(habit_id, user, db)
    db.delete(habit)
    db.commit()


@router.get("/logs", response_model=list[HabitLogOut])
def list_logs(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HabitLogOut]:
    today = date.today()
    start = date_from or (today - timedelta(days=6))
    end = date_to or today
    logs = db.scalars(
        select(HabitLog)
        .where(HabitLog.user_id == user.id, HabitLog.log_date >= start, HabitLog.log_date <= end)
        .order_by(HabitLog.log_date.asc())
    ).all()
    return [HabitLogOut.model_validate(log) for log in logs]


@router.post("/logs", response_model=HabitLogOut)
def upsert_log(
    payload: HabitLogUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitLogOut:
    _owned_habit(payload.habit_id, user, db)

    log = db.scalar(
        select(HabitLog).where(
            HabitLog.user_id == user.id,
            HabitLog.habit_id == payload.habit_id,
            HabitLog.log_date == payload.log_date,
        )
    )
    if log is None:
        log = HabitLog(
            user_id=user.id,
            habit_id=payload.habit_id,
            log_date=payload.log_date,
            completed=payload.completed,
            notes=payload.notes,
        )
        db.add(log)
    else:
        log.completed = payload.completed
        if payload.notes is not None:
            log.notes = payload.notes

    db.commit()
    db.refresh(log)
    return HabitLogOut.model_validate(log)


@router.get("/summary", response_model=TrackerSummary)
def summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TrackerSummary:
    today = date.today()
    habits = db.scalars(
        select(Habit)
        .where(Habit.user_id == user.id, Habit.active.is_(True))
        .order_by(Habit.created_at.asc(), Habit.id.asc())
    ).all()

    window_start = today - timedelta(days=89)
    logs = db.scalars(
        select(HabitLog).where(
            HabitLog.user_id == user.id,
            HabitLog.log_date >= window_start,
            HabitLog.log_date <= today,
        )
    ).all()

    today_logs = {log.habit_id: log for log in logs if log.log_date == today}
    completed_by_day: dict[date, set[int]] = defaultdict(set)
    for log in logs:
        if log.completed:
            completed_by_day[log.log_date].add(log.habit_id)

    active_ids = {habit.id for habit in habits}
    completed_count = sum(1 for habit in habits if today_logs.get(habit.id) and today_logs[habit.id].completed)
    total_count = len(habits)
    completion_rate = round(completed_count / total_count, 3) if total_count else 0.0

    streak = 0
    if active_ids:
        cursor = today
        if not active_ids.issubset(completed_by_day.get(today, set())):
            cursor = today - timedelta(days=1)
        while cursor >= window_start and active_ids.issubset(completed_by_day.get(cursor, set())):
            streak += 1
            cursor -= timedelta(days=1)

    return TrackerSummary(
        today=today,
        habits=[
            TodayHabit(
                habit=HabitOut.model_validate(habit),
                completed=bool(today_logs.get(habit.id) and today_logs[habit.id].completed),
                notes=today_logs[habit.id].notes if today_logs.get(habit.id) else None,
            )
            for habit in habits
        ],
        completed_count=completed_count,
        total_count=total_count,
        completion_rate=completion_rate,
        streak=streak,
    )
