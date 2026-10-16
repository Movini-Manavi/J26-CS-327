/* Service worker for guardian Web Push (grooming-detection demo).
 * The backend (pywebpush) sends JSON: { title, body, url }. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Grooming risk alert', {
      body: data.body || 'A new alert is waiting on the guardian page.',
      icon: '/favicon.ico',
      tag: data.tag || 'grooming-alert',
      data: { url: data.url || '/guardian' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/guardian';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.includes(url));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
