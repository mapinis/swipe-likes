import type { Snapshot } from "../data/cache.ts";
import type { SavedTrack } from "../api/types.ts";

const DAY = 86_400_000;

interface Seed {
  id: string;
  name: string;
  artistId: string;
  artist: string;
  ageDays: number;
  genres: string[];
}

const SEEDS: Seed[] = [
  { id: "t1", name: "Midnight City", artistId: "m83", artist: "M83", ageDays: 14, genres: ["indietronica"] },
  { id: "t2", name: "Redbone", artistId: "childish", artist: "Childish Gambino", ageDays: 30, genres: ["hip hop"] },
  { id: "t3", name: "Dog Days Are Over", artistId: "florence", artist: "Florence + The Machine", ageDays: 1200, genres: ["art pop"] },
  { id: "t4", name: "Mr. Brightside", artistId: "killers", artist: "The Killers", ageDays: 2100, genres: ["alternative rock"] },
  { id: "t5", name: "Polka Party", artistId: "weird", artist: "Weird Al", ageDays: 1600, genres: ["polka"] },
  { id: "t6", name: "Electric Feel", artistId: "mgmt", artist: "MGMT", ageDays: 90, genres: ["indietronica"] },
  { id: "t7", name: "Some Forgotten B-Side", artistId: "obscure1", artist: "The Nobodys", ageDays: 1800, genres: ["garage rock"] },
  { id: "t8", name: "Intro Skit", artistId: "obscure2", artist: "Random Mixtape", ageDays: 1500, genres: [] },
  { id: "t9", name: "Time", artistId: "floyd", artist: "Pink Floyd", ageDays: 700, genres: ["classic rock"] },
  { id: "t10", name: "Runaway", artistId: "kanye", artist: "Kanye West", ageDays: 45, genres: ["hip hop"] },
  { id: "t11", name: "Wake Me Up", artistId: "avicii", artist: "Avicii", ageDays: 1100, genres: ["edm"] },
  { id: "t12", name: "Sweater Weather", artistId: "nbhd", artist: "The Neighbourhood", ageDays: 400, genres: ["indie pop"] },
  { id: "t13", name: "Gangnam Style", artistId: "psy", artist: "PSY", ageDays: 2500, genres: ["k-pop"] },
  { id: "t14", name: "A Song I Skip", artistId: "obscure3", artist: "Elevator Trio", ageDays: 950, genres: ["lounge"] },
  { id: "t15", name: "Do I Wanna Know?", artistId: "arctic", artist: "Arctic Monkeys", ageDays: 20, genres: ["garage rock"] },
  { id: "t16", name: "Old Summer Anthem", artistId: "obscure4", artist: "Beach Dudes", ageDays: 1400, genres: ["surf rock"] },
  { id: "t17", name: "Take On Me", artistId: "aha", artist: "a-ha", ageDays: 1900, genres: ["synthpop"] },
  { id: "t18", name: "Another Forgotten One", artistId: "obscure5", artist: "The Nobodys", ageDays: 1750, genres: ["garage rock"] },
  { id: "t19", name: "New Obsession", artistId: "arctic", artist: "Arctic Monkeys", ageDays: 7, genres: ["garage rock"] },
  { id: "t20", name: "Meme Sound 2014", artistId: "obscure6", artist: "Viral Audio", ageDays: 2300, genres: [] },
];

function image(id: string) {
  return { url: `https://picsum.photos/seed/${id}/400/400`, width: 400, height: 400 };
}

export function mockSnapshot(now = Date.now()): Snapshot {
  const savedTracks: SavedTrack[] = SEEDS.map((s) => ({
    added_at: new Date(now - s.ageDays * DAY).toISOString(),
    track: {
      id: s.id,
      name: s.name,
      uri: `spotify:track:${s.id}`,
      duration_ms: 210_000,
      popularity: 50,
      artists: [{ id: s.artistId, name: s.artist }],
      album: { name: s.name, images: [image(s.id)] },
    },
  }));

  // "You actually listen to these lately."
  const topShortTracks = ["t1", "t15", "t19", "t10"];
  const topShortArtists = ["m83", "arctic", "kanye", "childish"];
  const topMedArtists = [...topShortArtists, "nbhd", "mgmt"];

  const artistGenres = new Map<string, string[]>();
  for (const s of SEEDS) artistGenres.set(s.artistId, s.genres);

  return {
    fetchedAt: now,
    user: { id: "mockuser", display_name: "Mock Listener", product: "premium" },
    savedTracks,
    topTrackIds: {
      short: topShortTracks,
      medium: [...topShortTracks, "t6", "t12"],
      long: [...topShortTracks, "t6", "t12", "t9"],
    },
    topArtistIds: {
      short: topShortArtists,
      medium: topMedArtists,
      long: [...topMedArtists, "floyd"],
    },
    recentlyPlayedTrackIds: ["t1", "t19", "t15"],
    recentlyPlayedArtistIds: ["m83", "arctic", "kanye"],
    activeGenres: ["indietronica", "garage rock", "hip hop", "indie pop"],
    artistGenres: [...artistGenres.entries()],
  };
}
