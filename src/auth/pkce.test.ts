import {
  buildAuthorizeUrl,
  codeChallenge,
  generateCodeVerifier,
  randomString,
} from "./pkce.ts";

test("codeChallenge matches the RFC 7636 test vector", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  await expect(codeChallenge(verifier)).resolves.toBe(
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});

test("generated verifiers are URL-safe and long enough", () => {
  const v = generateCodeVerifier();
  expect(v.length).toBeGreaterThanOrEqual(43);
  expect(v.length).toBeLessThanOrEqual(128);
  expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
});

test("randomString produces distinct values", () => {
  expect(randomString()).not.toBe(randomString());
});

test("buildAuthorizeUrl encodes the PKCE params", () => {
  const url = new URL(
    buildAuthorizeUrl({
      clientId: "abc",
      redirectUri: "http://127.0.0.1:5173/callback",
      scopes: ["user-library-read", "user-library-modify"],
      state: "xyz",
      challenge: "chal",
    }),
  );
  expect(url.origin + url.pathname).toBe(
    "https://accounts.spotify.com/authorize",
  );
  expect(url.searchParams.get("client_id")).toBe("abc");
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBe("chal");
  expect(url.searchParams.get("state")).toBe("xyz");
  expect(url.searchParams.get("scope")).toBe(
    "user-library-read user-library-modify",
  );
  expect(url.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:5173/callback",
  );
});
