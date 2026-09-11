import { tokenIsFresh } from "./session.ts";

test("tokenIsFresh respects the refresh buffer", () => {
  const now = 1_000_000;
  expect(tokenIsFresh(now + 120_000, now)).toBe(true);
  expect(tokenIsFresh(now + 30_000, now)).toBe(false); // within 60s buffer
  expect(tokenIsFresh(now - 1, now)).toBe(false);
});
