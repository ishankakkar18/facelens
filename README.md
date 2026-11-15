# FaceLens

Upload a selfie, get a kind and practical skin + grooming report, then follow a daily
checklist. Come back anytime to see what changed. Includes progress photos, AI change
summaries, and a doctor hub (directory, questions, visits, prescriptions).

> FaceLens is a wellness tool, **not medical advice**. It never scores attractiveness.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS (deploy: Vercel) |
| Backend | Spring Boot 4 (Java 21) + Spring Security + Spring Data JPA (deploy: Render Docker) |
| Database | H2 file for local dev, MySQL / TiDB for production |
| AI | Google Gemini (`gemini-3.5-flash`) |
| Storage | Cloudflare R2 when configured, local `backend/uploads` otherwise |
| Auth | JWT (email + password, BCrypt) |

> The original FastAPI implementation is kept in `backend-python/` for reference. The app now
> uses the Spring Boot backend in `backend/`.

## Features

- **Analyze** — capture or upload 3 photos (front, right side, left side), validate the angles, then get a detailed skin, acne, and acne-marks report.
- **Daily tracker** — AI suggestions become habits automatically; tick them off, build a streak.
- **Custom habits** — add, pause, or delete your own routine steps.
- **Progress** — a 12-month activity heatmap/calendar (click a day to see completed tasks) plus a visual timeline of progress photos with optional AI analysis.
- **What changed** — compare any two analyses (field-level cards + AI narrative).
- **Doctor hub** — dermatologist directory, question log with answers, visit/prescription tracking.
- **PDF export** — download any saved analysis as a report.
- **Privacy-first** — photos are ephemeral unless the user saves them.

## Project layout

```
facelens/
├── backend/                      # Spring Boot API (primary)
│   ├── pom.xml
│   ├── Dockerfile
│   ├── .env.example
│   └── src/main/java/com/facelens/
│       ├── FaceLensApplication.java
│       ├── config/               # security, CORS, static uploads, seed data
│       ├── auth/                 # JWT service, filter, principal
│       ├── controller/           # auth, analyze, analyses, tracker, progress, insights, doctors
│       ├── dto/                  # request/response records
│       ├── entity/               # JPA entities
│       ├── repository/           # Spring Data repositories
│       ├── service/              # Gemini, storage, PDF, habits, rate limiting
│       └── exception/            # API errors
├── backend-python/               # legacy FastAPI implementation (reference)
├── frontend/
│   ├── src/pages/                # Home, Login, Register, Dashboard, Analyze, Result, ...
│   ├── src/components/           # Layout, UI, Icons, ProtectedRoute
│   ├── src/lib/api.js            # API client
│   └── vercel.json
├── render.yaml
└── README.md
```

## Local setup

### Prerequisites

- Java 21+ (Java 25 works)
- Maven 3.9+
- Node 18+ and npm
- A free Gemini key: https://aistudio.google.com/app/apikey

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env and add GEMINI_API_KEY
mvn spring-boot:run
```

- API: http://localhost:8000
- Health: http://localhost:8000/health
- Local database: `backend/data/facelens.mv.db` (created automatically)
- Local uploads: `backend/uploads/`

Or build and run the jar:

```bash
mvn -DskipTests package
java -jar target/facelens-backend-1.0.0.jar
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

## Environment variables

Spring Boot reads `backend/.env` in local development (via `spring.config.import`). In
production, set the same values as environment variables.

| Key | Notes |
| --- | --- |
| `SECRET_KEY` | Long random string used to sign JWTs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default `10080` |
| `SPRING_DATASOURCE_URL` | MySQL JDBC URL; leave unset for local H2 |
| `SPRING_DATASOURCE_USERNAME` | MySQL username |
| `SPRING_DATASOURCE_PASSWORD` | MySQL password |
| `GEMINI_API_KEY` | Required for analysis |
| `GEMINI_MODEL` | Default `gemini-3.5-flash` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `R2_*` | Optional Cloudflare R2 credentials |
| `UPLOAD_DIR` | Local upload directory, default `uploads` |
| `PORT` | Server port, default `8000` |

Frontend (`frontend/.env`):

| Key | Notes |
| --- | --- |
| `VITE_API_URL` | Backend URL, e.g. `http://localhost:8000` or your Render URL |

## Deploy free (Render + Vercel)

### Backend on Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** and select the repo (`render.yaml` is detected), **or** create a
   Docker Web Service manually:
   - Dockerfile: `backend/Dockerfile`
   - Docker context: `backend`
   - Plan: Free
3. Set env vars: `GEMINI_API_KEY`, `SECRET_KEY`, `SPRING_DATASOURCE_URL`,
   `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `CORS_ORIGINS`.
4. Free tier sleeps after ~15 min idle; the first request may take ~30s.

### Frontend on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. Root directory: `frontend`
3. Framework preset: Vite (build `npm run build`, output `dist`).
4. Env var: `VITE_API_URL=https://<your-render-service>.onrender.com`
5. Deploy. `vercel.json` handles SPA routing.

### Database on free MySQL

- **TiDB Cloud Serverless** (MySQL-compatible) or **Aiven for MySQL** free tier.
- Set on Render:
  - `SPRING_DATASOURCE_URL=jdbc:mysql://host:4000/facelens?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`
  - `SPRING_DATASOURCE_USERNAME=...`
  - `SPRING_DATASOURCE_PASSWORD=...`
- Tables are created automatically on startup (`ddl-auto=update`).

> Render's ephemeral disk means local H2 data and uploads are lost on redeploy. Use MySQL +
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

- The dermatologist directory is **demo data** (marked "sample"). Replace
  `backend/src/main/java/com/facelens/config/DataInitializer.java` with a verified source before
  launch.
- The "doctor answers" are user-entered notes, not real medical replies.
- Rate limiting is in-memory (6 analyses / 10 min / IP). For production scale, move it to Redis.
- Add Flyway or Liquibase if you need versioned schema migrations.
