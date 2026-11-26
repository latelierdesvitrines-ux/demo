(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (u, a, b) => clamp((u - a) / (b - a))
const io = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
const eo = (x) => 1 - Math.pow(1 - x, 3)
const ei = (x) => x * x * x
const lerp = (a, b, t) => a + (b - a) * t
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- Menu, formulaire, révélations des sections (indépendant de la scène) ----------
const burger = $('#burger'), links = $('#links')
burger.onclick = () => { const o = links.classList.toggle('open'); burger.setAttribute('aria-expanded', o) }
$$('#links a').forEach((a) => a.onclick = () => { links.classList.remove('open'); burger.setAttribute('aria-expanded', false) })
$('#form').onsubmit = (e) => { e.preventDefault(); $('#ok').textContent = e.target.checkValidity() ? 'Merci ! (maquette : rien n\'est envoyé)' : 'Merci de remplir les trois champs.' }
const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target) } }), { threshold: .1 })
$$('.mk,.gal figure').forEach((el) => obs.observe(el))

// ---------- Scène ----------
const stage = $('#parcours'), nav = $('.nav'), bar = $('#bar')
const ph = { grains: $('#ph-grains'), inter: $('#ph-inter'), crois: $('#ph-crois'), esp: $('#ph-esp'), lait: $('#ph-lait') }
const topV = $('#top-view'), topImg = $('img', topV), stack = $('#stack'), glint = $('#glint'), beam = $('#beam'), halo = $('#halo')
const T = $$('.t').map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out, lines: $$('.ln>span', el) }))
// Titre : lettre par lettre
const h1 = $('h1'); $$('.w', h1).forEach((w) => { w.innerHTML = [...w.textContent].map((c, i) => `<span class="ch" style="animation-delay:${.15 + i * .045}s">${c}</span>`).join('') })
const chars = $$('.ch', h1); let heroLive = false
h1.addEventListener('animationend', (e) => { if (e.target === chars[chars.length - 1]) { chars.forEach((c) => { c.style.animation = 'none'; c.style.transform = 'none' }); heroLive = true } })
if (reduce) heroLive = true

const fxc = $('#fx'), fx = fxc.getContext('2d')
let P = reduce ? null : window.Particles($('#gl'))
let W, H, M, dpr, A, CW, cup = {}, glOK = { grains: false, crois: false }
let u = 0, uS = 0, tx = 0, ty = 0, ttx = 0, tty = 0, t0 = performance.now(), lastW = 0, lastH = 0

const cover = (nw, nh, ox = .5, oy = .5) => { const s = Math.max(W / nw, H / nh), w = nw * s, h = nh * s; return { x: (W - w) * ox, y: (H - h) * oy, w, h } }
const whenReady = (img) => img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.loading = 'eager' })

