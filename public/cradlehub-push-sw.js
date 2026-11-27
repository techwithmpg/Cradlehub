const ALLOWED_ACTION_PREFIXES = [
  "/crm",
  "/owner",
  "/staff-portal",
  "/staff",
  "/driver",
  "/utility",
];

function workspaceForPath(pathname) {
  if (pathname === "/staff/driver" || pathname.startsWith("/staff/driver/") || pathname === "/driver" || pathname.startsWith("/driver/")) {
    return "driver";
  }
  if (pathname === "/staff/utility" || pathname.startsWith("/staff/utility/") || pathname === "/utility" || pathname.startsWith("/utility/")) {
    return "utility";
  }
  if (pathname === "/staff" || pathname.startsWith("/staff/") || pathname === "/staff-portal" || pathname.startsWith("/staff-portal/")) {
    return "staff";
  }
  if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    return "crm";
  }
  if (pathname === "/owner" || pathname.startsWith("/owner/")) {
    return "owner";
  }
  return "other";
}

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

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
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
      : "CradleHub Alert";
  const body =
    typeof payload.body === "string"
      ? payload.body.slice(0, 280)
      : "Tap to open and take action in CradleHub.";
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

      // Reconcile matching visible workspace windows; suppress duplicate OS
      // cards only for desktop Bell workspaces (/crm, /owner) or URL-less CRM/Owner
      // test clients, never silently dropping foreground Staff PWA inner routes.
      const targetWorkspace = workspaceForPath(actionHref);
      let hasVisibleBellReconcile = false;
      visibleWindows.forEach((client) => {
        let sameOrigin = !client.url;
        let pathname = "";
        if (client.url) {
          try {
            const url = new URL(client.url);
            sameOrigin = url.origin === self.location.origin;
            pathname = url.pathname;
          } catch {
            sameOrigin = false;
          }
        }
        if (!sameOrigin) return;
        const clientWorkspace = client.url ? workspaceForPath(pathname) : null;
        if (
          payload.type === "home_service_assigned" &&
          pathname.startsWith("/staff/driver") &&
          /^\/staff\/driver\/map\?bookingId=[0-9a-f-]{36}$/i.test(actionHref)
        ) {
          client.postMessage({
            type: "CRADLEHUB_DRIVER_DISPATCH_WAKE",
            actionHref,
            notificationId,
          });
          return;
        }
        const compatibleTarget =
          !clientWorkspace ||
          targetWorkspace === "other" ||
          clientWorkspace === targetWorkspace ||
          ((actionHref.startsWith("/staff/scan") || actionHref.startsWith("/staff/attendance")) &&
            ["staff", "driver", "utility"].includes(clientWorkspace));
        if (!compatibleTarget) return;

        if (clientWorkspace === "crm" || clientWorkspace === "owner") {
          hasVisibleBellReconcile = true;
        } else if (!client.url && (targetWorkspace === "crm" || targetWorkspace === "owner")) {
          hasVisibleBellReconcile = true;
        }

        if (payload.type !== "home_service_assigned") {
          if (pathname.startsWith("/staff")) {
            client.postMessage({
              type: "CRADLEHUB_PUSH_RECONCILE",
              notificationId,
              actionHref,
              title,
              body,
            });
          } else {
            client.postMessage({
              type: "CRADLEHUB_PUSH_RECONCILE",
              notificationId,
            });
          }
        }
      });

      if (
        hasVisibleBellReconcile &&
        payload.test !== true &&
        payload.type !== "home_service_assigned" &&
        priority !== "critical"
      ) {
        return;
      }

      await self.registration.showNotification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        tag: `cradlehub-notification:${notificationId}`,
        renotify: true,
        requireInteraction: priority === "critical" || priority === "high",
        vibrate: priority === "critical" ? [250, 100, 250, 100, 300] : [180, 80, 180],
        data: { actionHref, notificationId },
        actions: [{ action: "view", title: "Open & Take Action" }],
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
      const targetPath = new URL(targetUrl).pathname;
      const targetWorkspace = workspaceForPath(targetPath);
      const isSharedAttendanceRoute =
        targetPath === "/staff/scan" ||
        targetPath.startsWith("/staff/scan/") ||
        targetPath === "/staff/attendance" ||
        targetPath.startsWith("/staff/attendance/");
      const existing = windows.find((client) => {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin) return false;
          const clientWorkspace = workspaceForPath(url.pathname);
          if (isSharedAttendanceRoute) {
            return ["staff", "driver", "utility"].includes(clientWorkspace);
          }
          return clientWorkspace === targetWorkspace;
        } catch {
          return false;
        }
      });

      if (existing) {
        try {
          if ("navigate" in existing) await existing.navigate(targetUrl);
          await existing.focus();
          return;
        } catch {
          // Fall back to opening a new window if focusing/navigating the existing tab fails.
        }
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
