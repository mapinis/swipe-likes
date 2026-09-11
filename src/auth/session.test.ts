import { scopeStringHasAll, tokenIsFresh } from "./session.ts";

test("tokenIsFresh respects the refresh buffer", () => {
  const now = 1_000_000;
  expect(tokenIsFresh(now + 120_000, now)).toBe(true);
  expect(tokenIsFresh(now + 30_000, now)).toBe(false); // within 60s buffer
  expect(tokenIsFresh(now - 1, now)).toBe(false);
});

test("scopeStringHasAll requires every scope to be present", () => {
  const scope = "streaming user-read-email user-read-private";
  expect(scopeStringHasAll(scope, ["streaming", "user-read-email"])).toBe(true);
  // Missing user-read-private (the exact bug that caused Invalid token scopes).
  expect(
    scopeStringHasAll("streaming user-modify-playback-state", [
      "streaming",
      "user-read-email",
      "user-read-private",
    ]),
  ).toBe(false);
  expect(scopeStringHasAll("", ["streaming"])).toBe(false);
});
