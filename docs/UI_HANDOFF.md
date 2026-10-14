# UI handoff

Phase 2 stack: Next.js 16 App Router, TypeScript, Tailwind 4, local shadcn-style primitives, TanStack Query, React Hook Form + Zod, Zustand, Recharts, and dnd-kit. The current implementation includes sign-in, responsive dashboard with animated bento cards, project list/create, workspace create/edit/switching, dark mode, task create/edit/assign/status/priority/severity, members, notifications, workspace project/task AI chat, workspace channels with threaded discussion, and versioned Markdown docs. Dashboard and collaboration animations honor reduced-motion. The API calls below are the implemented set; planned APIs are marked accordingly.

| Screen | Available endpoints | Planned endpoints |
|---|---|---|
| Login | `POST /auth/login`, `/auth/refresh`, `/auth/logout` | invite registration, recovery, verification, sessions, 2FA |
| Profile | `GET/PATCH /users/me` | avatar, skills, phone, bio, preferences, password |
| Workspace switcher | `GET/POST /workspaces`, `PATCH /workspaces/{workspace_id}` | archive, members, invitations, settings |
| Teams | `GET/POST /workspaces/{id}/teams` | team dashboard, calendar, capacity |
| Members | `GET/POST /workspaces/{workspace_id}/members`, `POST /workspaces/{workspace_id}/members/accounts` | invitations for unregistered accounts, role changes, deactivate/remove |
| Projects | `GET/POST /workspaces/{id}/projects` | edit/archive, templates, members, favorites |
| Board/list | `GET/POST /projects/{id}/tasks`, `PATCH/DELETE /tasks/{id}`, `GET /workspaces/{id}/members` | drag reorder, bulk ops, labels, filters |
| Task detail | `PATCH /tasks/{id}` | comments, subtasks, dependency, activity, time, approvals |
| Dashboard | `GET /users/me`, `/workspaces`, `/workspaces/{id}/projects`, `/projects/{id}/tasks` | date-series trend, member workload, standups, risks |
| Performance | none yet | performance metrics, goals, growth plan, 1:1 notes, feedback |
| Sprint/time/standup/leave | none yet | sprint, timer, timesheet, standup, leave endpoints |
| AI assistant | `POST /ai/chat`, `GET /workspaces/{id}/projects`, project task lists | ZIP knowledge sources, ingestion, code retrieval, streaming and file citations |
| Channels | `GET/POST /workspaces/{id}/channels`, `PATCH/DELETE /channels/{id}`, `GET/POST /channels/{id}/members`, `DELETE /channels/{id}/members/{member_user_id}`, `GET/POST /channels/{id}/messages`, `PATCH/DELETE /channels/{id}/messages/{message_id}`, `GET /workspaces/{id}/members` | WebSocket/SSE fanout, reactions, files, message search, typing/presence |
| Team docs | `GET/POST /workspaces/{id}/docs`, `GET/PATCH/DELETE /docs/{page_id}`, `GET /docs/{page_id}/versions` | Rich block editor, comments/mentions, page sharing outside workspace, restore version, attachments |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`, `POST /notifications/read-all`; email jobs are queued by the API after notification commits | preferences, realtime updates, other event triggers |
| Reports/search | none yet | report/export, global search |

## Enums and client rules

- Roles: workspace `owner`, `admin`, `member`, `guest`; team `team_lead`, `member`.
- Project status: `planned`, `active`, `on_hold`, `completed`; health: `green`, `amber`, `red`.
- Workflow category: `todo`, `in_progress`, `done`; default names: `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`.
- Task types intended: `task`, `bug`, `story`, `epic`, `subtask`; priorities: `urgent`, `high`, `medium`, `low`; severities: `critical`, `high`, `medium`, `low`. Preserve unknown status strings returned by server.
- IDs are UUID strings; timestamps ISO-8601, rendered in user timezone. Pagination: `page=1&page_size=20`, `meta={page,page_size,total}`, max page size 100.
- Workspace owners/admins can edit workspace name/slug/description; authenticated users can create additional workspaces.
- Workspace owners/admins can add existing accounts or create a new account with name, email, and initial password; owners can grant admin, and owners/admins can add member/guest roles.
- Board tasks can be created and edited with title, status, priority, and optional workspace-member `assignee_id`; the board displays priority as the single task-importance indicator. The API continues to accept and return severity for compatibility, but the board does not expose it. Cards can change assignees. Workspace owners/admins can soft-delete tasks from the board with a custom confirmation dialog; the API enforces the same permission. Owners/admins can move any task between statuses; members can move only tasks assigned to themselves, enforced in both the board and `PATCH /tasks/{id}`. AI questions use project/task records only; list the returned record sources and do not label them code citations.
- Keep access tokens in memory where practical. On 401, attempt one refresh then clear auth. Render 422 field errors, 409 conflicts, and include `x-request-id` in support diagnostics. Optimistic task changes should roll back on error; reorder is not supported yet.
- Channels are workspace scoped. Public channels are visible to workspace members; private channel creation adds its creator, and the creator or workspace owners/admins can add/remove members. The current channel screen polls message lists every five seconds. Replies are one level deep; Shift+Enter inserts a line break. Markdown is rendered in messages.
- Docs are workspace scoped Markdown pages. A save creates a new immutable snapshot; the history panel previews previous snapshots. Current editor format controls insert Markdown snippets. Workspace guests can read docs but cannot edit; authors and owners/admins can archive through the API.

## Realtime

There is no websocket/SSE endpoint yet; the current channel UI polls every five seconds. Notification emails are sent asynchronously through Brevo from a bounded, process-local Python queue. Knowledge chat target SSE events: `token` data `{"text":"..."}`, `citations` data `[{"path":"src/main.py","start_line":1,"end_line":20}]`, then `done`. Respect `prefers-reduced-motion` for bento transitions.