function placeCup(img) {
  const d = img.dataset, iw = CW / +d.rim, ih = iw * 1402 / 1122
  const r = { x: A.x - +d.cx * iw, y: A.y - +d.cy * ih, w: iw, h: ih }
  Object.assign(img.style, { left: r.x + 'px', top: r.y + 'px', width: iw + 'px', height: ih + 'px', transformOrigin: `${d.cx * 100}% ${d.cy * 100}%` })
  return r
}
function layout() {
  W = innerWidth; H = innerHeight; M = W < 700; dpr = Math.min(devicePixelRatio || 1, 2)
  A = { x: W * (M ? .5 : .5), y: H * (M ? .62 : .58) }
  CW = M ? Math.min(W * .78, H * .38) : H * .5
  cup.esp = placeCup(ph.esp); cup.lait = placeCup(ph.lait)
  const D = M ? W * .62 : CW * 1.05
  Object.assign(topV.style, { left: A.x - D / 2 + 'px', top: A.y - D / 2 + 'px', width: D + 'px', height: D + 'px' })
  stack.style.left = A.x + 'px'; stack.style.top = A.y + 'px'
  $$('.layer', stack).forEach((l) => Object.assign(l.style, { width: D + 'px', height: D + 'px', left: -D / 2 + 'px', top: -D / 2 + 'px' }))
  cup.D = D; cup.span = stage.offsetHeight - H; cup.top = stage.getBoundingClientRect().top + scrollY
  cup.layers = $$('.layer', stack).filter((l) => !M || !l.classList.contains('m-off')).map((l) => Object.assign(l, { _d: $('.disc', l), _s: $('.sh', l), _l: $('.lab', l) }))
  fxc.width = W * dpr; fxc.height = H * dpr; fx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // Particules : on ne reconstruit que si la taille change vraiment (barre d'adresse mobile)
  if (P && (Math.abs(W - lastW) > 2 || Math.abs(H - lastH) > 120)) {
    lastW = W; lastH = H; P.resize(W, H)
    const step = Math.ceil(Math.sqrt(W * H / (M ? 26000 : 52000)) * (layout.lite ? 1.6 : 1))
    whenReady(ph.grains).then(() => { glOK.grains = P.build('grains', ph.grains, cover(ph.grains.naturalWidth, ph.grains.naturalHeight), step); if (!glOK.grains) P = null })
    glOK.crois = false; cup.step = step
  } else if (P) P.resize(W, H)
}
function buildCrois() {
  if (!P || glOK.crois || buildCrois.busy) return
  buildCrois.busy = true
  whenReady(ph.crois).then(() => { if (P) glOK.crois = P.build('crois', ph.crois, cover(ph.crois.naturalWidth, ph.crois.naturalHeight, .5, .58), Math.round(cup.step * 1.6)); buildCrois.busy = false })
}

// ---------- Inclinaison : souris (PC), gyroscope (téléphone) ----------
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { ttx = e.clientX / W * 2 - 1; tty = e.clientY / H * 2 - 1 } }, { passive: true })
let gyroOn = false, slow = 0
const onOri = (e) => { if (e.gamma == null || slow > 40) return; gyroOn = true; ttx = clamp(e.gamma / 25, -1, 1); tty = clamp((e.beta - 50) / 25, -1, 1) }
if (!reduce && 'DeviceOrientationEvent' in window && matchMedia('(pointer:coarse)').matches) {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const b = $('#gyro'); b.hidden = false
    b.onclick = () => DeviceOrientationEvent.requestPermission().then((s) => { if (s === 'granted') addEventListener('deviceorientation', onOri) }).catch(() => {}).finally(() => b.hidden = true)
  } else addEventListener('deviceorientation', onOri)
}

