# Secure Accounts Lab

Web app for secure account management: registration with a password policy, CAPTCHA, email activation,
brute-force protection with a login log, email 2FA, Google sign-in, password reset and RBAC (user / admin).

- [`backend/`](backend/README.md) — FastAPI, PostgreSQL, JWT
- [`frontend/`](frontend/README.md) — React + Vite, served by nginx in Docker

## Run everything in Docker

```bash
cp backend/.env.example backend/.env   # optional: set JWT_SECRET, CAPTCHA / Google keys
docker compose up -d --build
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API + Swagger | http://localhost:8000/docs |
| Mailpit (all emails) | http://localhost:8025 |
| PostgreSQL | `localhost:5433`, user/password/db `app` |

Default admin: `admin@example.com` / `Admin123!` (`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`).

The backend container reads `backend/.env`; compose overrides the database and SMTP hosts so they point to
the `db` and `mailpit` containers. `VITE_API_URL` is baked into the frontend at build time (build arg in
`docker-compose.yml`), so rebuild the frontend after changing it.

After a model change, recreate the database: `docker compose down -v && docker compose up -d --build`.

## Local development

```bash
docker compose up -d db mailpit
cd backend && uv sync && uv run fastapi dev app/main.py
cd frontend && npm install && npm run dev
```
