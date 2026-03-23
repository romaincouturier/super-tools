self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // no-op
      }

      await self.registration.unregister();

      const controlledClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of controlledClients) {
        client.navigate(client.url);
      }
    })()
  );
});
