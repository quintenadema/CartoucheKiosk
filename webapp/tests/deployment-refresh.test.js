import { expect, test } from "bun:test";
import { startDeploymentRefresh, VERSION_CHECK_INTERVAL_MS } from "../src/lib/deployment-refresh";
import handler from "../src/pages/api/version";

function harness(fetchVersion) {
  let check, interval, reloads = 0, cancelled = false;
  const stop = startDeploymentRefresh({
    currentVersion: "loaded-build", fetchVersion,
    reload: () => { reloads++; },
    schedule: (fn, ms) => { check = fn; interval = ms; return 123; },
    cancel: id => { expect(id).toBe(123); cancelled = true; },
  });
  return { check: () => check(), stop, get reloads() { return reloads; }, get cancelled() { return cancelled; }, interval };
}

test("checks every five minutes and only reloads once for a changed deployment", async () => {
  const h = harness(async (url, options) => {
    expect(url).toBe("/version"); expect(options.cache).toBe("no-store");
    return { ok: true, json: async () => ({ version: "new-build" }) };
  });
  expect(h.interval).toBe(300000);
  expect(VERSION_CHECK_INTERVAL_MS).toBe(300000);
  await h.check(); await h.check(); expect(h.reloads).toBe(1); h.stop();
});

for (const version of ["loaded-build", "", "   ", null, 42, undefined]) {
  test(`unchanged or invalid version does not reload: ${version}`, async () => {
    const h = harness(async () => ({ ok: true, json: async () => ({ version }) }));
    await h.check(); expect(h.reloads).toBe(0); h.stop();
  });
}

test("network, HTTP and malformed JSON failures are safe and next check retries", async () => {
  let attempt = 0;
  const h = harness(async () => {
    attempt++;
    if (attempt === 1) throw new Error("offline");
    if (attempt === 2) return { ok: false };
    if (attempt === 3) return { ok: true, json: async () => { throw new Error("invalid JSON"); } };
    return { ok: true, json: async () => ({ version: "new-build" }) };
  });
  for (let i = 0; i < 3; i++) { await h.check(); expect(h.reloads).toBe(0); }
  await h.check(); expect(h.reloads).toBe(1); h.stop();
});

test("cleanup cancels polling and ignores in-flight replies", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  const pending = h.check();
  await h.check(); // Must not start a second overlapping request.
  h.stop(); resolve({ ok: true, json: async () => ({ version: "new-build" }) });
  await pending; expect(h.cancelled).toBe(true); expect(h.reloads).toBe(0);
});

test("version endpoint disables caching and rejects writes", () => {
  const headers = {}; let status, body;
  const res = { setHeader: (key, value) => { headers[key] = value; }, status: value => { status = value; return res; }, json: value => { body = value; } };
  handler({ method: "GET" }, res);
  expect(status).toBe(200); expect(headers["Cache-Control"]).toContain("no-store");
  expect(body).toHaveProperty("version");
  handler({ method: "POST" }, res); expect(status).toBe(405); expect(headers.Allow).toBe("GET");
});
