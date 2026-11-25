/* Le Zinc de Marcelin — une seule scène WebGL (un seul canvas, un seul contexte) pour tout le site.
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
  const vichyTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3ead8'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(176,40,47,.55)';
    for (let i = 0; i < 4; i++) { g.fillRect(i * 64, 0, 32, h); }
    for (let i = 0; i < 4; i++) { g.fillRect(0, i * 64, w, 32); }
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - .5) * 14; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0);
  });
  vichyTex.wrapS = vichyTex.wrapT = THREE.RepeatWrapping; vichyTex.repeat.set(5, 5);
  const vichySide = vichyTex.clone(); vichySide.repeat.set(24, 1.4); vichySide.needsUpdate = true;

  /* ───────── Matériaux ───────── */
  const mat = {
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .1 }),
    inox: new THREE.MeshPhysicalMaterial({ color: 0xe4e7ea, metalness: 1, roughness: .18, side: THREE.DoubleSide }),
    brass: new THREE.MeshPhysicalMaterial({ color: 0xd8ad68, metalness: 1, roughness: .26 }),
    porcelain: new THREE.MeshPhysicalMaterial({ color: 0xfbf7ef, roughness: .22, clearcoat: .9, clearcoatRoughness: .1 }),
    cloth: new THREE.MeshStandardMaterial({ map: vichyTex, roughness: .95 }),
    clothSide: new THREE.MeshStandardMaterial({ map: vichySide, roughness: .95, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: .5 }),
    candle: new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: .6 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb347 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .02, transparent: true, opacity: .32, clearcoat: 1, envMapIntensity: 2, depthWrite: false }),
    wine: new THREE.MeshPhysicalMaterial({ color: 0x6d1420, roughness: .1, transparent: true, opacity: .9 }),
  };

  /* ───────── Modèles ───────── */
  function makeCloche() {
    const g = new THREE.Group();
    const pts = [new THREE.Vector2(1.02, 0)];
    for (let i = 0; i <= 28; i++) { const t = i / 28 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(.0001, Math.cos(t) * 1.0), .08 + Math.sin(t) * .8)); }
    const dome = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), mat.inox); g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.01, .035, 14, 72), mat.chrome); rim.rotation.x = Math.PI / 2; rim.position.y = .05; g.add(rim);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.045, .07, .1, 20), mat.chrome); stem.position.y = .9; g.add(stem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.11, 28, 20), mat.chrome); knob.position.y = 1.0; g.add(knob);
    return g;
  }
  function makePlate(r = 1.2) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .78, .07, 72), mat.porcelain); base.position.y = .035; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .62, .02, 10, 72), mat.brass); ring.rotation.x = Math.PI / 2; ring.position.y = .072; g.add(ring);
    return g;
  }
  function makeSetting() {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.27, .2, .035, 40), mat.porcelain); p.position.y = .02; g.add(p);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .008, 8, 40), mat.brass); ring.rotation.x = Math.PI / 2; ring.position.y = .04; g.add(ring);
    const fork = new THREE.Group();
    const fh = new THREE.Mesh(new THREE.BoxGeometry(.035, .012, .24), mat.chrome); fh.position.z = .06; fork.add(fh);
    for (let i = -1; i <= 1; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.008, .01, .12), mat.chrome); t.position.set(i * .014, 0, -.12); fork.add(t); }
    const fb = new THREE.Mesh(new THREE.BoxGeometry(.044, .01, .03), mat.chrome); fb.position.z = -.06; fork.add(fb);
    fork.position.set(-.36, .018, 0); g.add(fork);
    const knife = new THREE.Group();
    const kh = new THREE.Mesh(new THREE.BoxGeometry(.03, .014, .22), mat.wood); kh.position.z = .1; knife.add(kh);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(.034, .008, .24), mat.chrome); kb.position.z = -.12; knife.add(kb);
    knife.position.set(.36, .018, 0); g.add(knife);
    const gp = []; for (let i = 0; i <= 10; i++) { const t = i / 10; gp.push(new THREE.Vector2(i === 0 ? .0001 : .012 + (t < .15 ? .05 : t < .4 ? .016 : .06 * Math.sin((t - .4) / .6 * 1.6 + .5) + .02), t * .3)); }
    const goblet = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.0001, 0), new THREE.Vector2(.06, 0), new THREE.Vector2(.012, .01), new THREE.Vector2(.012, .12), new THREE.Vector2(.07, .17), new THREE.Vector2(.08, .27), new THREE.Vector2(.07, .31)], 28), mat.glass);
    goblet.position.set(.3, .0, .3); g.add(goblet);
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(.062, .035, .1, 20), mat.wine); wine.position.set(.3, .2, .3); g.add(wine);
    return g;
  }
  function makeTable() {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, .08, 72), [mat.clothSide, mat.cloth, mat.cloth]); g.add(top);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.82, .75, 72, 1, true), mat.clothSide); skirt.position.y = -.4; g.add(skirt);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 1.45, 24), mat.wood); ped.position.y = -1.45; g.add(ped);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.75, .8, .09, 40), mat.wood); base.position.y = -2.2; g.add(base);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .42, 20), mat.candle); candle.position.y = .25; g.add(candle);
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .05, 30), mat.brass); holder.position.y = .06; g.add(holder);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(.055, 14, 12), mat.flame); flame.scale.set(1, 1.9, 1); flame.position.y = .52; g.add(flame);
    const light = new THREE.PointLight(0xffb060, 0, 5); light.position.y = .8; g.add(light);
    const settings = []; for (let i = 0; i < 12; i++) { const s = makeSetting(); s.visible = false; g.add(s); settings.push({ m: s, a: 0, y: 2.6, sc: .01, on: false }); }
    g.userData = { flame, light, settings };
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
  // 1. Ouverture : la cloche se soulève sur le nom
  addView('intro', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .1, 100); cam.position.set(0, 1.4, 10); cam.lookAt(0, 0, 0);
    studio(scene, { key: 3.4, rim: 2.8, fill: .3, warm: 0xffe6c4 });
    const pl = new THREE.PointLight(0xffd9a0, 24, 14); pl.position.set(-2, 3, 5); scene.add(pl);
    const root = new THREE.Group(); scene.add(root);
    const plate = makePlate(1.18), cl = makeCloche(); root.add(plate, cl);
    return { scene, cam, update() {
      const T = S.intro.t;
      const halfH = Math.tan(M.degToRad(cam.fov / 2)) * cam.position.z, halfW = halfH * cam.aspect;
      const Rc = M.clamp(halfW * .5, 1.1, 2.4);
      root.scale.setScalar(Rc); root.position.set(0, -.41 * Rc - .1, 0);
      // arrivée (0 – 0,5 s), tremblement (0,5 – 1,0 s), levée (1,0 – 2,0 s), envol (2,0 – 2,7 s)
      const arr = eOut(T / .6);
      root.position.y -= (1 - arr) * 2.5; root.visible = T > .01;
      const sh = T > .55 && T < 1.0 ? Math.sin(T * 90) * .012 * (1 - Math.abs((T - .78) / .23)) : 0;
      const lift = eInOut((T - 1.0) / .95), fly = eIn((T - 2.0) / .7);
      cl.position.set(sh + lift * .35 + fly * 2.2, lift * 1.45 + fly * 5, lift * .4);
      cl.rotation.set(0, 0, -lift * .55 - fly * .9);
      plate.position.x = sh * .5;
      cl.visible = T < 2.8;
    } };
  });

  // 2. Réservation : la table se dresse, les couverts se posent
  addView('table', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 2.8, rim: 1.8, fill: .5, warm: 0xffe2b8 });
    const root = new THREE.Group(); scene.add(root);
    const tb = makeTable(); root.add(tb);
    const U = tb.userData;
    blob(scene, -2.3, 8, 8);
    const TOPY = .04;
    const target = (i, n) => Math.PI / 2 + i * Math.PI * 2 / n;
    let prevN = 0;
    return { scene, cam, update(t, dt) {
      const n = Math.round(S.table.n), rise = S.table.rise, done = S.table.done;
      // la table se dresse : elle monte du sol avec un petit rebond
      const r = RM ? 1 : eBack(rise);
      root.position.y = M.lerp(-3.2, 0, clamp01(r));
      root.scale.set(1, M.lerp(.25, 1, clamp01(r)), 1);
      root.visible = rise > .001;
      root.rotation.y = (RM ? 0 : (1 - clamp01(rise)) * 1.4 + Math.sin(t * .35) * .12) + eInOut(done) * Math.PI * 2;
      const ss = n <= 4 ? 1.9 : 1.9 * Math.pow(4 / n, .55), rS = 1.0;
      U.settings.forEach((s, i) => {
        const act = i < n && rise > .55, ta = target(i, n);
        if (act && !s.on) { s.on = true; s.a = ta; s.y = 2.6; s.sc = ss; if (RM) s.y = 0; }
        if (!act && s.on) { s.on = false; }
        const ty = act ? 0 : 2.8;
        if (RM) { s.y = ty; s.a = ta; s.sc = act ? ss : .01; }
        else {
          // chute avec rebond (ressort), glissement autour de la table, échelle
          s.vy = (s.vy || 0) + ((ty - s.y) * 90 - (s.vy || 0) * 9) * dt; s.y += s.vy * dt;
          if (act) { let da = ta - s.a; da = Math.atan2(Math.sin(da), Math.cos(da)); s.a += da * (1 - Math.exp(-dt * 7)); }
          s.sc += ((act ? ss : .01) - s.sc) * (1 - Math.exp(-dt * 8));
        }
        s.m.visible = act || s.y < 2.6;
        s.m.position.set(Math.cos(s.a) * rS, TOPY + Math.max(0, s.y), Math.sin(s.a) * rS);
        s.m.rotation.y = Math.atan2(-Math.cos(s.a), -Math.sin(s.a));
        s.m.scale.setScalar(Math.max(.01, s.sc));
      });
      prevN = n;
      const f = clamp01(done);
      U.flame.scale.set(f * (1 + Math.sin(t * 17) * .08), f * 1.9 * (1 + Math.sin(t * 13) * .1), f); U.flame.visible = f > .01;
      U.light.intensity = f * 5;
      const d = fitDist(2.7, cam);
      cam.position.set(0, d * .52, d * .86); cam.lookAt(0, -.35, 0);
    } };
  });

  function stateKey() { return S.table.n + '|' + S.table.rise.toFixed(2) + '|' + S.table.done.toFixed(2); }
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
