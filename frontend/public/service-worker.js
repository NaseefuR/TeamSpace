self.addEventListener("push", event => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }
  const title = typeof payload.title === "string" ? payload.title : "TeamSpace";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new update.",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url: typeof payload.url === "string" ? payload.url : "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    let requestedUrl;
    try {
      requestedUrl = new URL(event.notification.data?.url ?? "/notifications", self.location.origin);
    } catch {
      requestedUrl = new URL("/notifications", self.location.origin);
    }
    const targetUrl = requestedUrl.origin === self.location.origin ? requestedUrl : new URL("/notifications", self.location.origin);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(targetUrl.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
