import {
  handleRedirectCallback,
  loadTokens,
  scopeStringHasAll,
  tokenIsFresh,
} from "./session.ts";

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

test("handleRedirectCallback exchanges the code only once (StrictMode-safe)", async () => {
  sessionStorage.setItem("sp.pkce.state", "xyz");
  sessionStorage.setItem("sp.pkce.verifier", "v".repeat(64));
  window.history.pushState({}, "", "/callback?code=abc&state=xyz");

  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          access_token: "a",
          token_type: "Bearer",
          scope: "streaming",
          expires_in: 3600,
          refresh_token: "r",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);

  // Two concurrent calls (as StrictMode's double effect would produce).
  await Promise.all([handleRedirectCallback(), handleRedirectCallback()]);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(loadTokens()?.accessToken).toBe("a");

  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
  localStorage.clear();
  sessionStorage.clear();
});
