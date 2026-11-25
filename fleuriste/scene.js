/* Maison Brindelune — une seule scène WebGL (un seul canvas, un seul contexte) pour tout le site.
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
  const wickerTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a5f35'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) {
      const x = c * 32 + (r % 2 ? 16 : 0), y = r * 16, k = rnd() * 30;
      g.fillStyle = `rgb(${176 + k | 0},${128 + k | 0},${78 + k * .6 | 0})`; g.fillRect(x + 1, y + 1, 30, 14);
      g.fillStyle = 'rgba(60,35,15,.35)'; g.fillRect(x + 1, y + 12, 30, 3);
    }
  });
  wickerTex.wrapS = wickerTex.wrapT = THREE.RepeatWrapping; wickerTex.repeat.set(3, 1.2);
  const kraftTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9a577'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.strokeStyle = `rgba(${rnd() > .5 ? '255,235,200' : '90,60,30'},${.05 + rnd() * .08})`; g.lineWidth = 1; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + rnd() * 40 - 20, y + rnd() * 6 - 3); g.stroke(); }
  });

  /* ───────── Matériaux ───────── */
  const mat = {
    green: new THREE.MeshStandardMaterial({ color: 0x5f8a58, roughness: .6, side: THREE.DoubleSide }),
    stem: new THREE.MeshStandardMaterial({ color: 0x55803f, roughness: .55 }),
    kraft: new THREE.MeshStandardMaterial({ map: kraftTex, roughness: .9, side: THREE.DoubleSide }),
    wicker: new THREE.MeshStandardMaterial({ map: wickerTex, roughness: .85, side: THREE.DoubleSide }),
    wickerDark: new THREE.MeshStandardMaterial({ color: 0x6d4a28, roughness: .8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf2b73a, roughness: .5 }),
    brown: new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: .8 }),
    ribbon: new THREE.MeshPhysicalMaterial({ color: 0xc2506b, roughness: .35, sheen: 1, sheenColor: new THREE.Color(0xffc0d0), side: THREE.DoubleSide }),
    pet: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .55, sheen: .8, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }),
  };
  const PINKS = [0xf4a3ba, 0xea7f9f, 0xf8c7d4, 0xfbe1e8, 0xd9567b, 0xfff2f4, 0xf3b88a];

  /* ───────── Modèles ───────── */
  // Pétale : base étroite, pointe douce, léger creux. Étend de y=0 à y=l.
  function petalGeometry(w, l) {
    const g = new THREE.PlaneGeometry(1, 1, 4, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = p.getY(i) + .5, wp = Math.pow(Math.sin(Math.PI * Math.pow(t, .75)), .65);
      const xx = x * w * wp;
      p.setXYZ(i, xx, t * l, xx * xx * 2.4 / Math.max(.3, w) + t * t * .14 * l);
    }
    g.computeVertexNormals();
    return g;
  }
  const KINDS = {
    rose: { rings: [{ n: 5, w: .52, l: .5, t: .35 }, { n: 7, w: .56, l: .6, t: .62 }, { n: 9, w: .6, l: .7, t: .95 }, { n: 11, w: .64, l: .8, t: 1.3 }], center: 0xf0b84a, r: .1 },
    daisy: { rings: [{ n: 16, w: .2, l: .85, t: 1.38 }, { n: 14, w: .2, l: .78, t: 1.46 }], center: 0xf0b030, r: .27, disc: true },
    lily: { rings: [{ n: 3, w: .62, l: 1.15, t: .85 }, { n: 3, w: .55, l: 1.05, t: 1.15 }], center: 0xe38a2a, r: .06, stamens: true },
  };
  const geoCache = {};
  const gGeo = (w, l) => geoCache[w + '_' + l] || (geoCache[w + '_' + l] = petalGeometry(w, l));
  function makeFlower(kind, color = 0xf4a3ba) {
    const K = KINDS[kind], g = new THREE.Group(), rings = [];
    K.rings.forEach((rg, ri) => {
      const m = new THREE.MeshPhysicalMaterial({ roughness: .55, sheen: .8, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
      const pivots = [];
      for (let k = 0; k < rg.n; k++) {
        const pv = new THREE.Group(); pv.rotation.y = k / rg.n * Math.PI * 2 + ri * .55;
        const pe = new THREE.Mesh(gGeo(rg.w, rg.l), m); pv.add(pe); g.add(pv); pivots.push(pe);
      }
      rings.push({ rg, m, pivots });
    });
    const cen = new THREE.Mesh(K.disc ? new THREE.CylinderGeometry(K.r, K.r * .9, .09, 32) : new THREE.SphereGeometry(K.r, 20, 14), new THREE.MeshStandardMaterial({ color: K.center, roughness: .7 }));
    cen.position.y = K.disc ? .05 : .08; g.add(cen);
    if (K.stamens) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const s = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .7, 6), mat.green); s.position.set(Math.cos(a) * .12, .35, Math.sin(a) * .12); s.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); g.add(s); const an = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc2561f })); an.position.set(Math.cos(a) * .2, .69, Math.sin(a) * .2); g.add(an); }
    const base = new THREE.Color(color);
    const api = { g, cen,
      setOpen(o) { rings.forEach((r, ri) => { const oo = sstep(ri * .06, .75 + ri * .06, o); r.pivots.forEach((pe, k) => { pe.rotation.x = M.lerp(.04, r.rg.t, oo) + Math.sin(k * 2.1 + ri) * .05 * oo; }); }); },
      setColor(c) { base.set(c); rings.forEach((r, ri) => { r.m.color.copy(base).lerp(new THREE.Color(0xffffff), kind === 'daisy' ? .08 : kind === 'lily' ? .1 : .14 - ri * .03); }); } };
    api.setColor(color); api.setOpen(1);
    return api;
  }
  function stemTube(pts, r = .03) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8), mat.stem); }
  function leaf(s = 1) { const m = new THREE.Mesh(gGeo(.55, 1), mat.green); m.scale.setScalar(s); return m; }

  function makeBasket() {
    const g = new THREE.Group();
    const pts = [new THREE.Vector2(.001, 0), new THREE.Vector2(.7, 0), new THREE.Vector2(.95, .06), new THREE.Vector2(1.3, .6), new THREE.Vector2(1.5, 1.02), new THREE.Vector2(1.46, 1.06), new THREE.Vector2(1.28, .62), new THREE.Vector2(.9, .12), new THREE.Vector2(.001, .1)];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat.wicker); g.add(bowl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.48, .05, 10, 56), mat.wickerDark); rim.rotation.x = Math.PI / 2; rim.position.y = 1.04; g.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.45, .05, 10, 56, Math.PI), mat.wickerDark); handle.position.y = 1.04; g.add(handle);
    return g;
  }
  function makeParcel() {
    const g = new THREE.Group(), W = 1.8, Hh = 1.1, D = 1.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), mat.kraft); g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(W + .08, .16, D + .08), mat.kraft); lid.position.y = Hh / 2 - .02; g.add(lid);
    const segs = [];
    const seg = (ax, sign, len, p0, cs, win) => { const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(.5, 0, 0); const m = new THREE.Mesh(geo, mat.ribbon); m.position.copy(p0); if (ax === 'y') m.rotation.z = sign * Math.PI / 2; else if (ax === 'z') m.rotation.y = -sign * Math.PI / 2; else if (sign < 0) m.rotation.y = Math.PI; m.userData = { len, cs, win }; g.add(m); segs.push(m); };
    const T = .035, Wd = .24, top = Hh / 2 + .075;
    // bande 1 : face avant, dessus, face arrière
    seg('y', 1, Hh + .08, new THREE.Vector3(0, -Hh / 2 - .04, D / 2 + .045), [Wd, T], [0, .1]);
    seg('z', -1, D + .1, new THREE.Vector3(0, top + .01, D / 2 + .05), [T, Wd], [.1, .25]);
    seg('y', -1, Hh + .08, new THREE.Vector3(0, Hh / 2 + .04, -D / 2 - .045), [Wd, T], [.25, .35]);
    // bande 2 : face gauche, dessus, face droite
    seg('y', 1, Hh + .08, new THREE.Vector3(-W / 2 - .045, -Hh / 2 - .04, 0), [T, Wd], [.3, .4]);
    seg('x', 1, W + .1, new THREE.Vector3(-W / 2 - .05, top + .04, 0), [T, Wd], [.4, .55]);
    seg('y', -1, Hh + .08, new THREE.Vector3(W / 2 + .045, Hh / 2 + .04, 0), [T, Wd], [.55, .65]);
    const bow = new THREE.Group(); bow.position.set(0, top + .08, 0);
    for (const s of [-1, 1]) { const lp = new THREE.Mesh(new THREE.TorusGeometry(.2, .05, 10, 28), mat.ribbon); lp.scale.set(1, 1.3, .55); lp.rotation.set(Math.PI / 2 - .35, 0, 0); lp.position.set(s * .27, 0, 0); lp.rotation.z = s * .5; bow.add(lp); const tl = new THREE.Mesh(new THREE.BoxGeometry(.13, .02, .5), mat.ribbon); tl.position.set(s * .15, -.03, .28); tl.rotation.y = s * .45; bow.add(tl); }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), mat.ribbon); bow.add(knot); g.add(bow);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(.4, .26, .015), new THREE.MeshStandardMaterial({ color: 0xfff6ee, roughness: .8 })); tag.position.set(.35, top + .12, .3); tag.rotation.set(-1.2, 0, .3); g.add(tag);
    g.userData = { segs, bow, tag };
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
  // 1. Ouverture : le bouquet éclot, les pétales dessinent le nom
  addView('intro', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .1, 100); cam.position.set(0, 0, 10);
    studio(scene, { key: 3.2, rim: 1.4, fill: .8, warm: 0xfff0e6 });
    const rig = new THREE.Group(); scene.add(rig);
    const cfg = [[-.62, .35, .28, 'rose', 0xf4a3ba, .5], [.05, .72, -.05, 'rose', 0xfbe1e8, .56], [.68, .28, -.3, 'rose', 0xea7f9f, .5]];
    const fl = cfg.map(([x, y, rz, kind, col, s], i) => {
      const f = makeFlower(kind, col); f.g.scale.setScalar(s * 1.3); f.g.position.set(x, y, 0); f.g.rotation.set(.95, 0, rz); rig.add(f.g); f.setOpen(0);
      const st = stemTube([new THREE.Vector3(x, y - .05, 0), new THREE.Vector3(x * .6, y - .8, 0), new THREE.Vector3(x * .15, -1.6, 0)], .035); rig.add(st);
      const lf = leaf(.7); lf.position.set(x * .7, y - .55, .05); lf.rotation.set(0, 0, x > 0 ? -1.1 : 1.1); rig.add(lf);
      return f;
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.95, 1.9, 36, 1, true), mat.kraft); cone.rotation.x = Math.PI; cone.position.y = -1.55; rig.add(cone);
    const rb = new THREE.Mesh(new THREE.TorusGeometry(.5, .045, 8, 32), mat.ribbon); rb.rotation.x = Math.PI / 2; rb.position.y = -1.2; rig.add(rb);
    // pétales qui formeront le nom
    const NMAX = MOBILE ? 460 : 900;
    const geo = petalGeometry(.6, 1);
    const inst = new THREE.InstancedMesh(geo, mat.pet, NMAX); inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false; scene.add(inst);
    const col = new THREE.Color(); for (let i = 0; i < NMAX; i++) { col.setHex(PINKS[i % PINKS.length]); inst.setColorAt(i, col); }
    let tg = null, N = 0;
    const dummy = new THREE.Object3D(), heads = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], p0 = new THREE.Vector3(), c = new THREE.Vector3();
    function sampleText(halfW, halfH) {
      const el = document.querySelector('.it-l2'); if (!el) return;
      const r = el.getBoundingClientRect(), txt = el.textContent.trim();
      const fs = 260, cv = document.createElement('canvas'), g = cv.getContext('2d');
      g.font = `500 ${fs}px "Cormorant Variable", Georgia, serif`; const mw = Math.ceil(g.measureText(txt).width) + 40;
      cv.width = mw; cv.height = Math.ceil(fs * 1.1); g.font = `500 ${fs}px "Cormorant Variable", Georgia, serif`; g.textBaseline = 'alphabetic'; g.fillStyle = '#000'; g.fillText(txt, 20, fs * .82);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      const wpx = r.width * (mw - 40) / (mw - 40), k = (r.width / (mw - 40)) / innerWidth * 2 * halfW;
      let area = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 128) area++;
      const step = Math.max(6, Math.round(Math.sqrt(area * 4 / NMAX)));
      const pts = [];
      for (let y = 0; y < cv.height; y += step) for (let x = 0; x < cv.width; x += step) if (d[(y * cv.width + x) * 4 + 3] > 128) pts.push([x, y]);
      while (pts.length > NMAX) pts.splice((rnd() * pts.length) | 0, 1);
      // centre de l'élément HTML en unités monde
      const cx = (r.left + r.width / 2 - innerWidth / 2) / innerWidth * 2 * halfW, cy = (innerHeight / 2 - (r.top + r.height * .52)) / innerHeight * 2 * halfH;
      const baseX = 20 + (mw - 40) / 2, baseY = fs * .82 - fs * .3;
      tg = pts.map(([x, y]) => ({ x: cx + (x - baseX) * k + (rnd() - .5) * step * k * .6, y: cy - (y - baseY) * k + (rnd() - .5) * step * k * .6, a: rnd() * 6.28, h: (rnd() * 3) | 0, t0: 1.9 + rnd() * .7, dur: .8 + rnd() * .4, sp: [rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4], up: 1.2 + rnd() * 2.6, sx: (rnd() - .5) * 2.2, s: step * k * 2.7 * (.8 + rnd() * .5) }));
      N = tg.length;
    }
    return { scene, cam, update() {
      const T = S.intro.t;
      const halfH = Math.tan(M.degToRad(cam.fov / 2)) * cam.position.z, halfW = halfH * cam.aspect;
      const s = M.clamp(halfW / 3.4, .62, 1.2);
      rig.scale.setScalar(s);
      const rise = eOut((T - .1) / .9), sink = eIn((T - 4.0) / .7);
      rig.position.set(0, M.lerp(-halfH - 2.5, -halfH * .42, rise) - sink * 5, 0);
      rig.rotation.y = Math.sin(T * 1.2) * .08;
      const o = sstep(.95, 1.95, T);
      fl.forEach((f, i) => { f.setOpen(sstep(i * .08, 1, o)); });
      rig.updateMatrixWorld();
      cfg.forEach(([x, y], i) => heads[i].set(x, y + .3, .25).applyMatrix4(rig.matrixWorld));
      if (!tg && T > 1.0) sampleText(halfW, halfH);
      inst.count = tg ? N : 0;
      if (tg) for (let i = 0; i < N; i++) {
        const q = tg[i], u = M.clamp((T - q.t0) / q.dur, 0, 1);
        if (u <= 0) { dummy.scale.setScalar(.0001); dummy.position.copy(heads[q.h]); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); continue; }
        const e = eInOut(u), hd = heads[q.h];
        p0.set(q.x, q.y, 0.1); c.set((hd.x + q.x) / 2 + q.sx, Math.max(hd.y, q.y) + q.up, 1.2);
        dummy.position.set((1 - e) * (1 - e) * hd.x + 2 * (1 - e) * e * c.x + e * e * p0.x, (1 - e) * (1 - e) * hd.y + 2 * (1 - e) * e * c.y + e * e * p0.y, (1 - e) * (1 - e) * hd.z + 2 * (1 - e) * e * c.z + e * e * p0.z);
        const sp = 1 - e;
        dummy.rotation.set(q.sp[0] * sp * 2, q.sp[1] * sp * 2, q.a + q.sp[2] * sp);
        const fade = 1 - sstep(3.9, 4.5, T);
        dummy.scale.setScalar(Math.max(.0001, q.s * M.lerp(.25, 1, eOut(u * 1.6)) * fade));
        dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    } };
  });

  // 2. Bouquets : une fleur 3D qui se referme et s'ouvre, teintée comme le bouquet survolé
  addView('bloom', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 3.0, rim: 1.6, fill: .8, warm: 0xfff0e6 });
    const root = new THREE.Group(); scene.add(root);
    const fls = { rose: makeFlower('rose'), daisy: makeFlower('daisy'), lily: makeFlower('lily') };
    const names = ['rose', 'daisy', 'lily'];
    for (const k of names) { fls[k].g.rotation.x = .95; fls[k].g.scale.setScalar(k === 'rose' ? 2.0 : k === 'daisy' ? 1.7 : 1.5); fls[k].g.position.y = .25; root.add(fls[k].g); }
    const st = stemTube([new THREE.Vector3(0, .2, 0), new THREE.Vector3(.1, -.8, 0), new THREE.Vector3(-.05, -1.9, 0)], .06); root.add(st);
    const l1 = leaf(1.1); l1.position.set(.05, -.9, 0); l1.rotation.set(0, 0, -1.2); root.add(l1);
    const l2 = leaf(1.0); l2.position.set(-.02, -1.35, 0); l2.rotation.set(0, 0, 1.2); root.add(l2);
    blob(scene, -2.2, 5, 4);
    const cur = new THREE.Color(0xf4a3ba), tgt = new THREE.Color();
    return { scene, cam, update(t, dt) {
      const k = names[S.bloom.kind] || 'rose';
      for (const n of names) fls[n].g.visible = n === k;
      tgt.setHex(S.bloom.col); cur.lerp(tgt, RM ? 1 : Math.min(1, dt * 6));
      const f = fls[k]; f.setColor(cur); f.setOpen(S.bloom.o);
      root.rotation.y = RM ? .2 : t * .25; root.rotation.z = RM ? 0 : Math.sin(t * .7) * .04;
      cam.position.set(0, .6, fitDist(2.9, cam)); cam.lookAt(0, -.05, 0);
    } };
  });

  // 3. Panier : les pétales tombent dans le panier d'osier
  addView('basket', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 3.0, rim: 1.4, fill: .8, warm: 0xfff0e6 });
    const root = new THREE.Group(); scene.add(root);
    root.add(makeBasket());
    const NMAX = MOBILE ? 130 : 220;
    const inst = new THREE.InstancedMesh(petalGeometry(.62, 1), mat.pet, NMAX); inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false; root.add(inst);
    const P = []; for (let i = 0; i < NMAX; i++) { const f = Math.pow(i / NMAX, .6), y = .22 + f * .85 + rnd() * .06, rr = Math.sqrt(rnd()) * Math.max(.15, 1.18 + y * .28 - .15); const a = rnd() * 6.28; P.push({ x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, rx: (rnd() - .5) * 2.2 + Math.PI / 2 * .9, ry: rnd() * 6.28, rz: rnd() * 6.28, s: .36 + rnd() * .12, d: 0, v: 0 }); }
    const dummy = new THREE.Object3D(), col = new THREE.Color(); let ver = -1;
    blob(scene, -.05, 5, 5);
    return { scene, cam, update(t, dt) {
      const B = S.basket;
      if (ver !== B.ver) { ver = B.ver; for (let i = 0; i < NMAX; i++) { col.setHex(B.cols[i % Math.max(1, B.cols.length)] || 0xf4a3ba); inst.setColorAt(i, col); } if (inst.instanceColor) inst.instanceColor.needsUpdate = true; }
      for (let i = 0; i < NMAX; i++) {
        const p = P[i], act = i < B.count;
        const tgt = act ? 1 : 0;
        if (RM) p.d = tgt; else { p.v += ((tgt - p.d) * 70 - p.v * 8.5) * dt; p.d += p.v * dt; }
        const drop = (1 - Math.min(1, p.d)) * 2.8;
        dummy.position.set(p.x, p.y + drop, p.z); dummy.rotation.set(p.rx + drop * .5, p.ry + drop * 1.2, p.rz);
        dummy.scale.setScalar(p.d < .01 && !act ? .0001 : p.s * Math.min(1, .3 + p.d));
        dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      root.rotation.y = RM ? .3 : Math.sin(t * .4) * .4 + .2; root.position.y = -.5;
      cam.position.set(0, 1.9, fitDist(2.35, cam)); cam.lookAt(0, .15, 0);
    } };
  });

  // 4. Confirmation : le colis est ficelé, le nœud se forme
  addView('parcel', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { key: 3.0, rim: 1.4, fill: .8, warm: 0xfff0e6 });
    const root = new THREE.Group(); scene.add(root);
    const pc = makeParcel(); root.add(pc); const U = pc.userData;
    blob(scene, -.62, 5, 4);
    return { scene, cam, update(t) {
      const r = RM ? 1 : S.parcel.r;
      const land = RM ? 1 : eOut(r / .12);
      root.position.y = M.lerp(2.6, 0, land) + (RM ? 0 : Math.sin(t * 1.4) * .02 * land);
      root.rotation.set(.25, RM ? -.5 : -.6 + r * .9 + Math.sin(t * .5) * .06, 0);
      U.segs.forEach((m) => { const [a, b] = m.userData.win, f = clamp01((r - a) / (b - a)), [sy, sz] = m.userData.cs;
        m.visible = f > .001; m.scale.set(Math.max(.0001, m.userData.len * eInOut(f)), sy, sz); });
      // axes : la bande verticale (y) a sa largeur sur z ou x selon la face
      U.bow.scale.setScalar(Math.max(.0001, eBack((r - .64) / .3)));
      U.bow.visible = r > .64; U.tag.visible = r > .8;
      cam.position.set(0, 1.2, fitDist(1.75, cam)); cam.lookAt(0, .0, 0);
    } };
  });

  function stateKey() { return S.bloom.kind + '|' + S.bloom.col + '|' + S.bloom.o.toFixed(2) + '|' + S.basket.ver + '|' + S.basket.count + '|' + S.parcel.r.toFixed(2); }
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
