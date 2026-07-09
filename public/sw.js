/* Matjar service worker — Web Push notifications. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "متجر", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "متجر";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || "/ar" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/ar";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
