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

  /* ═════════ Atelier Chaux-Vive : données, devis simulé (aucune donnée n'est envoyée) ═════════ */
  Object.assign(S, { paint: { p: 0 }, trowel: { p: RM ? 1 : 0 }, wall: { t: RM ? 1 : 0 } });

  const TRAVAUX = [
    { id: 'int', nom: 'Peinture intérieure', min: 22, max: 32, c: '#c4573a', img: 'apres1', alt: 'Salon aux murs clairs et lumineux', desc: 'Murs et plafonds : préparation, sous-couche, deux couches.' },
    { id: 'enduit', nom: 'Rebouchage et enduits', min: 35, max: 55, c: '#e0a84a', img: 'enduit', alt: 'Vieux mur dégradé à reprendre', desc: 'Fissures, lissage, reprise des supports avant peinture.' },
    { id: 'facade', nom: 'Façade et ravalement', min: 40, max: 65, c: '#6b8a5a', img: 'facade', alt: 'Nacelle élévatrice devant une façade peinte', desc: 'Nettoyage, réparation, enduit ou peinture de façade.' },
    { id: 'boiserie', nom: 'Boiseries, portes, volets', min: 45, max: 80, c: '#4a6f9a', img: 'pinceau', alt: 'Pinceau de peintre posé sur un tissu fleuri', desc: 'Ponçage, lasure ou laque, finitions soignées.' },
    { id: 'deco', nom: 'Peinture décorative, fresques', min: 30, max: 55, c: '#8e6b8a', img: 'rouleau', alt: 'Fresque murale peinte sur une façade en briques', desc: 'Teintes à la chaux, effets décoratifs, fresques murales.' },
    { id: 'reno', nom: 'Rénovation complète', min: 350, max: 650, c: '#b8a88f', img: 'cuisine', alt: 'Cuisine moderne rénovée', desc: 'Plâtrerie, électricité légère, peinture, sols : un seul interlocuteur.' },
  ];
  $('#grid').innerHTML = TRAVAUX.map((p) => `<article class="card" style="--c:${p.c}">
    <div class="card-img"><img src="photos/${p.img}.webp" alt="${p.alt}" width="800" height="600" loading="lazy"><span class="wipe" aria-hidden="true"><i></i><i></i><i></i></span><span class="card-chip" aria-hidden="true"></span></div>
    <div class="card-body"><h3>${p.nom}</h3><p>${p.desc}</p>
      <div class="card-foot"><span class="price"><small>dès</small>${p.min} €/m²</span>
      <button class="btn btn-sm ghost btn-add" type="button" data-id="${p.id}" aria-label="Demander un devis : ${p.nom}"><span>Demander un devis</span></button></div></div></article>`).join('');
  $('#travaux').innerHTML = TRAVAUX.map((p) => `<button type="button" class="chip" role="radio" aria-checked="false" data-id="${p.id}">${p.nom}</button>`).join('');

  /* Nuancier : une pastille par réponse */
  const SW = [['Bien', '#c4573a'], ['Travaux', '#e0a84a'], ['Surface', '#6b8a5a'], ['Pièces', '#4a6f9a'], ['État des murs', '#8e6b8a'], ['Début', '#b8a88f'], ['Contact', '#2e2a26']];
  $('#sw-list').innerHTML = SW.map(([k, c]) => `<li class="sw" style="--c:${c}"><span class="sw-fill"></span><span class="sw-t"><small>${k}</small><b>—</b></span></li>`).join('');
  const sws = $$('.sw');
  const fillSw = (i, text) => { const el = sws[i], on = !!text; if (!on && !el.classList.contains('full')) return;
    el.classList.toggle('full', on); $('b', el).textContent = on ? text : '—';
    if (ANIM && on) G.fromTo($('.sw-t b', el), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .5, ease: 'power3.out' }); };

  const Q = { bien: '', travaux: '', pieces: [], etat: '', delai: '' };
  const tr = () => TRAVAUX.find((x) => x.id === Q.travaux);
  const rnd10 = (n) => Math.round(n / 10) * 10;
  function estim() {
    const t = tr(), s = +$('#surface').value;
    $('#estim').textContent = t && s >= 5 ? `${rnd10(t.min * s).toLocaleString('fr-FR')} – ${rnd10(t.max * s).toLocaleString('fr-FR')} € TTC` : '—';
  }
  function majContact() { const ok = $('#nom').value.trim() && $('#tel').value.trim() && /^\d{5}$/.test($('#cp').value); fillSw(6, ok ? $('#nom').value.trim().split(' ')[0] : ''); }
  ['#nom', '#tel', '#cp'].forEach((s) => $(s).addEventListener('input', majContact));
  $('#surface').addEventListener('input', () => { const s = +$('#surface').value; fillSw(2, s >= 5 ? `${s} m²` : ''); estim(); });

  const msg = $('#msg');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const grp = b.closest('.chips');
    if (grp && b.classList.contains('chip')) {
      if (grp.id === 'pieces') {
        const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on));
        Q.pieces = $$('#pieces .chip[aria-checked="true"]').map((x) => x.dataset.v); fillSw(3, Q.pieces.length ? Q.pieces.join(', ') : '');
      } else {
        radio(grp, b);
        if (grp.id === 'bien') { Q.bien = b.dataset.v; fillSw(0, Q.bien); }
        if (grp.id === 'travaux') { Q.travaux = b.dataset.id; fillSw(1, tr().nom); estim(); }
        if (grp.id === 'etat') { Q.etat = b.dataset.v; fillSw(4, b.textContent); }
        if (grp.id === 'delai') { Q.delai = b.dataset.v; fillSw(5, Q.delai); }
      }
      msg.textContent = '';
    } else if (b.classList.contains('btn-add')) {
      const c = $(`#travaux .chip[data-id="${b.dataset.id}"]`); if (c) c.click();
      const t = $('#devis'); requestAnimationFrame(() => window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 40, behavior: ANIM ? 'smooth' : 'instant' }));
    }
  });

  const err = (t, el) => { msg.textContent = t; if (el) el.focus({ preventScroll: false }); if (ANIM) G.fromTo(msg, { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1, .3)' }); };
  $('#order').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!Q.travaux) return err('Choisissez le type de travaux.', $('#travaux .chip'));
    if (!($('#surface').value >= 5)) return err('Indiquez une surface d’au moins 5 m².', $('#surface'));
    if (!$('#nom').value.trim()) return err('Indiquez votre nom.', $('#nom'));
    if (!$('#tel').value.trim()) return err('Indiquez un téléphone (fictif en démo).', $('#tel'));
    if (!/^\d{5}$/.test($('#cp').value)) return err('Le code postal doit avoir 5 chiffres.', $('#cp'));
    msg.textContent = '';
    const n = $('#note').value.trim();
    $('#recap-list').innerHTML = [['Nom', esc($('#nom').value.trim())], ['Bien', esc(Q.bien || 'non précisé')], ['Travaux', esc(tr().nom)], ['Surface', `${esc($('#surface').value)} m²`], ['Pièces', esc(Q.pieces.join(', ') || 'non précisées')], ['Murs', esc(Q.etat || 'non précisé')], ['Début', esc(Q.delai || 'non précisé')], ['Remarque', n ? esc(n.slice(0, 120)) : '—'], ['Estimation', $('#estim').textContent], ['Réponse', 'Visite et devis sous 48 h']]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    showDone();
  });
  function showDone() {
    const form = $('#order'), done = $('#done'), grid = $('.devis-grid');
    const reveal = () => { form.hidden = true; done.hidden = false; grid.classList.add('is-done'); };
    if (!ANIM) { S.wall.t = 1; reveal(); $('.recap').focus(); return; }
    $('#valider').disabled = true;
    G.to(form, { opacity: 0, y: 16, duration: .4, ease: 'power2.in', onComplete: () => {
      reveal(); ScrollTrigger.refresh(); S.wall.t = 0;
      scrollToEl(done, MOBILE ? 80 : 110);
      const tl = G.timeline();
      tl.to(S.wall, { t: 1, duration: 3.2, ease: 'none' }, 0)
        .from('.recap', { opacity: 0, y: 30, duration: .8, ease: 'power3.out' }, 1.8)
        .from('#recap-list > *', { opacity: 0, x: -14, stagger: .04, duration: .4 }, 2.1)
        .from('.recap-demo', { opacity: 0, duration: .5 }, 2.8)
        .add(() => $('.recap').focus({ preventScroll: true }));
    } });
  }
  $('#again').addEventListener('click', () => {
    const form = $('#order');
    $('#done').hidden = true; form.hidden = false; form.reset(); $('#valider').disabled = false; $('.devis-grid').classList.remove('is-done');
    Object.assign(Q, { bien: '', travaux: '', pieces: [], etat: '', delai: '' });
    $$('.chips .chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
    sws.forEach((_, i) => fillSw(i, '')); estim(); S.wall.t = 0;
    if (ANIM) { G.fromTo(form, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5 }); ScrollTrigger.refresh(); }
  });

  /* Horaires */
  (function () {
    const now = new Date(), j = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    const open = j >= 1 && j <= 5 ? h >= 8 && h < 17.5 : j === 6 ? h >= 9 && h < 12 : false;
    const el = $('#open-now'); el.classList.toggle('is-open', open);
    $('span', el).textContent = open ? 'Atelier ouvert en ce moment (horaires d’exemple)' : 'Atelier fermé en ce moment (horaires d’exemple)';
    $$('.hours tr').forEach((r) => { if (r.dataset.d.split(',').map(Number).includes(j)) r.classList.add('today'); });
  })();

  /* Avant / après : la poignée est un rouleau */
  $$('.cmp-in').forEach((box) => {
    const inp = $('input', box);
    inp.addEventListener('input', () => { box.style.setProperty('--x', inp.value + '%'); box.dataset.user = 1; });
  });

  if (!ANIM) { window.__ready = true; return; }

  /* ═════════ Animations ═════════ */
  const fanIn = () => G.from('.swatches i', { rotation: 0, y: 40, opacity: 0, stagger: .09, duration: 1, ease: 'back.out(2)', delay: .5 });
  const LENR = 1.6, HH = Math.tan(17.5 * Math.PI / 180) * 10;
  function applyPaint() {
    const p = S.paint.p, hw = HH * innerWidth / innerHeight, bandH = HH * 2 / 3, m = .5 * (bandH * 1.04) / LENR;
    const b = Math.min(2, Math.floor(p)), u = p >= 3 ? 1 : p - b;
    $$('.pb').forEach((el, i) => {
      if (i < b || p >= 3) { el.style.clipPath = 'inset(0 0 0 0)'; return; }
      if (i > b) { el.style.clipPath = 'inset(0 100% 0 0)'; return; }
      const dir = i % 2 === 0 ? 1 : -1, x = dir > 0 ? -hw - m + u * (2 * hw + 2 * m) : hw + m - u * (2 * hw + 2 * m);
      const pct = Math.max(0, Math.min(100, (x + hw) / (2 * hw) * 100));
      el.style.clipPath = dir > 0 ? `inset(0 ${(100 - pct).toFixed(2)}% 0 0)` : `inset(0 0 0 ${pct.toFixed(2)}%)`;
    });
  }

  if (!S.intro.on) { heroIn(); fanIn(); }
  else {
    H.classList.add('intro-on');
    const intro = $('#intro');
    const tl = G.timeline({ paused: true });
    tl.from('.intro-kicker span', { opacity: 0, y: 10, stagger: .06, duration: .6, ease: 'power2.out' }, 3.2)
      .to(S.paint, { p: 1, duration: .85, ease: 'power1.inOut', onUpdate: applyPaint }, .5)
      .to(S.paint, { p: 2, duration: .85, ease: 'power1.inOut', onUpdate: applyPaint }, 1.5)
      .to(S.paint, { p: 3, duration: .85, ease: 'power1.inOut', onUpdate: applyPaint }, 2.5)
      .from('.it-l2', { letterSpacing: '0.07em', duration: 1.6, ease: 'expo.out' }, 2.7)
      .from('.it-l1', { y: 16, duration: .8, ease: 'power3.out' }, 2.7)
      .to('.intro-kicker, .intro-skip', { opacity: 0, duration: .3 }, 4.0)
      .to('.intro-title', { y: -24, opacity: 0, duration: .5, ease: 'power2.in' }, 4.1)
      .to(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', duration: .75, ease: 'expo.inOut' }, 4.15)
      .add(() => { heroIn(); fanIn(); }, 4.4);
    G.set(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' });
    applyPaint();
    runIntro(tl, 4.95);
  }

  /* Méthode : la truelle pose les couches pendant le défilement */
  const steps = $$('.step'), bar = $('.steps-bar');
  ScrollTrigger.create({
    trigger: '.couches', start: 'top top', end: () => '+=' + innerHeight * (MOBILE ? 2.2 : 2.8), pin: '.couches .pin-in', scrub: true, anticipatePin: 1,
    onUpdate: (s) => {
      S.trowel.p = s.progress; bar.style.setProperty('--p', s.progress.toFixed(3));
      const k = Math.min(3, Math.floor(s.progress * 4));
      steps.forEach((x, i) => x.classList.toggle('on', i === k));
    },
  });
  G.from('.pin-text .step', { x: 40, stagger: .1, duration: .8, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '.couches', start: 'top 60%' } });

  /* Travaux : une bande de peinture découvre chaque photo */
  $$('.card').forEach((c, i) => {
    const tl = G.timeline({ scrollTrigger: { trigger: c, start: 'top 90%' } });
    tl.from(c, { y: 50, opacity: 0, duration: .7, ease: 'power3.out' })
      .to($$('.wipe i', c), { scaleX: 0, duration: .8, ease: 'power3.inOut', stagger: .14 }, .3)
      .from($('.card-chip', c), { scale: 0, rotation: -40, duration: .6, ease: 'back.out(2.4)' }, 1.0)
      .from($$('.card-body > *', c), { y: 14, opacity: 0, stagger: .07, duration: .6, ease: 'power2.out' }, .5);
  });

  /* Avant / après : les murs se repeignent (bandes), puis la poignée se range au centre */
  $$('.cmp-in').forEach((box) => {
    const inp = $('input', box), o = { v: 108 };
    const set = () => { box.style.setProperty('--x', o.v.toFixed(1) + '%'); inp.value = Math.max(0, Math.min(100, o.v)); };
    set();
    G.from(box, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: box, start: 'top 90%' } });
    const demo = G.timeline({ paused: true, onUpdate: set })
      .to(o, { v: -8, duration: 2.2, ease: 'power1.inOut' }).to(o, { v: 50, duration: .9, ease: 'power2.inOut' });
    ScrollTrigger.create({ trigger: box, start: 'top 70%', once: true, onEnter: () => { if (!box.dataset.user) demo.play(); } });
    inp.addEventListener('pointerdown', () => { demo.kill(); box.dataset.user = 1; }, { once: true });
    inp.addEventListener('keydown', () => { demo.kill(); box.dataset.user = 1; }, { once: true });
  });

  /* Étapes : chaque brique tombe en place */
  $$('.brick').forEach((b, i) => {
    G.from(b, { y: -140, opacity: 0, rotation: () => G.utils.random(-5, 5), scale: .94, duration: 1, ease: 'bounce.out', scrollTrigger: { trigger: b, start: 'top 92%' } });
    G.from($$('.bn, b, span:last-child', b), { opacity: 0, y: 10, stagger: .08, duration: .5, delay: .5, scrollTrigger: { trigger: b, start: 'top 92%' } });
  });

  /* Devis : les fiches du nuancier arrivent comme un éventail */
  G.from('.sw', { x: -40, opacity: 0, stagger: .07, duration: .7, ease: 'power3.out', scrollTrigger: { trigger: '.nuancier', start: 'top 85%' } });
  G.from('.fs', { y: 30, opacity: 0, duration: .7, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '#order', start: 'top 85%' } });

  /* Garanties : cartes de nuancier */
  G.from('.plan', { y: 70, opacity: 0, rotation: () => G.utils.random(-3, 3), duration: 1, ease: 'expo.out', stagger: .12, scrollTrigger: { trigger: '.plans', start: 'top 85%' } });

  /* Zone */
  G.from('.zone-disc', { attr: { r: 0 }, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.map', start: 'top 85%' } });
  G.from('.towns-dots circle', { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', stagger: .12, duration: .5, ease: 'back.out(3)', scrollTrigger: { trigger: '.map', start: 'top 80%' } });
  G.from('.towns li', { y: 16, opacity: 0, stagger: .05, duration: .5, scrollTrigger: { trigger: '.towns', start: 'top 90%' } });

  /* Avis : le mur est lessivé d'un coup d'éponge */
  $$('.rev').forEach((r, k) => {
    const w = $('.wash', r);
    G.from(r, { y: 40, duration: 1, ease: 'power3.out', delay: k * .1, scrollTrigger: { trigger: r, start: 'top 92%' } });
    G.fromTo(w, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)', duration: 1.5, ease: 'power2.inOut', delay: k * .2, scrollTrigger: { trigger: r, start: 'top 82%' }, onComplete: () => { w.style.display = 'none'; } });
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
