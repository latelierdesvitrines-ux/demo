// Particules WebGL1 : une photo devient une grille de points (1 point = 1 « pixel » de step px).
// Tout le mouvement est calculé dans le vertex shader à partir de uniformes pilotés par le scroll.
window.Particles = function (canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' })
  if (!gl) return null
  const vs = `
attribute vec2 aHome; attribute vec3 aCol; attribute vec4 aRnd;
uniform vec2 uRes; uniform float uDpr, uStep, uE, uS, uD, uMode, uT;
uniform vec2 uC, uTilt; uniform vec4 uStream; uniform vec3 uBeam; uniform vec3 uCup;
varying vec3 vCol; varying float vE, vA, vRot, vSeed, vMode;
float sm(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
void main(){
  vec2 d = aHome - uC;
  float e0 = uE*1.9 - aRnd.w*.12 - length(d)/length(uRes)*1.1; float e = sm(e0); vec2 dir = d/(length(d)+1.);
  float sw = e*(aRnd.x-.35)*2.2;
  vec2 q = mat2(cos(sw),sin(sw),-sin(sw),cos(sw))*d;
  vec2 rd = vec2(cos(aRnd.y*6.2832), sin(aRnd.y*6.2832));
  float far = uMode > .5 ? 1.25 : .75;
  vec2 pe = uC + q + (dir*(.25+aRnd.z) + rd*.55)*e*uRes.y*far;
  pe += e*vec2(sin(uT*.5+aRnd.x*30.), cos(uT*.4+aRnd.y*30.))*14.;
  float z = e*(aRnd.z*1.7-.5);
  vec2 sc = uRes*.5 + uTilt*40.*z;
  pe = sc + (pe-sc)/(1.+z);
  // Flux : 22 % des points forment deux filets, le reste se pose sur la crème de la tasse.
  float s = sm(uS*1.6 - aRnd.w*.6);
  vec2 tgt;
  if (aRnd.z < .22) {
    float f = fract(aRnd.y + uT*(.5+aRnd.x*.25));
    float y0 = mix(uStream.z, uStream.w, uD);
    tgt = vec2(mix(uStream.x, uStream.y, step(.5, aRnd.x)) + (aRnd.w-.5)*(2.+f*5.), mix(y0, uStream.w, f));
  } else {
    float a = aRnd.y*6.2832, r = sqrt(aRnd.x);
    tgt = uCup.xy + vec2(cos(a), sin(a)*.2)*r*uCup.z;
  }
  vec2 pos = mix(pe, tgt, s);
  float size = mix(uStep+.6, mix(1.1+aRnd.x*1.9, 2.5+aRnd.x*6.5, uMode)/(1.+z), sm(e*4.));
  size = mix(size, aRnd.z < .22 ? 2.2 : 1.6, s) * (1.-uD*step(.22, aRnd.z));
  vec3 col = aCol;
  if (uMode < .5) col = mix(col, vec3(.34,.2,.11)*(.55+aRnd.x*.9), e*.65);
  col = mix(col, vec3(.72,.40,.15)*(.75+aRnd.z*.6), s);
  float bd = abs(dot(vec3(pos,1.), uBeam));
  float glow = (1.-smoothstep(0., 70., bd))*sm(e*3.)*(1.-s);
  col += vec3(1.,.78,.5)*glow*.9; size += glow*1.2;
  vCol = col; vE = e0 < .26 ? -1. : sm(e*5.); vA = 1.; vRot = aRnd.y*6.2832 + e*aRnd.x*8.; vSeed = aRnd.x; vMode = uMode;
  gl_PointSize = size*uDpr;
  gl_Position = vec4(pos/uRes*2.-1., 0., 1.) * vec4(1.,-1.,1.,1.);
}`
  const fs = `precision mediump float;
varying vec3 vCol; varying float vE, vA, vRot, vSeed, vMode;
void main(){
  vec2 c = gl_PointCoord-.5; float a = 1.;
  vec3 col = vCol;
  if (vE < 0.) discard; // pas encore parti : la vraie photo est visible dessous
  if (vE > .01) {
    if (vMode > .5) {
      vec2 r = mat2(cos(vRot),sin(vRot),-sin(vRot),cos(vRot))*c;
      float sh = abs(r.x)*1.15 + abs(r.y)*2.2 + r.x*r.y*1.5*vSeed;
      a = mix(1., 1.-smoothstep(.40,.48,sh), vE);
      col *= mix(1., .78 + .55*abs(sin(vRot*1.7)) + .25*(r.y+.3), vE);
    } else a = mix(1., 1.-smoothstep(.3,.5,length(c)), vE);
  }
  if (a < .02) discard;
  gl_FragColor = vec4(col, a*vA);
}`
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
  const pr = gl.createProgram()
  try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)) } catch (e) { console.warn(e); return null }
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return null }
  gl.useProgram(pr)
  const U = {}; for (const n of ['uRes', 'uDpr', 'uStep', 'uE', 'uS', 'uD', 'uMode', 'uT', 'uC', 'uTilt', 'uStream', 'uBeam', 'uCup']) U[n] = gl.getUniformLocation(pr, n)
  const A = { aHome: 2, aCol: 3, aRnd: 4 }, loc = {}
  for (const k in A) { loc[k] = gl.getAttribLocation(pr, k); gl.enableVertexAttribArray(loc[k]) }
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  const sets = {}, smp = document.createElement('canvas'), sx = smp.getContext('2d', { willReadFrequently: true })
  let dpr = 1, W = 1, H = 1

  return {
    resize(w, h) { dpr = Math.min(devicePixelRatio || 1, 2); W = w; H = h; canvas.width = w * dpr; canvas.height = h * dpr; gl.viewport(0, 0, canvas.width, canvas.height) },
    // r = rectangle « cover » de l'image en px CSS (identique à object-fit:cover)
    build(key, img, r, step) {
      const gw = Math.ceil(W / step), gh = Math.ceil(H / step)
      smp.width = gw; smp.height = gh
      sx.fillStyle = '#0d0a08'; sx.fillRect(0, 0, gw, gh)
      sx.drawImage(img, r.x / step, r.y / step, r.w / step, r.h / step)
      let px; try { px = sx.getImageData(0, 0, gw, gh).data } catch (e) { return false } // file:// = image « teintée »
      const n = gw * gh, home = new Float32Array(n * 2), col = new Float32Array(n * 3), rnd = new Float32Array(n * 4)
      for (let i = 0; i < n; i++) {
        home[i * 2] = (i % gw + .5) * step; home[i * 2 + 1] = ((i / gw | 0) + .5) * step
        for (let k = 0; k < 3; k++) col[i * 3 + k] = px[i * 4 + k] / 255
        for (let k = 0; k < 4; k++) rnd[i * 4 + k] = Math.random()
      }
      const bufs = {}
      for (const [k, data] of [['aHome', home], ['aCol', col], ['aRnd', rnd]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); bufs[k] = b }
      if (sets[key]) for (const k in sets[key].bufs) gl.deleteBuffer(sets[key].bufs[k])
      sets[key] = { bufs, n, step }
      return true
    },
    has: (key) => !!sets[key],
    clear() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT) },
    draw(key, u) {
      const s = sets[key]; if (!s) return
      for (const k in A) { gl.bindBuffer(gl.ARRAY_BUFFER, s.bufs[k]); gl.vertexAttribPointer(loc[k], A[k], gl.FLOAT, false, 0, 0) }
      gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uStep, s.step)
      for (const n of ['uE', 'uS', 'uD', 'uMode', 'uT']) gl.uniform1f(U[n], u[n] || 0)
      gl.uniform2fv(U.uC, u.uC); gl.uniform2fv(U.uTilt, u.uTilt); gl.uniform4fv(U.uStream, u.uStream || [0, 0, 0, 0])
      gl.uniform3fv(U.uBeam, u.uBeam || [0, 0, 1e5]); gl.uniform3fv(U.uCup, u.uCup || [0, 0, 0])
      gl.drawArrays(gl.POINTS, 0, s.n)
    }
  }
}
