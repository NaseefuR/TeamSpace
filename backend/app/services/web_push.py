import asyncio
import hashlib
import json
import logging

from pywebpush import WebPushException, webpush
from requests import RequestException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import Notification, PushSubscription

logger = logging.getLogger(__name__)


async def deliver_notification_push(notification_id: str) -> None:
    if not settings.vapid_public_key or not settings.vapid_private_key:
        logger.warning(
            "Web Push skipped for notification %s because VAPID keys are not configured",
            notification_id,
        )
        return

    async with SessionLocal() as db:
        notification = await db.get(Notification, notification_id)
        if notification is None:
            logger.warning("Skipping push for missing notification %s", notification_id)
            return
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.user_id == notification.user_id)
        )
        subscriptions = [
            {
                "id": subscription.id,
                "endpoint": subscription.endpoint,
                "p256dh": subscription.p256dh,
                "auth": subscription.auth,
            }
            for subscription in result.scalars()
        ]
        if not subscriptions:
            logger.info(
                "Web Push not sent for notification %s because the recipient has no subscribed browsers",
                notification_id,
            )
            return
        payload = json.dumps(
            {
                "title": notification.title,
                "body": notification.body,
                "url": notification.link if notification.link and notification.link.startswith("/") and not notification.link.startswith("//") else "/notifications",
                "tag": notification.id,
            }
        )

    expired_ids: list[str] = []
    for subscription in subscriptions:
        info = {
            "endpoint": subscription["endpoint"],
            "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
        }
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info=info,
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
        except WebPushException as error:
            status = error.response.status_code if error.response is not None else None
            if status in {404, 410}:
                expired_ids.append(subscription["id"])
                logger.info("Removing expired push subscription %s (HTTP %s)", subscription["id"], status)
            else:
                logger.warning(
                    "Push delivery failed for subscription %s (HTTP %s)",
                    subscription["id"],
                    status or "unknown",
                )
        except RequestException as error:
            logger.warning(
                "Push delivery failed for subscription %s (%s)",
                subscription["id"],
                type(error).__name__,
            )

    if expired_ids:
        async with SessionLocal() as db:
            await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(expired_ids)))
            await db.commit()


async def save_push_subscription(
    db: AsyncSession, *, user_id: str, endpoint: str, p256dh: str, auth: str
) -> PushSubscription:
    endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()
    subscription = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint_hash == endpoint_hash)
    )
    if subscription is None:
        subscription = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            endpoint_hash=endpoint_hash,
            p256dh=p256dh,
            auth=auth,
        )
        db.add(subscription)
    else:
        subscription.user_id = user_id
        subscription.p256dh = p256dh
        subscription.auth = auth
    await db.commit()
    await db.refresh(subscription)
    return subscription
