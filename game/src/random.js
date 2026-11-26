// A small deterministic random source: one mulberry32 stream plus smooth
// value noise, so the same seed always builds the same island.
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function range(min, max) {
    return min + (max - min) * next();
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  return { next, range, pick, seed: seed >>> 0 };
}

/** Smooth 1-D value noise over a fixed lattice, for rolling hills. */
export function makeNoise1D(seed, lattice) {
  const rand = createRandom(seed);
  const values = [];
  for (let i = 0; i < lattice; i += 1) values.push(rand.next());
  function at(t) {
    const scaled = t * (lattice - 1);
    const i = Math.floor(scaled);
    const f = scaled - i;
    const a = values[Math.max(0, Math.min(lattice - 1, i))];
    const b = values[Math.max(0, Math.min(lattice - 1, i + 1))];
    const smooth = f * f * (3 - 2 * f);
    return a + (b - a) * smooth;
  }
  return at;
}

/** Smooth 2-D value noise over a fixed lattice, for the island's relief. */
export function makeNoise2D(seed, size) {
  const rand = createRandom(seed);
  const grid = [];
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) row.push(rand.next());
    grid.push(row);
  }
  function at(x, z) {
    const fx = Math.max(0, Math.min(size - 1.001, x));
    const fz = Math.max(0, Math.min(size - 1.001, z));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = grid[iz][ix];
    const b = grid[iz][ix + 1];
    const c = grid[iz + 1][ix];
    const d = grid[iz + 1][ix + 1];
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  return at;
}
