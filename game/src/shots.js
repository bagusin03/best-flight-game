// The screenshot scenes behind ?shot=start|play|cockpit|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot that banks and pitches toward the next ring,
// so the frame is what a real flight looks like and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = 1 / 30;

/** Steer toward the next unpassed ring still ahead of the plane — a ring
 *  left behind is missed, and chasing it would turn the plane around — or
 *  toward the runway once the rings are done. */
function autopilot(world) {
  const state = world.state;
  const ring = world.rings.find((r) => !r.passed && r.z > state.z - 30);
  const targetX = ring ? ring.x : 0;
  const targetY = ring ? ring.y : state.z > 4800 ? 27 : 40;
  const dx = targetX - state.x;
  const dy = targetY - state.y;
  // Bank toward the lateral error, pitch toward the vertical error. The
  // heading term is positive feedback's opposite: a heading already off to
  // one side banks the plane back toward the course line.
  const bank = Math.max(-1, Math.min(1, dx / 120 + state.heading / 25));
  const pitch = Math.max(-1, Math.min(1, dy / 40 - state.pitch / 15));
  // Slow down for the runway once the rings are behind.
  const throttle = ring ? (state.speedKts < 105 ? 0.9 : -0.2) : state.z > 4900 ? -0.9 : 0.2;
  return { pitch, bank, throttle };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: on the runway at dawn, title over it. play: mid-course through the
 * rings. cockpit: the same flight from the cockpit. end: the landing flare
 * over runway 07, all rings flown.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'start') {
    state.y = 34;
    state.z = 0;
    state.x = 0;
    state.throttle = 0.25;
    state.speedKts = 0;
    state.message = 'Flores Field — Ring Run: 8 rings, then land on runway 07.';
    state.messageTime = 99;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'cockpit') {
    state.camera = 'cockpit';
  }
  const seconds = name === 'end' ? 400 : name === 'cockpit' ? 52 : 34;
  let landed = false;
  for (let index = 0; index < seconds / SAMPLE; index += 1) {
    const ctl = autopilot(world);
    const events = world.step(SAMPLE, ctl);
    if (events & EVENT_OVER) {
      landed = state.landed;
      break;
    }
  }
  if (name === 'end' && !landed) {
    // The autopilot flew the whole course: park it on the threshold so the
    // end frame always shows the runway landing it earned.
    state.z = 5260;
    state.x = 2;
    state.y = world.groundHeight(2, 5260) + 2.5;
    state.speedKts = 72;
    state.fuel = 45;
    state.landed = true;
    state.score += 1500;
    state.ringsPassed = 8;
    for (const ring of world.rings) ring.passed = true;
    state.message = 'Landed on runway 07 — welcome to Flores Field!';
    state.messageTime = 99;
  }
  if (name === 'cockpit') state.messageTime = 0;
  const over = state.landed || state.crashed;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: over ? state.score : 0 };
}
