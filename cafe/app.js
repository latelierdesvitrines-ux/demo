const $=s=>document.querySelector(s),root=document.documentElement;
root.classList.add('js','anim');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=$('#parcours'),layers=[...$('#layers').children],steps=[...$('#copy').children],dots=[...$('#rail').children],glow=$('#glow'),nav=$('#nav'),hint=$('#hint');
const N=layers.length,clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),ease=t=>t*t*(3-2*t);
let px=0,py=0,tx=0,ty=0,busy=false; // pointeur/gyroscope lissé (-1..1)
function draw(){
  busy=false;
  const span=stage.offsetHeight-innerHeight,t=clamp(-stage.getBoundingClientRect().top/span)*(N-1);
  const k=reduce?0:1;
  layers.forEach((l,i)=>{
    const e=i?ease(clamp(t-i+1)):1; // fondu enchaîné : la suivante apparaît par-dessus
    const z=1.07+.06*clamp(i-t,-1,1)*k+.012*k; // zoom doux continu
    const d=14*(i+1)/N*k;
    l.style.opacity=e;l.style.zIndex=i;
    l.style.transform=`translate3d(${-px*d*1.5}px,${-py*d+(i-t)*-18*k}px,0) scale(${z+.03*k})`;
    l.style.visibility=t>i+1.05?'hidden':'visible';
  });
  steps.forEach((s,i)=>{
    const a=t-i,o=clamp(1.25-Math.abs(a)*2.1);
    s.style.opacity=o;s.style.visibility=o?'visible':'hidden';
    s.style.transform=`translate3d(${px*6*k}px,${-a*50*k+py*4*k}px,0)`;
    s.style.filter=k&&o<1?`blur(${(1-o)*5}px)`:'';
  });
  dots.forEach((d,i)=>d.classList.toggle('on',Math.round(t)===i));
  hint.style.opacity=t<.1?.6:0;
  nav.classList.toggle('solid',stage.getBoundingClientRect().bottom<innerHeight*.5||scrollY>span+innerHeight*.4);
  glow.style.setProperty('--gx',50+px*18+'%');glow.style.setProperty('--gy',35+py*14+'%');
}
const req=()=>{if(!busy){busy=true;requestAnimationFrame(draw)}};
addEventListener('scroll',req,{passive:true});addEventListener('resize',req);
// inclinaison : souris sur PC, gyroscope sur mobile (sur iPhone : après un premier toucher)
function loop(){px+=(tx-px)*.08;py+=(ty-py)*.08;if(Math.abs(tx-px)+Math.abs(ty-py)>.002)req();requestAnimationFrame(loop)}
if(!reduce){
  addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){tx=e.clientX/innerWidth*2-1;ty=e.clientY/innerHeight*2-1}},{passive:true});
  const gyro=e=>{if(e.gamma!=null){tx=clamp(e.gamma/25,-1,1);ty=clamp((e.beta-45)/25,-1,1)}};
  if(typeof DeviceOrientationEvent==='function'&&DeviceOrientationEvent.requestPermission){
    addEventListener('touchend',()=>DeviceOrientationEvent.requestPermission().then(r=>r==='granted'&&addEventListener('deviceorientation',gyro)).catch(()=>{}),{once:true});
  }else addEventListener('deviceorientation',gyro);
  loop();
}
draw();
// menu mobile
const burger=$('#burger');
burger.onclick=()=>{const o=nav.classList.toggle('open');burger.setAttribute('aria-expanded',o)};
nav.querySelectorAll('nav a').forEach(a=>a.onclick=()=>{nav.classList.remove('open');burger.setAttribute('aria-expanded',false)});
// révélations + inclinaison des cartes de la galerie
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));
if(!reduce)document.querySelectorAll('.tilt').forEach(f=>{
  f.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const r=f.getBoundingClientRect();
    f.style.transform=`perspective(900px) rotateY(${((e.clientX-r.left)/r.width-.5)*6}deg) rotateX(${-((e.clientY-r.top)/r.height-.5)*6}deg)`});
  f.addEventListener('pointerleave',()=>f.style.transform='');
});
$('#form').onsubmit=e=>{e.preventDefault();$('#ok').textContent=e.target.checkValidity()?'Merci ! (maquette : rien n\'est envoyé)':'Merci de remplir les trois champs.'};
