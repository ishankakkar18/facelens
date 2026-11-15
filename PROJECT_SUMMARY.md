# FaceLens — Project Summary

**Last updated:** 15 Nov 2026

FaceLens is a web app that analyzes a selfie, gives a kind and practical skin + grooming
report, turns the suggestions into a daily checklist, and tracks progress over time. It also
includes a doctor hub for finding a dermatologist, logging questions, and tracking visits and
prescriptions.

> FaceLens is a wellness tool, **not medical advice**. It never scores attractiveness.

---

## Live deployment

| Service | URL |
| --- | --- |
| Frontend (Vercel) | https://facelens.vercel.app |
| Backend (Render) | https://facelens-api.onrender.com |
| Health check | https://facelens-api.onrender.com/health |
| Database | TiDB Cloud Serverless MySQL (AWS Oregon, persistent) |
| GitHub repository | https://github.com/ishankakkar18/facelens |

**Demo account**

```
Email:    heatprod@facelens.app
Password: password123
```

---

## Product features

### Analysis
- Capture with the camera or upload 3 photos: **front**, **right side**, **left side**
- The AI checks the angles first; wrong/duplicate/covered photos are rejected with per-angle feedback
- Structured AI report: overall description, estimated age range, facial shape, symmetry,
  skin tone/texture/hydration/pores/oiliness, **acne** (severity, types, locations, inflammation),
  **acne marks** (PIH/PIE, severity, locations), features, strengths, focus areas,
  medical notes, and **"What to use"** ingredient suggestions
- PDF export of any saved report

### Daily tracker
- AI suggestions automatically become habits when an analysis is saved
- Day-wise checklist with completion tracking
- Streak and completion-rate summary
- 7-day completion chart
- Custom habits: add, pause/resume, delete

### Progress
- **12-month activity heatmap** (GitHub/LeetCode style) with color intensity based on completed tasks
- **Click any day** to see the completed and not-completed tasks for that date
- Visual timeline of progress photos
- Optional AI analysis for each photo
- Notes per photo

### What changed
- Compare any two analyses
- Field-level diff cards (concerns added/removed, strengths, focus areas, tone, texture)
- AI-written narrative: improving, needs attention, staying steady, next focus

### Doctor hub
- Dermatologist directory with city filters
- "When to see a professional" red flags
- Question log with answers
- Visit / prescription / follow-up tracking

### Accounts & privacy
- Email + password registration and login (JWT)
- Protected routes on the frontend
- No photo retention unless the user explicitly saves it
- Delete analyses and progress photos at any time
- Medical disclaimer throughout

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│  React + Vite (Vercel)      │        │  Spring Boot 4 (Render Docker)   │
│                             │        │                                  │
│  Pages:                     │  HTTPS │  Controllers:                    │
│  Home / Login / Register    │ ─────► │  auth, analyze, analyses,        │
│  Dashboard / Analyze        │        │  tracker, progress, insights,    │
│  Result / History / Compare │        │  doctors                         │
│  Tracker / Progress         │        │                                  │
│  Doctor / Settings          │        │  Services:                       │
│                             │        │  JWT auth, Gemini, storage,      │
│  State: JWT in localStorage │        │  habits, PDF, rate limiting      │
└─────────────────────────────┘        └───────────────┬──────────────────┘
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              │                        │                        │
                     ┌────────▼────────┐      ┌────────▼────────┐      ┌────────▼────────┐
                     │ TiDB MySQL      │      │ Cloudflare R2   │      │ Google Gemini   │
                     │ users, analyses │      │ or local uploads│      │ 3.5 Flash       │
                     │ habits, logs,   │      │                 │      │                 │
                     │ photos, doctors │      │                 │      │                 │
                     └─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, React Router 6, Tailwind CSS 3 |
