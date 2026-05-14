# {{DISPLAY_NAME}}

Full-stack app with Rust (Actix-web) backend and React (Vite) frontend.

## Tech Stack

- **Backend:** Rust, Actix-web, Diesel ORM, PostgreSQL, JWT auth
- **Frontend:** React, Vite, Tailwind CSS

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials
# Install diesel CLI: cargo install diesel_cli --no-default-features --features postgres
diesel setup
diesel migration run
cargo run
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
  src/main.rs       - Entry point
  src/handlers/     - Route handlers
  src/models/       - Diesel models
  src/middleware/    - Auth middleware
  Cargo.toml        - Rust dependencies
  diesel.toml       - Diesel config
frontend/
  src/              - React source
```

## Environment Variables

See `backend/.env.example` for required variables.

## License

MIT
