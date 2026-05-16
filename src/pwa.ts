/**
 * Register the service worker (production only).
 *
 * When a new worker is waiting we reload the page once so the user always
 * runs the latest bundle. This is safe because the game state we care about
 * (best score, theme) is already persisted in localStorage.
 */

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    const swUrl = new URL("sw.js", document.baseURI).toString();
    navigator.serviceWorker
      .register(swUrl, { scope: "./" })
      .then((reg) => {
        // If there's already a worker waiting (because we loaded a cached page),
        // activate it on next tick.
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version is ready — tell it to take control, then reload.
              installing.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => {
        /* registration failed — game still works, just not offline */
      });

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
