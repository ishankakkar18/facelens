from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Dermatologist

# Demo directory only. Replace with a verified, licensed source before launch.
SAMPLE_DERMATOLOGISTS = [
    {
        "name": "Dr. A. Sharma (sample)",
        "city": "Bengaluru",
        "specialty": "Dermatology, acne & pigmentation",
        "phone": "+91-00000-00001",
        "address": "Indiranagar, Bengaluru",
    },
    {
        "name": "Dr. R. Iyer (sample)",
        "city": "Bengaluru",
        "specialty": "Cosmetic dermatology",
        "phone": "+91-00000-00002",
        "address": "Koramangala, Bengaluru",
    },
    {
        "name": "Dr. P. Mehta (sample)",
        "city": "Mumbai",
        "specialty": "Clinical dermatology",
        "phone": "+91-00000-00003",
        "address": "Bandra West, Mumbai",
    },
    {
        "name": "Dr. S. Khan (sample)",
        "city": "Delhi",
        "specialty": "Dermatology, hair & scalp",
        "phone": "+91-00000-00004",
        "address": "Hauz Khas, New Delhi",
    },
    {
        "name": "Dr. N. Rao (sample)",
        "city": "Hyderabad",
        "specialty": "Dermatology, eczema & sensitive skin",
        "phone": "+91-00000-00005",
        "address": "Jubilee Hills, Hyderabad",
    },
    {
        "name": "Dr. K. Patel (sample)",
        "city": "Pune",
        "specialty": "Dermatology & skin allergies",
        "phone": "+91-00000-00006",
        "address": "Kothrud, Pune",
    },
    {
        "name": "Dr. V. Nair (sample)",
        "city": "Chennai",
        "specialty": "Dermatology, pigmentation",
        "phone": "+91-00000-00007",
        "address": "Adyar, Chennai",
    },
]


def seed_dermatologists(db: Session) -> None:
    count = db.scalar(select(func.count()).select_from(Dermatologist)) or 0
    if count:
        return
    db.add_all(Dermatologist(**row) for row in SAMPLE_DERMATOLOGISTS)
    db.commit()
