// The island of Flores as the pilot sees it: a volcanic ridge down the
// middle, beaches at the shore, patchwork fields inland, a fishing village
// and an airstrip — Flores Field, runway 07 — at the far end of the course.
// All of it is deterministic from the seed: the same seed, the same island.
import { COURSE, PLANE } from './config.js';
import { createRandom, makeNoise1D, makeNoise2D } from './random.js';

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_FUEL_EMPTY = 8;
export const EVENT_OVER = EVENT_LANDED | EVENT_CRASHED | EVENT_FUEL_EMPTY;

/** A ring the pilot flies through: position, height and whether it is done. */
function buildRings(rand) {
  const rings = [];
  const spacing = (COURSE.runwayZ - 700) / COURSE.rings;
  for (let i = 0; i < COURSE.rings; i += 1) {
    const z = 650 + spacing * i + rand.range(-60, 60);
    const x = Math.sin(i * 1.35) * 190 + rand.range(-70, 70);
    const y = 95 + 55 * Math.sin(i * 0.9) + rand.range(-18, 18);
    rings.push({ x, y, z, radius: 32, passed: false, index: i + 1 });
  }
  return rings;
}

/** Villages, trees, the volcano and the airstrip's buildings, placed once. */
function buildLandmarks(rand) {
  const villages = [];
  for (let i = 0; i < 5; i += 1) {
    const z = 700 + i * 850 + rand.range(-120, 120);
    const x = (i % 2 === 0 ? -1 : 1) * rand.range(180, 380);
    const houses = [];
    for (let h = 0; h < 9; h += 1) {
      houses.push({ dx: rand.range(-46, 46), dz: rand.range(-30, 30), w: rand.range(7, 12), roof: rand.pick(['#c0392b', '#d35400', '#7d3c98', '#2e86c1']) });
    }
    villages.push({ x, z, houses, name: ['Wae Rebo', 'Bena', 'Moni', 'Larantuka', 'Ruteng'][i] });
  }
  const trees = [];
  for (let i = 0; i < 260; i += 1) {
    trees.push({ x: rand.range(-600, 600), z: rand.range(150, COURSE.runwayZ + 500), s: rand.range(0.7, 1.6) });
  }
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({ x: rand.range(-700, 700), y: rand.range(230, 330), z: rand.range(200, 6000), s: rand.range(0.8, 2.1) });
  }
  return { villages, trees, clouds };
}

