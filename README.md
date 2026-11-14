# FaceLens

Upload a selfie, get a kind and practical skin + grooming report, then follow a daily
checklist. Come back anytime to see what changed. Includes progress photos, AI change
summaries, and a doctor hub (directory, questions, visits, prescriptions).

> FaceLens is a wellness tool, **not medical advice**. It never scores attractiveness.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS (deploy: Vercel) |
| Backend | FastAPI + SQLAlchemy (deploy: Render) |
| Database | SQLite for dev, MySQL / TiDB for production |
| AI | Google Gemini (`gemini-3.5-flash`) |
| Storage | Cloudflare R2 when configured, local `backend/uploads` otherwise |
| Auth | JWT (email + password) |

## Features

- **Analyze** — upload a selfie, get a structured report (skin, features, strengths, focus areas).
- **Daily tracker** — AI suggestions become habits automatically; tick them off, build a streak.
- **Custom habits** — add, pause, or delete your own routine steps.
- **Progress photos** — visual timeline with optional AI analysis per photo.
- **What changed** — compare any two analyses (field-level cards + AI narrative).
- **Doctor hub** — dermatologist directory, question log with answers, visit/prescription tracking.
- **PDF export** — download any saved analysis as a report.
- **Privacy-first** — photos are ephemeral unless the user saves them.

## Project layout

```
facelens/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, startup
│   │   ├── config.py          # env settings
│   │   ├── database.py        # engine + session
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── auth.py            # JWT + password hashing
│   │   ├── ai.py              # Gemini analysis + change summary
│   │   ├── services.py        # habit generation + diff
│   │   ├── storage.py         # R2 / local uploads
│   │   ├── seed.py            # demo dermatologists
│   │   └── routers/           # auth, analyze, analyses, tracker, progress, insights, doctors
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/pages/             # Home, Login, Register, Dashboard, Analyze, Result, ...
│   ├── src/components/        # Layout, UI, Icons, ProtectedRoute
│   ├── src/lib/api.js         # typed-ish API client
│   ├── .env.example
│   └── vercel.json
├── render.yaml
└── README.md
```

## Local setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- SQLite database is created automatically at `backend/facelens.db`.

Get a free Gemini key: https://aistudio.google.com/app/apikey

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

## Environment variables

### Backend (`backend/.env`)

| Key | Notes |
| --- | --- |
| `SECRET_KEY` | Long random string (Render can generate it) |
| `DATABASE_URL` | `sqlite:///./facelens.db` or `mysql+pymysql://user:pass@host:4000/facelens?charset=utf8mb4` |
| `GEMINI_API_KEY` | Required for analysis |
| `GEMINI_MODEL` | Default `gemini-3.5-flash` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `R2_*` | Optional Cloudflare R2 credentials |

### Frontend (`frontend/.env`)

| Key | Notes |
| --- | --- |
| `VITE_API_URL` | Backend URL, e.g. `http://localhost:8000` or your Render URL |

## Deploy free (Render + Vercel)

### Backend on Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** and select the repo (`render.yaml` is detected), **or** create a
   Web Service manually:
   - Root directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Plan: Free
3. Set env vars: `GEMINI_API_KEY`, `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`.
4. Free tier sleeps after ~15 min idle; the first request may take ~30s.

### Frontend on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. Root directory: `frontend`
3. Framework preset: Vite (build `npm run build`, output `dist`).
4. Env var: `VITE_API_URL=https://<your-render-service>.onrender.com`
5. Deploy. `vercel.json` handles SPA routing.

### Database on free MySQL

- **TiDB Cloud Serverless** (MySQL-compatible) or **Aiven for MySQL** free tier.
- Set `DATABASE_URL` on Render, e.g.
  `mysql+pymysql://user:password@host:4000/facelens?charset=utf8mb4`
- Tables are created automatically on startup.

> Note: Render's ephemeral disk means local SQLite/uploads are lost on redeploy. Use MySQL +
> R2 for production.

## API summary

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Auth |
| GET | `/api/auth/me` | Current user |
| POST | `/api/analyze` | Upload + analyze (multipart) |
| GET | `/api/analyses` | List saved analyses |
| GET/DELETE | `/api/analyses/{id}` | Read / delete |
| GET | `/api/analyses/{id}/pdf` | PDF report |
| GET | `/api/tracker/summary` | Today + streak |
| GET/POST | `/api/tracker/habits` | List / create habits |
| PATCH/DELETE | `/api/tracker/habits/{id}` | Update / delete |
| GET/POST | `/api/tracker/logs` | Day logs / upsert |
| GET/POST | `/api/progress/photos` | Timeline / upload |
| DELETE | `/api/progress/photos/{id}` | Delete photo |
| GET | `/api/insights/changes` | Compare two analyses |
| GET | `/api/doctors`, `/api/doctors/cities` | Directory |
| GET/POST | `/api/doctors/questions` | Question log |
| PATCH/DELETE | `/api/doctors/questions/{id}` | Answer / delete |
| GET/POST | `/api/doctors/visits` | Visits |
| PATCH/DELETE | `/api/doctors/visits/{id}` | Update / delete |

## Notes & next steps

- The dermatologist directory is **demo data** (marked "sample"). Replace `backend/app/seed.py`
  with a verified source before launch.
- The "doctor answers" are user-entered notes, not real medical replies.
- Rate limiting is in-memory (6 analyses / 10 min / IP). For production scale, move it to Redis.
- Add Alembic migrations if you need versioned schema changes.
