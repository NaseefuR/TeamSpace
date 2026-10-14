# Team & Work Management Platform

Phase 1 backend foundation. Implemented versus deferred scope is explicit in [docs/ROADMAP.md](docs/ROADMAP.md). See `docs/API.md`, `docs/ARCHITECTURE.md`, and `docs/UI_HANDOFF.md`.

## Local setup

Requires Python 3.11+ and MySQL 8, or PostgreSQL (including Supabase). To develop on SQLite, use `DATABASE_URL=sqlite+aiosqlite:///./teamwork.db`.

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
# Configure database, JWT, Brevo email, Web Push and AI values.
alembic upgrade head
uvicorn app.main:app --reload
```

For Supabase, set `DATABASE_URL` in `backend/.env` to the PostgreSQL connection URI from your Supabase project. URL-encode special characters in the password; Supabase TLS is enabled automatically for `*.supabase.co` hosts.

Docs: `http://localhost:8000/docs`; health/readiness: `/api/v1/health`, `/api/v1/ready`.

## Browser push notifications

Web push is opt-in per browser. Configure a matching VAPID key pair in the backend environment:

```dotenv
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@example.com
```

Generate the pair once with trusted Web Push tooling (for example, `npx --yes web-push generate-vapid-keys`) and keep the private key secret. Use HTTPS for deployed sites; browsers allow service workers on `localhost` for development. After applying database migrations, users can enable or disable push for the current browser from the Notifications page. Existing in-app notification events (task assignments and workspace additions) are also delivered to opted-in browsers.

## Notification email

Configure Brevo transactional email with `BREVO_API_KEY`, a verified `BREVO_SENDER_EMAIL`, optional `BREVO_SENDER_NAME`, and `FRONTEND_BASE_URL`. After an in-app notification transaction commits, the API places an email job in a bounded in-process Python queue and a background thread sends it through Brevo. Configure secrets through the deployment secret manager; never commit API keys. The queue is process-local and volatile: pending emails can be lost on restart, and jobs are not shared across multiple API replicas.

## Docker / Linux

```bash
cd backend
cp .env.example .env
# Set strong secrets and provider values before starting.
docker compose up --build -d
```

Systemd/nginx examples are in `infra/`. In production use TLS, managed secrets, monitored storage and tested backups. Do not commit `.env`.

## Seed, tests, OpenAPI

Set `DEMO_PASSWORD` (at least 12 characters) in `backend/.env` before seeding; set `DEMO_LEAD_EMAIL` to choose the owner login email. The seed creates the owner and a demo workspace with sample projects and tasks (unassigned when there are no junior users). With Docker Compose, run the command inside the API container so the Compose-only database hostname `mysql` resolves:

```bash
cd backend
docker compose up --build -d
docker compose exec api python -m app.seed
```

For a host-run seed (`python -m app.seed`), configure `DATABASE_URL` with a host-reachable database address; the Compose service name `mysql` only resolves from containers on that Compose network. Run `pytest` from `backend/`. Export OpenAPI with `python -m app.export_openapi`; collection is `backend/postman_collection.json`.

## Web UI (Phase 2 initial slice)

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

The current UI includes sign-in, an animated bento dashboard, workspace create/edit/switching, project listing/creation, a kanban board with task creation, editing, assignment, and severity, workspace member add/account creation, notifications, and a Markdown-rendered project/task-context AI assistant. The workspace sidebar also has **Channels** for public/private team conversations with threads, and **Team docs** for nested Markdown pages with version history. Apply the new collaboration tables with `cd backend && alembic upgrade head` before using those screens. AI chat requires `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in `backend/.env`; this assistant does not index uploaded source archives. The backend API must be running. Remaining Phase 2 screens are listed in `docs/ROADMAP.md`.