| Backend | Spring Boot 4.1.2, Java 21, Spring Security, Spring Data JPA |
| Auth | JWT (JJWT 0.13), BCrypt password hashing |
| AI | Google Gemini `gemini-3.5-flash` (REST) |
| PDF | OpenPDF 3.0.5 |
| Storage | Local `uploads/` or Cloudflare R2 (AWS SDK v2) |
| Database (local) | H2 file, MySQL compatibility mode |
| Database (prod) | TiDB Cloud Serverless (MySQL 8 compatible) via `SPRING_DATASOURCE_*` |
| Frontend deploy | Vercel (Hobby) |
| Backend deploy | Render Docker web service (Free) |
| Legacy backend | FastAPI implementation retained in `backend-python/` |

---

## Data model

| Table | Purpose |
| --- | --- |
| `users` | Account email, BCrypt password hash, created timestamp |
| `analyses` | Saved AI reports (`result_json`), front/right/left image URLs, user |
| `consents` | Consent records with hashed IP and timestamp |
| `habits` | Skincare/grooming/lifestyle/professional habits, AI or custom |
| `habit_logs` | Per-day completion, unique per `(user, habit, date)` |
| `progress_photos` | Photo timeline with optional linked analysis |
| `doctor_questions` | Question log with status and answer |
| `doctor_visits` | Visit date, doctor, clinic, prescription, follow-up |
| `dermatologists` | Seeded demo directory |

---

## API endpoints

### Auth
| Method | Path |
| --- | --- |
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |

### Analysis
| Method | Path |
| --- | --- |
| POST | `/api/analyze` (multipart: `front`, `right`, `left`, `consent`, `save`) |
| GET | `/api/analyses` (`limit`, `offset`) |
| GET | `/api/analyses/{id}` |
| DELETE | `/api/analyses/{id}` |
| GET | `/api/analyses/{id}/pdf` |
| GET | `/api/insights/changes` (`previous_id`, `current_id` optional) |

### Tracker
| Method | Path |
| --- | --- |
| GET | `/api/tracker/summary` |
| GET / POST | `/api/tracker/habits` |
| PATCH / DELETE | `/api/tracker/habits/{id}` |
| GET / POST | `/api/tracker/logs` |

### Progress
| Method | Path |
| --- | --- |
| GET / POST | `/api/progress/photos` |
| DELETE | `/api/progress/photos/{id}` |

### Doctor hub
| Method | Path |
| --- | --- |
| GET | `/api/doctors` (`city` optional) |
| GET | `/api/doctors/cities` |
| GET / POST | `/api/doctors/questions` |
| PATCH / DELETE | `/api/doctors/questions/{id}` |
| GET / POST | `/api/doctors/visits` |
| PATCH / DELETE | `/api/doctors/visits/{id}` |

---

## Performance & free-tier behavior

- Route-level code splitting with `React.lazy` (main bundle ~196 kB, ~63 kB gzip)
- Client-side image compression before upload (max 1400 px, JPEG ~85%)
- Preconnect / DNS-prefetch to the Render API and Google Fonts
- Skeleton loaders for dashboard, tracker, and progress views
- GitHub Actions workflow pings `/health` every 10 minutes to keep the free Render instance warm
- Warm-up ping on app load; auth boot has a 60 s timeout; login/register show a
  "waking up the server" hint after 6 s

## Local development

### Backend

```bash
cd backend
cp .env.example .env
# add GEMINI_API_KEY to .env
mvn spring-boot:run
```

- API: http://localhost:8000
- Health: http://localhost:8000/health
- Local H2 DB: `backend/data/facelens.mv.db`
- Local uploads: `backend/uploads/`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

- App: http://localhost:5173

### Environment variables (backend)

| Key | Purpose |
| --- | --- |
| `SECRET_KEY` | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 10080) |
| `SPRING_DATASOURCE_URL` | MySQL JDBC URL; unset = local H2 |
| `SPRING_DATASOURCE_USERNAME` | MySQL username |
| `SPRING_DATASOURCE_PASSWORD` | MySQL password |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Default `gemini-3.5-flash` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `R2_*` | Optional Cloudflare R2 credentials |
| `UPLOAD_DIR` | Local upload directory |
| `PORT` | Server port (default 8000) |

### Environment variables (frontend)

| Key | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend base URL |

---

## Deployment details

### Render (backend via Docker)

