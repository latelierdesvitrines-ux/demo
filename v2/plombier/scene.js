/* Aquabrun — une seule scène WebGL (un seul canvas, un seul contexte) pour tout le site.
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
  /* ───────── Matériaux ───────── */
  const mat = {
    copper: new THREE.MeshPhysicalMaterial({ color: 0xdb8654, metalness: 1, roughness: .27, clearcoat: .35, clearcoatRoughness: .3 }),
    copperDark: new THREE.MeshPhysicalMaterial({ color: 0xa65b30, metalness: 1, roughness: .42 }),
    brass: new THREE.MeshPhysicalMaterial({ color: 0xdcb36c, metalness: 1, roughness: .24 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .08 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xdfe3e8, metalness: 1, roughness: .2, clearcoat: .25 }),
    steelDark: new THREE.MeshPhysicalMaterial({ color: 0x8a939b, metalness: 1, roughness: .4 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xd23a22, roughness: .32, clearcoat: .7, clearcoatRoughness: .2 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x72ccff, roughness: .04, metalness: 0, transparent: true, opacity: .86, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.6 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x2fa6ff, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .02, transparent: true, opacity: .14, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.2, depthWrite: false }),
    black: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: .6, metalness: .3 }),
  };
  const dialTex = canvasTex(1024, 1024, (g, w, h) => {
    const cx = w / 2, cy = h / 2, ang = (v) => (135 + 270 * v / 4) * Math.PI / 180;
    g.fillStyle = '#f5f2ea'; g.fillRect(0, 0, w, h);
    const rg = g.createRadialGradient(cx, cy, 100, cx, cy, 512); rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(1, 'rgba(120,110,90,.22)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    const arc = (a, b, col, r0, r1) => { g.beginPath(); g.arc(cx, cy, r1, ang(a), ang(b)); g.arc(cx, cy, r0, ang(b), ang(a), true); g.closePath(); g.fillStyle = col; g.fill(); };
    arc(2, 3, '#2f9e5a', 392, 436); arc(3, 3.5, '#e8a23a', 392, 436); arc(3.5, 4, '#d23a22', 392, 436);
    g.strokeStyle = '#1b1e22'; g.fillStyle = '#1b1e22'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= 40; i++) {
      const v = i / 10, a = ang(v), big = i % 10 === 0, mid = i % 5 === 0;
      g.lineWidth = big ? 9 : mid ? 6 : 3; const r0 = 440, r1 = big ? 340 : mid ? 372 : 395;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
      if (big) { g.font = '700 70px Arial, sans-serif'; g.fillText(String(i / 10), cx + Math.cos(a) * 275, cy + Math.sin(a) * 275); }
    }
    g.font = '700 54px Arial, sans-serif'; g.fillText('BAR', cx, cy + 185);
    g.font = '600 38px Arial, sans-serif'; g.fillStyle = '#6a7279'; g.fillText('A Q U A B R U N', cx, cy - 170);
  });
  dialTex.anisotropy = 8;

  /* ───────── Modèles ───────── */
  const R = .2; // rayon d'un tuyau
  function makePipe(len) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 48, 1), mat.copper); body.rotation.z = Math.PI / 2; g.add(body);
    for (const x of [len / 2 - .08, len / 2 - .42]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + .012, .028, 12, 48), mat.copperDark); ring.rotation.y = Math.PI / 2; ring.position.x = x; g.add(ring);
    }
    return g;
  }
  function hex(r, h, m) { const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), m); return x; }
  function makeCoupling() {
    const g = new THREE.Group();
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .72, 48), mat.brass); mid.rotation.z = Math.PI / 2; g.add(mid);
    for (const s of [-1, 1]) {
      const n = hex(.4, .3, mat.brass); n.rotation.z = Math.PI / 2; n.position.x = s * .48; g.add(n);
      const r = new THREE.Mesh(new THREE.TorusGeometry(.33, .035, 10, 48), mat.chrome); r.rotation.y = Math.PI / 2; r.position.x = s * .3; g.add(r);
    }
    return g;
  }
  function dropGeometry() {
    const p = [];
    for (let i = 0; i <= 14; i++) { const th = 2.2 * i / 14; p.push(new THREE.Vector2(Math.max(.0001, .4 * Math.sin(th)), -.1 - .4 * Math.cos(th))); }
    p.push(new THREE.Vector2(.2, .4), new THREE.Vector2(.1, .7), new THREE.Vector2(.03, .95), new THREE.Vector2(.0001, 1.05));
    return new THREE.LatheGeometry(p, 28);
  }
  const dropGeo = dropGeometry();

  function makeWrench() {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(-.62, .78); sh.lineTo(-.5, .98); sh.lineTo(-.31, .98); sh.lineTo(-.31, -.05); sh.lineTo(1.1, -.05); sh.lineTo(1.1, -.62);
    sh.lineTo(.27, -.8); sh.lineTo(.22, -3.2);
    sh.absarc(0, -3.2, .22, 0, -Math.PI, true);
    sh.lineTo(-.27, -.8); sh.lineTo(-.62, -.62); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, -3.18, .09, 0, Math.PI * 2, true); sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .3, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 5, curveSegments: 24 });
    geo.translate(0, 0, -.15);
    const body = new THREE.Mesh(geo, mat.steel); g.add(body);
    // mâchoire mobile
    const jaw = new THREE.Group();
    const js = new THREE.Shape(); js.moveTo(0, -.05); js.lineTo(0, .98); js.lineTo(.2, .98); js.lineTo(.3, .78); js.lineTo(.3, -.05); js.closePath();
    const jm = new THREE.Mesh(new THREE.ExtrudeGeometry(js, { depth: .3, bevelEnabled: true, bevelThickness: .045, bevelSize: .045, bevelSegments: 4 }), mat.steel); jm.position.set(0, 0, -.15); jaw.add(jm);
    g.add(jaw);
    // molette (vis sans fin)
    const wheel = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .12, 40), mat.chrome); disc.rotation.x = Math.PI / 2; wheel.add(disc);
    for (let i = 0; i < 18; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, .13), mat.chrome); const a = i / 18 * Math.PI * 2; k.position.set(Math.cos(a) * .27, Math.sin(a) * .27, 0); k.rotation.z = a; wheel.add(k); }
    wheel.position.set(.62, -.38, .24); g.add(wheel);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .3, 16), mat.chrome); axle.rotation.x = Math.PI / 2; axle.position.set(.62, -.38, .0); g.add(axle);
    g.userData = { jaw, wheel };
    return g;
  }
  function makeFitting() {
    const g = new THREE.Group();
    const bodyB = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .5, 48), mat.brass); bodyB.rotation.x = Math.PI / 2; bodyB.position.z = -.5; g.add(bodyB);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 2.2, 40), mat.copper); pipe.rotation.x = Math.PI / 2; pipe.position.z = -1.6; g.add(pipe);
    const nut = new THREE.Group();
    const nh = hex(.346, .36, mat.brass); nh.rotation.x = Math.PI / 2; nut.add(nh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.3, .025, 10, 40), mat.chrome); ring.position.z = .19; nut.add(ring);
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, 1.0, 40), mat.chrome); thread.rotation.x = Math.PI / 2; thread.position.z = .5; nut.add(thread);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .8, 40), mat.copper); tip.rotation.x = Math.PI / 2; tip.position.z = 1.1; nut.add(tip);
    g.add(nut); g.userData = { nut };
    return g;
  }
  function makeValve() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 2.8, 48), mat.brass); body.rotation.z = Math.PI / 2; g.add(body);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.78, 48, 32), mat.brass); bulb.scale.set(1, .92, 1); g.add(bulb);
    for (const s of [-1, 1]) {
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(.66, .66, .16, 48), mat.chrome); fl.rotation.z = Math.PI / 2; fl.position.x = s * 1.32; g.add(fl);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = hex(.07, .24, mat.steelDark); b.rotation.z = Math.PI / 2; b.position.set(s * 1.32, Math.cos(a) * .5, Math.sin(a) * .5); g.add(b); }
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.2, 40), mat.copper); pipe.rotation.z = Math.PI / 2; pipe.position.x = s * 1.98; g.add(pipe);
    }
    const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .62, 40), mat.brass); bonnet.position.y = .95; g.add(bonnet);
    const bn = hex(.44, .2, mat.brass); bn.position.y = 1.32; g.add(bn);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .9, 20), mat.chrome); stem.position.y = 1.7; g.add(stem);
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.66, .07, 16, 56), mat.red); rim.rotation.x = Math.PI / 2; wheel.add(rim);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.3, .07, .09), mat.red); sp.rotation.y = i / 3 * Math.PI; wheel.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .22, 24), mat.red); wheel.add(hub);
    const nutTop = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .1, 16), mat.chrome); nutTop.position.y = .15; wheel.add(nutTop);
    wheel.position.y = 2.15; g.add(wheel);
    g.userData = { wheel };
    return g;
  }
  function makeGauge() {
    const g = new THREE.Group();
    const dial = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ map: dialTex, roughness: .6 })); dial.position.z = .02; g.add(dial);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.04, .1, 24, 96), mat.chrome); bezel.position.z = .06; g.add(bezel);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, .34, 64), mat.brass); back.rotation.x = Math.PI / 2; back.position.z = -.18; g.add(back);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat.glass); glass.position.z = .14; g.add(glass);
    const needle = new THREE.Group();
    const nb = new THREE.Mesh(new THREE.BoxGeometry(.86, .045, .03), new THREE.MeshStandardMaterial({ color: 0xd23a22, roughness: .4 })); nb.position.x = .3; needle.add(nb);
    const nt = new THREE.Mesh(new THREE.ConeGeometry(.04, .14, 12), new THREE.MeshStandardMaterial({ color: 0xd23a22, roughness: .4 })); nt.rotation.z = -Math.PI / 2; nt.position.x = .78; needle.add(nt);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.28, .06, .03), new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: .5 })); tail.position.x = -.14; needle.add(tail);
    needle.position.z = .09; g.add(needle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .08, 24), mat.chrome); cap.rotation.x = Math.PI / 2; cap.position.z = .12; g.add(cap);
    // raccord laiton sous le manomètre
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .7, 32), mat.brass); st.position.y = -1.36; g.add(st);
    const hx = hex(.3, .26, mat.brass); hx.position.y = -1.6; g.add(hx);
    const th = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .5, 24), mat.chrome); th.position.y = -1.95; g.add(th);
    g.userData = { needle };
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
  const lookAtOrigin = (cam, d, el = .5, az = .5) => { cam.position.set(Math.sin(az) * d, el * d * .5, Math.cos(az) * d); cam.lookAt(0, 0, 0); };

  // 1. Ouverture : goutte, tuyaux, raccord, eau
  addView('intro', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .1, 100); cam.position.set(0, 0, 10);
    studio(scene, { key: 4.2, rim: 3.5, fill: .35, warm: 0xe6f3ff });
    const pl = new THREE.PointLight(0xbfe4ff, 28, 14); pl.position.set(0, 1.2, 4.5); scene.add(pl);
    const rig = new THREE.Group(); scene.add(rig);
    const PL = 9, pipeL = makePipe(PL), pipeR = makePipe(PL); pipeR.scale.x = -1; rig.add(pipeL, pipeR);
    const cpl = makeCoupling(); rig.add(cpl);
    const drop = new THREE.Mesh(dropGeo, mat.water); drop.scale.setScalar(.55); scene.add(drop);
    const bits = []; for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.085, 14, 10), mat.water); b.visible = false; scene.add(b); bits.push({ m: b, a: (i / 12) * Math.PI * 2 + rnd() * .4, v: .9 + rnd() * 1.1 }); }
    const ripple = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ripple.rotation.x = -1.15; scene.add(ripple);
    const flows = []; for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(R + .035, .035, 8, 40), mat.glow); f.rotation.y = Math.PI / 2; f.visible = false; rig.add(f); flows.push(f); }
    const YJ = -1.3;
    return { scene, cam, update() {
      const T = S.intro.t;
      const halfH = Math.tan(M.degToRad(cam.fov / 2)) * cam.position.z, halfW = halfH * cam.aspect;
      const s = M.clamp(halfW / 3.4, .6, 1.05);
      rig.scale.setScalar(s);
      const lift = -eIn((T - 4.1) / .65) * (halfH * 2 + 1);
      rig.position.set(0, YJ + lift, 0);
      // goutte
      const dEnd = YJ + .1;
      drop.visible = T > .12 && T < 1.1;
      if (drop.visible) { const k = eIn((T - .15) / .9); drop.position.set(0, M.lerp(halfH + 1.2, dEnd, k), 0.3); drop.scale.set(.5, .5 * (1 + .45 * k), .5); }
      // éclaboussure
      for (const b of bits) { const u = T - 1.08; b.m.visible = u > 0 && u < .9;
        if (b.m.visible) { b.m.position.set(Math.cos(b.a) * b.v * u * .95, dEnd + b.v * 1.8 * u - 3.4 * u * u, Math.sin(b.a) * .4); b.m.scale.setScalar(1 - u * .8); } }
      const ru = (T - 1.08) / .9; ripple.visible = ru > 0 && ru < 1;
      if (ripple.visible) { ripple.position.set(0, dEnd - .05, .3); ripple.scale.setScalar(.2 + ru * 2.4); ripple.material.opacity = (1 - ru) * .8; }
      // tuyaux : arrivent des deux côtés et se raccordent à 2,0 s
      const ext = halfW / s + PL / 2 + .6, fin = PL / 2 + .5;
      const a = eInOut((T - .85) / 1.15);
      pipeL.visible = pipeR.visible = T > .8;
      pipeL.position.x = -M.lerp(ext, fin, a); pipeR.position.x = M.lerp(ext, fin, a);
      const clank = T > 2.0 && T < 2.18 ? Math.sin(T * 160) * .02 : 0;
      pipeL.position.y = pipeR.position.y = clank;
      // raccord : glisse puis se visse
      cpl.visible = T > 1.7;
      const sl = eInOut((T - 2.0) / .55), sc = eInOut((T - 2.6) / .7);
      cpl.position.x = M.lerp(-halfW / s * .55 - 1.5, 0, sl) ;
      if (T < 2.0) cpl.position.x = M.lerp(-halfW / s - 2, -halfW / s * .55 - 1.5, eOut((T - 1.7) / .3));
      cpl.rotation.x = sc * Math.PI * 4 + sl * .6;
      cpl.scale.setScalar(1 + (T > 2.0 ? Math.sin(sl * Math.PI) * .03 : 0));
      // l'eau passe : bagues lumineuses qui courent vers le centre
      flows.forEach((f, i) => { const u = (T - 3.0 - (i >> 1) * .14) / .75; const side = i % 2 ? 1 : -1;
        f.visible = u > 0 && u < 1;
        if (f.visible) { f.position.x = side * M.lerp(halfW / s + .4, .3, eInOut(u)); f.scale.setScalar(1 + Math.sin(u * Math.PI) * .12); } });
      pl.intensity = 28 + (T > 3.0 && T < 3.9 ? Math.sin((T - 3.0) / .9 * Math.PI) * 25 : 0);
    } };
  });

  // 2. Urgence : clé à molette sur un raccord
  addView('wrench', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 100);
    studio(scene, { shadow: false, key: 3.4, rim: 2.6, fill: .45, warm: 0xe8f3ff });
    const root = new THREE.Group(); scene.add(root);
    const fit = makeFitting(), wr = makeWrench(), wp = new THREE.Group(); wr.position.y = -.5; wp.add(wr); fit.position.y = 0; root.add(fit, wp);
    blob(scene, -2.6, 8, 5);
    return { scene, cam, update(t) {
      const p = S.wrench.p;
      const open = .5 * (1 - sstep(0, .22, p));
      wr.userData.jaw.position.x = .31 + open;
      wr.userData.wheel.rotation.z = -open * 14;
      const turn = sstep(.22, 1, p);
      wp.rotation.z = M.lerp(2.09, .52, turn);
      fit.userData.nut.rotation.z = -turn * Math.PI / 2;
      fit.userData.nut.position.z = turn * .1;
      root.position.set(-1.2, .2, 0);
      const idle = RM ? 0 : Math.sin(t * .6) * .1;
      root.rotation.set(.12, -.22 + idle + turn * .12, 0);
      lookAtOrigin(cam, fitDist(3.0, cam), .2, .02);
    } };
  });

  // 3. Prestations : vanne dont le volant tourne, le débit coule
  addView('valve', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 3.4, rim: 2.8, fill: .5, warm: 0xe8f3ff });
    const v = makeValve(); scene.add(v);
    const jets = []; for (let i = 0; i < 56; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.058, 10, 8), mat.water); b.visible = false; scene.add(b); jets.push(b); }
    blob(scene, -1.1, 6, 3.4);
    const st = { ang: 0, vel: 0, flow: .6 };
    return { scene, cam, update(t, dt) {
      const tgt = S.valve.i * 1.4;
      if (RM) { st.ang = tgt; st.vel = 0; } else { st.vel += ((tgt - st.ang) * 38 - st.vel * 8) * dt; st.ang += st.vel * dt; }
      v.userData.wheel.rotation.y = st.ang;
      const ft = Math.abs(st.vel) > .35 ? 1 : .6; st.flow += (ft - st.flow) * Math.min(1, dt * 4);
      const rot = RM ? 0 : Math.sin(t * .5) * .28 + .15;
      v.rotation.y = -.55 + rot; v.position.set(-.55, -.1, 0);
      v.updateMatrixWorld();
      jets.forEach((b, i) => {
        const tau = (((t * .8 + i / jets.length) % 1)) * 1.15;
        b.visible = true;
        const lp = new THREE.Vector3(2.55 + 1.05 * tau, -.02 - 2.9 * tau * tau, 0);
        b.position.copy(lp); v.localToWorld(b.position);
        b.scale.set(st.flow * (1 + tau * .4), st.flow * (1.3 - tau * .3), st.flow);
      });
      lookAtOrigin(cam, fitDist(3.3, cam) , .45, .02);
      cam.position.y += .5; cam.lookAt(0, .45, 0);
    } };
  });

  // 4. Devis : manomètre à aiguille amortie
  addView('gauge', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 3.2, rim: 2.4, fill: .5, warm: 0xfff4e6 });
    const g = makeGauge(); scene.add(g);
    blob(scene, -2.3, 4, 3);
    return { scene, cam, update(t, dt) {
      const gs = S.gauge;
      if (RM) { gs.val = gs.target; gs.vel = 0; } else { gs.vel += ((gs.target - gs.val) * 70 - gs.vel * 7.5) * dt; gs.val += gs.vel * dt; }
      g.userData.needle.rotation.z = -(135 + 270 * gs.val / 4) * Math.PI / 180;
      g.rotation.set(-.05, (RM ? 0 : Math.sin(t * .6) * .22) + .18, 0);
      g.position.y = .2;
      cam.position.set(0, .1, fitDist(1.9, cam)); cam.lookAt(0, -.05, 0);
    } };
  });

  // 5. Confirmation : une goutte tombe dans l'eau et fait des ronds
  addView('splash', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 3.4, rim: 3, fill: .4, warm: 0xe8f3ff });
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, .3, 64), new THREE.MeshPhysicalMaterial({ color: 0x0f5fa8, roughness: .1, transparent: true, opacity: .96, clearcoat: 1, envMapIntensity: .55 }));
    pool.position.y = -.35; scene.add(pool);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.22, .09, 16, 80), mat.copper); rim.rotation.x = Math.PI / 2; rim.position.y = -.2; scene.add(rim);
    const rings = []; for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 80), new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = -.19; scene.add(r); rings.push(r); }
    const drop = new THREE.Mesh(dropGeo, mat.water); drop.scale.setScalar(.6); scene.add(drop);
    const crown = []; for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), mat.water); b.visible = false; scene.add(b); crown.push({ m: b, a: i / 14 * Math.PI * 2, v: .8 + (i % 3) * .35 }); }
    return { scene, cam, t1: 0, update(t) {
      // après la chute, la goutte retombe doucement en boucle
      if (S.splash.t >= 1 && !this.t1) this.t1 = t;
      if (S.splash.t < 1) this.t1 = 0;
      const T = RM ? 1.9 : S.splash.t < 1 ? S.splash.t * 2.6 : ((t - this.t1) % 3.6);
      drop.visible = T < .7;
      if (drop.visible) { const k = eIn(T / .7); drop.position.set(0, M.lerp(3.2, -.15, k), 0); drop.scale.set(.55, .55 * (1 + .4 * k), .55); }
      for (const c of crown) { const u = T - .7; c.m.visible = u > 0 && u < 1.1;
        if (c.m.visible) { c.m.position.set(Math.cos(c.a) * c.v * u * .8, -.15 + c.v * 2.2 * u - 4.2 * u * u, Math.sin(c.a) * c.v * u * .8); c.m.scale.setScalar(Math.max(.01, 1 - u * .6)); } }
      rings.forEach((r, i) => { const u = (T - .7 - i * .28) / 1.5; r.visible = u > 0 && u < 1; if (r.visible) { r.scale.setScalar(.15 + eOut(u) * 2.0); r.material.opacity = (1 - u) * .8; } });
      scene.rotation.y = RM ? 0 : Math.sin(t * .4) * .15;
      cam.position.set(0, fitDist(2.4, cam) * .42, fitDist(2.4, cam) * .9); cam.lookAt(0, .5, 0);
    } };
  });

  function stateKey() { return S.wrench.p.toFixed(3) + '|' + S.valve.i + '|' + S.gauge.target + '|' + S.splash.t.toFixed(2); }
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
