import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.entities import User


@pytest.mark.asyncio
async def test_register_workspace_project_task_flow(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/test.db")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            registered = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "lead@example.com",
                    "password": "CorrectHorseBattery!42",
                    "name": "Lead",
                },
            )
            assert registered.status_code == 201, registered.text
            login = await client.post(
                "/api/v1/auth/login",
                json={"email": "lead@example.com", "password": "CorrectHorseBattery!42"},
            )
            assert login.status_code == 200, login.text
            headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

            workspace = await client.post(
                "/api/v1/workspaces",
                headers=headers,
                json={"name": "Engineering", "slug": "engineering"},
            )
            assert workspace.status_code == 201, workspace.text
            workspace_id = workspace.json()["data"]["id"]

            project = await client.post(
                f"/api/v1/workspaces/{workspace_id}/projects",
                headers=headers,
                json={"name": "API", "key": "API"},
            )
            assert project.status_code == 201, project.text
            project_id = project.json()["data"]["id"]

            task = await client.post(
                f"/api/v1/projects/{project_id}/tasks",
                headers=headers,
                json={"title": "Ship endpoint"},
            )
            assert task.status_code == 201, task.text
            assert task.json()["meta"]["key"] == "API-1"
            assert task.json()["data"]["reporter_id"] == registered.json()["data"]["id"]

            async with sessions() as db:
                junior = User(
                    email="junior@example.com",
                    name="Junior Developer",
                    password_hash=hash_password("JuniorPassword!234"),
                )
                db.add(junior)
                await db.commit()

            added = await client.post(
                f"/api/v1/workspaces/{workspace_id}/members",
                headers=headers,
                json={"email": "junior@example.com", "role": "member"},
            )
            assert added.status_code == 201, added.text
            assert added.json()["data"]["user_id"] == junior.id

            duplicate = await client.post(
                f"/api/v1/workspaces/{workspace_id}/members",
                headers=headers,
                json={"email": "junior@example.com", "role": "member"},
            )
            assert duplicate.status_code == 409

            account = await client.post(
                f"/api/v1/workspaces/{workspace_id}/members/accounts",
                headers=headers,
                json={
                    "name": "New Developer",
                    "email": "newdev@example.com",
                    "password": "FirstLoginPassword!42",
                    "role": "member",
                },
            )
            assert account.status_code == 201, account.text
            assert account.json()["data"]["name"] == "New Developer"

            duplicate_account = await client.post(
                f"/api/v1/workspaces/{workspace_id}/members/accounts",
                headers=headers,
                json={
                    "name": "Duplicate User",
                    "email": "newdev@example.com",
                    "password": "FirstLoginPassword!42",
                    "role": "member",
                },
            )
            assert duplicate_account.status_code == 409

            new_user_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "newdev@example.com", "password": "FirstLoginPassword!42"},
            )
            assert new_user_login.status_code == 200, new_user_login.text

            members = await client.get(
                f"/api/v1/workspaces/{workspace_id}/members", headers=headers
            )
            assert members.status_code == 200, members.text
            assert members.json()["meta"]["total"] == 3

            assigned = await client.post(
                f"/api/v1/projects/{project_id}/tasks",
                headers=headers,
                json={"title": "Review deployment", "assignee_id": junior.id},
            )
            assert assigned.status_code == 201, assigned.text

            junior_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "junior@example.com", "password": "JuniorPassword!234"},
            )
            junior_headers = {"Authorization": f"Bearer {junior_login.json()['data']['access_token']}"}

            unread = await client.get("/api/v1/notifications/unread-count", headers=junior_headers)
            assert unread.json()["data"]["unread_count"] == 2

            notification_list = await client.get("/api/v1/notifications", headers=junior_headers)
            notification_id = notification_list.json()["data"][0]["id"]

            marked = await client.patch(
                f"/api/v1/notifications/{notification_id}/read", headers=junior_headers
            )
            assert marked.json()["data"]["is_read"] is True

            unread = await client.get("/api/v1/notifications/unread-count", headers=junior_headers)
            assert unread.json()["data"]["unread_count"] == 1
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_member_cannot_edit_task_details_but_can_update_assigned_status(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/test.db")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "owner@example.com",
                    "password": "CorrectHorseBattery!42",
                    "name": "Owner",
                },
            )
            owner_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "owner@example.com", "password": "CorrectHorseBattery!42"},
            )
            owner_headers = {"Authorization": f"Bearer {owner_login.json()['data']['access_token']}"}

            workspace = await client.post(
                "/api/v1/workspaces",
                headers=owner_headers,
                json={"name": "Ops", "slug": "ops"},
            )
            workspace_id = workspace.json()["data"]["id"]

            project = await client.post(
                f"/api/v1/workspaces/{workspace_id}/projects",
                headers=owner_headers,
                json={"name": "Support", "key": "SUP"},
            )
            project_id = project.json()["data"]["id"]

            async with sessions() as db:
                junior = User(
                    email="member@example.com",
                    name="Junior Member",
                    password_hash=hash_password("JuniorPassword!234"),
                )
                db.add(junior)
                await db.commit()

            membership = await client.post(
                f"/api/v1/workspaces/{workspace_id}/members",
                headers=owner_headers,
                json={"email": "member@example.com", "role": "member"},
            )
            assert membership.status_code == 201, membership.text

            task = await client.post(
                f"/api/v1/projects/{project_id}/tasks",
                headers=owner_headers,
                json={"title": "Fix issue", "assignee_id": junior.id},
            )
            assert task.status_code == 201, task.text
            task_id = task.json()["data"]["id"]

            junior_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "member@example.com", "password": "JuniorPassword!234"},
            )
            junior_headers = {"Authorization": f"Bearer {junior_login.json()['data']['access_token']}"}

            blocked = await client.patch(
                f"/api/v1/tasks/{task_id}",
                headers=junior_headers,
                json={"title": "Hacked title"},
            )
            assert blocked.status_code == 403, blocked.text
            assert "Members cannot edit task details" in str(blocked.json())

            blocked_create = await client.post(
                f"/api/v1/projects/{project_id}/tasks",
                headers=junior_headers,
                json={"title": "Unauthorized task"},
            )
            assert blocked_create.status_code == 403, blocked_create.text

            allowed = await client.patch(
                f"/api/v1/tasks/{task_id}",
                headers=junior_headers,
                json={"status": "In Progress"},
            )
            assert allowed.status_code == 422, allowed.text

            allowed = await client.patch(
                f"/api/v1/tasks/{task_id}",
                headers=junior_headers,
                json={
                    "status": "In Progress",
                    "handoff_done": "Reproduced the issue and added a fix.",
                    "handoff_needs": "Please review the fix against the staging environment.",
                },
            )
            assert allowed.status_code == 200, allowed.text
            assert allowed.json()["data"]["status"] == "In Progress"

            history = await client.get(
                f"/api/v1/tasks/{task_id}/status-history",
                headers=owner_headers,
            )
            assert history.status_code == 200, history.text
            transitions = history.json()["data"]
            assert len(transitions) == 1
            assert {
                key: transitions[0][key]
                for key in (
                    "task_id",
                    "from_status",
                    "to_status",
                    "work_done",
                    "next_needs",
                    "actor_id",
                    "actor_name",
                )
            } == {
                "task_id": task_id,
                "from_status": "Todo",
                "to_status": "In Progress",
                "work_done": "Reproduced the issue and added a fix.",
                "next_needs": "Please review the fix against the staging environment.",
                "actor_id": junior.id,
                "actor_name": "Junior Member",
            }
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
