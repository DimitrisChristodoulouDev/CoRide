import test from "node:test";
import assert from "node:assert/strict";
import { parseAuthCallback } from "../src/authLinks.ts";
test("installed app and Expo Go callback codes are parsed", () => {
  assert.equal(
    parseAuthCallback(
      "coride://auth/callback?code=abc",
      "coride://auth/callback",
    ).code,
    "abc",
  );
  assert.equal(
    parseAuthCallback(
      "exp://preview.exp.direct/--/auth/callback?code=xyz",
      "exp://preview.exp.direct/--/auth/callback",
    ).code,
    "xyz",
  );
});
test("unrelated routes do not start a session exchange", () => {
  assert.equal(
    parseAuthCallback("coride://somewhere?code=abc", "coride://auth/callback"),
    null,
  );
  assert.equal(
    parseAuthCallback(
      "https://unknown.example/auth/callback?code=abc",
      "coride://auth/callback",
    ),
    null,
  );
});
test("expired or invalid links surface auth errors", () => {
  assert.equal(
    parseAuthCallback(
      "coride://auth/callback#error=access_denied&error_description=Link%20expired",
      "coride://auth/callback",
    ).error,
    "Link expired",
  );
});
