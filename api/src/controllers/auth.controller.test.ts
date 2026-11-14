import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";


test("protected routes return 401 without a token", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    for (const url of ["/api/auth/me", "/api/categories", "/api/activities?from=2026-11-09T00:00:00Z&to=2026-11-16T00:00:00Z"]) {
      const res = await app.inject({ method: "GET", url });
      assert.equal(res.statusCode, 401, url);
      assert.deepEqual(res.json(), { error: "Unauthorized" });
    }
    const post = await app.inject({ method: "POST", url: "/api/activities", payload: {} });
    assert.equal(post.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("register validates the body shape (400, { error })", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.co" } });
    assert.equal(res.statusCode, 400);
    assert.equal(typeof res.json().error, "string");
  } finally {
    await app.close();
  }
});

test("garbage token is rejected", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/categories", headers: { cookie: "pt_session=abc" } });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("logout clears the cookie", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "POST", url: "/api/auth/logout" });
    assert.equal(res.statusCode, 204);
    // An app-specific name: every app on localhost shares cookies across ports.
    assert.match(String(res.headers["set-cookie"]), /pt_session=;/);
  } finally {
    await app.close();
  }
});


test("login is rate limited per client", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    // Invalid body => 400 without touching the database, but each call still counts toward the limit.
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: {} });
      statuses.push(res.statusCode);
    }
    assert.equal(statuses[0], 400);
    assert.equal(statuses[11], 429);
  } finally {
    await app.close();
  }
});

test("responses carry security headers", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  } finally {
    await app.close();
  }
});

test("writes from another origin are refused; the web app's origin and non-browser clients pass", async () => {
  const config = { ...loadConfig(), logLevel: "silent" };
  const app = buildApp(config);
  try {
    const logout = (origin?: string) =>
      app.inject({ method: "POST", url: "/api/auth/logout", headers: origin ? { origin } : {} });
    const evil = await logout("http://localhost:3000");
    assert.equal(evil.statusCode, 403);
    assert.equal(evil.json().error, "Origin not allowed");
    assert.equal(evil.headers["set-cookie"], undefined);
    assert.equal((await logout(config.corsOrigin)).statusCode, 204);
    assert.equal((await logout()).statusCode, 204);
    // A text/plain POST from another site never reaches the handler.
    const cookie = `pt_session=${app.jwt.sign({ id: 1 })}`;
    const cancel = await app.inject({
      method: "POST", url: "/api/activities/1/cancel", payload: "x",
      headers: { cookie, origin: "https://evil.example", "content-type": "text/plain" },
    });
    assert.equal(cancel.statusCode, 403);
    // Reads are unaffected.
    assert.equal((await app.inject({ method: "GET", url: "/api/health", headers: { origin: "https://evil.example" } })).statusCode, 200);
  } finally {
    await app.close();
  }
});
