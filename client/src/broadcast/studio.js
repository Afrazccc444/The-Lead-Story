// The 3D newsroom: a robot anchor with The Lead Story logo on its chest,
// a news desk, a giant video wall showing the current story, side screens,
// studio lighting and TV-style camera shots — plus an opening-titles set.
import * as THREE from '../vendor/three.module.min.js';

const RED = '#d8382c';
const NAVY = '#0b1426';
const DISPLAY_FONT = '"Playfair Display Variable", "Playfair Display", Georgia, serif';
const SERIF_FONT = '"Source Serif 4 Variable", Georgia, serif';
const SANS_FONT = '"Inter Variable", Inter, "Segoe UI", Arial, sans-serif';

/* ── Canvas-texture helpers ───────────────────────────────────── */
function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

function drawLogoMark(ctx, x, y, size) {
  ctx.fillStyle = RED;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${size * 0.72}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('L', x + size / 2, y + size * 0.54);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

const imageCache = new Map();
function loadImage(url, onLoad) {
  if (!url) return null;
  let entry = imageCache.get(url);
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false, waiters: [] };
    img.onload = () => {
      entry.ready = true;
      entry.waiters.splice(0).forEach((fn) => fn());
    };
    img.src = url;
    imageCache.set(url, entry);
  }
  if (entry.ready) return entry.img;
  entry.waiters.push(onLoad);
  return null;
}

/* ── Shots ────────────────────────────────────────────────────── */
const SHOTS = {
  wide: { pos: [0, 2.25, 7.6], look: [0, 1.95, 0] },
  close: { pos: [0.22, 2.24, 4.35], look: [0, 1.98, 0.3] }, // head, shoulders and the desk edge
  angle: { pos: [3.7, 2.45, 5.1], look: [-0.25, 1.95, 0] },
  screen: { pos: [-2.4, 2.35, 4.7], look: [0.7, 2.35, -1.6] },
};

