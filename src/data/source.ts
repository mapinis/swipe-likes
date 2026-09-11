import { SpotifyClient } from "../api/client.ts";
import { MOCK } from "../config.ts";
import { mockSnapshot } from "../mock/fixtures.ts";
import { loadSnapshot, saveSnapshot, type Snapshot } from "./cache.ts";
import { gatherSnapshot, type GatherProgress } from "./gather.ts";

export const client = new SpotifyClient();

export async function getSnapshot(
  opts: { force?: boolean; onProgress?: (p: GatherProgress) => void } = {},
): Promise<Snapshot> {
  if (MOCK) {
    opts.onProgress?.({ phase: "Loading demo library" });
    return mockSnapshot();
  }

  if (!opts.force) {
    const cached = await loadSnapshot();
    if (cached) return cached;
  }

  const snap = await gatherSnapshot(client, opts.onProgress);
  await saveSnapshot(snap);
  return snap;
}
