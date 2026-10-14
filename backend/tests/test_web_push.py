import base64
import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.entities import Notification, PushSubscription, User
from app.services import web_push

P256DH = base64.urlsafe_b64encode(b"\x04" + b"x" * 64).rstrip(b"=").decode()
AUTH_SECRET = base64.urlsafe_b64encode(b"y" * 16).rstrip(b"=").decode()


@pytest.mark.asyncio
async def test_web_push_subscriptions_are_user_scoped_and_removable(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "vapid_public_key", "")
    monkeypatch.setattr(settings, "vapid_private_key", "")
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/push.db")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            registered = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "push-owner@example.com",
                    "password": "CorrectHorseBattery!42",
                    "name": "Push Owner",
                },
            )
            assert registered.status_code == 201, registered.text
            owner_id = registered.json()["data"]["id"]
            owner_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "push-owner@example.com", "password": "CorrectHorseBattery!42"},
            )
            owner_headers = {
                "Authorization": f"Bearer {owner_login.json()['data']['access_token']}"
            }

            unsupported = await client.get(
                "/api/v1/notifications/push-config", headers=owner_headers
            )
            assert unsupported.status_code == 200
            assert unsupported.json()["data"] == {"enabled": False, "public_key": None}

            payload = {
                "endpoint": "https://fcm.googleapis.com/fcm/send/browser-endpoint",
                "keys": {"p256dh": P256DH, "auth": AUTH_SECRET},
            }
            not_configured = await client.post(
                "/api/v1/notifications/push-subscriptions",
                headers=owner_headers,
                json=payload,
            )
            assert not_configured.status_code == 503

            monkeypatch.setattr(settings, "vapid_public_key", "public-vapid-key")
            monkeypatch.setattr(settings, "vapid_private_key", "private-vapid-key")
            enabled = await client.get(
                "/api/v1/notifications/push-config", headers=owner_headers
            )
            assert enabled.json()["data"] == {
                "enabled": True,
                "public_key": "public-vapid-key",
            }
            saved = await client.post(
                "/api/v1/notifications/push-subscriptions",
                headers=owner_headers,
                json=payload,
            )
            assert saved.status_code == 200, saved.text
            assert saved.json()["data"]["subscribed"] is True

            async with sessions() as db:
                other = User(
                    email="other@example.com",
                    password_hash=hash_password("AnotherPassword!234"),
                    name="Other User",
                )
                db.add(other)
                await db.commit()

            other_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "other@example.com", "password": "AnotherPassword!234"},
            )
            other_headers = {
                "Authorization": f"Bearer {other_login.json()['data']['access_token']}"
            }
            denied = await client.request(
                "DELETE",
                "/api/v1/notifications/push-subscriptions",
                headers=other_headers,
                json={"endpoint": payload["endpoint"]},
            )
            assert denied.status_code == 200
            assert denied.json()["data"]["removed"] is False

            removed = await client.request(
                "DELETE",
                "/api/v1/notifications/push-subscriptions",
                headers=owner_headers,
                json={"endpoint": payload["endpoint"]},
            )
            assert removed.status_code == 200
            assert removed.json()["data"]["removed"] is True
            async with sessions() as db:
                assert await db.get(PushSubscription, saved.json()["data"]["id"]) is None
                assert await db.get(User, owner_id) is not None

            invalid_endpoint = await client.post(
                "/api/v1/notifications/push-subscriptions",
                headers=owner_headers,
                json={
                    **payload,
                    "endpoint": "http://127.0.0.1/internal",
                },
            )
            assert invalid_endpoint.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.asyncio
async def test_deliver_notification_push_sends_notification_payload(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/delivery.db")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    notification = Notification(
        user_id="user-1",
        workspace_id=None,
        type="task_assigned",
        title="Task assigned",
        body="API-2: Review deployment",
        link="/board?project=project-1",
        created_by=None,
    )
    subscription = PushSubscription(
        user_id="user-1",
        endpoint="https://fcm.googleapis.com/fcm/send/browser-endpoint",
        endpoint_hash="endpoint-hash",
        p256dh=P256DH,
        auth=AUTH_SECRET,
    )
    async with sessions() as db:
        db.add_all([notification, subscription])
        await db.flush()
        notification_id = notification.id
        await db.commit()

    calls = []

    def fake_webpush(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(settings, "vapid_public_key", "public-vapid-key")
    monkeypatch.setattr(settings, "vapid_private_key", "private-vapid-key")
    monkeypatch.setattr(web_push, "SessionLocal", sessions)
    monkeypatch.setattr(web_push, "webpush", fake_webpush)
    try:
        await web_push.deliver_notification_push(notification_id)
        assert len(calls) == 1
        assert calls[0]["subscription_info"] == {
            "endpoint": subscription.endpoint,
            "keys": {"p256dh": P256DH, "auth": AUTH_SECRET},
        }
        assert calls[0]["vapid_private_key"] == "private-vapid-key"
        assert calls[0]["vapid_claims"] == {"sub": settings.vapid_subject}
        assert json.loads(calls[0]["data"]) == {
            "title": "Task assigned",
            "body": "API-2: Review deployment",
            "url": "/board?project=project-1",
            "tag": notification_id,
        }
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_deliver_notification_push_logs_missing_vapid_configuration(monkeypatch, caplog):
    monkeypatch.setattr(settings, "vapid_public_key", "")
    monkeypatch.setattr(settings, "vapid_private_key", "")

    await web_push.deliver_notification_push("notification-1")

    assert "VAPID keys are not configured" in caplog.text
