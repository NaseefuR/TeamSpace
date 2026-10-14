import html
import logging
import queue
import threading
import time
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)
BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"
MAX_QUEUE_SIZE = 1000
MAX_ATTEMPTS = 3


@dataclass(frozen=True)
class NotificationEmail:
    recipient_email: str
    recipient_name: str
    subject: str
    body: str
    link: str | None
    notification_id: str
    project_name: str | None = None
    actor_name: str | None = None


_email_queue: queue.Queue[NotificationEmail | None] = queue.Queue(maxsize=MAX_QUEUE_SIZE)
_worker: threading.Thread | None = None
_worker_lock = threading.Lock()


def enqueue_notification_email(
    *,
    recipient_email: str,
    recipient_name: str,
    subject: str,
    body: str,
    link: str | None,
    notification_id: str,
    project_name: str | None = None,
    actor_name: str | None = None,
) -> None:
    if not settings.brevo_api_key or not settings.brevo_sender_email:
        log.error(
            "Notification was saved but email was not queued because Brevo is not configured",
            extra={"notification_id": notification_id},
        )
        return
    message = NotificationEmail(
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        subject=subject,
        body=body,
        link=link,
        notification_id=notification_id,
        project_name=project_name,
        actor_name=actor_name,
    )
    try:
        _email_queue.put_nowait(message)
    except queue.Full:
        log.error("Email queue is full; notification email was not queued", extra={"notification_id": notification_id})


def _send_email(message: NotificationEmail) -> None:
    if not settings.brevo_api_key or not settings.brevo_sender_email:
        raise RuntimeError("Brevo email is not configured")

    escaped_name = html.escape(message.recipient_name)
    escaped_subject = html.escape(message.subject)
    escaped_body = html.escape(message.body).replace("\n", "<br>")
    details_html = ""
    detail_rows = [
        ("Project", message.project_name),
        ("Assigned by", message.actor_name),
    ]
    visible_details = [(label, value) for label, value in detail_rows if value]
    if visible_details:
        details_html = (
            '<tr><td style="padding:0 36px 28px;">'
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
            'border="0" style="background-color:#f8f6ff;border:1px solid #ece8fb;'
            'border-radius:12px;">'
            + "".join(
                '<tr><td style="padding:12px 16px;color:#817b94;font-size:12px;'
                f'font-weight:700;text-transform:uppercase;letter-spacing:.6px;">{label}</td>'
                f'<td align="right" style="padding:12px 16px;color:#302b43;'
                f'font-size:14px;font-weight:600;">{html.escape(value)}</td></tr>'
                for label, value in visible_details
            )
            + "</table></td></tr>"
        )
    text_details = "".join(
        f"\n{label}: {value}" for label, value in visible_details
    )
    link_url = (
        urljoin(f"{settings.frontend_base_url.rstrip('/')}/", message.link.lstrip("/"))
        if message.link
        else None
    )
    cta_html = ""
    if link_url:
        escaped_url = html.escape(link_url, quote=True)
        cta_html = (
            '<tr><td style="padding:8px 36px 32px;">'
            f'<a href="{escaped_url}" style="display:inline-block;padding:13px 22px;'
            'border-radius:10px;background-color:#7059df;color:#ffffff;font-size:14px;'
            'font-weight:700;text-decoration:none;">Open TeamSpace&nbsp; &#8594;</a>'
            "</td></tr>"
        )
    html_body = f"""\
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f2fb;font-family:Arial,Helvetica,sans-serif;color:#252238;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f2fb;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background-color:#211b3a;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;border-radius:11px;background-color:#7059df;color:#ffffff;font-size:20px;font-weight:700;">T</td>
                  <td style="padding-left:11px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.3px;">TeamSpace</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;background-color:#7059df;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:36px 36px 20px;">
              <p style="margin:0 0 10px;color:#7059df;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">A team update for you</p>
              <h1 style="margin:0;color:#252238;font-size:25px;line-height:1.3;font-weight:700;">{escaped_subject}</h1>
              <p style="margin:22px 0 8px;color:#514d63;font-size:15px;line-height:1.6;">Hi {escaped_name},</p>
              <p style="margin:0;color:#514d63;font-size:15px;line-height:1.75;">{escaped_body}</p>
            </td>
          </tr>
          {details_html}
          {cta_html}
          <tr>
            <td style="padding:20px 36px;background-color:#faf9fd;border-top:1px solid #eeecf4;">
              <p style="margin:0;color:#888498;font-size:12px;line-height:1.6;">You received this email because of activity in your TeamSpace workspace.</p>
              <p style="margin:7px 0 0;color:#aaa7b5;font-size:11px;">TeamSpace &middot; Helping teams move work forward</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    text_body = f"Hi {message.recipient_name},\n\n{message.body}{text_details}"
    if link_url:
        text_body += f"\n\nOpen TeamSpace: {link_url}"

    response = httpx.post(
        BREVO_SEND_EMAIL_URL,
        headers={"api-key": settings.brevo_api_key, "accept": "application/json"},
        json={
            "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
            "to": [{"email": message.recipient_email, "name": message.recipient_name}],
            "subject": message.subject,
            "htmlContent": html_body,
            "textContent": text_body,
        },
        timeout=15,
    )
    response.raise_for_status()


def _run_worker() -> None:
    while True:
        message = _email_queue.get()
        try:
            if message is None:
                return
            for attempt in range(1, MAX_ATTEMPTS + 1):
                try:
                    _send_email(message)
                    log.info(
                        "Notification email sent",
                        extra={"notification_id": message.notification_id},
                    )
                    break
                except Exception:
                    log.exception(
                        "Notification email delivery failed",
                        extra={
                            "notification_id": message.notification_id,
                            "attempt": attempt,
                        },
                    )
                    if attempt < MAX_ATTEMPTS:
                        time.sleep(2 ** (attempt - 1))
        finally:
            _email_queue.task_done()


def start_email_worker() -> None:
    global _worker
    with _worker_lock:
        if _worker is not None and _worker.is_alive():
            return
        if not settings.brevo_api_key or not settings.brevo_sender_email:
            log.warning("Brevo email is not configured; notification emails cannot be delivered")
        _worker = threading.Thread(target=_run_worker, name="notification-email-worker", daemon=True)
        _worker.start()


def stop_email_worker() -> None:
    global _worker
    with _worker_lock:
        worker = _worker
        if worker is None or not worker.is_alive():
            _worker = None
            return
        _email_queue.put(None)
    worker.join(timeout=20)
    with _worker_lock:
        if not worker.is_alive():
            _worker = None
        else:
            log.error("Notification email worker did not stop before shutdown timeout")
