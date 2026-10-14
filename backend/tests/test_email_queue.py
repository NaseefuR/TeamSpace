from unittest.mock import Mock

from app.core.config import settings
from app.services import email_queue
from app.services.email_queue import NotificationEmail


def test_send_email_uses_brevo_transactional_email_api(monkeypatch):
    monkeypatch.setattr(settings, "brevo_api_key", "test-api-key")
    monkeypatch.setattr(settings, "brevo_sender_email", "noreply@example.test")
    monkeypatch.setattr(settings, "brevo_sender_name", "TeamSpace")
    monkeypatch.setattr(settings, "frontend_base_url", "https://team.example.test")
    response = Mock()
    post = Mock(return_value=response)
    monkeypatch.setattr(email_queue.httpx, "post", post)
    message = NotificationEmail(
        recipient_email="member@example.test",
        recipient_name="Jamie <Admin>",
        subject="Task assigned <Review>",
        body="<Review> the change",
        link="/board?project=abc",
        notification_id="notification-id",
        project_name="Platform (PLAT)",
        actor_name="Taylor <Lead>",
    )

    email_queue._send_email(message)

    post.assert_called_once()
    args, kwargs = post.call_args
    assert args == (email_queue.BREVO_SEND_EMAIL_URL,)
    assert kwargs["headers"]["api-key"] == "test-api-key"
    assert kwargs["json"]["to"] == [{"email": "member@example.test", "name": "Jamie <Admin>"}]
    assert kwargs["json"]["subject"] == "Task assigned <Review>"
    html_content = kwargs["json"]["htmlContent"]
    assert "TeamSpace" in html_content
    assert "background-color:#7059df" in html_content
    assert "Jamie &lt;Admin&gt;" in html_content
    assert "Task assigned &lt;Review&gt;" in html_content
    assert "&lt;Review&gt; the change" in html_content
    assert "Project" in html_content
    assert "Platform (PLAT)" in html_content
    assert "Assigned by" in html_content
    assert "Taylor &lt;Lead&gt;" in html_content
    assert 'href="https://team.example.test/board?project=abc"' in html_content
    assert "<Admin>" not in html_content
    assert kwargs["json"]["textContent"] == (
        "Hi Jamie <Admin>,\n\n<Review> the change"
        "\nProject: Platform (PLAT)\nAssigned by: Taylor <Lead>"
        "\n\nOpen TeamSpace: https://team.example.test/board?project=abc"
    )
    response.raise_for_status.assert_called_once()


def test_notification_email_is_delivered_by_background_queue_worker(monkeypatch):
    monkeypatch.setattr(settings, "brevo_api_key", "test-api-key")
    monkeypatch.setattr(settings, "brevo_sender_email", "noreply@example.test")
    sent = []
    monkeypatch.setattr(email_queue, "_send_email", sent.append)

    email_queue.start_email_worker()
    email_queue.enqueue_notification_email(
        recipient_email="member@example.test",
        recipient_name="Jamie",
        subject="Task assigned",
        body="A task was assigned",
        link="/board",
        notification_id="notification-id",
    )
    email_queue._email_queue.join()
    email_queue.stop_email_worker()

    assert len(sent) == 1
    assert sent[0].notification_id == "notification-id"
