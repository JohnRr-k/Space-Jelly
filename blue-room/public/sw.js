/* The Blue Room — minimal service worker.
 * Its ONLY job is to let the page show system notifications through the
 * registration API (required on Android Chrome) and to focus the app when a
 * notification is tapped. It does not cache anything and does not run in the
 * background: reminders fire only while the app is open in a tab/window.
 * No push subscription exists because there is no push backend. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