export function createWorld(rand) {
  const seed = rand.seed;
  const hills = makeNoise2D(seed ^ 0x51ab, 24);
  const coast = makeNoise1D(seed ^ 0x77c1, 40);
  const patches = makeNoise2D(seed ^ 0x2e09, 16);
  const fieldRand = createRandom(seed ^ 0x9d3e);
  const rings = buildRings(fieldRand);
  const landmarks = buildLandmarks(fieldRand);

  /** The volcano cone that anchors the horizon, at z = 3400, x = -260. */
  const VOLCANO = { x: -260, z: 3400, height: 260, radius: 620 };

  // Keep every ring reachable: no hoop may sit inside a hillside or the
  // volcano cone — each one floats at least 65 m above its own ground.
  for (const ring of rings) {
    ring.y = Math.max(ring.y, groundHeight(ring.x, ring.z) + 65);
  }
  /**
   * Ground height in metres at (x, z). Sea level is 0; the island rises
   * inland, the runway strip is flattened, and the volcano cone stands out.
   */
  function groundHeight(x, z) {
    if (z < 40) return 0;
    // Flatten a shelf for the airstrip so landings are fair.
    const dzRun = Math.abs(z - (COURSE.runwayZ + 60));
    const dxRun = Math.abs(x - COURSE.runwayX);
    if (dzRun < 320 && dxRun < 90) return 26;
    const shore = 120 + coast(z / 5200) * 260;
    const inland = Math.max(0, (Math.abs(x) - shore) / 420);
    let h = inland * inland * 90 * (0.55 + 0.9 * hills((x + 700) / 90, z / 90));
    h += 26 * hills((x + 700) / 260, z / 260);
    // Volcano cone.
    const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    if (dv < VOLCANO.radius) {
      const cone = (1 - dv / VOLCANO.radius) * VOLCANO.height;
      h = Math.max(h, cone);
    }
    // The sea takes everything past the shore on either side.
    const seaEdge = shore + 260;
    if (Math.abs(x) > seaEdge) h = Math.min(h, -6 - (Math.abs(x) - seaEdge) * 0.02);
    return h;
  }

  function patchKind(x, z) {
    return patches((x + 700) / 160, z / 160);
  }

  const state = {
    // Plane state, in world units and knots.
    x: 0,
    y: 34,
    z: 0,
    heading: 0,
    bank: 0,
    pitch: 0,
    speedKts: 0,
    throttle: 0,
    fuel: COURSE.startFuel,
    score: 0,
    ringsPassed: 0,
    timeLeft: COURSE.timeLimit,
    distance: 0,
    landed: false,
    crashed: false,
    crashReason: '',
    message: '',
    messageTime: 0,
    camera: 'chase',
    // Autopilot hint used by the screenshot stager only.
    autopilot: false,
  };

  function reset() {
    state.x = 0;
    state.y = 34;
    state.z = 0;
    state.heading = 0;
    state.bank = 0;
    state.pitch = 0;
    state.speedKts = 0;
    state.throttle = 0;
    state.fuel = COURSE.startFuel;
    state.score = 0;
    state.ringsPassed = 0;
    state.timeLeft = COURSE.timeLimit;
    state.distance = 0;
    state.landed = false;
    state.crashed = false;
    state.crashReason = '';
    state.message = 'Flores Field — Ring Run: 8 rings, then land on runway 07.';
    state.messageTime = 6;
    for (const ring of rings) ring.passed = false;
  }

  function flash(message, seconds) {
    state.message = message;
    state.messageTime = seconds;
  }

  /**
   * Advance the flight by dt seconds. `ctl` carries -1..1 pitch, bank and
   * throttle inputs; `throttleDelta` is the per-second throttle change.
   * Returns an event bitmask.
   */
  function step(dt, ctl) {
    if (state.landed || state.crashed) return 0;
    state.timeLeft -= dt;
    if (state.messageTime > 0) state.messageTime -= dt;

    // Throttle and speed: speed chases its throttle target, drag included.
    state.throttle = Math.max(0, Math.min(1, state.throttle + ctl.throttle * dt));
    const target = PLANE.minSpeedKts + (PLANE.maxSpeedKts - PLANE.minSpeedKts) * state.throttle;
    state.speedKts += (target - state.speedKts) * Math.min(1, dt * 0.55);
    if (state.speedKts < PLANE.stallKts && state.y > groundHeight(state.x, state.z) + 3) {
      state.pitch -= 14 * dt; // A stalled wing drops its nose.
    }

    // Bank turns the plane; pitch climbs or descends.
    const bankTarget = ctl.bank * PLANE.maxBank;
    state.bank += (bankTarget - state.bank) * Math.min(1, dt * 3.2);
    state.heading += (-state.bank * PLANE.turnRate / PLANE.maxBank) * dt;
    const pitchTarget = ctl.pitch * PLANE.maxPitch;
    state.pitch += (pitchTarget - state.pitch) * Math.min(1, dt * 2.6);

    const speedMs = (state.speedKts * 1852) / 3600;
    const headingRad = (state.heading * Math.PI) / 180;
    const pitchRad = (state.pitch * Math.PI) / 180;
    state.z += Math.cos(headingRad) * Math.cos(pitchRad) * speedMs * dt;
    state.x += -Math.sin(headingRad) * Math.cos(pitchRad) * speedMs * dt;
    state.y += Math.sin(pitchRad) * speedMs * dt * 0.9 + (state.throttle > 0.55 ? PLANE.climbRate * 0.12 * dt : 0);
    state.y = Math.max(2, Math.min(420, state.y));
    state.x = Math.max(-COURSE.boundX, Math.min(COURSE.boundX, state.x));
    state.distance = state.z;

    // Fuel: throttle burns it; an empty tank ends the sortie.
    state.fuel -= PLANE.fuelBurn * (0.25 + state.throttle) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.crashed = true;
      state.crashReason = 'Out of fuel over the Flores Sea.';
      return EVENT_FUEL_EMPTY | EVENT_OVER;
    }
    if (state.timeLeft <= 0) {
      state.crashed = true;
      state.crashReason = 'Out of time — the sun set on the run.';
      return EVENT_CRASHED | EVENT_OVER;
    }

    // Rings: fly through the hoop and it pays points and fuel.
    for (const ring of rings) {
      if (ring.passed) continue;
      if (Math.abs(state.z - ring.z) > 18) continue;
      const dx = state.x - ring.x;
      const dy = state.y - ring.y;
      if (Math.hypot(dx, dy) < ring.radius) {
        ring.passed = true;
        state.ringsPassed += 1;
        state.score += PLANE.ringPoints;
        state.fuel = Math.min(100, state.fuel + COURSE.ringFuel);
        flash(`Ring ${ring.index} of ${COURSE.rings}! +${PLANE.ringPoints} pts, +${COURSE.ringFuel} fuel`, 2.5);
        return EVENT_RING;
      }
    }

    // Ground contact: a gentle touchdown on the runway is a landing.
    const ground = groundHeight(state.x, state.z);
    if (state.y <= ground + 2.5) {
      const onRunway =
        Math.abs(state.x - COURSE.runwayX) < COURSE.runwayWidth / 2 &&
        state.z > COURSE.runwayZ - 60 &&
        state.z < COURSE.runwayZ + COURSE.runwayLength + 120;
      const gentle = Math.abs(state.pitch) < 9 && Math.abs(state.bank) < 18 && state.speedKts < 95;
      if (onRunway && gentle && state.ringsPassed >= 6) {
        state.landed = true;
        state.y = ground + 2.5;
        const perfect = Math.abs(state.x - COURSE.runwayX) < 6 && state.speedKts < 80;
        state.score += PLANE.landingPoints + (perfect ? PLANE.perfectLandingBonus : 0);
        state.score += Math.max(0, Math.round(state.timeLeft)) * 5;
        flash(perfect ? 'PERFECT LANDING on runway 07!' : 'Landed on runway 07 — welcome to Flores Field!', 6);
        return EVENT_LANDED | EVENT_OVER;
      }
      if (onRunway && gentle) {
        state.crashed = true;
        state.crashReason = 'Landed early — fly through at least 6 rings first, then runway 07.';
        return EVENT_CRASHED | EVENT_OVER;
      }
      state.crashed = true;
      state.crashReason = state.y <= 3 && ground <= 0 ? 'Ditched in the Flores Sea.' : 'Flew into the hillside.';
      return EVENT_CRASHED | EVENT_OVER;
    }
    return 0;
  }

  reset();
  return {
    state,
    rings,
    landmarks,
    groundHeight,
    patchKind,
    reset,
    step,
    flash,
    volcano: VOLCANO,
  };
}