// ---------- Effets 2D : poussière dans le faisceau, éclaboussures de lait, vapeur ----------
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()
const dust = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), v: .2 + rnd() * .8, r: .4 + rnd() * 1.3, p: rnd() * 6 }))
const drops = Array.from({ length: 46 }, () => ({ b: .38 + rnd() * .3, a: -Math.PI / 2 + (rnd() - .5) * 2.4, v: .35 + rnd() * .65, r: 1 + rnd() * 3.2 }))
const steam = Array.from({ length: 26 }, () => ({ o: rnd(), x: (rnd() - .5) * .5, s: .6 + rnd() * .8, w: rnd() * 6 }))
const puff = document.createElement('canvas'); puff.width = puff.height = 128
{ const g = puff.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,240,.5)'); gr.addColorStop(1, 'rgba(255,250,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128) }
function drawFx(t, bl) {
  fx.clearRect(0, 0, W, H)
  const dA = 1 - seg(u, 1.4, 2.2)
  if (dA > 0) { // poussière : brille seulement dans le faisceau
    for (const d of dust) {
      const x = ((d.x + t * .012 * d.v) % 1) * W, y = ((d.y + t * .006 * d.v + Math.sin(t * .3 + d.p) * .01) % 1) * H
      const k = Math.max(0, 1 - Math.abs(bl[0] * x + bl[1] * y + bl[2]) / (H * .12))
      if (k <= 0) continue
      fx.fillStyle = `rgba(255,228,190,${(.15 + .7 * k) * dA})`; fx.beginPath(); fx.arc(x, y, d.r * (1 + k), 0, 7); fx.fill()
    }
  }
  const m = seg(u, 3.65, 4.4), dv = seg(u, 4.6, 5.3)
  if (m > .3 && dv < .3) { // éclaboussures : position = fonction du scroll (trajectoire balistique)
    const L = cup.lait, ix = L.x + +ph.lait.dataset.s1 * L.w, iy = L.y + +ph.lait.dataset.sy * L.h
    fx.fillStyle = 'rgba(255,250,242,.92)'
    for (const d of drops) {
      const k = (m - d.b) / .32; if (k <= 0 || k >= 1) continue
      const sp = CW * .55 * d.v, x = ix + Math.cos(d.a) * sp * k, y = iy + Math.sin(d.a) * sp * k + CW * .9 * k * k
      fx.beginPath(); fx.ellipse(x, y, d.r * (1 - k * .5), d.r * (1.6 - k), d.a + 1.57, 0, 7); fx.fill()
    }
  }
  const sA = seg(u, 3.1, 3.6) * (1 - seg(u, 5.0, 5.5))
  if (sA > 0 && !reduce) { // vapeur : ambiance lente (temps), intensité pilotée par le scroll
    fx.globalCompositeOperation = 'screen'
    for (const s of steam) {
      const k = (s.o + t * .05 * s.s) % 1, sz = CW * (.12 + k * .38)
      const x = A.x + (s.x + Math.sin(t * .6 + s.w + k * 4) * .18) * CW, y = A.y - CW * .2 - k * H * .42
      fx.globalAlpha = sA * Math.sin(k * Math.PI) * .22; fx.drawImage(puff, x - sz / 2, y - sz / 2, sz, sz)
    }
    fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over'
  }
}
const show = (el, on) => { el.style.visibility = on ? 'visible' : 'hidden' }
// Trou circulaire dans la photo = front d'explosion des particules (même formule que le shader)
const hole = (el, k, cx, cy) => { const R = Math.max(0, (k * 1.9 - .38) / 1.1) * Math.hypot(W, H), v = R > 0 ? `radial-gradient(circle at ${cx}px ${cy}px, transparent ${R}px, #000 ${R + 1}px)` : 'none'; el.style.webkitMaskImage = el.style.maskImage = v }

