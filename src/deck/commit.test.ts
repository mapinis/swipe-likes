import type { SpotifyClient } from "../api/client.ts";
import { commitToss } from "./commit.ts";

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

function fakeClient(existingPlaylists: unknown[] = []) {
  const calls: Call[] = [];
  const client = {
    async getAllPages() {
      return existingPlaylists;
    },
    async request(path: string, opts: { method?: string; body?: unknown } = {}) {
      calls.push({ method: opts.method ?? "GET", path, body: opts.body });
      if (path === "/me/playlists" && opts.method === "POST") {
        return {
          id: "PL1",
          name: "Swiped Out",
          uri: "spotify:playlist:PL1",
          owner: { id: "u1" },
        };
      }
      return undefined;
    },
  } as unknown as SpotifyClient;
  return { client, calls };
}

const items = [
  { id: "t1", uri: "spotify:track:t1" },
  { id: "t2", uri: "spotify:track:t2" },
];

test("commit uses the post-Feb-2026 endpoints (create /me/playlists, add /items, remove /me/library)", async () => {
  const { client, calls } = fakeClient([]);
  const res = await commitToss(client, "u1", items);

  const create = calls.find((c) => c.method === "POST" && c.path === "/me/playlists");
  expect(create).toBeDefined();

  const add = calls.find((c) => c.method === "POST" && c.path === "/playlists/PL1/items");
  expect(add).toBeDefined();
  expect((add!.body as { uris: string[] }).uris).toEqual([
    "spotify:track:t1",
    "spotify:track:t2",
  ]);

  const remove = calls.find((c) => c.method === "DELETE" && c.path === "/me/library");
  expect(remove).toBeDefined();
  expect((remove!.body as { uris: string[] }).uris).toEqual([
    "spotify:track:t1",
    "spotify:track:t2",
  ]);

  expect(res).toEqual({ playlistId: "PL1", removed: 2 });
});

test("commit reuses an existing Swiped Out playlist instead of creating one", async () => {
  const existing = [
    { id: "OLD", name: "Swiped Out", uri: "spotify:playlist:OLD", owner: { id: "u1" } },
  ];
  const { client, calls } = fakeClient(existing);
  await commitToss(client, "u1", items);

  expect(calls.find((c) => c.path === "/me/playlists")).toBeUndefined();
  expect(calls.find((c) => c.path === "/playlists/OLD/items")).toBeDefined();
});