export function createStudio(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04070d');
  scene.fog = new THREE.Fog('#04070d', 13, 32);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 120);

  /* ── Reflections: a virtual ring of studio softboxes ───────── */
  // Rendered once into an environment map, so every glossy surface (robot
  // shell, desk, floor) reflects real-looking studio lights.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#04070d');
  const softbox = (color, strength, pos, size) => {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    box.position.set(...pos);
    box.lookAt(0, 1.8, 0);
    envScene.add(box);
  };
  softbox('#fff3e6', 9, [3.6, 5.6, 5.2], [4.2, 2.6]); // key softbox
  softbox('#d6e2ff', 3.2, [-5.2, 3.6, 3.4], [3, 3.2]); // fill
  softbox('#ffffff', 2.2, [0, 9, 1], [9, 6]); // ceiling grid
  softbox('#ff4636', 4.5, [0, 3, -6], [11, 0.7]); // red LED band behind
  softbox('#3f6fe0', 2.6, [6.5, 2.4, -2], [2, 4.5]); // blue side panel
  softbox('#3f6fe0', 2.6, [-6.5, 2.4, -2], [2, 4.5]);
  scene.environment = pmrem.fromScene(envScene, 0.035).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  /* ── Materials ─────────────────────────────────────────────── */
  // Lacquered robot shell, gunmetal joints, piano-black desk.
  const robotWhite = new THREE.MeshPhysicalMaterial({ color: '#eef1f5', metalness: 0.08, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 });
  const robotDark = new THREE.MeshPhysicalMaterial({ color: '#1a202c', metalness: 0.85, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const glowRed = new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 2.6 });
  const deskMat = new THREE.MeshPhysicalMaterial({ color: '#0d121c', metalness: 0.4, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0d121c', metalness: 0.6, roughness: 0.4 });

  /* ── Lights: key, fill, back/rim, top, plus practical lamps ── */
  scene.add(new THREE.HemisphereLight('#9fb6e6', '#120a08', 0.35));
  const key = new THREE.SpotLight('#fff1e2', 140, 24, 0.5, 0.75, 1.2);
  key.position.set(3.4, 6.4, 5.6);
  key.target.position.set(0, 2.1, 0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight('#c9d8ff', 45, 20, 0.7, 0.9, 1.3);
  fill.position.set(-4.8, 4.2, 4.6);
  fill.target.position.set(0, 2, 0);
  scene.add(fill, fill.target);
  const rim = new THREE.SpotLight('#ff4a3a', 75, 16, 0.6, 0.6, 1.1);
  rim.position.set(-1.2, 5, -2.6);
  rim.target.position.set(0, 2.2, 0.3);
  scene.add(rim, rim.target);
  const rim2 = new THREE.SpotLight('#6e9bff', 55, 16, 0.6, 0.6, 1.1);
  rim2.position.set(1.6, 5, -2.6);
  rim2.target.position.set(0, 2.2, 0.3);
  scene.add(rim2, rim2.target);
  const topLight = new THREE.SpotLight('#ffffff', 40, 12, 0.45, 0.8, 1.4);
  topLight.position.set(0, 7.5, 0.8);
  topLight.target.position.set(0, 1, 0.8);
  scene.add(topLight, topLight.target);

  // Soft glow sprites stand in for camera "bloom" around bright lights.
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const glow = (color, size, pos, opacity = 0.6) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(size, size, 1);
    sprite.position.set(...pos);
    scene.add(sprite);
    return sprite;
  };

  // Ceiling lamps with faint light beams through the studio haze.
  const beamTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0.0)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  })();
  for (const [x, z, color] of [
    [-3.2, 1.2, '#cfe0ff'],
    [0, 2.2, '#fff3e0'],
    [3.2, 1.2, '#cfe0ff'],
  ]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 24), frameMat);
    lamp.position.set(x, 6.3, z);
    scene.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), new THREE.MeshBasicMaterial({ color }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, 6.18, z);
    scene.add(lens);
    glow(color, 1.4, [x, 6.1, z], 0.5);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 6, 32, 1, true),
      new THREE.MeshBasicMaterial({ color, alphaMap: beamTex, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(x, 3.2, z);
    scene.add(beam);
  }

  /* ── Studio set ────────────────────────────────────────────── */
  const studio = new THREE.Group();
  scene.add(studio);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshPhysicalMaterial({ color: '#080b13', metalness: 0.5, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  studio.add(floor);

  const floorRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.68, 96), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.55 }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.set(0, 0.01, 0.6);
  studio.add(floorRing);

  // Giant video wall
  const screen = makeCanvas(1920, 1080);
  const wallMat = new THREE.MeshStandardMaterial({ map: screen.tex, emissive: '#ffffff', emissiveMap: screen.tex, emissiveIntensity: 0.85, roughness: 0.45 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.16), wallMat);
  wall.position.set(0, 2.85, -3.2);
  studio.add(wall);
  const wallFrame = new THREE.Mesh(new THREE.BoxGeometry(7.7, 4.46, 0.12), frameMat);
  wallFrame.position.set(0, 2.85, -3.28);
  studio.add(wallFrame);
  for (const x of [-3, -1.5, 0, 1.5, 3]) {
    glow('#ff5040', 1.1, [x, 0.6, -3.1], 0.35);
    glow('#ff5040', 1.1, [x, 5.1, -3.1], 0.35);
  }
  for (const y of [0.6, 5.1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.04, 0.04), glowRed);
    strip.position.set(0, y, -3.18);
    studio.add(strip);
  }

  // Side screens with the brand
  const side = makeCanvas(512, 1024);
  (() => {
    const { ctx } = side;
    const g = ctx.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0, '#0e1a33');
    g.addColorStop(1, '#05080f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 1024);
    ctx.strokeStyle = 'rgba(120,150,210,0.12)';
    for (let y = 0; y < 1024; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    drawLogoMark(ctx, 196, 120, 120);
    ctx.save();
    ctx.translate(256, 620);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `800 92px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('The Lead Story', 0, 30);
    ctx.restore();
    ctx.fillStyle = RED;
    ctx.fillRect(0, 990, 512, 34);
  })();
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 4.2),
      new THREE.MeshStandardMaterial({ map: side.tex, emissive: '#ffffff', emissiveMap: side.tex, emissiveIntensity: 0.55 }),
    );
    panel.position.set(s * 5.4, 2.6, -2.2);
    panel.rotation.y = -s * 0.5;
    studio.add(panel);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.2, 0.12), glowRed);
    pillar.position.set(s * 4.15, 2.6, -3.05);
    studio.add(pillar);
  }

  // Back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ color: '#070b14', roughness: 0.9 }));
  backWall.position.set(0, 6, -3.6);
  studio.add(backWall);

  // News desk
  const desk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.5), deskMat);
  top.position.set(0, 1.0, 0.85);
  top.castShadow = top.receiveShadow = true;
  desk.add(top);
  const deskFront = makeCanvas(2048, 512);
  (() => {
    const { ctx } = deskFront;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#16213a');
    g.addColorStop(1, '#070b14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2048, 512);
    ctx.fillStyle = RED;
    ctx.fillRect(0, 0, 2048, 18);
    drawLogoMark(ctx, 560, 150, 210);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 150px ${DISPLAY_FONT}`;
    ctx.fillText('The Lead Story', 820, 320);
    ctx.fillStyle = '#9fb0cc';
    ctx.font = `600 44px ${SANS_FONT}`;
    ctx.fillText('GLOBAL POLITICS · WEEKLY', 826, 400);
  })();
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.98, 0.1),
    [frameMat, frameMat, frameMat, frameMat, new THREE.MeshStandardMaterial({ map: deskFront.tex, emissive: '#ffffff', emissiveMap: deskFront.tex, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 }), frameMat],
  );
  front.position.set(0, 0.49, 1.58);
  front.castShadow = true;
  desk.add(front);
  const deskGlow = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.03, 0.03), glowRed);
  deskGlow.position.set(0, 1.07, 1.6);
  desk.add(deskGlow);
  // Props: papers, a microphone and a mug
  const paperMat = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.9 });
  for (const [x, r] of [
    [-0.75, 0.12],
    [-0.68, -0.06],
  ]) {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.006, 0.58), paperMat);
    paper.position.set(x, 1.066, 0.95);
    paper.rotation.y = r;
    paper.receiveShadow = true;
    desk.add(paper);
  }
  const micStand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 12), robotDark);
  micStand.position.set(0.42, 1.22, 1.0);
  micStand.rotation.x = -0.35;
  desk.add(micStand);
  const micHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.08, 6, 12), robotDark);
  micHead.position.set(0.42, 1.38, 0.94);
  micHead.rotation.x = -1.1;
  desk.add(micHead);
  const micLight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), glowRed);
  micLight.position.set(0.42, 1.38, 1.0);
  desk.add(micLight);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.13, 20), new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.4 }));
  mug.position.set(1.35, 1.13, 1.05);
  mug.castShadow = true;
  desk.add(mug);
  studio.add(desk);

  /* ── The robot anchor ──────────────────────────────────────── */
  const robot = new THREE.Group();
  robot.position.set(0, 0, 0.2);
  studio.add(robot);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 10, 28), robotWhite);
  torso.scale.set(1, 1, 0.78);
  torso.position.y = 1.52;
  torso.castShadow = true;
  robot.add(torso);

  // Chest emblem: The Lead Story logo
  const emblem = makeCanvas(256, 256);
  (() => {
    const { ctx } = emblem;
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 170px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('L', 128, 140);
  })();
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.15, 48), new THREE.MeshStandardMaterial({ map: emblem.tex, emissive: '#ffffff', emissiveMap: emblem.tex, emissiveIntensity: 0.35, transparent: true }));
  chest.position.set(0, 1.62, 0.346); // sits proud of the body so no edge sinks in
  robot.add(chest);
  const chestRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 10, 48), robotDark);
  chestRing.position.copy(chest.position);
  robot.add(chestRing);

  // Arms: a real joint chain (shoulder → elbow → wrist → hand) so the anchor
  // can gesture naturally. The rest pose puts both hands on the desk.
  const UPPER = 0.46;
  const FORE = 0.44;
  const arms = [-1, 1].map((s) => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 20), robotDark);
    ball.position.set(s * 0.53, 1.84, 0);
    ball.castShadow = true;
    robot.add(ball);

    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.56, 1.8, 0.02);
    robot.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, UPPER - 0.17, 10, 20), robotWhite);
    upper.position.y = -UPPER / 2;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -UPPER;
    shoulder.add(elbow);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.092, 20, 16), robotDark);
    elbow.add(elbowBall);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, FORE - 0.15, 10, 20), robotWhite);
    fore.position.y = -FORE / 2;
    fore.castShadow = true;
    elbow.add(fore);

    const wrist = new THREE.Group();
    wrist.position.y = -FORE;
    elbow.add(wrist);
    // Hand: palm, a block of fingers and a thumb
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.07, 6, 14), robotDark);
    palm.scale.set(1.25, 1, 0.55);
    palm.position.y = -0.08;
    palm.castShadow = true;
    wrist.add(palm);
    const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.07, 6, 12), robotDark);
    fingers.scale.set(1.3, 1, 0.5);
    fingers.position.set(0, -0.19, 0.01);
    fingers.rotation.x = 0.25;
    wrist.add(fingers);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.06, 6, 10), robotDark);
    thumb.position.set(-s * 0.075, -0.1, 0.03);
    thumb.rotation.z = -s * 0.7;
    wrist.add(thumb);

    return { s, shoulder, elbow, wrist, pose: { sx: 0, sy: 0, sz: 0, ex: 0, wx: 0 } };
  });

  // Rest pose (hands resting on the desk) and gesture offsets from it.
  const REST = (s) => ({ sx: -0.35, sy: -s * 0.3, sz: s * 0.16, ex: -0.87, wx: 0.32 });
  const GESTURES = {
    rest: () => ({}),
    // both palms lift and open towards the viewer
    open: () => ({ sx: -0.22, ex: -0.62, wx: -0.75, sz: 0.06 }),
    // right hand points forward to make a point
    point: (s) => (s > 0 ? { sx: -0.62, ex: -0.22, wx: -0.25, sy: 0.15 } : {}),
    // hands spread wide: "on the one hand… on the other"
    spread: (s) => ({ sz: s * 0.32, ex: -0.48, sx: -0.12, wx: -0.5 }),
    // left hand explains while the right rests
    explain: (s) => (s < 0 ? { sx: -0.32, ex: -0.62, sy: 0.22, wx: -0.45 } : {}),
    // right hand explains
    explainRight: (s) => (s > 0 ? { sx: -0.3, ex: -0.58, sy: -0.2, wx: -0.4 } : {}),
    // both hands come together in front: summing up
    together: (s) => ({ sx: -0.3, ex: -0.5, sy: s * 0.28, wx: -0.3 }),
  };
  arms.forEach((arm) => Object.assign(arm.pose, REST(arm.s)));
  let gesture = 'rest';
  let gestureUntil = 0;
  let nextAutoGesture = 0;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 20), robotDark);
  neck.position.y = 2.02;
  robot.add(neck);

  const head = new THREE.Group();
  head.position.y = 2.36;
  robot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 48, 32), robotWhite);
  skull.scale.set(1.12, 0.95, 1);
  skull.castShadow = true;
  head.add(skull);

  // Face screen: glowing eyes + a mouth that moves with the voice
  const face = makeCanvas(512, 256);
  const faceMat = new THREE.MeshStandardMaterial({ map: face.tex, emissive: '#ffffff', emissiveMap: face.tex, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.2, side: THREE.DoubleSide });
  const faceMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.368, 0.368, 0.3, 48, 1, true, -0.85, 1.7), faceMat);
  faceMesh.scale.set(1.12, 1, 1);
  faceMesh.position.y = -0.01;
  head.add(faceMesh);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 28), robotDark);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.41, 0, 0);
    head.add(ear);
    const earGlow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 32), glowRed);
    earGlow.rotation.y = Math.PI / 2;
    earGlow.position.set(s * 0.45, 0, 0);
    head.add(earGlow);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10), robotDark);
  antenna.position.set(0.12, 0.43, 0);
  head.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), glowRed.clone());
  antennaTip.position.set(0.12, 0.56, 0);
  head.add(antennaTip);

  let mouthLevel = 0;
  let blink = 0;
  let nextBlink = 2;
  function drawFace(t) {
    const { ctx } = face;
    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, 512, 256);
    // subtle scanlines
    ctx.fillStyle = 'rgba(80,140,255,0.05)';
    for (let y = 0; y < 256; y += 6) ctx.fillRect(0, y, 512, 2);
    // eyes
    const eyeH = Math.max(4, 46 * (1 - blink));
    ctx.shadowColor = '#7fd8ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#bff0ff';
    for (const x of [176, 336]) {
      ctx.beginPath();
      ctx.ellipse(x, 104, 30, eyeH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // mouth: an equaliser that follows the voice
    ctx.shadowColor = '#ff5a4a';
    ctx.fillStyle = '#ff7a6a';
    const bars = 9;
    for (let i = 0; i < bars; i++) {
      const centre = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
      const wobble = 0.55 + 0.45 * Math.sin(t * 22 + i * 1.7);
      const h = 6 + mouthLevel * 54 * (0.35 + 0.65 * centre) * wobble;
      ctx.fillRect(196 + i * 14, 188 - h / 2, 8, h);
    }
    ctx.shadowBlur = 0;
    face.tex.needsUpdate = true;
  }

  /* ── Opening-titles set (far from the studio) ──────────────── */
  const intro = new THREE.Group();
  intro.position.set(80, 2.5, 0);
  scene.add(intro);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(2.1, 36, 24), new THREE.MeshBasicMaterial({ color: '#4a6fae', wireframe: true, transparent: true, opacity: 0.45 }));
  intro.add(globe);
  const rings = [3, 3.5, 4.1].map((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018 + i * 0.006, 8, 160), i === 1 ? new THREE.MeshBasicMaterial({ color: '#ffffff' }) : new THREE.MeshBasicMaterial({ color: RED }));
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.45;
    intro.add(ring);
    return ring;
  });
  const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: emblem.tex, transparent: true }));
  intro.add(logoPlane);
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, () => (Math.random() - 0.5) * 60), 3),
    ),
    new THREE.PointsMaterial({ color: '#9fb4e0', size: 0.06 }),
  );
  intro.add(stars);

  /* ── Video-wall drawing ────────────────────────────────────── */
  let screenContent = { kicker: 'THE LEAD STORY', title: 'The Lead Story', body: 'A weekly briefing on global politics' };
  let meta = { issue: '', date: '' };
  function drawScreen() {
    const { ctx } = screen;
    const W = 1920;
    const H = 1080;
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#13213f');
    bg.addColorStop(1, NAVY);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // world-map style grid
    ctx.strokeStyle = 'rgba(140,170,230,0.08)';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // header bar
    ctx.fillStyle = RED;
    ctx.fillRect(0, 0, W, 110);
    drawLogoMark(ctx, 40, 18, 74);
    ctx.fillStyle = '#fff';
    ctx.font = `800 54px ${DISPLAY_FONT}`;
    ctx.fillText('The Lead Story', 136, 75);
    ctx.font = `700 34px ${SANS_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(screenContent.kicker ?? '').toUpperCase(), W - 50, 70);
    ctx.textAlign = 'left';

    // picture (if any)
    const img = loadImage(screenContent.image, drawScreen);
    let textX = 110;
    let textW = W - 220;
    if (img) {
      const boxW = 820;
      const boxH = 700;
      const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const sw = boxW / scale;
      const sh = boxH / scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(90, 190, boxW, boxH);
      ctx.clip();
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 90, 190, boxW, boxH);
      ctx.restore();
      ctx.strokeStyle = RED;
      ctx.lineWidth = 6;
      ctx.strokeRect(90, 190, boxW, boxH);
      textX = 980;
      textW = W - textX - 90;
    }

    // headline + text
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${img ? 74 : 92}px ${DISPLAY_FONT}`;
    const titleLines = wrapLines(ctx, screenContent.title, textW, 3);
    let y = 260;
    for (const line of titleLines) {
      ctx.fillText(line, textX, y);
      y += img ? 86 : 104;
    }
    ctx.fillStyle = RED;
    ctx.fillRect(textX, y - 20, 140, 8);
    y += 50;
    ctx.fillStyle = '#c9d4ea';
    ctx.font = `400 ${img ? 40 : 46}px ${SERIF_FONT}`;
    for (const line of wrapLines(ctx, screenContent.body, textW, img ? 7 : 6)) {
      ctx.fillText(line, textX, y);
      y += img ? 56 : 64;
    }

    // footer strip
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = '#9fb0cc';
    ctx.font = `600 32px ${SANS_FONT}`;
    ctx.fillText(`THE LEAD STORY  ·  ${meta.issue}  ·  ${meta.date}`.toUpperCase(), 50, H - 33);
    screen.tex.needsUpdate = true;
  }

  /* ── State & animation ─────────────────────────────────────── */
  let mode = 'studio';
  let introStart = 0;
  let shot = SHOTS.wide;
  let shotStart = 0;
  let talkSource = () => 0;
  const clock = new THREE.Clock();
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function frame() {
    const t = clock.getElapsedTime();

    const dt = Math.min(0.05, t - (frame.last ?? t));
    frame.last = t;

    // Robot life: breathing, blinking, head motion while talking
    const talk = talkSource();
    mouthLevel += (talk - mouthLevel) * 0.35;
    torso.scale.y = 1 + Math.sin(t * 1.6) * 0.008;

    // Gestures: while speaking, the anchor uses its hands every few seconds,
    // with small "beats" on emphasised words; at rest the hands sit on the desk.
    const speakingNow = talk > 0.05;
    if (speakingNow && t > gestureUntil && t > nextAutoGesture) {
      const pool = ['explain', 'explainRight', 'open', 'rest', 'together', 'explain', 'rest'];
      gesture = pool[Math.floor(Math.random() * pool.length)];
      gestureUntil = t + 1.6 + Math.random() * 1.8;
      nextAutoGesture = gestureUntil + 0.8 + Math.random() * 2.2;
    }
    if (t > gestureUntil) gesture = 'rest';
    const ease = 1 - Math.exp(-dt * 4.2); // smooth, slightly weighted motion
    const beat = speakingNow ? (talk - 0.35) * 0.16 : 0;
    for (const arm of arms) {
      const rest = REST(arm.s);
      const g = GESTURES[gesture]?.(arm.s) ?? {};
      const active = Object.keys(g).length > 0;
      const p = arm.pose;
      for (const k of ['sx', 'sy', 'sz', 'ex', 'wx']) {
        const target = rest[k] + (g[k] ?? 0) + (k === 'ex' && active ? -beat : 0);
        p[k] += (target - p[k]) * ease;
      }
      arm.shoulder.rotation.set(p.sx, p.sy, p.sz);
      arm.elbow.rotation.x = p.ex + Math.sin(t * 0.9 + arm.s) * 0.012; // never perfectly still
      arm.wrist.rotation.x = p.wx;
    }

    // Lean in slightly while speaking; turn the head towards the camera.
    robot.rotation.x += ((speakingNow ? 0.035 : 0) - robot.rotation.x) * ease;
    const towardsCamera = Math.max(-0.35, Math.min(0.35, Math.atan2(camera.position.x, camera.position.z - 0.2) * 0.6));
    head.rotation.y += (towardsCamera + Math.sin(t * 0.7) * 0.06 + Math.sin(t * 2.3) * 0.03 * mouthLevel - head.rotation.y) * ease;
    head.rotation.x = -0.05 + Math.sin(t * 1.9) * 0.03 * (0.3 + mouthLevel) - (gesture !== 'rest' ? 0.03 : 0);
    head.rotation.z = Math.sin(t * 0.5) * 0.025 + (gesture === 'spread' ? 0.04 : 0);
    if (t > nextBlink) {
      blink = Math.min(1, blink + 0.35);
      if (blink >= 1) nextBlink = t + 2 + Math.random() * 3.5;
    } else blink = Math.max(0, blink - 0.25);
    antennaTip.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 1.1;
    micLight.visible = Math.sin(t * 3) > -0.3;
    drawFace(t);
    floorRing.material.opacity = 0.4 + Math.sin(t * 1.3) * 0.15;

    if (mode === 'intro') {
      const it = t - introStart;
      rings.forEach((r, i) => {
        r.rotation.z = it * (0.4 + i * 0.25) * (i % 2 ? -1 : 1);
      });
      globe.rotation.y = it * 0.25;
      const p = Math.min(1, it / 7);
      const ease = 1 - (1 - p) ** 3;
      const radius = 16 - ease * 10.5;
      const angle = -1.2 + ease * 1.2;
      camera.position.set(intro.position.x + Math.sin(angle) * radius, intro.position.y + 1.6 - ease * 1.4, intro.position.z + Math.cos(angle) * radius);
      camera.lookAt(intro.position);
      logoPlane.lookAt(camera.position);
      logoPlane.scale.setScalar(0.3 + ease * 1.2);
    } else {
      // Slow dolly-in plus gentle hand-held sway within each shot
      const st = Math.min(1, (t - shotStart) / 10);
      tmpPos.set(...shot.pos);
      tmpLook.set(...shot.look);
      tmpPos.lerp(tmpLook, st * 0.06);
      tmpPos.x += Math.sin(t * 0.35) * 0.05;
      tmpPos.y += Math.sin(t * 0.5) * 0.025;
      camera.position.copy(tmpPos);
      camera.lookAt(tmpLook);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  drawScreen();
  document.fonts?.ready.then(() => {
    drawScreen();
  });

  let raf = requestAnimationFrame(frame);

  /* ── Video wall clips (editor-uploaded, silent, looping) ───── */
  let wallVideoEl = null;
  let wallVideoTex = null;
  function showWallVideo(url) {
    if (!url) {
      if (wallMat.map !== screen.tex) {
        wallMat.map = screen.tex;
        wallMat.emissiveMap = screen.tex;
        wallMat.needsUpdate = true;
      }
      wallVideoEl?.pause();
      return;
    }
    if (!wallVideoEl) {
      wallVideoEl = document.createElement('video');
      wallVideoEl.muted = true;
      wallVideoEl.loop = true;
      wallVideoEl.playsInline = true;
      wallVideoEl.preload = 'auto';
      wallVideoTex = new THREE.VideoTexture(wallVideoEl);
      wallVideoTex.colorSpace = THREE.SRGBColorSpace;
    }
    if (!wallVideoEl.src.endsWith(url)) wallVideoEl.src = url;
    wallVideoEl.play().catch(() => {});
    if (wallMat.map !== wallVideoTex) {
      wallMat.map = wallVideoTex;
      wallMat.emissiveMap = wallVideoTex;
      wallMat.needsUpdate = true;
    }
  }

  function setShot(name) {
    if (!SHOTS[name]) return;
    shot = SHOTS[name];
    shotStart = clock.getElapsedTime();
  }

  return {
    setMeta(next) {
      meta = { ...meta, ...next };
      drawScreen();
    },
    setScreen(content) {
      if (!content) return;
      screenContent = { ...content };
      showWallVideo(content.video);
      drawScreen();
    },
    setShot,
    /** Start a named gesture (open, point, spread, explain, together…) for a few seconds. */
    gesture(name, seconds = 2.2) {
      if (!GESTURES[name]) return;
      gesture = name;
      gestureUntil = clock.getElapsedTime() + seconds;
      nextAutoGesture = gestureUntil + 1.2;
    },
    setMode(next) {
      mode = next;
      if (next === 'intro') introStart = clock.getElapsedTime();
      if (next === 'studio') setShot('wide');
    },
    setTalkSource(fn) {
      talkSource = fn;
    },
    /** Pause/resume any clip on the video wall along with the broadcast. */
    setPaused(paused) {
      if (!wallVideoEl || wallMat.map !== wallVideoTex) return;
      if (paused) wallVideoEl.pause();
      else wallVideoEl.play().catch(() => {});
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (wallVideoEl) {
        wallVideoEl.pause();
        wallVideoEl.removeAttribute('src');
        wallVideoEl.load();
        wallVideoTex?.dispose();
      }
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        mats.forEach((m) => {
          m.map?.dispose?.();
          m.emissiveMap?.dispose?.();
          m.dispose?.();
        });
      });
      renderer.dispose();
    },
  };
}
