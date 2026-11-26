// Skyrunner Flores — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** World units: 1 unit = 1 metre. The course runs along +Z. */
export const COURSE = {
  startZ: 0,
  /** Where the runway threshold sits; the flight ends there. */
  runwayZ: 5200,
  runwayX: 0,
  runwayWidth: 34,
  runwayLength: 420,
  /** Lateral half-width the pilot may roam in before the sea cliffs. */
  boundX: 620,
  /** Rings the pilot must fly through, in course order. */
  rings: 8,
  /** Fuel the plane starts with, in percent. */
  startFuel: 100,
  /** Fuel a ring gives back. */
  ringFuel: 12,
  /** Seconds on the clock when the sortie starts. */
  timeLimit: 300,
};

/** Flight model numbers for the Cendrawasih-1, a single-engine prop plane. */
export const PLANE = {
  /** Knots at full throttle, level flight. */
  maxSpeedKts: 148,
  /** Knots at idle. */
  minSpeedKts: 42,
  /** Knots below which the wing stops flying. */
  stallKts: 58,
  /** Degrees per second of turn at full bank. */
  turnRate: 26,
  /** Degrees per second the nose pitches. */
  pitchRate: 18,
  /** Maximum bank, degrees. */
  maxBank: 52,
  /** Maximum pitch, degrees. */
  maxPitch: 24,
  /** Climb, metres per second, at full power. */
  climbRate: 7.5,
  /** Fuel burned per second at full throttle. */
  fuelBurn: 0.55,
  /** Points for a ring, and the landing bonus. */
  ringPoints: 500,
  landingPoints: 1500,
  perfectLandingBonus: 800,
};

/** Colours of the Flores dusk: warm low sun over a green volcanic island. */
export const PALETTE = {
  skyTop: '#1d4e89',
  skyMid: '#5f8fc4',
  skyHorizon: '#f7c98b',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  seaDeep: '#0f5e7a',
  seaShallow: '#2fa8a0',
  sand: '#e8d29a',
  grassLight: '#7fb069',
  grass: '#4e9a51',
  grassDark: '#2f6b3a',
  fieldPatch: '#c9a227',
  forest: '#1e5c2e',
  rock: '#6b5d4f',
  volcano: '#4a3f38',
  runway: '#3a3f46',
  runwayMark: '#f5f2e8',
  ring: '#ffcf3f',
  ringGlow: '#ff9d00',
  panel: '#20242c',
  panelEdge: '#3d4450',
  gaugeFace: '#10151d',
  gaugeGlow: '#7ee0a3',
  amber: '#ffb347',
  red: '#ff5a4e',
  text: '#f4f1e6',
  muted: '#aab4c0',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'skyrunner-flores.best';
