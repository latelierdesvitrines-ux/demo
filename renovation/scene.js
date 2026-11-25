/* Atelier Chaux-Vive — une seule scène WebGL (un seul canvas, un seul contexte) pour tout le site.
   Chaque « vue » est dessinée dans le rectangle de son élément [data-view], uniquement s'il est à l'écran.
   Modèles construits en code, sans fichier externe. */
const H = document.documentElement;
const S = window.SITE || (window.SITE = { intro: { t: 99 } });
const ready = () => dispatchEvent(new Event('site-scene'));

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

try {
  if (!hasWebGL()) throw new Error('webgl');
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');
  start(THREE, RoomEnvironment, RoundedBoxGeometry);
} catch (e) {
  H.classList.add('no-webgl');
  ready();
}

function start(THREE, RoomEnvironment, RoundedBoxGeometry) {
  const RM = H.classList.contains('rm');
  const MOBILE = matchMedia('(max-width: 980px)').matches;
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const M = THREE.MathUtils;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const eOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const eIn = (t) => Math.pow(clamp01(t), 3);
  const eInOut = (t) => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const eBack = (t) => { t = clamp01(t); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };


  /* ───────── Textures procédurales (canvas) ───────── */
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blobTex = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.5, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  /* ───────── Textures ───────── */
  const furTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c4573a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const x = rnd() * w, y = rnd() * h, l = 4 + rnd() * 10; g.strokeStyle = rnd() > .5 ? `rgba(255,170,130,${.08 + rnd() * .2})` : `rgba(70,20,10,${.08 + rnd() * .25})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 3, y + l); g.stroke(); }
  });
  furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping; furTex.repeat.set(3, 2);
  const noiseTex = canvasTex(256, 256, (g, w, h) => {
    const d = g.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = 90 + rnd() * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }, false);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.repeat.set(5, 3);
  const brickTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#7a6a5a'; g.fillRect(0, 0, w, h);
    const bh = 64, bw = 170;
    for (let r = 0; r * bh < h; r++) for (let c = -1; c * bw < w; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0) + 4, y = r * bh + 4, k = rnd();
      g.fillStyle = `rgb(${150 + k * 40 | 0},${70 + k * 30 | 0},${48 + k * 20 | 0})`; g.fillRect(x, y, bw - 8, bh - 8);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .12})`; g.fillRect(x + rnd() * bw, y + rnd() * bh, 3 + rnd() * 8, 2); }
    }
  });

  /* ───────── Matériaux ───────── */
  const mat = {
    fur: new THREE.MeshStandardMaterial({ map: furTex, roughness: 1, color: 0xffffff }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .1 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xdfe3e8, metalness: 1, roughness: .2, clearcoat: .2 }),
    grip: new THREE.MeshPhysicalMaterial({ color: 0x2e2a26, roughness: .45, clearcoat: .5 }),
    wood: new THREE.MeshPhysicalMaterial({ color: 0xb8814a, roughness: .5, clearcoat: .5 }),
    cap: new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: .5, metalness: .2 }),
    wall: new THREE.MeshStandardMaterial({ map: brickTex, roughness: .9 }),
    paintWall: new THREE.MeshStandardMaterial({ color: 0xeee6d6, roughness: .95, bumpMap: noiseTex, bumpScale: .5 }),
    paint: new THREE.MeshPhysicalMaterial({ color: 0x9c3f27, roughness: .5, clearcoat: .25, clearcoatRoughness: .5, bumpMap: noiseTex, bumpScale: .3 }),
  };
  const layerMats = [
    new THREE.MeshStandardMaterial({ color: 0x9b8f80, roughness: 1, bumpMap: noiseTex, bumpScale: 2.2 }),
    new THREE.MeshStandardMaterial({ color: 0xd8c9ac, roughness: .95, bumpMap: noiseTex, bumpScale: 1.2 }),
    new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: .9, bumpMap: noiseTex, bumpScale: .6 }),
    mat.paint,
  ];

  /* ───────── Modèles ───────── */
  const LEN = 1.6;
  function makeRoller() {
    const g = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, LEN, 56, 1), mat.fur); g.add(sleeve);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.2, .27, .08, 40), mat.cap); c.position.y = s * (LEN / 2 + .02); g.add(c); }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, LEN + .5, 16), mat.chrome); g.add(axle);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, LEN / 2 + .25, 0), new THREE.Vector3(0, LEN / 2 + .5, .02), new THREE.Vector3(.02, LEN / 2 + .62, .3), new THREE.Vector3(.1, LEN / 2 + .66, .7)]);
    const fr = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .032, 10), mat.chrome); g.add(fr);
    const dir = new THREE.Vector3(.5, .85, .35).normalize();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, 1.5, 20), mat.grip);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    grip.position.set(.1, LEN / 2 + .66, .7).addScaledVector(dir, .75); g.add(grip);
    g.userData = { sleeve };
    return g;
  }
  // Pose du rouleau : p de 0 à 3 = trois passages (gauche → droite, droite → gauche, gauche → droite).
  function rollerAt(rl, p, xl, xr, ys, z) {
    const b = Math.min(2, Math.floor(p)), u = p >= 3 ? 1 : p - b, dir = b % 2 === 0 ? 1 : -1;
    const x = dir > 0 ? M.lerp(xl, xr, u) : M.lerp(xr, xl, u);
    const y = b < 2 ? M.lerp(ys[b], ys[b + 1], sstep(.88, 1, u)) : ys[2];
    rl.position.set(x, y, z); rl.userData.sleeve.rotation.y = -x * 3.2;
    rl.rotation.z = -dir * .12 * (sstep(0, .1, u) - sstep(.9, 1, u));
    return { b, u, dir };
  }
  function makeTrowel() {
    const g = new THREE.Group();
    const sh = new THREE.Shape(); const w = .85, h = .34, r = .07;
    sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .025, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 2 }), mat.steel); g.add(blade);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, .02), new THREE.Vector3(0, 0, .2), new THREE.Vector3(0, 0, .34), new THREE.Vector3(.12, 0, .46)]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .028, 8), mat.chrome); g.add(neck);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.065, .075, .72, 20), mat.wood); grip.rotation.z = Math.PI / 2; grip.position.set(.28, 0, .5); g.add(grip);
    return g;
  }

  function studio(scene, { shadow = false, warm = 0xffe6c7, key = 3.2, rim = 2.2, fill = .5, size = 4 } = {}) {
    scene.environment = ENV; scene.environmentIntensity = .85;
    const k = new THREE.DirectionalLight(warm, key); k.position.set(-4, 7, 5); scene.add(k);
    if (shadow) {
      k.castShadow = true; k.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024); k.shadow.radius = 6; k.shadow.bias = -.0004; k.shadow.normalBias = .02;
      Object.assign(k.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: .5, far: 25 });
    }
    const r = new THREE.DirectionalLight(0xbcd2ff, rim); r.position.set(5, 3, -5); scene.add(r);
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a120a, fill));
    return k;
  }
  function ground(scene, y, opacity = .45, size = 14) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity }));
    p.rotation.x = -Math.PI / 2; p.position.y = y; p.receiveShadow = true; scene.add(p);
    return p;
  }
  function blob(scene, y, w, d) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    p.rotation.x = -Math.PI / 2; p.position.y = y; scene.add(p); return p;
  }
  const fitDist = (r, cam) => { const vf = M.degToRad(cam.fov) / 2, hf = Math.atan(Math.tan(vf) * cam.aspect); return r / Math.sin(Math.min(vf, hf)); };

  /* ───────── Vues ───────── */
  const views = [];
  const addView = (name, setup) => { const el = document.querySelector(`[data-view="${name}"]`); if (!el) return; const v = { el, ...setup() }; views.push(v); };
  /* ───────── Vues ───────── */
  // 1. Ouverture : le rouleau peint trois bandes
  addView('intro', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .1, 100); cam.position.set(0, 0, 10);
    studio(scene, { key: 3.6, rim: 1.4, fill: .7, warm: 0xfff0dc });
    const rl = makeRoller(); scene.add(rl);
    return { scene, cam, update() {
      const halfH = Math.tan(M.degToRad(cam.fov / 2)) * cam.position.z, halfW = halfH * cam.aspect;
      const p = S.paint ? S.paint.p : 0, bandH = halfH * 2 / 3;
      const s = (bandH * 1.04) / LEN;
      rl.scale.setScalar(s);
      rl.visible = S.intro.t > .15 && p < 3.0001 && !(p >= 3 && S.intro.t > 4.2);
      const ys = [halfH - bandH / 2, 0, -halfH + bandH / 2];
      const m = .5 * s;
      rollerAt(rl, p, -halfW - m, halfW + m, ys, .4);
      if (p >= 3) { rl.position.x += eIn((S.intro.t - 3.5) / .5) * (halfW + 3); }
      if (S.paint) S.paint.hw = halfW;
    } };
  });

  // 2. Méthode : la truelle pose quatre couches
  addView('trowel', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 2.4, rim: 1.4, fill: .5, warm: 0xfff0dc });
    const root = new THREE.Group(); scene.add(root);
    const W = 4.4, Hh = 2.7;
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, .3), mat.wall); root.add(base);
    const layers = layerMats.map((m, k) => { const geo = new THREE.BoxGeometry(W, Hh, .07); geo.translate(W / 2, 0, 0); const l = new THREE.Mesh(geo, m); l.position.set(-W / 2, 0, .15 + .037 + k * .072); l.scale.x = .0001; root.add(l); return l; });
    const tr = makeTrowel(); root.add(tr);
    blob(scene, -1.9, 7, 4);
    return { scene, cam, update(t) {
      const p = S.trowel.p, k = Math.min(3, Math.floor(p * 4)), u = p >= 1 ? 1 : p * 4 - k;
      layers.forEach((l, i) => { const f = i < k ? 1 : i === k ? sstep(0, .86, u) : 0; l.scale.x = Math.max(.0001, f); l.visible = f > .001; });
      const sweep = sstep(0, .86, u), back = sstep(.86, 1, u);
      const x = M.lerp(-W / 2 - .2, W / 2 + .1, sweep) * (1 - back) + (-W / 2 - .2) * back;
      const zig = Math.sin(sweep * Math.PI * 4.5) * .8 * (1 - back);
      tr.position.set(x + .4, zig, .15 + .1 + k * .072 + back * .5);
      tr.rotation.set(-.35, 0, Math.cos(sweep * Math.PI * 4.5) * .18);
      if (p >= 1) tr.position.set(W / 2 + .8, 0, .9);
      root.rotation.set(.1, -.5 + (RM ? 0 : Math.sin(t * .5) * .06), 0);
      root.position.set(0, .1, 0);
      cam.position.set(0, .6, fitDist(3.5, cam)); cam.lookAt(0, 0, 0);
    } };
  });

  // 3. Confirmation : le rouleau peint un mur terre cuite
  addView('wall', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 2.6, rim: 1.2, fill: .55, warm: 0xfff0dc });
    const W = 3.6, Hh = 2.1, bh = Hh / 3;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, .2), mat.paintWall); scene.add(panel);
    const slabs = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, bh, .05), mat.paint); m.position.set(0, Hh / 2 - bh / 2 - i * bh, .125); m.visible = false; scene.add(m); return m; });
    const rl = makeRoller(); const s = (bh * 1.05) / LEN; rl.scale.setScalar(s); scene.add(rl);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + .3, Hh + .3, .1), new THREE.MeshStandardMaterial({ color: 0x6d5a44, roughness: .6 })); frame.position.z = -.08; scene.add(frame);
    blob(scene, -1.6, 6, 3);
    return { scene, cam, update(t) {
      const p = RM ? 3 : S.wall.t * 3;
      const ys = [Hh / 2 - bh / 2, 0, -Hh / 2 + bh / 2], m = .4 * s;
      const st = rollerAt(rl, p, -W / 2 - m, W / 2 + m, ys, .36);
      rl.visible = p < 3;
      slabs.forEach((sl, i) => { let f = i < st.b ? 1 : i === st.b ? st.u : 0; if (p >= 3) f = 1; sl.visible = f > .002;
        const wdt = Math.max(.001, (W - .02) * f); sl.scale.x = wdt; const dirI = i % 2 === 0 ? 1 : -1; sl.position.x = dirI > 0 ? -W / 2 + .01 + wdt / 2 : W / 2 - .01 - wdt / 2; });
      scene.rotation.set(.08, RM ? -.15 : -.15 + Math.sin(t * .5) * .08, 0);
      cam.position.set(0, .3, fitDist(1.95, cam)); cam.lookAt(0, 0, 0);
    } };
  });

  function stateKey() { return S.trowel.p.toFixed(3) + '|' + S.wall.t.toFixed(2); }
  /* ───────── Boucle : on ne dessine que les vues visibles ───────── */
  let W = innerWidth, Hh = innerHeight, dirty = true, prev = performance.now(), firstFrame = true;
  const onResize = () => { W = innerWidth; Hh = innerHeight; renderer.setSize(W, Hh); dirty = true; };
  addEventListener('resize', onResize);
  let lastState = '';
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    const t = now / 1000;
    const vis = [];
    for (const v of views) {
      if (!v.el.isConnected) continue;
      if (S.intro.on && v.el.dataset.view !== 'intro') continue;
      const r = v.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > Hh || r.right < 0 || r.left > W) continue;
      vis.push([v, r]);
    }
    // En mouvement réduit : on redessine seulement si quelque chose a changé.
    const state = vis.map(([v, r]) => v.el.dataset.view + (r.top | 0) + ',' + (r.left | 0)).join('|') + stateKey();
    const busy = !RM || state !== lastState || dirty;
    lastState = state;
    if (!vis.length) { if (dirty || prevCount) { renderer.setScissorTest(false); renderer.clear(); } prevCount = 0; dirty = false; return; }
    if (!busy && !firstFrame) return;
    prevCount = vis.length; dirty = false;
    renderer.setScissorTest(false); renderer.clear();
    renderer.setScissorTest(true);
    for (const [v, r] of vis) {
      const x = Math.round(r.left), y = Math.round(Hh - r.bottom), w = Math.round(r.width), h = Math.round(r.height);
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      v.cam.aspect = w / h; v.cam.updateProjectionMatrix();
      v.update(t, dt);
      renderer.render(v.scene, v.cam);
    }
    if (firstFrame) { firstFrame = false; }
  }
  let prevCount = 0;
  // Préchauffage : un vrai rendu de chaque vue dans une petite cible hors écran (shaders compilés,
  // textures envoyées), pour qu'aucun à-coup ne tombe pendant l'ouverture.
  const t0 = performance.now();
  const rt = new THREE.WebGLRenderTarget(32, 32);
  renderer.setRenderTarget(rt);
  for (const v of views) {
    v.scene.traverse((o) => { o.visible = true; });
    v.cam.aspect = 1; v.cam.updateProjectionMatrix();
    renderer.render(v.scene, v.cam);
  }
  renderer.setRenderTarget(null); rt.dispose();
  window.__warm = Math.round(performance.now() - t0);
  requestAnimationFrame(frame);
  window.__scene = { renderer, views };
  ready();
}