// ---------- Boucle ----------
let fN = 0, fT = performance.now(), fps = 60, prev = performance.now()
let jsT = 0, jsN = 0
function frame(now) {
  requestAnimationFrame(frame)
  const tA = performance.now()
  const y = scrollY - cup.top, span = cup.span, bottom = span + H - y
  const p = clamp(y / span); u = p * 10
  if (nav._s !== bottom < 70) nav.classList.toggle('solid', nav._s = bottom < 70)
  if (bottom < -50) return // scène sortie : on ne dessine plus rien
  fN++; if (now - fT > 1000) { fps = fN * 1000 / (now - fT); fN = 0; fT = now; slow = fps < 24 ? slow + 1 : 0
    if (P && slow === 3 && !layout.lite) { layout.lite = true; lastW = 0; layout() } }
  const dt = Math.min(.1, (now - prev) / 1000); prev = now
  const kS = 1 - Math.pow(.82, dt * 60), kT = 1 - Math.pow(.94, dt * 60)
  uS = Math.abs(u - uS) > 3 ? u : lerp(uS, u, kS); tx = lerp(tx, ttx, kT); ty = lerp(ty, tty, kT)
  const U = uS, t = (now - t0) / 1000, tilt = reduce ? [0, 0] : [tx, ty]
  bar.style.transform = `scaleY(${p})`

  // Textes : chaque ligne monte dans son masque, puis ressort par le haut
  for (const o of T) {
    if (U < o.a - .6 || U > o.b + .6) { if (o.off) continue; o.off = 1 } else o.off = 0
    o.lines.forEach((s, j) => {
      const a = o.a < 0 ? 1 : eo(seg(U, o.a + j * .07, o.a + j * .07 + .32)), b = io(seg(U, o.b - .3 + j * .05, o.b + j * .05))
      s.style.transform = `translateY(${(1 - a) * 135 - b * 140}%)`
    })
  }
  if (heroLive) { const b = seg(U, .2, .65); chars.forEach((c, i) => { const k = io(clamp(b * 1.6 - i * .05)); c.style.transform = `translateY(${-k * 110}%) rotate(${-k * 8}deg)` }) }

  // 1. Grains -> poudre (particules)
  const e = seg(U, .1, 1.7), sF = seg(U, 1.45, 2.35), dr = seg(U, 3.0, 3.7)
  const glG = P && glOK.grains, beamAng = -.38 + U * .04
  const bx = W * (.62 - U * .05), by = H * .38, nx = -Math.sin(beamAng), ny = Math.cos(beamAng), bl = [nx, ny, -(nx * bx + ny * by)]
  beam.style.transform = `translate(${bx}px,${by}px) rotate(${beamAng}rad) scaleY(${1 + e * .6})`
  beam.style.visibility = U < 2.4 ? 'visible' : 'hidden'
  show(ph.grains, U < 2.6)
  hole(ph.grains, glG ? e : 0, W * .5, H * .5)
  ph.grains.style.transform = glG ? `translate(${-tx * 8}px,${-ty * 6}px) scale(1.02)` : `scale(${1.02 + e * .25}) rotate(${e * 3}deg)`

  // 2-3. Espresso : la tasse est l'ancre, révélée par un cercle qui part de la crème
  const c = seg(U, 2.45, 3.2), E = cup.esp, ed = ph.esp.dataset
  show(ph.esp, U > 2.42 && U < 5.4)
  const tiltT = `rotateY(${tilt[0] * 7}deg) rotateX(${-tilt[1] * 5}deg)`
  ph.esp.style.clipPath = `circle(${eo(c) * 85}% at ${ed.cx * 100}% ${ed.cy * 100}%)`
  ph.esp.style.transform = `${tiltT} scale(${1.22 - .22 * eo(c)}) rotate(${(1 - eo(c)) * -9}deg)`
  glint.style.visibility = U > 2.8 && U < 4.8 ? 'visible' : 'hidden'
  glint.style.transform = `translateX(${lerp(-70, 70, seg(U, 2.9, 4.6))}%) skewX(-8deg)`

  // 4. Lait : le masque suit le filet (colonne) puis s'ouvre en cercle depuis l'impact
  const m = seg(U, 3.65, 4.4), dv = seg(U, 4.6, 5.35), L = cup.lait, ld = ph.lait.dataset
  show(ph.lait, U > 3.62 && U < 5.4)
  if (m < 1) {
    const sx = ld.s1 * 100, iy = ld.sy * 100, col = seg(m, 0, .4), rr = eo(seg(m, .3, .8)) * 95, bw = 3.2
    const pts = [`${sx - bw}% 0%`]
    if (rr < 1) pts.push(`${sx - bw}% ${col * iy}%`, `${sx + bw}% ${col * iy}%`)
    else for (let k = 0; k <= 24; k++) { const a = Math.PI / 2 + .25 + k / 24 * (2 * Math.PI - .5); pts.push(`${sx + Math.cos(a) * rr * L.h / L.w}% ${iy - Math.sin(a) * rr}%`) }
    pts.push(`${sx + bw}% 0%`)
    ph.lait.style.clipPath = `polygon(${pts.join(',')})`
  } else ph.lait.style.clipPath = 'none'
  ph.lait.style.transform = `${tiltT} scale(${1 + 2.6 * ei(dv)})`

  // 5. Plongée dans la tasse -> vue de dessus qui tourne
  const rot = (U - 4.6) * 48
  show(topV, U > 4.62 && U < 5.62)
  topV.style.clipPath = `circle(${eo(dv) * 50}% at 50% 50%)`
  topV.style.transform = `${tiltT} scale(${1.5 - .5 * eo(dv)})`
  topImg.style.transform = `rotate(${rot}deg)`

  // 6. Vue éclatée : la tasse bascule, les couches se séparent avec trajectoire, ombre et étiquette
  const tl = io(seg(U, 5.55, 6.2)), sp = io(seg(U, 6.0, 6.95)), fl = ei(seg(U, 7.05, 7.85))
  show(stack, U > 5.6 && U < 7.9)
  const layers = cup.layers
  const n = layers.length, gap = cup.D * (M ? .36 : .27), sc = M ? lerp(1, .78, tl) : 1
  stack.style.left = lerp(A.x, W * (M ? .3 : .6), sp) + 'px'
  stack.style.transform = `rotateY(${tilt[0] * 10}deg) rotateX(${-tilt[1] * 6}deg) scale(${sc})`
  layers.forEach((l, i) => {
    const y = (i - (n - 1) / 2) * gap * sp + (i ? 0 : 0), x = Math.sin(i * 1.9) * cup.D * .07 * sp
    const sgn = i % 2 ? 1 : -1, fx_ = sgn * (.6 + i * .08) * W * fl, fy = (i - n / 2) * H * .35 * fl - H * .2 * fl
    l.style.transform = `translate3d(${x + fx_}px,${y + fy}px,${-i * (2 + 30 * sp) + fl * 200}px) rotateZ(${sgn * 7 * sp + sgn * 70 * fl}deg)`
    l.style.zIndex = n - i
    l._d.style.transform = `rotateX(${62 * tl + fl * 30 * sgn}deg) rotateZ(${rot}deg)`
    l._s.style.transform = `translate(${20 + 30 * sp}px,${cup.D * .1 + 50 * sp}px) rotateX(${62 * tl}deg) scale(${.9 + .25 * sp})`
    l._s.style.visibility = tl > .05 && fl < .9 ? 'visible' : 'hidden'
    const lb = eo(seg(U, 6.3 + i * .09, 6.65 + i * .09)) * (1 - seg(fl, 0, .3))
    l._l.style.clipPath = i % 2 && !M ? `inset(0 0 0 ${(1 - lb) * 100}%)` : `inset(0 ${(1 - lb) * 100}% 0 0)`
  })

  // 7-8. Croissant : les éclats se rassemblent, puis il éclate et dévoile la salle (grand dézoom)
  const k1 = seg(U, 7.35, 8.25), bu = seg(U, 8.75, 9.5), zi = io(seg(U, 8.7, 9.95))
  if (U > 5) buildCrois()
  const glC = P && glOK.crois
  show(ph.crois, U > 7.3 && U < 9.6)
  hole(ph.crois, glC ? (k1 < 1 ? 1 - k1 : bu) : 0, W * .5, H * .55)
  ph.crois.style.transform = `translate(${-tx * 10}px,${-ty * 8}px) scale(${1.04 + bu * .3})`
  ph.crois.style.clipPath = glC ? 'none' : `circle(${eo(k1) * 80 * (1 - bu)}% at 50% 58%)`
  show(ph.inter, U > 8.6)
  ph.inter.style.transformOrigin = '72% 52%'
  ph.inter.style.transform = `translate(${-tx * 10}px,${-ty * 8}px) scale(${lerp(3.4, 1.04, zi)})`

  halo.style.transform = `translate(${W * (.5 + .3 * Math.sin(U * .8) + tx * .05)}px,${H * (.45 + .2 * Math.cos(U * .6))}px)`

  // WebGL
  if (P) {
    P.clear()
    if (glG && e > 0 && U < 3.8) {
      const ex = E.x, ey = E.y
      P.draw('grains', { uE: e, uS: sF, uD: dr, uMode: 0, uT: t, uC: [W * .5, H * .5], uTilt: tilt, uBeam: bl,
        uStream: [ex + ed.s1 * E.w, ex + ed.s2 * E.w, ey + ed.sy * E.h, A.y], uCup: [A.x, A.y, CW * .4] })
    }
    if (glC && U > 7.2 && U < 9.7 && (k1 < 1 || bu > 0)) {
      P.draw('crois', { uE: k1 < 1 ? 1 - k1 : bu, uMode: 1, uT: t, uC: [W * .5, H * .55], uTilt: tilt })
    }
  }
  drawFx(t, bl)
  jsT += performance.now() - tA; jsN++
}

let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 150) })
layout(); requestAnimationFrame(frame)
window.__cafe = { get js() { const v = jsT / (jsN || 1); jsT = jsN = 0; return +v.toFixed(2) }, get fps() { return fps }, get gl() { return !!P && glOK }, get u() { return u } }
})()
