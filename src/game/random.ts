// Random numbers for the games. Endless modes use Math.random; the daily challenge uses a generator seeded by the
// date, so everyone gets the same questions on the same day.

export type Random = () => number; // like Math.random: [0, 1)

// mulberry32: tiny, fast, good enough for picking countries.
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String -> 32-bit seed (FNV-1a).
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

export function pick<T>(items: T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}

// Fisher-Yates on a copy.
export function shuffled<T>(items: T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
