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

  /* ═════════ Le Zinc de Marcelin : carte, réservation simulée (aucune donnée envoyée) ═════════ */
  Object.assign(S, { table: { n: 2, rise: RM ? 1 : 0, done: 0 } });

  const CARTE = [
    { cat: 'Entrées', items: [
      ['Œuf mayonnaise du Zinc', 'Œuf fermier, mayonnaise maison, salade croquante', 7.5],
      ['Soupe à l’oignon gratinée', 'Croûtons, comté fondu', 9],
      ['Salade de chèvre chaud', 'Toast de chèvre, noix, miel, jeunes pousses', 11],
      ['Galette de pomme de terre', 'Saumon fumé, crème citronnée, câpres', 12]] },
    { cat: 'Plats', items: [
      ['Onglet de bœuf, échalotes confites', 'Frites maison ou purée', 21],
      ['Poulet fermier rôti', 'Jus corsé, légumes du marché', 19],
      ['Poisson du jour', 'Selon l’arrivage, beurre blanc', 22],
      ['Poêlée de champignons', 'Céleri rôti, plat végétarien', 16],
      ['Andouillette sauce moutarde', 'Pommes sautées', 18]] },
    { cat: 'Desserts', items: [
      ['Gâteau au chocolat maison', 'Crème anglaise', 8.5],
      ['Tarte fine aux pommes', 'Glace vanille', 8],
      ['Crème caramel', 'Comme à la maison', 6.5],
      ['Café gourmand', 'Trois mignardises', 9]] },
    { cat: 'Vins & boissons', items: [
      ['Vin rouge ou blanc au verre', 'Sélection du patron, 12 cl', 5],
      ['Carafe de vin', '50 cl', 14],
      ['Bière pression', '25 cl', 3.5],
      ['Eau, jus, soda', 'Selon la boisson', 3]] },
  ];
  const ring = $('#ring'), scene3 = $('#slate-scene');
  ring.innerHTML = CARTE.map((c, i) => `<section class="slate" style="--i:${i}" aria-label="${c.cat}"><h3>${c.cat}</h3><ul>${c.items.map(([n, d, p]) =>
    `<li><span class="nm"><b>${n}</b><small>${d}</small></span><span class="pr">${eur(p)}</span></li>`).join('')}</ul></section>`).join('');
  $('#slate-tabs').innerHTML = CARTE.map((c, i) => `<li${i === 0 ? ' class="on"' : ''}>${c.cat}</li>`).join('');
  const fitRing = () => ring.style.setProperty('--wpx', scene3.clientWidth + 'px');
  fitRing(); addEventListener('resize', fitRing); addEventListener('load', fitRing);

  /* Réservation : couverts, horaires */
  const MIDI = ['12:00', '12:30', '13:00', '13:30', '14:00'], SOIR = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
  const heures = () => { const v = $('#jour').value; if (!v) return [...MIDI, ...SOIR]; const j = new Date(v + 'T12:00').getDay(); return j === 1 ? [] : j === 0 ? MIDI : [...MIDI, ...SOIR]; };
  const majHeures = () => { const h = heures(); $('#heure').innerHTML = h.length ? h.map((x) => `<option>${x.replace(':', ' h ').replace(' 00', '')}</option>`).join('') : '<option>Fermé ce jour-là</option>'; };
  let couverts = 2, occ = 'Repas simple';
  const TXT = ['', 'Une table pour un', 'Une table pour deux', 'Pour trois', 'Pour quatre', 'Pour cinq', 'Pour six', 'Pour sept', 'Pour huit', 'Pour neuf : privatisation conseillée', 'Pour dix : privatisation conseillée', 'Pour onze : privatisation conseillée', 'Pour douze : privatisation conseillée'];
  function majCouverts() {
    $('#couverts').textContent = couverts; $('#couv').textContent = couverts; $('#couv-txt').textContent = couverts > 1 ? 'couverts · ' + TXT[couverts] : 'couvert · ' + TXT[1];
    S.table.n = couverts;
    if (ANIM) { G.fromTo('#couverts, #couv', { scale: 1.35 }, { scale: 1, duration: .4, ease: 'back.out(3)' }); }
  }
  $('#plus').onclick = () => { couverts = Math.min(12, couverts + 1); majCouverts(); };
  $('#moins').onclick = () => { couverts = Math.max(1, couverts - 1); majCouverts(); };
  $('#jour').addEventListener('change', majHeures);
  $('#jour').min = new Date().toISOString().slice(0, 10);
  majHeures(); majCouverts();

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.classList.contains('chip') && b.closest('#occasion')) { radio(b.parentNode, b); occ = b.dataset.v; $('#msg').textContent = ''; }
    else if (b.dataset.type) { const c = $(`#occasion .chip[data-v="${b.dataset.type}"]`); if (c) { radio(c.parentNode, c); occ = b.dataset.type; } }
  });

  const msg = $('#msg');
  const err = (t, el) => { msg.textContent = t; if (el) el.focus({ preventScroll: false }); if (ANIM) G.fromTo(msg, { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1, .3)' }); };
  $('#order').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!$('#nom').value.trim()) return err('Indiquez votre nom.', $('#nom'));
    if (!$('#tel').value.trim()) return err('Indiquez un téléphone (fictif en démo).', $('#tel'));
    if (!$('#jour').value) return err('Choisissez une date.', $('#jour'));
    if (!heures().length) return err('Nous sommes fermés le lundi : choisissez un autre jour.', $('#jour'));
    if (couverts > 8 && occ !== 'Privatisation') return err('Au-delà de 8 couverts, choisissez « Privatisation ».', $('#occasion .chip:last-child'));
    msg.textContent = '';
    const d = new Date($('#jour').value + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const n = $('#note').value.trim();
    $('#recap-list').innerHTML = [['Nom', esc($('#nom').value.trim())], ['Couverts', String(couverts)], ['Quand', `${esc(d)} à ${esc($('#heure').value)}`], ['Occasion', esc(occ)], ['Remarque', n ? esc(n.slice(0, 120)) : '—'], ['Confirmation', 'Par téléphone sous 24 h']]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    showDone();
  });
  function showDone() {
    const form = $('#order'), done = $('#done'), grid = $('.resa-grid');
    const reveal = () => { form.hidden = true; done.hidden = false; grid.classList.add('is-done'); };
    if (!ANIM) { S.table.done = 1; reveal(); $('.recap').focus(); return; }
    $('#valider').disabled = true;
    G.to(form, { opacity: 0, y: 16, duration: .4, ease: 'power2.in', onComplete: () => {
      reveal(); ScrollTrigger.refresh(); S.table.done = 0;
      scrollToEl(grid, MOBILE ? 66 : 96);
      const tl = G.timeline();
      tl.to(S.table, { done: 1, duration: 2.6, ease: 'none' }, 0)
        .from('.recap', { opacity: 0, y: 30, duration: .8, ease: 'power3.out' }, .8)
        .from('#recap-list > *', { opacity: 0, x: -14, stagger: .05, duration: .4 }, 1.1)
        .from('.recap-demo', { opacity: 0, duration: .5 }, 1.7)
        .add(() => $('.recap').focus({ preventScroll: true }));
    } });
  }
  $('#again').addEventListener('click', () => {
    const form = $('#order');
    $('#done').hidden = true; form.hidden = false; form.reset(); $('#valider').disabled = false; $('.resa-grid').classList.remove('is-done');
    S.table.done = 0; couverts = 2; occ = 'Repas simple'; majCouverts(); majHeures();
    $$('#occasion .chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.v === 'Repas simple')));
    if (ANIM) { G.fromTo(form, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5 }); ScrollTrigger.refresh(); }
  });

  /* Horaires */
  (function () {
    const now = new Date(), j = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    const open = j === 1 ? false : j === 0 ? h >= 12 && h < 15 : (h >= 12 && h < 14.5) || (h >= 19 && h < (j === 6 ? 23 : 22.5));
    const el = $('#open-now'); el.classList.toggle('is-open', open);
    $('span', el).textContent = open ? 'Ouvert en ce moment (horaires d’exemple)' : 'Fermé en ce moment (horaires d’exemple)';
    $$('.hours tr').forEach((tr) => { if (tr.dataset.d.split(',').map(Number).includes(j)) tr.classList.add('today'); });
  })();

  if (!ANIM) { window.__ready = true; return; }

  /* ═════════ Animations ═════════ */
  if (!S.intro.on) { heroIn(); }
  else {
    H.classList.add('intro-on');
    const intro = $('#intro');
    const tl = G.timeline({ paused: true });
    tl.from('.intro-kicker span', { opacity: 0, y: 10, stagger: .06, duration: .6, ease: 'power2.out' }, 0.2)
      .fromTo('.intro-title', { opacity: 0, filter: 'blur(14px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.4, ease: 'power2.out' }, 1.35);
    $$('.steam i').forEach((p, k) => {
      const dx = (k - 4) * 34;
      tl.fromTo(p, { opacity: 0, y: 40, x: dx, scale: .5 },
        { keyframes: [{ opacity: .55, y: -40, x: dx + G.utils.random(-20, 20), scale: 1.2, duration: .9, ease: 'sine.out' }, { opacity: 0, y: -210, x: dx * 1.7 + G.utils.random(-40, 40), scale: 2.4, duration: 1.5, ease: 'sine.in' }] }, 1.0 + k * .11);
    });
    tl.to('.intro-kicker, .intro-skip', { opacity: 0, duration: .3 }, 3.7)
      .to('.intro-title', { y: -20, opacity: 0, duration: .5, ease: 'power2.in' }, 3.85)
      .to(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', duration: .75, ease: 'expo.inOut' }, 3.9)
      .add(heroIn, 4.15);
    G.set(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' });
    runIntro(tl, 4.7);
  }

  /* La carte : le prisme d'ardoises tourne pendant le défilement */
  const tabs = $$('#slate-tabs li');
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  ScrollTrigger.create({
    trigger: '.carte', start: 'top top', end: () => '+=' + innerHeight * (MOBILE ? 2.6 : 3.2), pin: '.carte .pin-in', scrub: true, anticipatePin: 1,
    onUpdate: (s) => {
      const f = s.progress * 3, k = Math.min(2, Math.floor(f)), u = f - k;
      const pos = s.progress >= 1 ? 3 : k + sm(.3, .85, u);
      ring.style.setProperty('--rot', (-pos * 90).toFixed(2) + 'deg');
      const cur = Math.round(pos) % 4; tabs.forEach((t, i) => t.classList.toggle('on', i === cur));
    },
  });

  /* Les plats glissent sur le comptoir */
  $$('.dish').forEach((d, i) => {
    const dir = i % 2 ? 1 : -1, tl = G.timeline({ scrollTrigger: { trigger: d, start: 'top 88%' } });
    tl.from(d, { x: dir * Math.min(innerWidth * .6, 420), rotation: dir * 24, opacity: 0, duration: 1.5, ease: 'expo.out' }, 0)
      .from($('.dish-p', d), { rotation: dir * 140, duration: 1.6, ease: 'expo.out' }, 0)
      .from($('figcaption b', d), { opacity: 0, y: 16, duration: .7 }, .7)
      .fromTo($('.chalk', d), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .8, ease: 'power1.inOut' }, .9);
  });

  /* Les formules sortent comme des tickets */
  $$('.tk').forEach((t, i) => {
    const rot = [-2, 0, 2][i];
    G.timeline({ scrollTrigger: { trigger: '.tickets', start: 'top 82%' } })
      .fromTo(t, { clipPath: 'inset(0% 0% 100% 0%)', y: -110 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.1, ease: 'power2.out' }, i * .5)
      .to(t, { rotation: MOBILE ? 0 : rot, duration: .6, ease: 'back.out(2)', clearProps: MOBILE ? 'clipPath,transform' : 'clipPath' }, i * .5 + 1.0);
  });
  G.from('.slot', { scaleX: 0, duration: .8, ease: 'expo.out', scrollTrigger: { trigger: '.slot', start: 'top 90%' } });

  /* Réservation : la table se dresse */
  ScrollTrigger.create({ trigger: '.table-stage', start: 'top 80%', once: true, onEnter: () => G.to(S.table, { rise: 1, duration: 1.6, ease: 'none' }) });
  G.from('.fs', { y: 30, opacity: 0, duration: .7, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '#order', start: 'top 85%' } });

  /* Photos : rideau de zinc */
  $$('.gimg').forEach((g) => {
    G.fromTo(g, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: g, start: 'top 85%' } });
    G.from($('img', g), { scale: 1.35, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: g, start: 'top 85%' } });
  });
  G.from('.ticks li', { x: -20, opacity: 0, stagger: .08, duration: .6, scrollTrigger: { trigger: '.ticks', start: 'top 88%' } });

  /* Avis */
  $$('.rev').forEach((r, k) => G.from(r, { y: 50, opacity: 0, rotation: (k - 1) * 2, duration: 1, ease: 'power3.out', delay: k * .1, scrollTrigger: { trigger: r, start: 'top 90%' } }));

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
