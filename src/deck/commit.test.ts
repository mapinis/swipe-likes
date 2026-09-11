import type { SpotifyClient } from "../api/client.ts";
import { commitToss } from "./commit.ts";

interface Call {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function fakeClient(
  opts: { existingPlaylists?: unknown[]; existingItems?: unknown[] } = {},
) {
  const calls: Call[] = [];
  const client = {
    async getAllPages(path: string) {
      return path.includes("/items")
        ? (opts.existingItems ?? [])
        : (opts.existingPlaylists ?? []);
    },
    async request(
      path: string,
      o: {
        method?: string;
        body?: unknown;
        query?: Record<string, string | number | undefined>;
      } = {},
    ) {
      calls.push({ method: o.method ?? "GET", path, body: o.body, query: o.query });
      if (path === "/me/playlists" && o.method === "POST") {
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

test("commit uses the post-Feb-2026 endpoints and query-based library removal", async () => {
  const { client, calls } = fakeClient();
  const res = await commitToss(client, "u1", items);

  expect(calls.find((c) => c.method === "POST" && c.path === "/me/playlists")).toBeDefined();

  const add = calls.find((c) => c.path === "/playlists/PL1/items");
  expect((add!.body as { uris: string[] }).uris).toEqual([
    "spotify:track:t1",
    "spotify:track:t2",
  ]);

  const remove = calls.find((c) => c.method === "DELETE" && c.path === "/me/library");
  expect(remove).toBeDefined();
  expect(remove!.body).toBeUndefined();
  expect(remove!.query?.uris).toBe("spotify:track:t1,spotify:track:t2");

  expect(res).toEqual({ playlistId: "PL1", removed: 2 });
});

test("commit reuses an existing Swiped Out playlist instead of creating one", async () => {
  const existing = [
    { id: "OLD", name: "Swiped Out", uri: "spotify:playlist:OLD", owner: { id: "u1" } },
  ];
  const { client, calls } = fakeClient({ existingPlaylists: existing });
  await commitToss(client, "u1", items);

  expect(calls.find((c) => c.path === "/me/playlists")).toBeUndefined();
  expect(calls.find((c) => c.path === "/playlists/OLD/items")).toBeDefined();
});

test("re-run does not re-add tracks already in the backup playlist", async () => {
  const existing = [
    { id: "OLD", name: "Swiped Out", uri: "spotify:playlist:OLD", owner: { id: "u1" } },
  ];
  const { client, calls } = fakeClient({
    existingPlaylists: existing,
    existingItems: [{ track: { uri: "spotify:track:t1" } }], // t1 already backed up
  });
  await commitToss(client, "u1", items);

  const add = calls.find((c) => c.path === "/playlists/OLD/items");
  expect((add!.body as { uris: string[] }).uris).toEqual(["spotify:track:t2"]);
  // Removal still covers everything the user tossed (removing an unliked track is a no-op).
  const remove = calls.find((c) => c.path === "/me/library");
  expect(remove!.query?.uris).toBe("spotify:track:t1,spotify:track:t2");
});
