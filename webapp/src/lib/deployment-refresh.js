export const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function startDeploymentRefresh({ currentVersion, fetchVersion, reload, schedule = setInterval, cancel = clearInterval }) {
  let stopped = false;
  let checking = false;
  let reloading = false;
  async function check() {
    if (stopped || checking || reloading || !currentVersion) return;
    checking = true;
    try {
      const response = await fetchVersion("/version", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return;
      const { version } = await response.json();
      if (!stopped && typeof version === "string" && version.trim() && version !== currentVersion) {
        reloading = true;
        reload();
      }
    } catch {
      // Offline, failed deployments and invalid responses must leave the display running.
    } finally {
      checking = false;
    }
  }
  const timer = schedule(check, VERSION_CHECK_INTERVAL_MS);
  return () => { stopped = true; cancel(timer); };
}
