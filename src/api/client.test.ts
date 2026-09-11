import { SpotifyApiError, SpotifyClient } from "./client.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const token = () => Promise.resolve("tok");
const noSleep = () => Promise.resolve();

test("attaches bearer token and parses JSON", async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    return jsonResponse({ id: "42" });
  };
  const client = new SpotifyClient({ fetchImpl, getToken: token, sleep: noSleep });

  const out = await client.request<{ id: string }>("/me");
  expect(out.id).toBe("42");
  expect(calls[0].url).toBe("https://api.spotify.com/v1/me");
  expect(calls[0].headers.get("Authorization")).toBe("Bearer tok");
});

test("retries on 429 honoring Retry-After, then succeeds", async () => {
  const slept: number[] = [];
  let n = 0;
  const fetchImpl: typeof fetch = async () => {
    n++;
    if (n === 1)
      return new Response("", { status: 429, headers: { "Retry-After": "2" } });
    return jsonResponse({ ok: true });
  };
  const client = new SpotifyClient({
    fetchImpl,
    getToken: token,
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
  });

  const out = await client.request<{ ok: boolean }>("/me");
  expect(out.ok).toBe(true);
  expect(n).toBe(2);
  expect(slept).toEqual([2000]);
});

test("throws SpotifyApiError with parsed message on 4xx", async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse({ error: { message: "bad scope" } }, { status: 403 });
  const client = new SpotifyClient({ fetchImpl, getToken: token, sleep: noSleep });

  await expect(client.request("/me")).rejects.toMatchObject({
    name: "SpotifyApiError",
    status: 403,
    message: "bad scope",
  });
  expect(SpotifyApiError).toBeDefined();
});

test("getAllPages follows the next cursor and collects items", async () => {
  const fetchImpl: typeof fetch = async (url) => {
    const u = String(url);
    if (u.includes("offset=2") || u.includes("page2")) {
      return jsonResponse({ items: [{ v: 3 }], next: null, total: 3 });
    }
    return jsonResponse({
      items: [{ v: 1 }, { v: 2 }],
      next: "https://api.spotify.com/v1/me/tracks?page2",
      total: 3,
    });
  };
  const client = new SpotifyClient({ fetchImpl, getToken: token, sleep: noSleep });

  const progress: Array<[number, number | null]> = [];
  const items = await client.getAllPages<{ v: number }>(
    "/me/tracks",
    {},
    (c, t) => progress.push([c, t]),
  );
  expect(items.map((i) => i.v)).toEqual([1, 2, 3]);
  expect(progress).toEqual([
    [2, 3],
    [3, 3],
  ]);
});