- `render.yaml` Blueprint creates `facelens-api`
- Dockerfile: multi-stage Maven build → Java 21 JRE
- Render env vars:
  - `SECRET_KEY` (generated)
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL=gemini-3.5-flash`
  - `CORS_ORIGINS=https://facelens.vercel.app,http://localhost:5173,http://127.0.0.1:5173`
- Current database: **TiDB Cloud Serverless MySQL** (persistent, AWS Oregon)
- Free instance sleeps after ~15 minutes; first request may take ~50 seconds

### Vercel (frontend)

- Root directory: `frontend`
- Framework: Vite
- Build: `npm run build` → `dist`
- Env: `VITE_API_URL=https://facelens-api.onrender.com`
- SPA routing handled by `frontend/vercel.json`

### CORS fix applied

The first deployment only allowed localhost origins, which caused the frontend error
"Could not reach the server. Is the backend running?". The Render `CORS_ORIGINS` value was
updated to include `https://facelens.vercel.app`, a redeploy was triggered, and the following
was verified:

```
HTTP/2 200
access-control-allow-origin: https://facelens.vercel.app
```

---

## Verification log

The deployed system was tested end-to-end:

- Frontend loads: `200`
- Backend health: `200`
- CORS preflight from Vercel origin: `200`
- Registration + login from the deployed frontend: success
- Dashboard loads tracker summary and analysis count
- Live Gemini analysis: `200` with `facial_shape: oval`, `age_range: 24-32`
- 3-photo validation: `422` with per-angle `photo_errors` when photos are duplicated
- Result page rendering: acne severity, acne marks, hydration, pores, clinical notes, and
  "What to use" ingredients verified with a mock report
- Activity heatmap: 31-day range returned correct counts; clicking a day displayed completed
  and not-completed tasks
- Keep-alive GitHub Actions workflow: completed successfully
- Production frontend bundle: main JS 195.75 kB (63.07 kB gzip) with lazy-loaded route chunks
- **TiDB Cloud Serverless MySQL**: all 9 tables created automatically; 11 habits and 15 logs
  restored; data now persists across Render deploys
- Local backend tests also covered: habits, logs, streak, doctors, questions, visits,
  progress photos, PDF export, and AI change insights

---

## Known limitations

1. **TiDB Serverless free quota** — 5 GiB row storage and 50M request units per month; the
   instance is throttled if the free quota is exhausted.
2. **Free-tier cold starts** — Render sleeps after inactivity; the first request can be slow.
   A GitHub Actions workflow pings `/health` every 10 minutes to keep it warm.
3. **Demo dermatologist directory** — seeded sample data marked "(sample)"; replace with a
   verified source before real use.
4. **Doctor answers are user-entered notes** — not real medical replies.
5. **In-memory rate limiting** — 6 analyses per 10 minutes per IP; use Redis for multi-instance
   production.
6. **No automated test suite yet** — verification was done through API and UI smoke tests.

---

## Next steps

- [x] Connect TiDB Cloud Serverless and set `SPRING_DATASOURCE_*` on Render
- [ ] Replace sample dermatologist data with a verified directory
- [ ] Add Flyway or Liquibase migrations
- [ ] Add backend integration tests and frontend component tests
- [ ] Move rate limiting to Redis
- [ ] Add password reset / email verification
- [ ] Add Google sign-in
- [ ] Add product recommendations and routine reminders
- [ ] Add a data export / delete-account flow

---

## Repository layout

```
facelens/
├── backend/                 # Spring Boot 4 API (primary)
│   ├── pom.xml
│   ├── Dockerfile
│   ├── .env.example
│   └── src/main/java/com/facelens/
│       ├── config/          # security, CORS, static uploads, seed data
│       ├── auth/            # JWT service, filter, principal
│       ├── controller/      # auth, analyze, analyses, tracker, progress, insights, doctors
│       ├── dto/             # request/response records
│       ├── entity/          # JPA entities
│       ├── repository/      # Spring Data repositories
│       ├── service/         # Gemini, storage, PDF, habits, rate limiting
│       └── exception/       # API errors
├── backend-python/          # legacy FastAPI implementation (reference)
├── frontend/                # React + Vite app
├── render.yaml
├── README.md
└── PROJECT_SUMMARY.md
```
