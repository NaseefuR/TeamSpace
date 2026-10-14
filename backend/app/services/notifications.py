from app.models.entities import Notification


def add_notification(
    db,
    *,
    user_id: str,
    workspace_id: str,
    notification_type: str,
    title: str,
    body: str,
    link: str | None,
    created_by: str | None,
    data: dict | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        workspace_id=workspace_id,
        type=notification_type,
        title=title,
        body=body,
        link=link,
        created_by=created_by,
        data=data,
    )
    db.add(notification)
    return notification
