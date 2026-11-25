/* Aquabrun — une seule scène WebGL (un seul canvas, un seul contexte) pour tout le site.
   Chaque « vue » est dessinée dans le rectangle de son élément [data-view], uniquement s'il est à l'écran.
   Modèles construits en code, sans fichier externe. */
const H = document.documentElement;
const S = window.SITE || (window.SITE = { intro: { t: 99 }, hero: { p: 0 } });
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
  /* ───────── Textures métal : stries de brossage + patine (canvas, aucun fichier) ───────── */
  function metalTex(color, blobs = true) {
    const t = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = color ? '#fff' : '#808080'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { const a = .03 + rnd() * .12; g.fillStyle = rnd() < .5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; g.fillRect(rnd() * w, 0, .5 + rnd() * 1.6, h); }
      for (let i = 0; i < (blobs ? 46 : 0); i++) { // traces d'usure et d'oxydation
        const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r), d = rnd() < .75;
        gr.addColorStop(0, color ? (d ? 'rgba(70,40,25,.28)' : 'rgba(110,160,140,.14)') : (d ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.12)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }, color);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const wornC = metalTex(true), wornR = metalTex(false), brushR = metalTex(false, false);
  const pbr = (o) => new THREE.MeshPhysicalMaterial({ map: wornC, roughnessMap: wornR, bumpMap: wornR, bumpScale: .45, metalness: 1, ...o });
  /* ───────── Matériaux ───────── */
  const mat = {
    copper: pbr({ color: 0xe08a58, roughness: .5, clearcoat: .25, clearcoatRoughness: .35 }),
    copperDark: pbr({ color: 0x9a5530, roughness: .75 }),
    brass: pbr({ color: 0xdcb36c, roughness: .46 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .1, roughnessMap: brushR, bumpMap: brushR, bumpScale: .3 }),
    steel: pbr({ color: 0xdfe3e8, roughness: .55, clearcoat: .15, roughnessMap: brushR, bumpMap: brushR }),
    steelDark: pbr({ color: 0x8a939b, roughness: .8 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: .85, metalness: 0 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xd23a22, roughness: .32, clearcoat: .7, clearcoatRoughness: .2 }),
    // goutte : verre d'eau (indice 1,33), reflets d'environnement forts, pas de transmission (trop lourd)
    water: new THREE.MeshPhysicalMaterial({ color: 0xcfeaff, emissive: 0x0c3552, roughness: 0, metalness: 0, transparent: true, opacity: .42, ior: 1.33, clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, envMapIntensity: 3, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ color: 0x2fa6ff, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .02, transparent: true, opacity: .14, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.2, depthWrite: false }),
    black: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: .6, metalness: .3 }),
  };

  /* ───────── Eau : surface à vagues (shader maison) + volume ─────────
     Normales calculées par différences finies sur 4 sinus animés, fresnel, reflet de ciel de studio,
     éclats de soleil, caustiques procédurales, écume sur les bords, anneau d'impact (uImp). */
  const waters = [];
  const WSURF_V = `uniform float uTime, uAmp; varying vec3 vW; varying vec2 vP; varying vec2 vUv;
    float hgt(vec2 p){ float t = uTime; return sin(p.x*3.1+t*1.3)*.5 + sin(p.y*4.3-t*1.7+p.x)*.35 + sin((p.x+p.y)*7.0+t*2.3)*.18 + sin((p.x-p.y)*11.0-t*3.1)*.09; }
    void main(){ vUv = uv; vP = position.xz; vec3 p = position; float e = smoothstep(1.0, .8, max(abs(uv.x*2.-1.), abs(uv.y*2.-1.)));
      p.y += hgt(vP*2.0) * uAmp * e; vec4 w = modelMatrix * vec4(p,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const WSURF_F = `uniform float uTime, uAmp, uDisc, uImp; uniform vec3 uDeep, uShallow; varying vec3 vW; varying vec2 vP; varying vec2 vUv;
    float hgt(vec2 p){ float t = uTime; return sin(p.x*3.1+t*1.3)*.5 + sin(p.y*4.3-t*1.7+p.x)*.35 + sin((p.x+p.y)*7.0+t*2.3)*.18 + sin((p.x-p.y)*11.0-t*3.1)*.09; }
    float H(vec2 p){ float h = hgt(p); if (uImp >= 0.){ float r = length(p), f = uImp*1.1; h += sin((r-f)*22.)*exp(-pow((r-f)*3.,2.))*exp(-uImp*.9)*1.6; } return h; }
    vec3 sky(vec3 r){ float u = clamp(r.y*.5+.5,0.,1.); vec3 c = mix(vec3(.05,.1,.16), vec3(.55,.75,.95), pow(u,1.4));
      c += vec3(1.,.95,.88) * smoothstep(.15,.0,abs(r.x*.8 + r.z*.3 + .35)) * smoothstep(.2,.7,r.y) * 1.6; // boîte à lumière
      c += vec3(.7,.85,1.) * smoothstep(.12,.0,abs(r.x*.7 - r.z*.5 - .6)) * smoothstep(.1,.5,r.y) * .9; return c; }
    void main(){
      vec2 q = vUv*2.-1.; float edge = max(abs(q.x), abs(q.y)); if (uDisc > .5){ edge = length(q); if (edge > 1.) discard; }
      vec2 p = vP*2.0; float e = .02;
      float h0 = H(p), hx = H(p+vec2(e,0.)), hz = H(p+vec2(0.,e));
      vec3 n = normalize(vec3(-(hx-h0)/e*uAmp*2.0, 1., -(hz-h0)/e*uAmp*2.0));
      vec3 v = normalize(cameraPosition - vW); float nv = max(dot(n,v),0.); float F = .02 + .98*pow(1.-nv,5.);
      vec3 r = reflect(-v,n); vec3 L = normalize(vec3(-.5,.8,.45));
      float spec = pow(max(dot(r,L),0.), 140.) * 2.2;
      float cau = pow(1.-abs(sin(p.x*7.+h0*3.+uTime*.7)*sin(p.y*7.-h0*3.+uTime*.5)), 10.) * .5;
      vec3 col = mix(uDeep, uShallow, .35 + .65*nv) + cau*vec3(.35,.7,.9)*.5;
      col = mix(col, sky(r), clamp(F*1.2 + .08,0.,1.)) + spec;
      float foam = smoothstep(.86,1.,edge) * (.5 + .5*sin(p.x*9.+uTime*1.2)*sin(p.y*8.-uTime*1.));
      col = mix(col, vec3(.92,.97,1.), clamp(foam,0.,1.)*.55);
      gl_FragColor = vec4(col, clamp(.62 + F*.35 + foam*.2, 0., .95)); }`;
  const WVOL_V = `varying vec3 vL; varying vec3 vW; varying vec3 vN; void main(){ vL = position; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
  const WVOL_F = `uniform float uLevel, uTime; uniform vec3 uDeep, uShallow; varying vec3 vL; varying vec3 vW; varying vec3 vN;
    void main(){ if (vL.y > uLevel) discard; vec3 v = normalize(cameraPosition - vW); float nv = abs(dot(normalize(vN), v)); float F = pow(1.-nv, 3.);
      float d = clamp((uLevel - vL.y)/.8, 0., 1.); vec3 col = mix(uShallow, uDeep, d*.6 + .2);
      col += F*vec3(.5,.75,1.)*.6 + pow(1.-abs(sin(vL.x*6.+uTime*.8)*sin(vL.z*6.-uTime*.6)),10.)*.12;
      gl_FragColor = vec4(col, .5 + F*.35); }`;
  function waterSurface(o = {}) {
    const m = new THREE.ShaderMaterial({ vertexShader: WSURF_V, fragmentShader: WSURF_F, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uAmp: { value: o.amp ?? .035 }, uDisc: { value: o.disc ? 1 : 0 }, uImp: { value: -1 }, uDeep: { value: new THREE.Color(o.deep ?? 0x0b4a7c) }, uShallow: { value: new THREE.Color(o.shallow ?? 0x3aa8e0) } } });
    waters.push(m); return m;
  }
  function waterVolume(o = {}) {
    const m = new THREE.ShaderMaterial({ vertexShader: WVOL_V, fragmentShader: WVOL_F, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uLevel: { value: -1 }, uDeep: { value: new THREE.Color(o.deep ?? 0x0b4a7c) }, uShallow: { value: new THREE.Color(o.shallow ?? 0x4fb6ea) } } });
    waters.push(m); return m;
  }
  const surfGeo = new THREE.PlaneGeometry(2, 2, 48, 48).rotateX(-Math.PI / 2); // surface 2×2, mise à l'échelle par chaque usage
  /* Filetage : vraie hélice (tube le long d'une courbe) sur un noyau cylindrique */
  function makeThread(r, len, turns, m) {
    const g = new THREE.Group(), pts = [], N = turns * 16;
    for (let i = 0; i <= N; i++) { const u = i / N, a = u * turns * Math.PI * 2; pts.push(new THREE.Vector3(-len / 2 + u * len, Math.cos(a) * r, Math.sin(a) * r)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, r * .1, 6), m));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r * .93, r * .93, len, 32), m); core.rotation.z = Math.PI / 2; g.add(core);
    return g;
  }
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
      const o = new THREE.Mesh(new THREE.TorusGeometry(.215, .03, 10, 32), mat.rubber); o.rotation.y = Math.PI / 2; o.position.x = s * .66; g.add(o);
    }
    return g;
  }
  function dropGeometry() { // goutte réelle : bas sphérique, haut effilé
    const p = [];
    for (let i = 0; i <= 18; i++) { const th = 2.3 * i / 18; p.push(new THREE.Vector2(Math.max(.0001, .4 * Math.sin(th)), -.1 - .4 * Math.cos(th))); }
    p.push(new THREE.Vector2(.24, .36), new THREE.Vector2(.14, .56), new THREE.Vector2(.07, .78), new THREE.Vector2(.025, .97), new THREE.Vector2(.0001, 1.05));
    return new THREE.LatheGeometry(p, 32);
  }
  function meniscusGeometry() { // goutte qui se forme : large à la base (ménisque), col étroit, bulbe
    const p = [new THREE.Vector2(.0001, .02), new THREE.Vector2(.5, .02)];
    for (let i = 1; i <= 10; i++) { const u = i / 10; p.push(new THREE.Vector2(.14 + .36 * Math.exp(-u * 5), -u * .45)); }
    for (let i = 1; i <= 12; i++) { const th = Math.PI * i / 12; p.push(new THREE.Vector2(Math.max(.0001, .3 * Math.sin(th)), -.75 + .3 * Math.cos(th))); }
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
    const thread = makeThread(.26, 1.0, 9, mat.chrome); thread.rotation.y = -Math.PI / 2; thread.position.z = .5; nut.add(thread);
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

  const shadowLights = [];
  function studio(scene, { shadow = false, warm = 0xffe6c7, key = 3.2, rim = 2.2, fill = .5, size = 4 } = {}) {
    scene.environment = ENV; scene.environmentIntensity = .85;
    const k = new THREE.DirectionalLight(warm, key); k.position.set(-4, 7, 5); scene.add(k);
    if (shadow) {
      shadowLights.push(k); k.castShadow = true; k.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024); k.shadow.radius = 6; k.shadow.bias = -.0004; k.shadow.normalBias = .02;
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

  // 1. Hero : un raccord sur tube de verre ; au défilement : la fuite goutte, les raccords se vissent, l'eau monte
  addView('hero', () => {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    studio(scene, { shadow: true, key: 3.4, rim: 2.8, fill: .45, warm: 0xe8f3ff, size: 7 });
    const FLOOR = -1.75; ground(scene, FLOOR, .4, 24);
    const rig = new THREE.Group(); scene.add(rig);
    // tube de verre + eau + capuchons laiton à filetage
    const GL = 2.6, GR = .42;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(GR, GR, GL, 48, 1, true).rotateZ(Math.PI / 2), mat.glass.clone()); glass.material.opacity = .07; glass.material.envMapIntensity = 3.5; rig.add(glass);
    const wvol = waterVolume(); const vol = new THREE.Mesh(new THREE.CylinderGeometry(GR - .035, GR - .035, GL - .1, 40).rotateZ(Math.PI / 2), wvol); vol.renderOrder = 2; rig.add(vol);
    const wsurf = waterSurface({ amp: .03 }); const surf = new THREE.Mesh(surfGeo, wsurf); surf.renderOrder = 3; rig.add(surf);
    for (const sd of [-1, 1]) {
      const cap = hex(.5, .3, mat.brass); cap.rotation.z = Math.PI / 2; cap.position.x = sd * 1.45; cap.castShadow = true; rig.add(cap);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.43, .04, 10, 48), mat.chrome); ring.rotation.y = Math.PI / 2; ring.position.x = sd * 1.3; rig.add(ring);
      const th = makeThread(.27, .55, 6, mat.brass); th.position.x = sd * 1.87; rig.add(th);
    }
    // deux tuyaux de cuivre, chacun avec son raccord
    const arms = [-1, 1].map((sd) => {
      const arm = new THREE.Group(), pipe = makePipe(6); pipe.position.x = 0; arm.add(pipe);
      pipe.children.forEach((c) => { c.castShadow = true; });
      pipe.rotation.y = sd > 0 ? Math.PI : 0;                // les bagues de soudure restent côté raccord
      const cp = makeCoupling(); cp.children.forEach((c) => { c.castShadow = true; }); arm.add(cp);
      rig.add(arm); return { arm, cp, sd };
    });
    // bulles qui montent dans l'eau
    const bubbles = []; for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), mat.water); b.renderOrder = 4; rig.add(b); bubbles.push({ m: b, x: (rnd() - .5) * 2, ph: rnd(), sp: .25 + rnd() * .3, z: (rnd() - .5) * .3 }); }
    // fuite : goutte qui se forme (ménisque), tombe, éclabousse
    const hang = new THREE.Mesh(meniscusGeometry(), mat.water), fall = new THREE.Mesh(dropGeo, mat.water);
    scene.add(hang, fall);
    const puddleM = waterSurface({ disc: true, amp: .012, deep: 0x123f66, shallow: 0x3d86b8 }); const puddle = new THREE.Mesh(surfGeo, puddleM); puddle.position.y = FLOOR + .01; puddle.renderOrder = 1; scene.add(puddle);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ring2.rotation.x = -Math.PI / 2; scene.add(ring2);
    const spl = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), mat.water); b.visible = false; scene.add(b); spl.push({ m: b, a: i / 6 * 6.28 + rnd(), v: .6 + rnd() * .6 }); }
    const sp = { x: 0, v: 0 };                                // ressort : le défilement est suivi avec un peu d'inertie
    const DX = -1.55;                                          // x du joint gauche fuyant
    return { scene, cam, update(t, dt) {
      const target = S.hero.p;
      if (RM) { sp.x = target; sp.v = 0; } else { sp.v += ((target - sp.x) * 70 - sp.v * 13) * dt; sp.x += sp.v * dt; }
      const p = M.clamp(sp.x, -.03, 1.03);
      const close = eInOut(p / .42);                           // 0 ouvert → 1 vissé
      const gap = 1 - close;
      const WIDE = cam.aspect > 1.25;
      for (const a of arms) {
        const cx = a.sd * (2.23 + gap * .8);
        a.cp.position.x = cx;
        a.cp.rotation.x = a.sd * gap * 9.5;                    // le raccord tourne en avançant
        const pl = a.arm.children[0]; pl.position.x = cx + a.sd * 2.6;
      }
      // niveau d'eau : monte après la réparation, surface ondulante
      const lv = M.lerp(-GR + .06, GR * .45, sstep(.42, .95, p)) + Math.sin(t * 1.1) * .004;
      const chord = Math.sqrt(Math.max(.0004, (GR - .035) ** 2 - lv * lv));
      wvol.uniforms.uLevel.value = lv;
      surf.visible = p > .43; surf.position.y = lv; surf.scale.set((GL - .12) / 2, 1, chord);
      bubbles.forEach((b) => { const u = (t * b.sp + b.ph) % 1; b.m.visible = p > .5 && lv > -GR + .12; b.m.position.set(b.x, -GR * .8 + u * (lv + GR * .8), b.z); b.m.scale.setScalar(.5 + u * .8); });
      // fuite
      const leak = clamp01(gap * 1.6);
      const per = 1.5, ph = (t % per) / per, tf = RM ? .5 : ph;
      hang.visible = leak > .02 && tf < .62; fall.visible = leak > .02 && tf >= .62 && tf < .86;
      const dx = DX - gap * .4, y0 = -.42;
      if (hang.visible) { const k = tf / .62; hang.position.set(dx, y0, .2); hang.scale.set(.18 * leak, .22 * leak * (.4 + k * .9), .18 * leak); }
      if (fall.visible) { const u = (tf - .62) / .24, yy = M.lerp(y0 - .3, FLOOR + .05, u * u); fall.position.set(dx, yy, .2); fall.scale.set(.12 * leak, .12 * leak * (1.2 + u * .4), .12 * leak); }
      const iu = tf >= .86 ? (tf - .86) / .14 : -1;
      puddle.visible = leak > .02; puddle.position.x = dx; puddle.position.z = .2;
      const pr = .25 + .5 * leak; puddle.scale.set(pr * 1.6, 1, pr); puddleM.uniforms.uImp.value = iu >= 0 ? iu * 1.2 : -1;
      ring2.visible = leak > .02 && iu >= 0; if (ring2.visible) { ring2.position.set(dx, FLOOR + .02, .2); ring2.scale.setScalar(.1 + iu * .5); ring2.material.opacity = (1 - iu) * .6 * leak; }
      spl.forEach((b) => { b.m.visible = leak > .02 && iu >= 0 && iu < .8; if (b.m.visible) { const q = iu * .5; b.m.position.set(dx + Math.cos(b.a) * b.v * q, FLOOR + .05 + b.v * 1.4 * q - 5 * q * q, .2 + Math.sin(b.a) * b.v * q * .6); b.m.scale.setScalar(.8 * leak); } });
      // caméra : légère orbite avec le défilement et au repos
      const idle = RM ? 0 : Math.sin(t * .35) * .05;
      const hw = WIDE ? 5.0 : 3.0, z = hw / (Math.tan(M.degToRad(cam.fov / 2)) * Math.max(cam.aspect, .9));
      const az = -.12 + p * .38 + idle;
      cam.position.set(Math.sin(az) * z, .55 + p * .25, Math.cos(az) * z);
      cam.lookAt(0, WIDE ? .8 : -.2, 0);
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
    const poolM = waterSurface({ disc: true, amp: .02, deep: 0x07406e, shallow: 0x2f8fcf });
    const pool = new THREE.Mesh(surfGeo, poolM); pool.scale.set(2.2, 1, 2.2); pool.position.y = -.19; scene.add(pool);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, .3, 64), new THREE.MeshStandardMaterial({ color: 0x0a2f52, roughness: .6 })); basin.position.y = -.36; scene.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.22, .09, 16, 80), mat.copper); rim.rotation.x = Math.PI / 2; rim.position.y = -.2; scene.add(rim);
    const rings = []; for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 80), new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = -.19; scene.add(r); rings.push(r); }
    const drop = new THREE.Mesh(dropGeo, mat.water); drop.scale.setScalar(.6); scene.add(drop);
    const crown = []; for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), mat.water); b.visible = false; scene.add(b); crown.push({ m: b, a: i / 14 * Math.PI * 2, v: .8 + (i % 3) * .35 }); }
    return { scene, cam, t1: 0, update(t) {
      // après la chute, la goutte retombe doucement en boucle
      if (S.splash.t >= 1 && !this.t1) this.t1 = t;
      if (S.splash.t < 1) this.t1 = 0;
      const T = RM ? 1.9 : S.splash.t < 1 ? S.splash.t * 2.6 : ((t - this.t1) % 3.6);
      poolM.uniforms.uImp.value = T > .7 ? (T - .7) * 1.1 : -1;
      drop.visible = T < .7;
      if (drop.visible) { const k = eIn(T / .7); drop.position.set(0, M.lerp(3.2, -.15, k), 0); drop.scale.set(.55, .55 * (1 + .4 * k), .55); }
      for (const c of crown) { const u = T - .7; c.m.visible = u > 0 && u < 1.1;
        if (c.m.visible) { c.m.position.set(Math.cos(c.a) * c.v * u * .8, -.15 + c.v * 2.2 * u - 4.2 * u * u, Math.sin(c.a) * c.v * u * .8); c.m.scale.setScalar(Math.max(.01, 1 - u * .6)); } }
      rings.forEach((r, i) => { const u = (T - .7 - i * .28) / 1.5; r.visible = false; // anneaux dessinés remplacés par les vagues du shader
        if (0) r.visible = u > 0 && u < 1; if (r.visible) { r.scale.setScalar(.15 + eOut(u) * 2.0); r.material.opacity = (1 - u) * .8; } });
      scene.rotation.y = RM ? 0 : Math.sin(t * .4) * .15;
      cam.position.set(0, fitDist(2.4, cam) * .42, fitDist(2.4, cam) * .9); cam.lookAt(0, .5, 0);
    } };
  });

  function stateKey() { return S.hero.p.toFixed(3) + '|' + S.wrench.p.toFixed(3) + '|' + S.valve.i + '|' + S.gauge.target + '|' + S.splash.t.toFixed(2); }
  /* ───────── Boucle : on ne dessine que les vues visibles ───────── */
  let W = innerWidth, Hh = innerHeight, dirty = true, prev = performance.now(), firstFrame = true;
  const onResize = () => { W = innerWidth; Hh = innerHeight; renderer.setSize(W, Hh); dirty = true; };
  addEventListener('resize', onResize);
  let lastState = '';
  // Qualité adaptative : si l'appareil rame (Chromebook sans GPU), on baisse la résolution puis on coupe les ombres.
  let ema = 16, slow = 0, quality = 0, basePR = renderer.getPixelRatio();
  function adapt(raw) {
    ema = ema * .92 + raw * .08;
    if (++slow < 15 || ema < 36 || quality >= 3) return;
    slow = 0; quality++; ema = 20;
    if (quality === 1) shadowLights.forEach((l) => { l.castShadow = false; });
    renderer.setPixelRatio(Math.max(.5, basePR * (quality === 1 ? .8 : quality === 2 ? .6 : .45))); renderer.setSize(W, Hh); dirty = true;
    window.__quality = quality;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    adapt(Math.min(200, now - prev));
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    const t = now / 1000;
    for (const w of waters) w.uniforms.uTime.value = t;
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
