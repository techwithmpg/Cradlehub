const ALLOWED_ACTION_PREFIXES = [
  "/crm",
  "/owner",
  "/staff-portal",
  "/staff",
  "/driver",
  "/utility",
];

function safeActionHref(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return "/";
    const allowed = ALLOWED_ACTION_PREFIXES.some(
      (prefix) =>
        parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    );
    return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/";
  } catch {
    return "/";
  }
}

function parsePayload(event) {
  try {
    const payload = event.data ? event.data.json() : {};
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  const notificationId =
    typeof payload.notificationId === "string"
      ? payload.notificationId
      : "unknown";
  const actionHref = safeActionHref(payload.actionHref);
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.slice(0, 120)
      : "CradleHub update";
  const body =
    typeof payload.body === "string"
      ? payload.body.slice(0, 280)
      : "Open CradleHub to view this update.";
  const priority =
    ["low", "normal", "high", "critical"].includes(payload.priority)
      ? payload.priority
      : "normal";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visibleWindows = windows.filter(
        (client) => client.visibilityState === "visible"
      );

      // Only the driver's foreground PWA may auto-open its own live dispatch map.
      // A background worker NEVER force-launches or focuses any application:
      // normal notificationclick requires the driver's explicit interaction.
      if (payload.type === "home_service_assigned" &&
          /^\\/staff\\/driver\\/map\\?bookingId=[0-9a-f-]{36}$/i.test(actionHref)) {
        visibleWindows.forEach((client) => {
          try {
            const url = new URL(client.url);
            if (url.origin === self.location.origin && url.pathname.startsWith("/staff/driver")) {
              client.postMessage({
                type: "CRADLEHUB_DRIVER_DISPATCH_WAKE",
                actionHref,
                notificationId,
              });
            }
          } catch {
            // Invalid or cross-origin clients must not receive driver details.
          }
        });
      }

      // Ordinary alerts reconcile into the existing authorized foreground UI.
      if (visibleWindows.length > 0 && payload.test !== true && payload.type !== "home_service_assigned") {
        visibleWindows.forEach((client) =>
          client.postMessage({
            type: "CRADLEHUB_PUSH_RECONCILE",
            notificationId,
          })
        );
        return;
      }

      await self.registration.showNotification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        tag: `cradlehub-notification:${notificationId}`,
        renotify: priority === "critical",
        requireInteraction: priority === "critical",
        data: { actionHref, notificationId },
        actions: [{ action: "view", title: "View" }],
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionHref = safeActionHref(event.notification.data?.actionHref);
  const targetUrl = new URL(actionHref, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => {
        try {
          const url = new URL(client.url);
          return url.origin === self.location.origin &&
            (!actionHref.startsWith("/staff/") || url.pathname.startsWith("/staff/"));
        } catch {
          return false;
        }
      });

      if (existing) {
        if ("navigate" in existing) await existing.navigate(targetUrl);
        await existing.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey =
          event.oldSubscription?.options?.applicationServerKey;
        if (!applicationServerKey) throw new Error("Missing application server key");
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        const response = await fetch("/api/notifications/push/subscription", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
        if (!response.ok) throw new Error("Subscription renewal was rejected");
      } catch {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        windows.forEach((client) =>
          client.postMessage({
            type: "CRADLEHUB_PUSH_SUBSCRIPTION_CHANGED",
          })
        );
      }
    })()
  );
});
