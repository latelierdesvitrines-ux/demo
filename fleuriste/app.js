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

  /* ═════════ Maison Brindelune : catalogue, panier simulé (aucune donnée envoyée) ═════════ */
  Object.assign(S, { bloom: { kind: 0, col: 0xf08a5d, o: 1 }, basket: { count: 0, cols: [], ver: 0 }, parcel: { r: RM ? 1 : 0 } });

  const PRODUITS = [
    { id: 'prairie', nom: 'Prairie d’été', prix: 39, img: 'prairie', alt: 'Bouquet de zinnias roses et orangés', desc: 'Zinnias, marguerites et feuillage léger, façon fleurs des champs.', kind: 0, col: 0xf08a5d },
    { id: 'creme', nom: 'Crème champêtre', prix: 55, img: 'champetre', alt: 'Bouquet de roses crème et feuillage tenu à la main', desc: 'Roses ivoire, renoncules et verdure sauvage, très romantique.', kind: 0, col: 0xf1e3cf },
    { id: 'bonbon', nom: 'Rose bonbon', prix: 45, img: 'bonbon', alt: 'Bouquet rose et vert sur fond fuchsia', desc: 'Roses, lisianthus et véronique dans un camaïeu rose tendre.', kind: 0, col: 0xf48fb1 },
    { id: 'lys', nom: 'Lys d’albâtre', prix: 49, img: 'lys', alt: 'Bouquet de grands lys blancs', desc: 'Lys blancs parfumés, lierre et pensées, élégance pure.', kind: 2, col: 0xffffff },
    { id: 'pivoines', nom: 'Rouge & rose', prix: 59, img: 'pivoines', alt: 'Bouquet de fleurs rouges et roses dans un vase', desc: 'Pivoines, œillets et feuillage sombre pour un bouquet généreux.', kind: 0, col: 0xc2185b },
    { id: 'marguerites', nom: 'Marguerites du jardin', prix: 29, img: 'marguerites', alt: 'Marguerites dans un pot en zinc', desc: 'Marguerites et fleurs jaunes, livrées dans un pot en zinc.', kind: 1, col: 0xffffff },
    { id: 'soleil', nom: 'Soleil', prix: 35, img: 'tournesols', alt: 'Bouquet de tournesols', desc: 'Tournesols éclatants et gypsophile, pour offrir de la bonne humeur.', kind: 1, col: 0xf5b301 },
    { id: 'tulipe', nom: 'Tulipes tendres', prix: 32, img: 'tulipes', alt: 'Tulipes roses dans un verre devant une fenêtre', desc: 'Dix tulipes roses, simples et délicates.', kind: 0, col: 0xf7a8c4 },
  ];
  const panier = {};
  $('#grid').innerHTML = PRODUITS.map((p, i) => `<article class="bq${i === 0 ? ' active' : ''}" data-i="${i}" tabindex="0">
    <div class="bq-img"><img src="photos/${p.img}.webp" alt="${p.alt}" width="800" height="1000" loading="lazy"><span class="flap f1" aria-hidden="true"></span><span class="flap f2" aria-hidden="true"></span><span class="bow" aria-hidden="true"></span></div>
    <div class="bq-body"><h3>${p.nom}</h3><p>${p.desc}</p><div class="bq-foot"><span class="price">${eur(p.prix)}</span>
    <button class="btn btn-sm btn-add" type="button" data-id="${p.id}" aria-label="Ajouter au panier : ${p.nom}"><span>Ajouter</span></button></div></div></article>`).join('');

  /* Fleur 3D : se referme puis s'ouvre dans la teinte du bouquet */
  const bqs = $$('.bq'), blName = $('.bl-name'), blPrice = $('.bl-price');
  let lastTouch = 0, bloomTl = null;
  function setBloom(i, first) {
    if (!first && bqs[i].classList.contains('active')) return;
    bqs.forEach((c, k) => c.classList.toggle('active', k === i));
    const p = PRODUITS[i], set = () => { blName.textContent = p.nom; blPrice.textContent = eur(p.prix); };
    S.bloom.kind = p.kind; S.bloom.col = p.col;
    if (ANIM && !first) {
      if (bloomTl) bloomTl.kill();
      bloomTl = G.timeline().to(S.bloom, { o: 0, duration: .28, ease: 'power2.in' }).to(S.bloom, { o: 1, duration: 1.1, ease: 'power2.out' });
      G.to([blName, blPrice], { opacity: 0, y: -8, duration: .15, onComplete: () => { set(); G.fromTo([blName, blPrice], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .35, stagger: .05, ease: 'power3.out' }); } });
    } else set();
  }
  setBloom(0, true);
  bqs.forEach((c, i) => {
    c.addEventListener('mouseenter', () => setBloom(i));
    c.addEventListener('focusin', () => setBloom(i));
    c.addEventListener('touchstart', () => { lastTouch = Date.now(); setBloom(i); }, { passive: true });
  });

  /* Panier */
  let mode = 'retrait';
  const lignes = () => PRODUITS.filter((p) => panier[p.id]);
  const nbItems = () => lignes().reduce((n, p) => n + panier[p.id], 0);
  const sousTotal = () => lignes().reduce((t, p) => t + p.prix * panier[p.id], 0);
  const total = () => sousTotal() + (sousTotal() > 0 && mode === 'livraison' ? 8 : 0);
  function rendre() {
    const L = lignes();
    $('#cart-lines').innerHTML = L.map((p) => `<li><span>${p.nom}<small>${eur(p.prix)}</small></span>
      <button type="button" data-moins="${p.id}" aria-label="Retirer un ${p.nom}">−</button><b>${panier[p.id]}</b>
      <button type="button" data-plus="${p.id}" aria-label="Ajouter un ${p.nom}">+</button><strong>${eur(p.prix * panier[p.id])}</strong></li>`).join('');
    $('#cart-empty').hidden = L.length > 0;
    const n = nbItems();
    $('#cart-count').textContent = n; $('#bk-n').textContent = n; $('#bk-txt').textContent = n > 1 ? 'bouquets' : 'bouquet';
    $('#cart-total').textContent = eur(total()); $('#bk-total').textContent = eur(total());
    // pétales du panier : 20 par bouquet, aux couleurs choisies
    const cols = []; L.forEach((p) => { for (let k = 0; k < panier[p.id] * 20; k++) cols.push(k % 5 === 4 ? 0xfbe1e8 : p.col === 0xffffff ? 0xfff6f6 : p.col); });
    S.basket.cols = cols; S.basket.count = cols.length; S.basket.ver++;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.id || b.dataset.plus || b.dataset.moins;
    if (b.dataset.id || b.dataset.plus) { panier[id] = (panier[id] || 0) + 1; }
    else if (b.dataset.moins) { panier[id] = Math.max(0, panier[id] - 1); }
    if (id) {
      rendre(); $('#msg').textContent = '';
      if (b.dataset.id) { const sp = $('span', b); sp.textContent = 'Ajouté ✓'; setTimeout(() => (sp.textContent = 'Ajouter'), 1300); if (ANIM) G.fromTo('#cart-count', { scale: 1.8 }, { scale: 1, duration: .5, ease: 'back.out(3)' }); }
    }
    if (b.classList.contains('chip') && b.closest('#mode')) { radio(b.parentNode, b); mode = b.dataset.v; $('#adr-box').hidden = mode !== 'livraison'; rendre(); }
  });
  $('#jour').min = new Date().toISOString().slice(0, 10);
  rendre();

  const msg = $('#msg');
  const err = (t, el) => { msg.textContent = t; if (el) el.focus({ preventScroll: false }); if (ANIM) G.fromTo(msg, { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1, .3)' }); };
  $('#order').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sousTotal()) return err('Ajoutez d’abord un bouquet.');
    if (!$('#jour').value) return err('Choisissez un jour.', $('#jour'));
    if (mode === 'livraison' && !$('#adr').value.trim()) return err('Indiquez l’adresse de livraison (fictive en démo).', $('#adr'));
    if (!$('#nom').value.trim()) return err('Indiquez votre nom.', $('#nom'));
    if (!$('#tel').value.trim()) return err('Indiquez un téléphone (fictif en démo).', $('#tel'));
    msg.textContent = '';
    const d = new Date($('#jour').value + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const n = $('#note').value.trim();
    $('#done-title').textContent = mode === 'livraison' ? 'Votre colis est ficelé.' : 'Votre commande vous attend.';
    $('#recap-list').innerHTML = [['Nom', esc($('#nom').value.trim())], ['Bouquets', lignes().map((p) => `${panier[p.id]} × ${esc(p.nom)}`).join('<br>')], ['Réception', mode === 'livraison' ? `Livraison le ${esc(d)}, ${esc($('#creneau').value)}` : `Retrait en boutique le ${esc(d)}, ${esc($('#creneau').value)}`], ...(mode === 'livraison' ? [['Adresse', esc($('#adr').value.trim())]] : []), ['Carte', n ? esc(n.slice(0, 100)) : '—'], ['Total', eur(total())]]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    showDone();
  });
  function showDone() {
    const form = $('#order'), done = $('#done'), grid = $('.pan-grid');
    const reveal = () => { form.hidden = true; done.hidden = false; grid.classList.add('is-done'); };
    if (!ANIM) { S.parcel.r = 1; reveal(); $('.recap').focus(); return; }
    $('#valider').disabled = true;
    G.to(form, { opacity: 0, y: 16, duration: .4, ease: 'power2.in', onComplete: () => {
      reveal(); ScrollTrigger.refresh(); S.parcel.r = 0;
      scrollToEl(done, MOBILE ? 80 : 110);
      const tl = G.timeline();
      tl.to(S.parcel, { r: 1, duration: 3.4, ease: 'none' }, 0)
        .from('.recap', { opacity: 0, y: 30, duration: .8, ease: 'power3.out' }, 2.0)
        .from('#recap-list > *', { opacity: 0, x: -14, stagger: .05, duration: .4 }, 2.3)
        .from('.recap-demo', { opacity: 0, duration: .5 }, 3.0)
        .add(() => $('.recap').focus({ preventScroll: true }));
    } });
  }
  $('#again').addEventListener('click', () => {
    const form = $('#order');
    $('#done').hidden = true; form.hidden = false; form.reset(); $('#valider').disabled = false; $('.pan-grid').classList.remove('is-done');
    Object.keys(panier).forEach((k) => delete panier[k]); mode = 'retrait'; $('#adr-box').hidden = true;
    $$('#mode .chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.v === 'retrait')));
    S.parcel.r = 0; rendre();
    if (ANIM) { G.fromTo(form, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5 }); ScrollTrigger.refresh(); }
  });

  /* Horaires */
  (function () {
    const now = new Date(), j = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    const open = j === 1 ? false : j === 0 ? h >= 9 && h < 13 : h >= 9 && h < (j === 6 ? 19.5 : 19);
    const el = $('#open-now'); el.classList.toggle('is-open', open);
    $('span', el).textContent = open ? 'Ouvert en ce moment (horaires d’exemple)' : 'Fermé en ce moment (horaires d’exemple)';
    $$('.hours tr').forEach((tr) => { if (tr.dataset.d.split(',').map(Number).includes(j)) tr.classList.add('today'); });
  })();

  /* La tige : construite en pixels, dessinée selon le défilement */
  const stemEl = $('#prog'); let stemRender = () => {};
  function buildStem() {
    const w = MOBILE ? 34 : 54, h = innerHeight, cx = w / 2, a = MOBILE ? 5 : 9;
    const d = `M${cx} 0 C${cx - a} ${h * .12}, ${cx + a} ${h * .25}, ${cx} ${h * .38} S${cx - a} ${h * .64}, ${cx} ${h * .77} S${cx + a} ${h * .93}, ${cx} ${h - 24}`;
    const leaves = [.12, .26, .4, .54, .67, .8].map((f, i) => `<g class="lf" data-f="${f}" data-s="${i % 2 ? 1 : -1}"><path d="M0 0 C${i % 2 ? 14 : -14} -10, ${i % 2 ? 24 : -24} -2, ${i % 2 ? 30 : -30} 8 C${i % 2 ? 18 : -18} 12, ${i % 2 ? 6 : -6} 8, 0 0Z" fill="#6f8f6a" opacity=".92"/></g>`).join('');
    const petals = [0, 1, 2, 3, 4, 5].map((k) => `<ellipse class="pt" cx="0" cy="-9" rx="4.6" ry="9.5" fill="${k % 2 ? '#e98fa8' : '#c2506b'}" transform="rotate(${k * 60})"/>`).join('');
    stemEl.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path id="stem-path" d="${d}" fill="none" stroke="#5f8a58" stroke-width="${MOBILE ? 2 : 3}" stroke-linecap="round"/>${leaves}<g id="stem-head">${petals}<circle r="4" fill="#f2b73a"/></g></svg>`;
    const path = $('#stem-path'), L = path.getTotalLength(), head = $('#stem-head'), lfs = $$('.lf', stemEl), pts = $$('.pt', stemEl);
    path.style.strokeDasharray = L;
    stemRender = (p) => {
      path.style.strokeDashoffset = L * (1 - p);
      const tip = path.getPointAtLength(Math.max(.1, L * p)), sc = .25 + .75 * p * (MOBILE ? .7 : 1);
      head.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${(p * 220).toFixed(0)}) scale(${sc.toFixed(3)})`);
      const op = sstepJS(0, .985, p); pts.forEach((e) => e.setAttribute('ry', (4.5 + 5 * op).toFixed(2)));
      lfs.forEach((g) => { const f = +g.dataset.f, k = Math.max(0, Math.min(1, (p - f * .96) / .06)), pt = path.getPointAtLength(L * Math.min(1, f * 1.02));
        g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${(k * (MOBILE ? .7 : 1)).toFixed(3)})`); });
    };
  }
  function sstepJS(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  buildStem(); stemRender(RM || !ANIM ? 1 : 0);
  let stemP = 0;
  addEventListener('resize', () => { buildStem(); stemRender(stemP); });

  if (!ANIM) { window.__ready = true; return; }

  /* ═════════ Animations ═════════ */
  if (!S.intro.on) { heroIn(); }
  else {
    H.classList.add('intro-on');
    const intro = $('#intro');
    G.set('.it-l1, .it-l2', { opacity: 0 });
    const tl = G.timeline({ paused: true });
    tl.from('.intro-kicker span', { opacity: 0, y: 10, stagger: .06, duration: .6, ease: 'power2.out' }, 0.3)
      .to('.it-l1', { opacity: 1, y: 0, duration: .9, ease: 'power2.out' }, 3.4)
      .fromTo('.it-l2', { opacity: 0, filter: 'blur(10px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out' }, 3.8)
      .to('.intro-kicker, .intro-skip', { opacity: 0, duration: .3 }, 4.9)
      .to('.intro-title', { y: -24, opacity: 0, duration: .5, ease: 'power2.in' }, 5.0)
      .to(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', duration: .75, ease: 'expo.inOut' }, 5.05)
      .add(heroIn, 5.3);
    G.set(intro, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' });
    runIntro(tl, 5.8);
  }

  /* La tige grandit avec le défilement */
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { stemP = s.progress; stemRender(stemP); } });

  /* Bouquets : le papier kraft s'ouvre */
  bqs.forEach((c, i) => {
    const f1 = $('.f1', c), f2 = $('.f2', c), bow = $('.bow', c);
    G.set([f1, f2], { transformPerspective: 900 });
    const tl = G.timeline({ scrollTrigger: { trigger: c, start: 'top 90%' } });
    tl.from(c, { y: 50, opacity: 0, duration: .7, ease: 'power3.out' })
      .to(bow, { scale: 0, rotation: 200, duration: .6, ease: 'back.in(2)' }, .5)
      .to(f1, { rotationX: -125, duration: 1.0, ease: 'power3.inOut' }, .8)
      .to(f2, { rotationX: 125, duration: 1.0, ease: 'power3.inOut' }, .8)
      .set([f1, f2, bow], { display: 'none' })
      .from($('img', c), { scale: 1.25, duration: 1.4, ease: 'expo.out' }, .8)
      .from($$('.bq-body > *', c), { opacity: 0, y: 14, stagger: .07, duration: .6 }, 1.2);
  });
  if (!FINE) {
    ScrollTrigger.create({ trigger: '.bq-list', start: 'top center', end: 'bottom center', onUpdate: () => {
      if (Date.now() - lastTouch < 1500) return;
      const mid = innerHeight * .62; let best = 0, bd = 1e9;
      bqs.forEach((r, i) => { const b = r.getBoundingClientRect(); const dd = Math.abs(b.top + b.height / 2 - mid); if (dd < bd) { bd = dd; best = i; } });
      setBloom(best);
    } });
  }

  /* Panier */
  G.from('.basket-stage', { scale: .85, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.basket-stage', start: 'top 88%' } });
  G.from('.fs', { y: 30, opacity: 0, duration: .7, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '#order', start: 'top 85%' } });

  /* Photos : rideau */
  $$('.gimg').forEach((g) => {
    G.fromTo(g, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: g, start: 'top 86%' } });
    G.from($('img', g), { scale: 1.35, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: g, start: 'top 86%' } });
  });
  G.from('.ticks li', { x: -20, opacity: 0, stagger: .08, duration: .6, scrollTrigger: { trigger: '.ticks', start: 'top 88%' } });

  /* Abonnements : étiquettes qui se balancent */
  $$('.plan').forEach((p, k) => G.from(p, { rotation: (k % 2 ? -1 : 1) * (MOBILE ? 4 : 14), y: -40, opacity: 0, duration: 1.8, ease: 'elastic.out(1, .35)', delay: k * .12, scrollTrigger: { trigger: '.plans', start: 'top 85%' } }));
  $$('.pr-val').forEach((el) => { const v = +el.dataset.v, o = { n: 0 };
    G.to(o, { n: v, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => { el.textContent = Math.round(o.n) + ' €'; } }); });

  /* Avis */
  $$('.rev').forEach((r, k) => G.from(r, { y: 50, opacity: 0, rotation: (k - 1) * 2.5, duration: 1, ease: 'power3.out', delay: k * .1, scrollTrigger: { trigger: r, start: 'top 90%' } }));

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
