# {{DISPLAY_NAME}}

Full-stack app with Go (Gin) backend and React (Vite) frontend.

## Tech Stack

- **Backend:** Go, Gin, GORM, PostgreSQL, JWT auth
- **Frontend:** React, Vite, Tailwind CSS

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials
go mod download
go run main.go
```

Server runs on `http://localhost:8080`

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
  main.go          - Entry point
  config/          - App configuration
  handlers/        - Route handlers
  models/          - GORM models
  middleware/      - Auth middleware
frontend/
  src/             - React source
```

## Environment Variables

See `backend/.env.example` for required variables.

## License

MIT
