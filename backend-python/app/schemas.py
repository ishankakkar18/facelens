from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Auth ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Analyses ---
class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_url: str | None
    result_json: dict
    created_at: datetime


class AnalysisList(BaseModel):
    items: list[AnalysisOut]
    total: int


# --- Tracker ---
class HabitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(default="skincare", pattern="^(skincare|grooming|lifestyle|professional)$")
    source: str = Field(default="custom")


class HabitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, pattern="^(skincare|grooming|lifestyle|professional)$")
    active: bool | None = None


class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    source: str
    source_analysis_id: int | None
    active: bool
    created_at: datetime


class HabitLogUpsert(BaseModel):
    habit_id: int
    log_date: date
    completed: bool = True
    notes: str | None = None


class HabitLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    habit_id: int
    log_date: date
    completed: bool
    notes: str | None


class TodayHabit(BaseModel):
    habit: HabitOut
    completed: bool
    notes: str | None = None


class TrackerSummary(BaseModel):
    today: date
    habits: list[TodayHabit]
    completed_count: int
    total_count: int
    completion_rate: float
    streak: int


# --- Progress photos ---
class ProgressPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    photo_date: date
    image_url: str
    analysis_id: int | None
    notes: str | None
    created_at: datetime


# --- Doctor ---
class DoctorQuestionCreate(BaseModel):
    question: str = Field(min_length=5, max_length=2000)


class DoctorQuestionAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=5000)


class DoctorQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    status: str
    answer: str | None
    created_at: datetime
    answered_at: datetime | None


class DoctorVisitCreate(BaseModel):
    visit_date: date
    doctor_name: str = Field(min_length=1, max_length=255)
    clinic: str | None = None
    notes: str | None = None
    prescription: str | None = None
    next_followup: date | None = None


class DoctorVisitUpdate(BaseModel):
    visit_date: date | None = None
    doctor_name: str | None = Field(default=None, min_length=1, max_length=255)
    clinic: str | None = None
    notes: str | None = None
    prescription: str | None = None
    next_followup: date | None = None


class DoctorVisitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_date: date
    doctor_name: str
    clinic: str | None
    notes: str | None
    prescription: str | None
    next_followup: date | None
    created_at: datetime


class DermatologistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    specialty: str
    phone: str | None
    address: str | None
