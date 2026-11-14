import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../errors.js";
import { sanitizeNotes } from "./sanitize-notes.js";

test("keeps the editor's formatting tags", () => {
  const html = "<p><strong>Bold</strong> <em>it</em> <u>u</u></p><ul><li>a</li></ul><ol><li>b</li></ol>";
  assert.equal(sanitizeNotes(html), html);
});

test("strips scripts, attributes and unknown tags", () => {
  assert.equal(sanitizeNotes('<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:x">link</a></p>'), "<p>Hilink</p>");
  assert.equal(sanitizeNotes('<img src=x onerror="alert(1)">'), "");
});

test("an empty editor becomes an empty string", () => {
  assert.equal(sanitizeNotes("<p></p>"), "");
  assert.equal(sanitizeNotes("  "), "");
});

test("rejects notes that are too long", () => {
  assert.throws(() => sanitizeNotes(`<p>${"x".repeat(10_001)}</p>`), (e: unknown) => e instanceof AppError && e.statusCode === 400);
});
