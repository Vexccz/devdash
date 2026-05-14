# {{DISPLAY_NAME}}

Python FastAPI backend + React Vite frontend + SQLAlchemy + JWT Auth

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Fill in your env vars

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Stack

- **Backend:** Python FastAPI + SQLAlchemy + Alembic + JWT
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens)
- **Docs:** Auto-generated at `/docs` (Swagger) and `/redoc`

## Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app entry
│   ├── config.py        # Settings from env
│   ├── database.py      # SQLAlchemy setup
│   ├── models/          # DB models
│   ├── schemas/         # Pydantic schemas
│   ├── routers/         # API routes
│   ├── services/        # Business logic
│   └── middleware/      # Auth middleware
├── alembic/             # Migrations
├── requirements.txt
└── .env.example

frontend/
├── src/
│   ├── pages/           # Route pages
│   ├── components/      # Shared components
│   ├── lib/             # API client, auth helpers
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
