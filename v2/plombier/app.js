(function () {
  'use strict';
  const H = document.documentElement;
  const RM = H.classList.contains('rm');
  const G = window.gsap;
  const ANIM = !RM && !!G && !!window.ScrollTrigger;
  const MOBILE = matchMedia('(max-width: 980px)').matches;
  if (ANIM) { H.classList.add('anim'); G.registerPlugin(ScrollTrigger); }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const eur = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const radio = (group, btn) => $$('[role="radio"]', group).forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
  const FINE = H.classList.contains('fine');

  // État partagé avec la scène 3D (scene.js le lit à chaque image).
  const S = window.SITE = window.SITE || {};
  S.rm = RM; S.mobile = MOBILE;
  S.intro = { t: ANIM ? 0 : 99, on: ANIM };

  // Menu mobile et pression des boutons
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.burger');
    if (b) { const o = $('#menu').classList.toggle('open'); b.setAttribute('aria-expanded', o); }
    else if (e.target.closest('#menu a')) { $('#menu').classList.remove('open'); $('.burger').setAttribute('aria-expanded', 'false'); }
    const btn = e.target.closest('.btn');
    if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 160); }
  });

  // Découpage des titres
  function splitChars(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w) => `<span class="w" aria-hidden="true" style="display:inline-block;white-space:nowrap">${[...w].map((c) => `<span class="c" style="display:inline-block">${c}</span>`).join('')}</span>`).join(' ');
    return $$('.c', el);
  }
  function splitLines(el) {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map((p) => `<span style="display:block;overflow:hidden;padding-bottom:.1em"><span class="l" style="display:inline-block">${p.trim()}</span></span>`).join('');
    return $$('.l', el);
  }

  // UN SEUL défilement instantané dans un requestAnimationFrame (Safari/WebKit : jamais scrollIntoView puis scrollBy).
  function scrollToEl(el, off) {
    requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - (off == null ? 80 : off)), behavior: 'instant' }));
  }

  // Apparition du hero (après l'ouverture)
  function heroIn() {
    const tl = G.timeline();
    tl.from('.hero-title .ln > span', { yPercent: 110, rotation: 3, duration: 1.1, ease: 'expo.out', stagger: .1 }, 0)
      .fromTo('.hero-photo', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' }, 0)
      .from('.hero-photo img', { scale: 1.3, duration: 1.8, ease: 'expo.out' }, 0.1)
      .to('.hero [data-a="fade"]', { opacity: 1, duration: .8, stagger: .12 }, .35)
      .from('.hero [data-a="fade"]', { y: 24, duration: .9, ease: 'power3.out', stagger: .12 }, .35)
      .from('.top', { yPercent: -100, opacity: 0, duration: .8, ease: 'power3.out' }, .2);
  }

  // Ouverture : le site construit sa timeline (en pause) ; ce bloc la branche (passer, Échap, attente de la scène 3D).
  function runIntro(tl, total) {
    const intro = $('#intro');
    S.introTl = tl;
    const end = () => { H.classList.remove('intro-on'); S.intro.on = false; S.intro.t = 99; G.ticker.lagSmoothing(500, 33); if (intro) intro.remove(); ScrollTrigger.refresh(); };
    tl.to(S.intro, { t: total, duration: total, ease: 'none' }, 0)
      .to('.intro-skip', { opacity: 1, duration: .4 }, .4);
    tl.eventCallback('onComplete', end);
    $('.intro-skip').addEventListener('click', () => { tl.progress(1); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.intro.on) tl.progress(1); });
    let started = false;
    // Durée fixe en temps réel, même si l'appareil rame ; démarrage deux images après la scène 3D.
    const go = () => { if (started) return; started = true;
      requestAnimationFrame(() => requestAnimationFrame(() => { G.ticker.lagSmoothing(0); window.__introStart = performance.now(); tl.play(); })); };
    addEventListener('site-scene', go, { once: true });
    setTimeout(go, 4000);
  }

  /* ═════════ Aquabrun : données, formulaire de devis simulé (aucune donnée n'est envoyée) ═════════ */
  Object.assign(S, { wrench: { p: RM ? .6 : 0 }, valve: { i: 0, n: 8 }, gauge: { target: .4, val: 0, vel: 0 }, splash: { t: 0 } });

  const PRESTATIONS = [
    { id: 'fuite', nom: 'Recherche et réparation de fuite', prix: 120, img: 'robinet', alt: 'Robinet de lavabo qui coule', desc: 'Localisation de la fuite et réparation, pièces courantes comprises.' },
    { id: 'debouchage', nom: 'Débouchage de canalisation', prix: 89, img: 'tuyaux', alt: 'Tubes de cuivre et raccords', desc: 'Évier, WC, douche ou colonne, au furet ou à haute pression.' },
    { id: 'chaudiere-entretien', nom: 'Entretien de chaudière', prix: 99, img: 'plombier1', alt: 'Technicien au travail dans une pièce', desc: 'Contrôle annuel, nettoyage et attestation d’entretien.' },
    { id: 'chaudiere-remplacement', nom: 'Remplacement de chaudière', prix: 3200, img: 'chaudiere', alt: 'Installation d’une chaudière', desc: 'Dépose, pose, mise en service. Aides possibles selon dossier.' },
    { id: 'radiateurs', nom: 'Pose de radiateurs', prix: 250, img: 'radiateur', alt: 'Tête thermostatique de radiateur', desc: 'Pose et raccordement d’un radiateur, purge incluse.' },
    { id: 'douche', nom: 'Remplacement de douche', prix: 380, img: 'apres2', alt: 'Pommeau de douche', desc: 'Receveur, paroi et robinetterie, dépose de l’ancienne douche comprise.' },
    { id: 'sdb', nom: 'Rénovation de salle de bains', prix: 4500, img: 'apres1', alt: 'Salle de bains moderne avec baignoire', desc: 'Plomberie, sanitaires, douche à l’italienne, coordination.' },
    { id: 'wc', nom: 'Remplacement de WC', prix: 150, img: 'wc', alt: 'WC dans une pièce carrelée', desc: 'Dépose et pose d’un WC, évacuation et alimentation.' },
  ];
  S.valve.n = PRESTATIONS.length;

  $('#grid').innerHTML = PRESTATIONS.map((p, i) => `<article class="card${i === 0 ? ' active' : ''}" data-i="${i}" tabindex="0">
    <div class="card-img"><img src="photos/${p.img}.webp" alt="${p.alt}" width="800" height="600" loading="lazy"><span class="plate" aria-hidden="true"><i class="wheel"></i></span></div>
    <div class="card-body"><h3>${p.nom}</h3><p>${p.desc}</p>
      <div class="card-foot"><span class="price"><small>à partir de</small>${eur(p.prix)}<i class="stream" aria-hidden="true"></i></span>
      <button class="btn btn-sm ghost btn-add" type="button" data-id="${p.id}" aria-label="Demander un devis : ${p.nom}"><span>Demander un devis</span></button></div></div></article>`).join('');

  /* Vanne : la carte survolée ou touchée ouvre la vanne 3D */
  const cards = $$('.card'), vlName = $('.vl-name'), vlPrice = $('.vl-price');
  let lastTouch = 0;
  function setValve(i, first) {
    if (i === S.valve.i && !first) return;
    S.valve.i = i;
    cards.forEach((c, k) => c.classList.toggle('active', k === i));
    const p = PRESTATIONS[i], set = () => { vlName.textContent = p.nom; vlPrice.textContent = `dès ${eur(p.prix)}`; };
    if (ANIM && !first) G.to([vlName, vlPrice], { opacity: 0, y: -8, duration: .15, onComplete: () => { set(); G.fromTo([vlName, vlPrice], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .35, stagger: .05, ease: 'power3.out' }); } });
    else set();
  }
  setValve(0, true);
  cards.forEach((c, i) => {
    c.addEventListener('mouseenter', () => setValve(i));
    c.addEventListener('focusin', () => setValve(i));
    c.addEventListener('touchstart', () => { lastTouch = Date.now(); setValve(i); }, { passive: true });
  });

  /* Devis en 4 étapes : à chaque étape, la pression monte */
  const STEPS = [.4, 1.0, 1.6, 2.2];
  const Q = { type: '', urg: 'Cette semaine', step: 0 };
  $('#type').innerHTML = PRESTATIONS.map((p) => `<button type="button" class="chip" role="radio" aria-checked="false" data-id="${p.id}">${p.nom}</button>`).join('')
    + '<button type="button" class="chip" role="radio" aria-checked="false" data-id="autre">Autre / je ne sais pas</button>';
  const form = $('#order'), panes = $$('.pane'), stepper = $$('.stepper li'), msg = $('#msg');
  const barVal = $('#bar-val'), barTxt = $('#bar-txt');
  const gShown = { v: 0 };
  function setPressure(v, txt) {
    S.gauge.target = v;
    if (txt) barTxt.textContent = txt;
    if (ANIM) G.to(gShown, { v, duration: 1.1, ease: 'power2.out', onUpdate: () => { barVal.textContent = gShown.v.toFixed(1).replace('.', ','); } });
    else { gShown.v = v; barVal.textContent = v.toFixed(1).replace('.', ','); }
  }
  function goStep(n, dir) {
    Q.step = n; form.dataset.s = n; msg.textContent = '';
    panes.forEach((p, i) => p.classList.toggle('on', i === n));
    stepper.forEach((s, i) => { s.classList.toggle('on', i === n); s.classList.toggle('done-s', i < n); });
    setPressure(STEPS[n], `étape ${n + 1} sur 4`);
    if (ANIM) G.fromTo(panes[n], { x: 36 * (dir || 1), opacity: 0 }, { x: 0, opacity: 1, duration: .55, ease: 'power3.out' });
    // Mobile : le manomètre reste collé en haut ; on garde le formulaire visible sous lui.
    if (dir && MOBILE) { const r = $('.stepper').getBoundingClientRect(); if (r.top < 290 || r.top > innerHeight - 260) scrollToEl($('.stepper'), 300); }
  }
  goStep(0);
  const err = (t, el) => { msg.textContent = t; if (el) el.focus({ preventScroll: true }); if (ANIM) G.fromTo(msg, { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1, .3)' }); return false; };
  function validStep(n) {
    if (n === 0 && !Q.type) return err('Choisissez un type d’intervention.', $('#type .chip'));
    if (n === 3) {
      if (!$('#nom').value.trim()) return err('Indiquez votre nom.', $('#nom'));
      if (!$('#tel').value.trim()) return err('Indiquez un téléphone (fictif en démo).', $('#tel'));
      if (!/^\d{5}$/.test($('#cp').value)) return err('Le code postal doit avoir 5 chiffres.', $('#cp'));
    }
    return true;
  }
  $('#next').addEventListener('click', () => { if (validStep(Q.step)) goStep(Math.min(3, Q.step + 1), 1); });
  $('#prev').addEventListener('click', () => goStep(Math.max(0, Q.step - 1), -1));

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('chip')) { radio(b.parentNode, b); Q.type = b.dataset.id; msg.textContent = ''; }
    else if (b.classList.contains('urg-o')) { radio(b.parentNode, b); Q.urg = b.dataset.v; }
    else if (b.classList.contains('btn-add')) {
      const c = $(`.chip[data-id="${b.dataset.id}"]`); if (c) { radio(c.parentNode, c); Q.type = b.dataset.id; }
      if (Q.step !== 0) goStep(0, -1);
      const t = $('#devis'); requestAnimationFrame(() => window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 40, behavior: ANIM ? 'smooth' : 'instant' }));
    }
  });
  $('#photos').addEventListener('change', () => {
    const f = [...$('#photos').files].slice(0, 5);
    $('#fichiers').innerHTML = f.map((x) => `<li>📎 ${esc(x.name)} (${Math.max(1, Math.round(x.size / 1024))} Ko)</li>`).join('');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Q.step < 3) { if (validStep(Q.step)) goStep(Q.step + 1, 1); return; }
    if (!validStep(0) || !validStep(3)) return;
    const t = Q.type === 'autre' ? 'Autre / je ne sais pas' : PRESTATIONS.find((p) => p.id === Q.type).nom;
    const n = Math.min($('#photos').files.length, 5), d = $('#desc').value.trim();
    $('#recap-list').innerHTML = [['Nom', esc($('#nom').value.trim())], ['Intervention', esc(t)], ['Problème', d ? esc(d.slice(0, 140)) : '—'], ['Urgence', esc(Q.urg)], ['Photos', `${n} (simulé)`], ['Code postal', esc($('#cp').value)], ['Réponse', 'Sous 24 h ouvrées']]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    showDone();
  });

  function showDone() {
    const done = $('#done'), grid = $('.devis-grid');
    const reveal = () => { form.hidden = true; done.hidden = false; grid.classList.add('is-done'); };
    if (!ANIM) { setPressure(2.6, 'dans la zone verte'); S.splash.t = 1; reveal(); $('.recap').focus(); return; }
    setPressure(2.6, 'dans la zone verte');
    $('#valider').disabled = true;
    G.delayedCall(1.2, () => {
      G.to(form, { opacity: 0, y: 16, duration: .35, ease: 'power2.in', onComplete: () => {
        reveal(); ScrollTrigger.refresh(); S.splash.t = 0;
        scrollToEl(done, MOBILE ? 80 : 120);
        const tl = G.timeline();
        tl.to(S.splash, { t: 1, duration: 2.6, ease: 'none' }, 0)
          .from('.recap', { opacity: 0, y: 30, duration: .8, ease: 'power3.out' }, 1.0)
          .from('#recap-list > *', { opacity: 0, x: -14, stagger: .05, duration: .4 }, 1.3)
          .from('.recap-demo', { opacity: 0, duration: .5 }, 1.9)
          .add(() => $('.recap').focus({ preventScroll: true }));
      } });
    });
  }
  $('#again').addEventListener('click', () => {
    $('#done').hidden = true; form.hidden = false; form.reset(); $('#fichiers').innerHTML = '';
    $('#valider').disabled = false; $('#devis-grid, .devis-grid').classList.remove('is-done');
    Q.type = ''; Q.urg = 'Cette semaine'; $$('#type .chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
    $$('.urg-o').forEach((u) => u.setAttribute('aria-checked', String(u.dataset.v === 'Cette semaine')));
    S.splash.t = 0; goStep(0, -1);
    if (ANIM) { G.fromTo(form, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5 }); ScrollTrigger.refresh(); }
  });

  /* Horaires : l'accueil est-il ouvert ? (le dépannage l'est toujours) */
  (function () {
    const now = new Date(), j = now.getDay(), h = now.getHours();
    if (j >= 1 && j <= 5 && h >= 8 && h < 18) $('#h-atelier').classList.add('today');
  })();

  /* Avant / après : le curseur est un raccord en cuivre */
  $$('.cmp-in').forEach((box) => {
    const inp = $('input', box);
    const set = (v) => box.style.setProperty('--x', v + '%');
    inp.addEventListener('input', () => { set(inp.value); box.dataset.user = 1; });
  });

  if (!ANIM) { window.__ready = true; return; }

  /* ═════════ Animations ═════════ */
  const wave = (top, t, amp, n = 28) => {
    let p = '';
    for (let i = 0; i <= n; i++) { const x = i / n * 100; p += `${x.toFixed(1)}% ${(top + Math.sin(i * .75 + t * 7) * amp).toFixed(2)}%, `; }
    return `polygon(${p}100% 130%, 0% 130%)`;
  };

  /* Ouverture : la goutte (3D), le raccord (3D), l'eau remplit le nom, la crue découvre la page */
  if (!S.intro.on) heroIn();
  else {
    H.classList.add('intro-on');
    const intro = $('#intro'), fill = $('.it-fill'), flood = $('.intro-flood');
    const lvl = { v: 0 }, fl = { v: 100 };
    fill.style.clipPath = wave(130, 0, 0); flood.style.clipPath = wave(130, 0, 0); flood.style.transform = 'none';
    const tl = G.timeline({ paused: true });
    tl.from('.intro-kicker span', { opacity: 0, y: 10, stagger: .06, duration: .6, ease: 'power2.out' }, 0)
      .from('.it-word', { opacity: 0, duration: 1.2 }, .2)
      // l'eau monte dans les lettres une fois le raccord vissé
      .to(lvl, { v: 1, duration: 1.15, ease: 'power1.inOut', onUpdate: () => { fill.style.clipPath = wave(M01(lvl.v), tl.time(), 2.2 * Math.sin(Math.min(1, lvl.v * 1.6) * Math.PI) + .4); } }, 3.0)
      .from('.intro-sub', { opacity: 0, y: 12, duration: .7, ease: 'power2.out' }, 3.3)
      // sortie : la crue couvre l'écran, puis le rideau se lève d'un trait
      .to('.intro-kicker, .intro-skip, .intro-sub', { opacity: 0, duration: .3 }, 4.0)
      .to(fl, { v: -25, duration: .8, ease: 'power2.in', onUpdate: () => { flood.style.clipPath = wave(fl.v, tl.time(), 3); } }, 4.05)
      .to(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', duration: .75, ease: 'expo.inOut' }, 4.95)
      .add(heroIn, 5.2);
    G.set(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' });
    runIntro(tl, 5.75);
  }
  function M01(v) { return 112 - v * 122; } // niveau d'eau en % de la hauteur du titre (112 = vide, -10 = plein)

  /* Urgence : la clé à molette serre l'écrou pendant le défilement */
  const steps = $$('.step'), bar = $('.steps-bar');
  ScrollTrigger.create({
    trigger: '.sos', start: 'top top', end: () => '+=' + innerHeight * (MOBILE ? 2.1 : 2.6), pin: '.sos-pin', scrub: true, anticipatePin: 1,
    onUpdate: (s) => {
      S.wrench.p = s.progress; bar.style.setProperty('--p', s.progress.toFixed(3));
      const k = Math.min(2, Math.floor(s.progress * 3));
      steps.forEach((x, i) => x.classList.toggle('on', i === k));
    },
  });
  G.from('.sos-text .step', { x: 40, stagger: .1, duration: .8, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '.sos', start: 'top 60%' } });

  /* Prestations : chaque carte s'ouvre comme une vanne */
  cards.forEach((c, i) => {
    const plate = $('.plate', c), wheel = $('.wheel', c);
    const tl = G.timeline({ scrollTrigger: { trigger: c, start: 'top 90%' } });
    tl.from(c, { y: 40, opacity: 0, duration: .6, ease: 'power3.out' })
      .to(wheel, { rotation: 540, duration: .9, ease: 'power2.inOut' }, .25)
      .to(plate, { yPercent: -102, duration: .85, ease: 'power3.inOut' }, .6)
      .from($('.card-img img', c), { scale: 1.3, duration: 1.2, ease: 'power2.out' }, .6)
      .from($('.card-body > *:not(.card-foot)', c), { opacity: 0, y: 14, stagger: .08, duration: .6 }, .5)
      .fromTo($('.stream', c), { scaleX: 0 }, { scaleX: 1, duration: .8, ease: 'power2.inOut' }, 1.0)
      .from($('.price', c), { opacity: 0, x: -10, duration: .5 }, 1.0)
      .from($('.btn-add', c), { opacity: 0, scale: .8, duration: .4, ease: 'back.out(2)' }, 1.3);
    // la roue tourne aussi quand on survole
    c.addEventListener('mouseenter', () => G.to(wheel, { rotation: '+=120', duration: .6, ease: 'power2.out' }));
  });
  if (!FINE) {
    ScrollTrigger.create({ trigger: '.cards', start: 'top center', end: 'bottom center', onUpdate: () => {
      if (Date.now() - lastTouch < 1500) return;
      const mid = innerHeight * .62; let best = 0, bd = 1e9;
      cards.forEach((r, i) => { const b = r.getBoundingClientRect(); const d = Math.abs(b.top + b.height / 2 - mid); if (d < bd) { bd = d; best = i; } });
      setValve(best);
    } });
  }

  /* Devis : apparitions */
  G.from('.stepper li', { y: -14, opacity: 0, stagger: .08, duration: .5, scrollTrigger: { trigger: '.stepper', start: 'top 90%' } });
  G.from('.chip', { y: 20, opacity: 0, duration: .5, stagger: .04, ease: 'power2.out', scrollTrigger: { trigger: '#type', start: 'top 90%' } });
  G.from('.gauge-stage', { scale: .85, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.gauge-stage', start: 'top 88%' } });

  /* Avant / après : le raccord fait un aller-retour pour montrer le geste */
  $$('.cmp-in').forEach((box) => {
    const inp = $('input', box), o = { v: 50 };
    const set = () => { inp.value = o.v; box.style.setProperty('--x', o.v.toFixed(1) + '%'); };
    G.from(box, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: box, start: 'top 90%' } });
    const demo = G.timeline({ paused: true, onUpdate: set })
      .to(o, { v: 82, duration: .9, ease: 'power2.inOut' }).to(o, { v: 18, duration: 1.1, ease: 'power2.inOut' }).to(o, { v: 50, duration: .8, ease: 'power2.inOut' });
    ScrollTrigger.create({ trigger: box, start: 'top 65%', once: true, onEnter: () => { if (!box.dataset.user) demo.play(); } });
    inp.addEventListener('pointerdown', () => demo.kill(), { once: true });
    inp.addEventListener('keydown', () => demo.kill(), { once: true });
  });

  /* Zone : ondes sur la carte, cercle tracé */
  G.from('.zone-disc', { attr: { r: 0 }, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.map', start: 'top 85%' } });
  G.from('.towns-dots circle', { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', stagger: .12, duration: .5, ease: 'back.out(3)', scrollTrigger: { trigger: '.map', start: 'top 80%' } });
  G.from('.towns li', { y: 16, opacity: 0, stagger: .05, duration: .5, scrollTrigger: { trigger: '.towns', start: 'top 90%' } });

  /* Certifications : cartes qui se raccordent au tuyau */
  G.from('.plan', { y: 70, opacity: 0, rotationX: -40, duration: 1, ease: 'expo.out', stagger: .14, scrollTrigger: { trigger: '.plans', start: 'top 82%' } });
  G.from('.plans-pipe', { scaleX: 0, transformOrigin: 'left', duration: 1.4, ease: 'power2.inOut', scrollTrigger: { trigger: '.plans', start: 'top 85%' } });

  /* Avis : l'eau se vide et découvre le texte */
  $$('.rev').forEach((r, k) => {
    const w = $('.water', r), o = { v: 0 };
    G.from(r, { y: 40, duration: 1, ease: 'power3.out', delay: k * .1, scrollTrigger: { trigger: r, start: 'top 92%' } });
    G.to(o, { v: 1, duration: 1.6, ease: 'power1.inOut', delay: k * .18, scrollTrigger: { trigger: r, start: 'top 82%' },
      onUpdate: () => { w.style.clipPath = wave(-12 + o.v * 125, o.v * 3 + k, 4 * Math.sin(o.v * Math.PI) + .5, 20); if (o.v > .99) w.style.display = 'none'; } });
    w.style.clipPath = wave(-12, 0, 0, 20);
  });

  /* ───────── Commun : progression, bandeau, titres, pied de page ───────── */
  const prog = $('#prog');
  const mq = $('.mq-track');
  let mqAnim = null;
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => {
    if (prog) prog.style.setProperty('--p', s.progress.toFixed(4));
    if (!mqAnim && mq && mq.getAnimations) mqAnim = mq.getAnimations()[0];
    if (mqAnim) { const v = Math.min(Math.abs(s.getVelocity()) / 400, 5); mqAnim.playbackRate = 1 + v; G.delayedCall(.25, () => { mqAnim.playbackRate = 1; }); }
  } });
  if ($('.hero-photo img')) G.to('.hero-photo img', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  const trg = (el, s) => ({ trigger: el, start: s || 'top 86%' });
  $$('[data-a="chars"]').forEach((el) => { const c = splitChars(el);
    G.from(c, { yPercent: 70, opacity: 0, filter: 'blur(8px)', duration: .9, ease: 'power3.out', stagger: .018, scrollTrigger: trg(el, 'top 85%') }); });
  $$('[data-a="drops"]').forEach((el) => { const c = splitChars(el);
    G.from(c, { y: () => -G.utils.random(80, 160), opacity: 0, scaleY: 1.6, scaleX: .7, duration: 1, ease: 'bounce.out', stagger: { each: .02, from: 'random' }, scrollTrigger: trg(el, 'top 85%') }); });
  $$('[data-a="grow"]').forEach((el) => { const c = splitChars(el);
    G.from(c, { scale: .2, yPercent: 60, rotation: () => G.utils.random(-25, 25), opacity: 0, transformOrigin: '50% 100%', duration: 1, ease: 'back.out(2)', stagger: .02, scrollTrigger: trg(el, 'top 85%') }); });
  $$('[data-a="lines"]').forEach((el) => { const l = splitLines(el);
    G.from(l, { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: .09, scrollTrigger: trg(el, 'top 88%') }); });
  $$('[data-a="slash"]').forEach((el) => {
    G.fromTo(el, { clipPath: 'polygon(0% 0%, 0% 0%, -12% 100%, -12% 100%)', x: -30 },
      { clipPath: 'polygon(0% 0%, 112% 0%, 100% 100%, -12% 100%)', x: 0, duration: 1.1, ease: 'expo.inOut', scrollTrigger: trg(el, 'top 85%') }); });
  $$('[data-a="level"]').forEach((el) => {
    G.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)', y: 30 }, { clipPath: 'inset(-10% 0% -10% 0%)', y: 0, duration: 1.3, ease: 'power2.out', scrollTrigger: trg(el, 'top 85%') }); });
  $$('.lead, .kicker').forEach((el) => { if (el.closest('.hero') || el.closest('#intro')) return;
    G.from(el, { opacity: 0, y: 18, duration: .8, ease: 'power2.out', scrollTrigger: trg(el, 'top 90%') }); });
  if ($('.foot-brand')) G.from('.foot-brand', { yPercent: 40, opacity: 0, letterSpacing: '0.1em', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: 'footer', start: 'top 90%' } });
  if ($('.hours')) { G.from('.hours tr', { x: -30, opacity: 0, duration: .7, stagger: .1, ease: 'power3.out', scrollTrigger: trg('.hours', 'top 88%') });
    G.from('.open-now', { scale: .8, opacity: 0, duration: .6, ease: 'back.out(2)', scrollTrigger: trg('.open-now', 'top 92%') }); }
  addEventListener('load', () => ScrollTrigger.refresh());
  window.__ready = true;
})();
