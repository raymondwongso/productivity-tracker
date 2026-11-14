import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

// Validation runs before any handler, so none of these requests reach the database.

const ROUTES: [string, string][] = [
  ["GET", "/api/activities?from=2026-11-09T00:00:00Z&to=2026-11-16T00:00:00Z"],
  ["GET", "/api/activities/1"],
  ["POST", "/api/activities"],
  ["PATCH", "/api/activities/1"],
  ["DELETE", "/api/activities/1"],
  ["POST", "/api/activities/1/cancel"],
  ["POST", "/api/activities/1/restore"],
  ["GET", "/api/categories"],
  ["GET", "/api/settings/grace-periods"],
  ["GET", "/api/projects"],
  ["POST", "/api/projects"],
  ["GET", "/api/titles"],
  ["POST", "/api/titles"],
  ["GET", "/api/games"],
  ["POST", "/api/games"],
  ["GET", "/api/stats/sleep?from=2026-11-01&to=2026-11-15&tz=UTC"],
  ["GET", "/api/stats/fitness?from=2026-11-01&to=2026-11-15&tz=UTC"],
  ["GET", "/api/stats/work?from=2026-11-01&to=2026-11-15&tz=UTC"],
  ["GET", "/api/stats/cinema?from=2026-11-01&to=2026-11-15&tz=UTC"],
  ["GET", "/api/stats/gaming?from=2026-11-01&to=2026-11-15&tz=UTC"],
];

test("every domain route requires a session", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    for (const [method, url] of ROUTES) {
      const res = await app.inject({ method: method as "GET", url, payload: method === "GET" || method === "DELETE" ? undefined : {} });
      assert.equal(res.statusCode, 401, `${method} ${url}`);
    }
  } finally {
    await app.close();
  }
});

test("bad bodies and queries are rejected with 400 { error }", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    await app.ready();
    const cookie = `pt_session=${app.jwt.sign({ id: 1 })}`;
    const cases: [string, string, unknown][] = [
      ["GET", "/api/activities", undefined],
      ["GET", "/api/activities?from=yesterday&to=today", undefined],
      ["GET", "/api/activities/abc", undefined],
      ["POST", "/api/activities", { name: "x" }],
      ["POST", "/api/activities", { category: "knitting", name: "x", plannedStart: "2026-11-14T09:00:00Z", plannedEnd: "2026-11-14T10:00:00Z" }],
      ["POST", "/api/activities", { category: "gaming", name: "x", plannedStart: "2026-11-14T09:00:00Z", plannedEnd: "2026-11-14T10:00:00Z", gameId: 0 }],
      ["GET", "/api/activities?from=2026-11-09T00:00:00Z&to=2026-11-16T00:00:00Z&category=knitting", undefined],
      ["POST", "/api/games", {}],
      ["GET", "/api/stats/sleep", undefined],
      ["GET", "/api/stats/fitness?from=2026-11-01&to=2026-11-15", undefined],
      ["GET", "/api/stats/work?from=Nov 1&to=2026-11-15&tz=UTC", undefined],
      ["GET", "/api/stats/cinema?from=2026-11-01&to=2026-11-15&tz=", undefined],
      ["POST", "/api/activities", { category: "sleep", name: "x", plannedStart: "nope", plannedEnd: "2026-11-14T10:00:00Z" }],
      ["POST", "/api/activities", { category: "workout", name: "x", plannedStart: "2026-11-14T09:00:00Z", plannedEnd: "2026-11-14T10:00:00Z", focus: "napping" }],
      ["POST", "/api/activities", { category: "meals", name: "x", plannedStart: "2026-11-14T09:00:00Z", plannedEnd: "2026-11-14T10:00:00Z", items: [{ calories: 5 }] }],
      ["PATCH", "/api/activities/1", { actualStart: "noon" }],
      ["POST", "/api/titles", { name: "Dune", kind: "podcast" }],
      ["GET", "/api/projects?status=archived", undefined],
    ];
    for (const [method, url, payload] of cases) {
      const res = await app.inject({ method: method as "GET", url, payload: payload as object | undefined, headers: { cookie } });
      assert.equal(res.statusCode, 400, `${method} ${url} ${JSON.stringify(payload)}`);
      assert.equal(typeof res.json().error, "string");
    }
  } finally {
    await app.close();
  }
});
