# {{DISPLAY_NAME}}

Full-stack app with Django (DRF) backend and React (Vite) frontend.

## Tech Stack

- **Backend:** Python, Django, Django REST Framework, SimpleJWT, PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your PostgreSQL credentials
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Server runs on `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`

## Project Structure

```
backend/
  manage.py           - Django management
  app/settings.py     - Django settings
  app/urls.py         - URL routing
  api/views.py        - API views
  api/serializers.py  - DRF serializers
  api/models.py       - Django models
frontend/
  src/                - React source
```

## Environment Variables

See `backend/.env.example` for required variables.

## License

MIT
