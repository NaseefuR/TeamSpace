# Phase 1 implementation status

This is a runnable backend foundation. The full requested catalog is not complete; only routes listed in `docs/API.md` should be treated as implemented.

## Implemented

Async FastAPI/SQLAlchemy core; MySQL configuration; Alembic migrations; JWT access/refresh rotation; Argon2 password hashing; profile; workspace and membership isolation; team/project create/list; workspace member list/add and admin account creation; default project workflows; task create/list/update/soft-delete and assignment; in-app task-assignment/member-added notifications with unread/read APIs; Brevo transactional email delivery using a bounded in-process thread queue; workspace/project/task-context AI chat through OpenAI-compatible API; workspace channels with private membership and threaded messages; versioned Markdown workspace docs; health/readiness; ZIP metadata validation; deployment samples; unit tests and API/OpenAPI/Postman docs.

## Deferred modules

1. Invitation links for unregistered invitees, password reset, verification, TOTP, session management, branded email templates, and workspace member role changes/deactivation/removal.
2. Spaces, full project/workflow CRUD, project roles, labels, custom fields, templates/favorites.
3. Task subtasks, multi-assignees/watchers, dependencies, checklists, comments/mentions/reactions, attachments/activity, bulk, clone/move/recurrence, filters/search, calendar/timeline, approvals.
4. Sprints, milestones, goals, dashboards, performance, workload/capacity, 1:1 notes and feedback.
5. Timers, time entries, timesheets, standups, attendance, leaves and holidays.
6. Notification preferences and triggers beyond task assignment, durable distributed email queue, SSE/WebSockets, scheduled reports.
7. Rich block editor, restore document versions, comments/mentions on docs, webhooks, API tokens, exports/trash restore, rate limiting, ICS.
8. Knowledge source/version/file/chunk/chat/usage routes, extraction worker, chunking, embeddings/vector retrieval, citation streaming and feedback. Only source/version schema scaffolding and ZIP metadata validation exist.
9. Full normalized schema for all requested named tables, explicit production DDL migrations, comprehensive audit coverage and integration tests.

Phase 2 has an initial UI slice: sign-in, responsive dashboard with animated bento cards, workspace create/edit/switching, project list/create, a drag-and-drop board with task create/edit/assignment/severity, member list/add/account creation, notifications, a Markdown-rendered project/task-context AI chat, workspace channels with threads, and a Markdown docs library with history. It is wired to backend routes in `docs/API.md`. The AI assistant does not currently index uploaded source code, stream answers, or produce file citations. Remaining screens include the broader dashboard/reporting, task detail/collaboration, sprint/time/standup/leave, full knowledge ingestion/RAG, search/settings and integrations.
