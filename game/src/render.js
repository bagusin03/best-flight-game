// The painter: dusk sky with sun and clouds, a projected island of patchwork
// fields and sea, the Cendrawasih-1 in chase or cockpit view, glowing
// instruments and a full HUD — altitude, speed, heading, fuel, rings, score.
import { COURSE, FIELD, PALETTE, PLANE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FOCAL = 640;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Mix an [r,g,b] colour toward another by t. */
function mixColor(a, b, t) {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}

function rgb(c, alpha = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const C = {};
for (const key of Object.keys(PALETTE)) C[key] = hexToRgb(PALETTE[key]);

/** Terrain colour at a point: sand, fields, forest, rock, sea, runway. */
function terrainColor(h, x, z, patch) {
  if (h <= 0.5) return h < -4 ? C.seaDeep : C.seaShallow;
  if (h < 3) return C.sand;
  if (Math.abs(x - COURSE.runwayX) < COURSE.runwayWidth / 2 && z > COURSE.runwayZ - 60 && z < COURSE.runwayZ + COURSE.runwayLength + 120) {
    return C.runway;
  }
  if (patch > 0.74) return C.fieldPatch;
  if (h > 150) return C.volcano;
  if (h > 95) return C.rock;
  if (patch > 0.62) return C.forest;
  if (h < 14) return C.grassLight;
  return patch > 0.45 ? C.grass : C.grassDark;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = FIELD.width;
  const H = FIELD.height;

  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.width = Math.round(W * scale * (window.devicePixelRatio || 1));
    canvas.height = Math.round(H * scale * (window.devicePixelRatio || 1));
    canvas.style.width = `${Math.round(W * scale)}px`;
    canvas.style.height = `${Math.round(H * scale)}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawSky(state, horizonY) {
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, horizonY + 42);
    // Low sun, ahead and to the left, with a warm glow.
    const sunX = W * 0.30 - state.heading * 1.4;
    const sunY = horizonY - 66;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,179,71,0.55)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Project a world point into screen space; null when behind the camera. */
  function project(cam, x, y, z) {
    const headingRad = (cam.heading * Math.PI) / 180;
    const dx = x - cam.x;
    const dz = z - cam.z;
    const rx = dx * Math.cos(headingRad) + dz * Math.sin(headingRad);
    const rz = -dx * Math.sin(headingRad) + dz * Math.cos(headingRad);
    if (rz < 6) return null;
    const scale = FOCAL / rz;
    return {
      x: W / 2 + rx * scale,
      y: cam.horizonY + (cam.y - y) * scale,
      scale,
      rz,
    };
  }

  function drawTerrain(world, cam) {
    const rows = 58;
    const cols = 36;
    const xStep = 1400 / cols;
    // Row distances grow geometrically so near ground is detailed and the
    // far island still reaches the horizon.
    const distances = [];
    let d = 14;
    for (let i = 0; i <= rows; i += 1) {
      distances.push(d);
      d *= 1.085;
    }
    let prev = null;
    for (let r = 0; r <= rows; r += 1) {
      const z = cam.z + distances[r];
      const points = [];
      for (let c = 0; c <= cols; c += 1) {
        const x = cam.x + (c - cols / 2) * xStep;
        const h = world.groundHeight(x, z);
        const p = project(cam, x, h, z);
        points.push({ p, h, x, z, patch: world.patchKind(x, z) });
      }
      if (prev) {
        for (let c = 0; c < cols; c += 1) {
          const a = prev[c];
          const b = prev[c + 1];
          const d2 = points[c + 1];
          const e = points[c];
          if (!a.p || !b.p || !d2.p || !e.p) continue;
          const fog = clamp((a.p.rz - 260) / 900, 0, 0.82);
          let col = terrainColor(a.h, a.x, a.z, a.patch);
          col = mixColor(col, C.skyHorizon, fog);
          ctx.fillStyle = rgb(col);
          ctx.beginPath();
          ctx.moveTo(a.p.x, a.p.y);
          ctx.lineTo(b.p.x, b.p.y);
          ctx.lineTo(d2.p.x, d2.p.y);
          ctx.lineTo(e.p.x, e.p.y);
          ctx.closePath();
          ctx.fill();
          // Runway centre dashes, painted on the strip itself.
          if (Math.abs(a.x) < 2 && a.z > COURSE.runwayZ && a.z < COURSE.runwayZ + COURSE.runwayLength && Math.floor(a.z / 60) % 2 === 0) {
            ctx.fillStyle = rgb(C.runwayMark, 0.9);
            ctx.fillRect(a.p.x - 3, a.p.y, 6, Math.max(2, (d2.p.y - a.p.y) * 0.7));
          }
        }
      }
      prev = points;
    }
  }

  function drawClouds(world, cam) {
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    for (const cloud of world.landmarks.clouds) {
      const p = project(cam, cloud.x, cloud.y, cloud.z);
      if (!p || p.x < -200 || p.x > W + 200) continue;
      const s = cloud.s * p.scale * 60;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + s * 0.55, p.y + s * 0.06, s * 0.65, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLandmarks(world, cam) {
    // Villages: a cluster of small houses with coloured roofs, each named
    // on the map; trees are small dark triangles on the near ground.
    for (const village of world.landmarks.villages) {
      for (const house of village.houses) {
        const hx = village.x + house.dx;
        const hz = village.z + house.dz;
        const h = world.groundHeight(hx, hz);
        const p = project(cam, hx, h, hz);
        if (!p || p.rz > 700 || p.rz < 25) continue;
        const w = Math.max(2, house.w * p.scale * 0.9);
        ctx.fillStyle = '#e8dcc0';
        ctx.fillRect(p.x - w / 2, p.y - w * 0.9, w, w * 0.9);
        ctx.fillStyle = house.roof;
        ctx.beginPath();
        ctx.moveTo(p.x - w / 2 - 1, p.y - w * 0.9);
        ctx.lineTo(p.x, p.y - w * 1.5);
        ctx.lineTo(p.x + w / 2 + 1, p.y - w * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(20,70,35,0.9)';
    for (const tree of world.landmarks.trees) {
      if (Math.abs(tree.z - cam.z) > 420 || Math.abs(tree.x - cam.x) > 320) continue;
      const h = world.groundHeight(tree.x, tree.z);
      const p = project(cam, tree.x, h, tree.z);
      if (!p || p.rz < 25) continue;
      const s = Math.max(1.5, 9 * p.scale * tree.s);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s);
      ctx.lineTo(p.x - s * 0.55, p.y);
      ctx.lineTo(p.x + s * 0.55, p.y);
      ctx.closePath();
      ctx.fill();
    }
    // Airstrip buildings beside runway 07: tower, hangar, windsock.
    const tower = project(cam, 42, 26, COURSE.runwayZ + 180);
    if (tower && tower.rz < 900 && tower.rz > 40) {
      const s = tower.scale;
      ctx.fillStyle = '#dfe6ee';
      ctx.fillRect(tower.x - 7 * s, tower.y - 34 * s, 14 * s, 34 * s);
      ctx.fillStyle = '#2e86c1';
      ctx.fillRect(tower.x - 10 * s, tower.y - 42 * s, 20 * s, 9 * s);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(tower.x - 30 * s, tower.y);
      ctx.lineTo(tower.x - 30 * s, tower.y - 14 * s);
      ctx.lineTo(tower.x - 12 * s, tower.y - 8 * s);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRings(world, cam) {
    for (const ring of world.rings) {
      if (ring.passed) continue;
      const p = project(cam, ring.x, ring.y, ring.z);
      if (!p || p.rz > 1100) continue;
      const r = ring.radius * p.scale;
      if (r < 2) continue;
      ctx.save();
      ctx.globalAlpha = clamp(1.15 - p.rz / 900, 0.25, 1);
      ctx.lineWidth = Math.max(3, r * 0.16);
      ctx.strokeStyle = PALETTE.ringGlow;
      ctx.shadowColor = PALETTE.ringGlow;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.strokeStyle = PALETTE.ring;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(11, Math.round(r * 0.5))}px ${'Trebuchet MS'}, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // The number only when the hoop's centre is actually on screen.
      if (r < 220 && p.x > 0 && p.x < W && p.y > 0 && p.y < H) {
        ctx.fillText(String(ring.index), p.x, p.y - r - Math.max(12, r * 0.45));
      }
      ctx.restore();
    }
  }

  /** The Cendrawasih-1 from behind and slightly above, banking with the turn. */
  function drawPlane(state, t) {
    const cx = W / 2;
    const cy = H * 0.66;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-state.bank * Math.PI) / 180);
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);
    // Wings: warm cream with red tips and a sunlit upper surface.
    ctx.fillStyle = '#f2e3c6';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.quadraticCurveTo(-60, -14, -16, -4);
    ctx.lineTo(16, -4);
    ctx.quadraticCurveTo(60, -14, 118, 6);
    ctx.quadraticCurveTo(60, 14, 14, 10);
    ctx.lineTo(-14, 10);
    ctx.quadraticCurveTo(-60, 14, -118, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-118, 2, 16, 8);
    ctx.fillRect(102, 2, 16, 8);
    // Fuselage, tapering away from the camera, with a teal stripe.
    const fus = ctx.createLinearGradient(0, -70, 0, 52);
    fus.addColorStop(0, '#7fb3d5');
    fus.addColorStop(0.5, '#eaf2f8');
    fus.addColorStop(1, '#b9c9d6');
    ctx.fillStyle = fus;
    ctx.beginPath();
    ctx.moveTo(-13, 52);
    ctx.quadraticCurveTo(-17, -10, -8, -72);
    ctx.quadraticCurveTo(0, -80, 8, -72);
    ctx.quadraticCurveTo(17, -10, 13, 52);
    ctx.quadraticCurveTo(0, 60, -13, 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a7f8e';
    ctx.fillRect(-12, -34, 24, 7);
    // Tail fin and stabiliser.
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-4, -72);
    ctx.lineTo(-4, -104);
    ctx.lineTo(6, -96);
    ctx.lineTo(8, -72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2e3c6';
    ctx.fillRect(-34, -66, 68, 8);
    // Registration and navigation lights.
    ctx.fillStyle = '#22303c';
    ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PK-SKY', 0, 34);
    const blink = Math.sin(t * 6) > 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#7a1f1a';
    ctx.beginPath();
    ctx.arc(-118, 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#35e08a' : '#14532d';
    ctx.beginPath();
    ctx.arc(118, 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGauge(x, y, r, label, valueText, needleAngle, glow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PALETTE.gaugeFace;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = glow ? PALETTE.gaugeGlow : PALETTE.panelEdge;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238,241,245,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.lineTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
      ctx.stroke();
    }
    ctx.rotate(needleAngle);
    ctx.strokeStyle = '#ff5a4e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -r + 10);
    ctx.stroke();
    ctx.rotate(-needleAngle);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold ${Math.max(10, r * 0.32)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(valueText, 0, r * 0.42);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `${Math.max(9, r * 0.24)}px "Trebuchet MS", sans-serif`;
    ctx.fillText(label, 0, -r - 7);
    ctx.restore();
  }

  /** Cockpit view: glareshield, spinning prop, and a lit instrument panel. */
  function drawCockpit(state, t) {
    // Nose and spinning prop disc, seen through the windshield.
    const cx = W / 2;
    const cy = H * 0.52;
    ctx.fillStyle = 'rgba(230,238,244,0.92)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 150, 150, 46, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy + 40);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#9aa7b4';
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.rotate(t * 9);
    ctx.fillStyle = '#5d6b7a';
    for (let i = 0; i < 3; i += 1) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.ellipse(0, -52, 9, 52, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#2b3440';
    ctx.beginPath();
    ctx.arc(cx, cy + 40, 13, 0, Math.PI * 2);
    ctx.fill();
    // Instrument panel.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, H - 148, W, 148);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, H - 148, W, 4);
    // Artificial horizon.
    const hx = 210;
    const hy = H - 74;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#3f7fc4';
    ctx.fillRect(-52, -52, 104, 52 + clamp(-state.pitch * 1.6, -40, 40));
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-52, clamp(-state.pitch * 1.6, -40, 40), 104, 104);
    ctx.rotate((-state.bank * Math.PI) / 180);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-52, -2, 104, 3);
    ctx.restore();
    ctx.strokeStyle = PALETTE.gaugeGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, hy + 68);
    const altFt = Math.round(state.y * 3.281);
    drawGauge(430, H - 74, 46, 'ALTITUDE ft', String(altFt), -Math.PI * 0.75 + clamp(altFt / 12000, 0, 1) * Math.PI * 1.5, true);
    drawGauge(580, H - 74, 46, 'AIRSPEED kt', String(Math.round(state.speedKts)), -Math.PI * 0.75 + clamp(state.speedKts / 180, 0, 1) * Math.PI * 1.5, true);
    drawGauge(730, H - 74, 46, 'FUEL %', String(Math.round(state.fuel)), -Math.PI * 0.75 + clamp(state.fuel / 100, 0, 1) * Math.PI * 1.5, state.fuel > 25);
    // Throttle lever.
    ctx.fillStyle = PALETTE.gaugeFace;
    ctx.fillRect(850, H - 128, 26, 108);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(850, H - 128 + (1 - state.throttle) * 92, 26, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', 863, H - 132 + 122);
    ctx.fillText(`${Math.round(state.throttle * 100)}%`, 905, H - 74);
    // Compass tape on the panel.
    ctx.fillStyle = PALETTE.gaugeFace;
    ctx.fillRect(960, H - 118, 260, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    const hdg = Math.round(((state.heading % 360) + 360) % 360);
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 1090, H - 94);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px "Trebuchet MS", sans-serif';
    ctx.fillText('Cockpit — press C for chase view', 1090, H - 52);
  }

  function drawMinimap(world, state) {
    const mx = W - 178;
    const my = H - 178;
    const mw = 158;
    const mh = 128;
    ctx.fillStyle = 'rgba(16,21,29,0.82)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(mx, my, mw, mh);
    const mapX = (x) => mx + ((x + 620) / 1240) * mw;
    const mapZ = (z) => my + (z / (COURSE.runwayZ + 500)) * mh;
    ctx.strokeStyle = 'rgba(244,241,230,0.5)';
    ctx.beginPath();
    ctx.moveTo(mapX(0), mapZ(0));
    ctx.lineTo(mapX(0), mapZ(COURSE.runwayZ));
    ctx.stroke();
    for (const ring of world.rings) {
      ctx.fillStyle = ring.passed ? PALETTE.gaugeGlow : PALETTE.ring;
      ctx.beginPath();
      ctx.arc(mapX(ring.x), mapZ(ring.z), ring.passed ? 3 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(mapX(0) - 8, mapZ(COURSE.runwayZ) - 3, 16, 6);
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.moveTo(mapX(state.x), mapZ(state.z) - 6);
    ctx.lineTo(mapX(state.x) - 5, mapZ(state.z) + 5);
    ctx.lineTo(mapX(state.x) + 5, mapZ(state.z) + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FLORES FIELD', mx + 6, my + 14);
  }

  function drawHud(world, state, screen) {
    const hdg = Math.round(((state.heading % 360) + 360) % 360);
    const altFt = Math.round(state.y * 3.281);
    ctx.textBaseline = 'alphabetic';
    // Top bar.
    ctx.fillStyle = 'rgba(10,14,20,0.62)';
    ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`ALT ${altFt.toLocaleString()} ft`, 18, 40);
    ctx.fillText(`SPD ${Math.round(state.speedKts)} kt`, 268, 40);
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 498, 40);
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${state.score.toLocaleString()}`, W - 18, 40);
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`RINGS ${state.ringsPassed}/${COURSE.rings}   TIME ${Math.max(0, Math.ceil(state.timeLeft))}s`, W - 18, 58);
    // Fuel bar under the top bar.
    const fuelW = 220;
    ctx.fillStyle = 'rgba(10,14,20,0.62)';
    ctx.fillRect(18, 74, fuelW, 16);
    ctx.fillStyle = state.fuel > 25 ? PALETTE.gaugeGlow : PALETTE.red;
    ctx.fillRect(18, 74, fuelW * clamp(state.fuel / 100, 0, 1), 16);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(18, 74, fuelW, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`FUEL ${Math.round(state.fuel)}%`, 248, 87);
    // Stall warning — only while actually flying.
    if (screen === SCREEN_PLAY && state.speedKts < PLANE.stallKts && state.throttle < 0.9) {
      ctx.fillStyle = Math.sin(Date.now() / 120) > 0 ? PALETTE.red : '#fff';
      ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ STALL — FULL THROTTLE', W / 2, 108);
    }
    // Centre message — only while actually flying.
    if (screen === SCREEN_PLAY && state.messageTime > 0 && state.message) {
      ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
      const w2 = ctx.measureText(state.message).width + 28;
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      ctx.fillRect(W / 2 - w2 / 2, 118, w2, 32);
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, W / 2, 140);
    }
    // Next-ring distance — only while actually flying.
    const next = screen === SCREEN_PLAY ? world.rings.find((r) => !r.passed) : null;
    if (next) {
      const dist = Math.max(0, Math.round(next.z - state.z));
      ctx.fillStyle = PALETTE.ring;
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`NEXT RING ${next.index} — ${dist} m`, W / 2, H - (state.camera === 'cockpit' ? 168 : 24));
    }
  }

  function drawTitle(world, state, best) {
    ctx.fillStyle = 'rgba(8,12,20,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 64px "Trebuchet MS", sans-serif';
    ctx.fillText('SKYRUNNER FLORES', W / 2, 150);
    ctx.fillStyle = PALETTE.ring;
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.fillText('Island Ring Run — Cendrawasih-1 over the Flores Sea', W / 2, 192);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px "Trebuchet MS", sans-serif';
    ctx.fillText('Fly through all 8 golden rings, then land on runway 07 at Flores Field.', W / 2, 250);
    ctx.fillText('Rings refill your fuel. Mind the volcano — and the sea.', W / 2, 280);
    ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('↑ ↓ pitch      ← → bank      SHIFT throttle up      CTRL throttle down', W / 2, 340);
    ctx.fillText('Mouse: hold left button and steer      C camera      P pause      M sound', W / 2, 368);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
    const pulse = 0.7 + Math.sin(Date.now() / 350) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY', W / 2, 620);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px "Trebuchet MS", sans-serif';
    if (best > 0) ctx.fillText(`Best score: ${best.toLocaleString()}`, W / 2, 658);
    ctx.fillText('An original game — no commercial names, art or music.', W / 2, 686);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(8,12,20,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    if (state.landed) {
      ctx.fillStyle = PALETTE.gaugeGlow;
      ctx.font = 'bold 52px "Trebuchet MS", sans-serif';
      ctx.fillText('LANDED — WELCOME TO FLORES FIELD', W / 2, 220);
    } else {
      ctx.fillStyle = PALETTE.red;
      ctx.font = 'bold 52px "Trebuchet MS", sans-serif';
      ctx.fillText('SORTIE OVER', W / 2, 220);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '22px "Trebuchet MS", sans-serif';
      ctx.fillText(state.crashReason, W / 2, 264);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
    ctx.fillText(`Score ${state.score.toLocaleString()}    Rings ${state.ringsPassed}/${COURSE.rings}    Best ${Math.max(best, state.score).toLocaleString()}`, W / 2, 330);
    ctx.font = '20px "Trebuchet MS", sans-serif';
    ctx.fillText('Press R or SPACE to fly again', W / 2, 380);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,12,20,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 48px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '20px "Trebuchet MS", sans-serif';
    ctx.fillText('Press P to keep flying', W / 2, H / 2 + 30);
  }

  function draw(world, state, screen, best, t) {
    const scale = canvas.width / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const horizonY = H * 0.46 - state.pitch * 2.2;
    const cam = {
      x: state.x,
      y: state.y + (state.camera === 'cockpit' ? 1.4 : 8),
      z: state.z - (state.camera === 'cockpit' ? 2 : 20),
      heading: state.heading,
      horizonY,
    };
    // The world rolls with the bank; the HUD and the plane stay level.
    ctx.save();
    ctx.translate(W / 2, horizonY);
    ctx.rotate((-state.bank * Math.PI) / 180 * 0.45);
    ctx.translate(-W / 2, -horizonY);
    drawSky(state, horizonY);
    drawTerrain(world, cam);
    drawClouds(world, cam);
    drawLandmarks(world, cam);
    drawRings(world, cam);
    ctx.restore();

    if (state.camera === 'cockpit') drawCockpit(state, t);
    else drawPlane(state, t);

    if (screen !== SCREEN_TITLE) {
      drawHud(world, state, screen);
      if (state.camera !== 'cockpit') drawMinimap(world, state);
    }
    if (screen === SCREEN_TITLE) {
      drawHud(world, state, screen);
      drawTitle(world, state, best);
    } else if (screen === SCREEN_OVER) {
      drawOver(state, best);
    } else if (screen === SCREEN_PAUSED) {
      drawPaused();
    }
  }

  return { draw };
}
