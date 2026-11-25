// Animations au défilement + mini-commande (simulée : rien n'est envoyé).
(function () {
  var rm = document.documentElement.classList.contains('rm')
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
  }, { threshold: .12 })
  document.querySelectorAll('.rv').forEach(function (n, i) { n.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(n) })
  // léger décalage des visuels du hero au défilement
  var pars = [].slice.call(document.querySelectorAll('[data-par]')), tick = false
  function par() { tick = false; var y = scrollY; pars.forEach(function (p) { p.style.translate = '0 ' + (y * p.dataset.par) + 'px' }) }
  if (!rm) addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(par) } }, { passive: true })
  // panier
  var cart = {}, txt = document.getElementById('ordtxt'), msg = document.getElementById('cmsg')
  var fmt = function (n) { return n.toFixed(2).replace('.', ',') + ' €' }
  function total() { var t = 0, c = 0; for (var k in cart) { t += cart[k].p * cart[k].q; c += cart[k].q } txt.textContent = (c ? 'Commander (' + c + ') · ' : 'Commander · ') + fmt(t); return c }
  document.querySelectorAll('.add').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.closest('[data-id]'), id = a.dataset.id
      cart[id] = cart[id] || { p: parseFloat(a.dataset.price), q: 0 }; cart[id].q++
      total(); msg.textContent = ''; b.classList.add('ok'); setTimeout(function () { b.classList.remove('ok') }, 500)
    })
  })
  document.getElementById('order').addEventListener('click', function () {
    msg.textContent = total() ? 'Démonstration : rien n\'est envoyé ni payé. Sur un vrai site, retrait en 10 min.' : 'Ajoutez un plat ou une formule pour commander.'
  })
  document.querySelectorAll('.qf').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault(); var m = f.querySelector('.msg'), t = f.t.value.replace(/\D/g, '')
      m.textContent = (!f.p.value.trim() || t.length < 10) ? 'Indiquez votre prénom et un numéro à 10 chiffres.' : 'Démonstration : rien n\'est envoyé.'
    })
  })
})()
