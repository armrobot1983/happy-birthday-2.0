/* ============================================================
   星空花语 Premium — Main JavaScript
   Perf-Optimized · Lightbox · Music Panel
   ============================================================ */

const scenesWrapper = document.getElementById('scenesWrapper');
const starfield = document.getElementById('starfield');
const starCtx = starfield.getContext('2d');
const ribbonsCanvas = document.getElementById('ribbons-canvas');
const ribbonsCtx = ribbonsCanvas.getContext('2d');
const fireworksCanvas = document.getElementById('fireworks-canvas');
const fireworksCtx = fireworksCanvas.getContext('2d');

// Logical dimensions (CSS pixels) — shared across all canvas draw functions
let logicalW = window.innerWidth, logicalH = window.innerHeight;

const bgmAudio = document.getElementById('bgmAudio');
const audioGojo = document.getElementById('audioGojo');
const audioXia = document.getElementById('audioXia');
const wishBtn = document.getElementById('wishBtn');
const wishRing = document.getElementById('wishRing');

const isMobile = () => window.innerWidth <= 768;

// State
let currentScene = 0, activeScene = 0, targetY = 0, currentY = 0;
let isScrolling = false, scrollTimeout = null;
const totalScenes = 4, vh = () => window.innerHeight;
let animFrameId = null;

// Starfield
let stars = [], shootingStars = [];

// Ribbons
let ribbons = [];

// Trail particles
let trailParticles = [], trailCanvas, trailCtx;

// Particle text
let particleTextChars = [], particleTextCache = null, particleTextCacheCtx = null;
let particleTextPhase = 'idle', particleTextTimer = 0;

// Fireworks
let fireworksRockets = [], fireworksSparks = [];

// Petals
let petalsSpawned = false;

// Audio
let audioCtx = null, analyser = null, freqData = null, prevFreqData = null;
let audioMode = 'music', beatEnergy = 0, smoothedBeat = 0;
const BGM_NORMAL = 0.35, BGM_DUCKED = 0.07, DUCK_DURATION = 600;
let duckingAnimFrame = null, activeVoiceAudio = null;

// Mouse
let mouseX = -1000, mouseY = -1000, smoothMouseX = 0, smoothMouseY = 0;

// Lightbox
let lightboxOpen = false, lightboxIdx = -1, photoItems = [];

// Music panel
let musicExpanded = false, bgmPlaying = true;

// ============================================================
// Canvas Setup
// ============================================================
function resizeCanvases() {
  logicalW = window.innerWidth;
  logicalH = window.innerHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Full-res canvases (starfield, fireworks) — scale by dpr for retina crispness
  [starfield, fireworksCanvas].forEach(c => {
    c.width = Math.floor(logicalW * dpr);
    c.height = Math.floor(logicalH * dpr);
  });
  starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fireworksCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Half-res canvases (ribbons, trail) — 0.5× resolution for performance
  const hdpr = 0.5 * dpr;
  ribbonsCanvas.width = Math.floor(logicalW * hdpr);
  ribbonsCanvas.height = Math.floor(logicalH * hdpr);
  ribbonsCtx.setTransform(hdpr, 0, 0, hdpr, 0, 0);

  if (!trailCanvas) { trailCanvas = document.createElement('canvas'); trailCtx = trailCanvas.getContext('2d'); }
  trailCanvas.width = Math.floor(logicalW * hdpr);
  trailCanvas.height = Math.floor(logicalH * hdpr);
  trailCtx.setTransform(hdpr, 0, 0, hdpr, 0, 0);
}

// ============================================================
// Starfield
// ============================================================
function createStars() {
  stars = [];
  const sc = isMobile() ? 100 : 200;
  const hc = isMobile() ? 8 : 15;
  for (let i = 0; i < sc; i++) {
    const r = Math.random();
    stars.push({
      x: Math.random()*logicalW, y: Math.random()*logicalH,
      radius: Math.random()*1.8+0.3,
      color: r<0.7?'255,255,255':r<0.9?'170,200,255':'255,220,170',
      baseOpacity: Math.random()*0.55+0.3,
      twinkleSpeed: Math.random()*0.02+0.005, twinkleOffset: Math.random()*Math.PI*2,
      parallax: Math.random()*0.3+0.08,
    });
  }
  for (let i = 0; i < hc; i++) {
    const r = Math.random();
    stars.push({
      x: Math.random()*logicalW, y: Math.random()*logicalH,
      radius: Math.random()*2.8+1.8,
      color: r<0.6?'200,180,255':r<0.85?'255,210,160':'160,200,255',
      baseOpacity: Math.random()*0.4+0.35,
      twinkleSpeed: Math.random()*0.007+0.002, twinkleOffset: Math.random()*Math.PI*2,
      parallax: Math.random()*0.12+0.03, hero:true,
    });
  }
}

function spawnShootingStar() {
  const fl = Math.random()>0.5;
  shootingStars.push({
    x: fl?-50:logicalW+50, y: Math.random()*logicalH*0.6,
    dx: fl?logicalW*0.7+Math.random()*400:-(logicalW*0.7),
    dy: logicalH*0.3+Math.random()*300,
    life:1, decay:Math.random()*0.015+0.008, width:Math.random()*1.5+0.8,
  });
}

function drawStarfield(sy) {
  const ctx = starCtx, w = logicalW, h = logicalH;
  ctx.clearRect(0,0,w,h);
  const now = performance.now()*0.001, sy2 = sy*0.5;
  for (const s of stars) {
    const op = Math.max(0.04,Math.min(1,s.baseOpacity+Math.sin(now*s.twinkleSpeed+s.twinkleOffset)*0.25));
    let y = (s.y-sy2*s.parallax)%h; if(y<0)y+=h;
    ctx.beginPath(); ctx.arc(s.x,y,s.radius,0,Math.PI*2);
    ctx.fillStyle = `rgba(${s.color},${op})`; ctx.fill();
    if(s.hero){
      const g = ctx.createRadialGradient(s.x,y,0,s.x,y,s.radius*3);
      g.addColorStop(0,`rgba(${s.color},${op*0.5})`); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s.x,y,s.radius*3,0,Math.PI*2); ctx.fill();
    }
  }
  for(let i=shootingStars.length-1;i>=0;i--){
    const ss=shootingStars[i]; ss.life-=ss.decay;
    if(ss.life<=0){shootingStars.splice(i,1);continue;}
    const sx=ss.x+ss.dx*(1-ss.life), sy3=ss.y+ss.dy*(1-ss.life);
    const g=ctx.createLinearGradient(sx,sy3,sx-ss.dx*0.08,sy3-ss.dy*0.08);
    g.addColorStop(0,`rgba(255,255,255,${ss.life})`);
    g.addColorStop(0.4,`rgba(200,210,255,${ss.life*0.6})`); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.strokeStyle=g; ctx.lineWidth=ss.width;
    ctx.beginPath(); ctx.moveTo(sx,sy3); ctx.lineTo(sx-ss.dx*0.08,sy3-ss.dy*0.08); ctx.stroke();
  }
}

// ============================================================
// Ribbons — single shadowBlur layer for perf
// ============================================================
function createRibbons() {
  ribbons=[];
  const w=logicalW, h=logicalH;
  const cols=[['rgba(240,210,100,','rgba(212,160,138,'],['rgba(200,180,220,','rgba(160,200,240,'],['rgba(255,220,180,','rgba(240,180,150,'],['rgba(180,210,240,','rgba(140,180,220,']];
  const rc = isMobile() ? 2 : 4;
  for (let i = 0; i < rc; i++) {
    ribbons.push({points:[],numPoints:6,amplitude:Math.random()*50+35,frequency:Math.random()*0.008+0.004,speed:Math.random()*0.0004+0.0002,phase:Math.random()*Math.PI*2,yBase:h*(0.2+i*0.14),width:Math.random()*2.5+1.5,colors:cols[i],opacity:Math.random()*0.15+0.08,swayAmp:Math.random()*30+15});
    for(let j=0;j<ribbons[i].numPoints;j++) ribbons[i].points.push({x:(w/(ribbons[i].numPoints-1))*j,y:0});
  }
}

function drawRibbons(time,sy) {
  const ctx=ribbonsCtx, w=logicalW, h=logicalH;
  ctx.clearRect(0,0,w,h);
  for(const rib of ribbons){
    for(let j=0;j<rib.points.length;j++){
      const t=j/(rib.points.length-1);
      rib.points[j].y=rib.yBase+Math.sin(time*rib.speed+t*rib.frequency*100+rib.phase)*rib.amplitude+Math.cos(time*rib.speed*1.7+t*60+rib.phase)*rib.swayAmp*(audioMode==='music'?1+smoothedBeat*2:1);
    }
    ctx.beginPath(); ctx.moveTo(rib.points[0].x,rib.points[0].y);
    for(let j=1;j<rib.points.length-1;j++){const xc=(rib.points[j].x+rib.points[j+1].x)/2,yc=(rib.points[j].y+rib.points[j+1].y)/2;ctx.quadraticCurveTo(rib.points[j].x,rib.points[j].y,xc,yc);}
    ctx.lineTo(rib.points[rib.points.length-1].x,rib.points[rib.points.length-1].y);
    // Single glow layer (no multi-layer shadowBlur)
    ctx.strokeStyle=rib.colors[0]+(rib.opacity*0.7)+')'; ctx.lineWidth=rib.width*5;
    ctx.shadowBlur=12; ctx.shadowColor=rib.colors[0]+(rib.opacity*0.3)+')'; ctx.stroke();
    ctx.shadowBlur=0;
  }
}

// ============================================================
// Trail Particles — 0.5x canvas, single glow layer
// ============================================================
function createTrailParticles() {
  trailParticles=[];
  const tc = isMobile() ? 20 : 40;
  for (let i = 0; i < tc; i++) {
    trailParticles.push({
      x:Math.random()*logicalW,y:Math.random()*logicalH*totalScenes,
      baseX:Math.random()*logicalW,baseY:Math.random()*logicalH*totalScenes,
      vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.25,
      radius:Math.random()*2.2+0.8,
      color:Math.random()<0.5?'140,180,240':'240,190,140',
      baseOpacity:Math.random()*0.5+0.3,phase:Math.random()*Math.PI*2,
    });
  }
}

function drawTrailParticles(time,sy) {
  const ctx=trailCtx, w=logicalW, h=logicalH;
  ctx.fillStyle='rgba(4,6,21,0.05)'; ctx.fillRect(0,0,w,h);
  const now=time*0.001, sy2=sy*0.5;
  for(const tp of trailParticles){
    const mx=smoothMouseX*0.5,my=smoothMouseY*0.5+sy2;
    const dx=mx-tp.x,dy=my-tp.y,dist=Math.sqrt(dx*dx+dy*dy)+1;
    if(dist<150){tp.vx+=(dx/dist)*0.02;tp.vy+=(dy/dist)*0.02;}
    tp.x+=tp.vx+Math.sin(now*0.7+tp.phase)*0.15;tp.y+=tp.vy+Math.cos(now*0.6+tp.phase)*0.12;
    tp.vx+=(tp.baseX-tp.x)*0.0003;tp.vy+=(tp.baseY-tp.y)*0.0003;
    tp.vx*=0.998;tp.vy*=0.998;
    const adjY=tp.y-sy2; if(adjY<-60||adjY>h+60)continue;
    const op=tp.baseOpacity*(1+smoothedBeat*1.5),sz=tp.radius*(1+smoothedBeat*2);
    const g=ctx.createRadialGradient(tp.x,adjY,0,tp.x,adjY,sz*2.5);
    g.addColorStop(0,`rgba(${tp.color},${op*0.75})`); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(tp.x,adjY,sz*2.5,0,Math.PI*2); ctx.fill();
  }
  // Stamp onto starfield
  starCtx.save();
  starCtx.globalCompositeOperation='lighter';
  starCtx.drawImage(trailCanvas,0,0,logicalW,logicalH);
  starCtx.restore();
}

// ============================================================
// Particle Text — pre-rendered glow cache
// ============================================================
function createParticleText() {
  particleTextChars=[];
  const off=document.createElement('canvas'), offC=off.getContext('2d');
  off.width=600;off.height=250;
  offC.fillStyle='#fff';offC.font='900 160px "Noto Serif SC",serif';
  offC.textAlign='center';offC.textBaseline='middle';
  offC.fillText('李馨',300,125);
  const img=offC.getImageData(0,0,600,250),px=[];
  for(let y=0;y<250;y+=4)for(let x=0;x<600;x+=4){if(img.data[(y*600+x)*4+3]>128)px.push({tx:(x-300)*0.7,ty:(y-125)*0.7});}
  // Pre-render glow
  particleTextCache=document.createElement('canvas');particleTextCache.width=40;particleTextCache.height=40;
  particleTextCacheCtx=particleTextCache.getContext('2d');
  const gl=particleTextCacheCtx.createRadialGradient(20,20,0,20,20,18);
  gl.addColorStop(0,'rgba(255,255,255,1)');gl.addColorStop(0.3,'rgba(255,255,255,0.5)');gl.addColorStop(1,'rgba(255,255,255,0)');
  particleTextCacheCtx.fillStyle=gl;particleTextCacheCtx.fillRect(0,0,40,40);
  const cx=logicalW/2,cy=logicalH*1.5;
  for(const p of px){
    const a=Math.random()*Math.PI*2,r=200+Math.random()*400;
    particleTextChars.push({tx:p.tx,ty:p.ty,x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,cx,cy,size:Math.random()*2+0.8,color:['#FFD700','#E8C4B8','#F0D060','#88ccff','#ffffff','#D4A08A'][Math.floor(Math.random()*6)],speed:Math.random()*0.02+0.008,phase:Math.random()*Math.PI*2});
  }
}

function updateParticleText() {
  if(!particleTextChars.length||!particleTextCache||activeScene!==3)return;
  if(particleTextPhase==='idle')return;
  const now=performance.now()*0.001,ctx=starCtx,cy=logicalH*0.5;
  for(const p of particleTextChars){
    const tx=p.cx+p.tx,ty=cy+p.ty;
    if(particleTextPhase==='converging'){p.x+=(tx-p.x)*p.speed;p.y+=(ty-p.y)*p.speed;}
    else if(particleTextPhase==='holding'){p.x=tx+Math.sin(now*2+p.phase)*2;p.y=ty+Math.cos(now*2.5+p.phase)*2;}
    else if(particleTextPhase==='dispersing'){p.x+=(p.x-tx)*0.01+(Math.random()-0.5)*2;p.y+=(p.y-ty)*0.01+(Math.random()-0.5)*2;}
    const br=0.5+0.5*Math.sin(now*1.5+p.phase),sz=p.size*(1+smoothedBeat*2.5),al=br*0.9;
    ctx.globalAlpha=al;ctx.globalCompositeOperation='lighter';
    ctx.drawImage(particleTextCache,p.x-sz*10,p.y-sz*10,sz*20,sz*20);
    ctx.globalAlpha=al;ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,sz*0.5,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}

function triggerParticleText() {
  if(particleTextPhase==='converging'||particleTextPhase==='holding')return;
  particleTextPhase='converging';particleTextTimer=performance.now();
}

// ============================================================
// Fireworks
// ============================================================
class Spark{
  constructor(x,y,vx,vy,color,size){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.color=color;this.size=size||Math.random()*2.5+1;this.life=1;this.decay=Math.random()*0.012+0.006;this.gravity=60+Math.random()*40;this.drag=0.985;}
  update(dt){this.vx*=this.drag;this.vy*=this.drag;this.vy+=this.gravity*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;this.life-=this.decay;}
  draw(ctx){if(this.life<=0)return;const a=this.life,g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.size*3);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(0.3,this.color.replace(')',`,${a})`).replace('rgb','rgba'));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(this.x,this.y,this.size*3,0,Math.PI*2);ctx.fill();}
}
class Rocket{
  constructor(){this.x=Math.random()*logicalW*0.6+logicalW*0.2;this.y=logicalH+20;this.targetY=logicalH*(0.15+Math.random()*0.35);this.vy=-(300+Math.random()*250);this.trail=[];this.alive=true;this.color=['#FFD700','#E8C4B8','#88ccff','#F0D060','#ffffff'][Math.floor(Math.random()*5)];}
  update(dt){this.y+=this.vy*dt;this.vy+=15;this.trail.push({x:this.x,y:this.y,life:1});if(this.trail.length>15)this.trail.shift();for(const t of this.trail)t.life-=0.07;if(this.y<=this.targetY){this.alive=false;const c=60+Math.floor(Math.random()*60);for(let i=0;i<c;i++){const a=Math.random()*Math.PI*2,s=Math.random()*250+80;fireworksSparks.push(new Spark(this.x,this.y,Math.cos(a)*s,Math.sin(a)*s,this.color,Math.random()*2.5+1));}}}
  draw(ctx){for(const t of this.trail){if(t.life<=0)continue;ctx.fillStyle=`rgba(255,220,150,${t.life*0.5})`;ctx.beginPath();ctx.arc(t.x,t.y,1.5,0,Math.PI*2);ctx.fill();}const g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,8);g.addColorStop(0,'rgba(255,255,255,0.9)');g.addColorStop(0.4,this.color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(this.x,this.y,8,0,Math.PI*2);ctx.fill();}
}
function spawnFirework(){fireworksRockets.push(new Rocket());}
function drawFireworks(dt){const ctx=fireworksCtx;ctx.clearRect(0,0,logicalW,logicalH);ctx.globalCompositeOperation='lighter';for(const r of fireworksRockets)r.update(dt);fireworksRockets=fireworksRockets.filter(r=>r.alive);for(const s of fireworksSparks)s.update(dt);fireworksSparks=fireworksSparks.filter(s=>s.life>0);for(const r of fireworksRockets)r.draw(ctx);for(const s of fireworksSparks)s.draw(ctx);ctx.globalCompositeOperation='source-over';}

// ============================================================
// Scene Scroll — Fixed Oscillation
// ============================================================
function scrollToScene(i){if(i<0||i>=totalScenes)return;currentScene=i;targetY=i*vh();}
function setScrollLock(){isScrolling=true;clearTimeout(scrollTimeout);scrollTimeout=setTimeout(()=>{isScrolling=false;},1000);}

window.addEventListener('wheel',(e)=>{
  if(endingOpen)return;
  if(activeScene===3&&(e.target.closest('#photoWallScroll')||e.target.closest('.scene4-right'))){
    e.preventDefault();
    carouselContinuous+=e.deltaY*1.4;
    return;
  }
  e.preventDefault();if(isScrolling)return;
  if(e.deltaY>30&&currentScene<totalScenes-1){scrollToScene(currentScene+1);setScrollLock();}
  else if(e.deltaY<-30&&currentScene>0){scrollToScene(currentScene-1);setScrollLock();}
},{passive:false});

let tsY=0;
window.addEventListener('touchstart',(e)=>{if(!endingOpen&&!e.target.closest('#photoWallScroll')&&!e.target.closest('.scene4-right'))tsY=e.touches[0].clientY;},{passive:false});
window.addEventListener('touchend',(e)=>{
  if(endingOpen||isScrolling)return;if(e.target.closest('#photoWallScroll')||e.target.closest('.scene4-right'))return;
  const d=tsY-e.changedTouches[0].clientY;
  if(d>40&&currentScene<totalScenes-1){scrollToScene(currentScene+1);setScrollLock();}
  else if(d<-40&&currentScene>0){scrollToScene(currentScene-1);setScrollLock();}
},{passive:false});

window.addEventListener('keydown',(e)=>{
  if(endingOpen)return;
  if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();if(currentScene<totalScenes-1)scrollToScene(currentScene+1);}
  else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();if(currentScene>0)scrollToScene(currentScene-1);}
  else if(e.key==='Escape'&&lightboxOpen)closeLightbox();
});

// Click to advance scene (not on buttons, cards, photo wall, or music)
scenesWrapper.addEventListener('click',(e)=>{
  if(endingOpen||lightboxOpen||isScrolling)return;
  if(e.target.closest('button')||e.target.closest('.card-3d')||e.target.closest('.photo-item')||e.target.closest('.music-panel'))return;
  if(currentScene<totalScenes-1){scrollToScene(currentScene+1);setScrollLock();}
});

window.addEventListener('mousemove',(e)=>{mouseX=e.clientX;mouseY=e.clientY;});
window.addEventListener('touchmove',(e)=>{if(e.touches.length===1){mouseX=e.touches[0].clientX;mouseY=e.touches[0].clientY;}},{passive:true});

// ============================================================
// Scene Detection
// ============================================================
const sEnter=[],sLeave=[];
sEnter[0]=()=>triggerScene1();
sEnter[1]=()=>{document.getElementById('charTextGojo').classList.add('visible');};
sEnter[2]=()=>{document.getElementById('charTextXia').classList.add('visible');};
sEnter[3]=()=>{triggerParticleText();for(let i=0;i<3;i++)setTimeout(spawnFirework,i*500);};
sLeave[0]=()=>{petalsSpawned=false;document.getElementById('petalsContainer').innerHTML='';};
sLeave[1]=()=>{document.getElementById('charTextGojo').classList.remove('visible');};
sLeave[2]=()=>{document.getElementById('charTextXia').classList.remove('visible');};
sLeave[3]=()=>{
  particleTextPhase='idle';
  // Reset all particle positions to scattered state so they don't linger
  const cx=logicalW/2,cy=logicalH*1.5;
  for(const p of particleTextChars){
    const a=Math.random()*Math.PI*2,r=200+Math.random()*400;
    p.x=cx+Math.cos(a)*r; p.y=cy+Math.sin(a)*r;
  }
  // Repaint starfield without particles
  drawStarfield(currentY);
};

function checkSceneChange(){
  const v=vh();let d=Math.round(currentY/v);d=Math.max(0,Math.min(totalScenes-1,d));
  if(d!==activeScene){const p=activeScene;activeScene=d;currentScene=d;if(sLeave[p])sLeave[p]();if(sEnter[d])sEnter[d]();}
}

// ============================================================
// Scene 1
// ============================================================
function triggerScene1(){
  document.querySelectorAll('.scene1-title .char').forEach((c,i)=>setTimeout(()=>c.classList.add('visible'),i*150));
  setTimeout(()=>{document.getElementById('subtitleEl').classList.add('visible');document.getElementById('scrollHint').classList.add('visible');},400);
  if(!petalsSpawned){petalsSpawned=true;spawnPetals();}
}

const petalColors=['#E8C4B8','#F5DFD7','#D4A08A','#F0D8D0','#EAB8B0','#F8E8E0','#DDB8B8','#F2D0C8'];
function spawnPetals(){
  const c=document.getElementById('petalsContainer');
  for(let i=0;i<15;i++){
    const p=document.createElement('div');p.className='petal';
    const s=Math.random()*20+12,d=6+Math.random()*4;
    p.style.cssText=`width:${s}px;height:${s*1.5}px;left:${Math.random()*90}%;top:-40px;background:radial-gradient(ellipse at center,${petalColors[Math.floor(Math.random()*petalColors.length)]},transparent);border-radius:50% 0 50% 0;filter:blur(${Math.random()*1.8}px);animation:petalDrift ${d}s var(--ease-out-expo) ${Math.random()*1.8}s forwards;`;
    c.appendChild(p);
  }
  setTimeout(()=>{c.innerHTML='';petalsSpawned=false;},12000);
}

// ============================================================
// 3D Card
// ============================================================
function init3DCard(cId,iId){
  const card=document.getElementById(cId),inner=document.getElementById(iId);if(!card||!inner)return;
  const glare=inner.querySelector('.card-glare');
  function tilt(cx,cy,s){
    const r=card.getBoundingClientRect(),x=cx-r.left,y=cy-r.top;
    inner.classList.remove('resting');
    inner.style.transform=`rotateY(${((x/r.width)-0.5)*s}deg) rotateX(${-((y/r.height)-0.5)*s*0.85}deg) translateZ(12px)`;
    if(glare){glare.style.setProperty('--glare-x',`${(x/r.width)*100}%`);glare.style.setProperty('--glare-y',`${(y/r.height)*100}%`);}
  }
  card.addEventListener('mousemove',(e)=>tilt(e.clientX,e.clientY,14));
  card.addEventListener('mouseleave',()=>{inner.classList.add('resting');inner.style.transform='rotateY(0deg) rotateX(0deg) translateZ(0)';if(glare)glare.style.setProperty('--glare-x','50%');});
  // Touch tilt only on desktop — mobile uses :active press feedback instead
  if (!isMobile()) {
    card.addEventListener('touchmove',(e)=>{if(e.touches.length===1)tilt(e.touches[0].clientX,e.touches[0].clientY,9);});
    card.addEventListener('touchend',()=>{inner.classList.add('resting');inner.style.transform='rotateY(0deg) rotateX(0deg) translateZ(0)';});
  }
}

// ============================================================
// Audio Ducking
// ============================================================
function smoothVol(t){
  cancelAnimationFrame(duckingAnimFrame);const s=bgmAudio.volume,st=performance.now();
  function step(){const e=Math.min((performance.now()-st)/DUCK_DURATION,1);bgmAudio.volume=s+(t-s)*(1-Math.pow(1-e,3));if(e<1)duckingAnimFrame=requestAnimationFrame(step);}
  duckingAnimFrame=requestAnimationFrame(step);
}
function playVoice(a,btnEl){
  if(activeVoiceAudio&&activeVoiceAudio!==a){activeVoiceAudio.pause();activeVoiceAudio.currentTime=0;}
  // Loading state
  const icon = btnEl ? btnEl.querySelector('.voice-btn-icon') : null;
  const label = btnEl ? btnEl.querySelector('.voice-btn-label') : null;
  if(a.paused){
    if (a.readyState < 2 && icon) { icon.classList.add('loading'); if (label) label.textContent = '加载中...'; }
    a.currentTime=0;a.play().then(()=>{
      if (icon) icon.classList.remove('loading');
      if (label) label.textContent = '点击暂停';
      activeVoiceAudio=a;audioMode='voice';smoothVol(BGM_DUCKED);
    }).catch(()=>{
      if (icon) icon.classList.remove('loading');
      if (label) label.textContent = '点击播放祝福';
    });
  }
  else{a.pause();activeVoiceAudio=null;audioMode='music';smoothVol(BGM_NORMAL);if(label)label.textContent='点击播放祝福';}
}
function stopVoice(){
  if(activeVoiceAudio){activeVoiceAudio.pause();activeVoiceAudio.currentTime=0;activeVoiceAudio=null;}
  audioMode='music';smoothVol(BGM_NORMAL);
  document.querySelectorAll('.voice-btn-label').forEach(el => { el.textContent = '点击播放祝福'; });
}

document.getElementById('voiceBtnGojo').addEventListener('click',(e)=>{e.stopPropagation();playVoice(audioGojo,e.currentTarget);addRipple(e.currentTarget.querySelector('.voice-btn-icon'));});
document.getElementById('voiceBtnXia').addEventListener('click',(e)=>{e.stopPropagation();playVoice(audioXia,e.currentTarget);addRipple(e.currentTarget.querySelector('.voice-btn-icon'));});
audioGojo.addEventListener('ended',stopVoice);audioXia.addEventListener('ended',stopVoice);
audioGojo.addEventListener('pause',()=>{if(activeVoiceAudio===audioGojo&&audioGojo.currentTime>0)stopVoice();});
audioXia.addEventListener('pause',()=>{if(activeVoiceAudio===audioXia&&audioXia.currentTime>0)stopVoice();});

// ============================================================
// Web Audio
// ============================================================
function initAudioCtx(){
  if(audioCtx)return;
  try{
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();
    analyser=audioCtx.createAnalyser();
    analyser.fftSize=1024;analyser.smoothingTimeConstant=0.6;analyser.minDecibels=-80;analyser.maxDecibels=-10;
    const src=audioCtx.createMediaElementSource(bgmAudio);src.connect(analyser);analyser.connect(audioCtx.destination);
    freqData=new Uint8Array(analyser.frequencyBinCount);prevFreqData=new Uint8Array(analyser.frequencyBinCount);
  }catch(e){console.warn('Web Audio N/A:',e);}
}
function updateAudio(timestamp){
  if(!analyser)return;
  analyser.getByteFrequencyData(freqData);
  const n=freqData.length;let bs=0,ms=0,hs=0;
  const be=Math.floor(n*0.1),me=Math.floor(n*0.6);
  for(let i=0;i<be;i++)bs+=freqData[i];
  for(let i=be;i<me;i++)ms+=freqData[i];
  for(let i=me;i<n;i++)hs+=freqData[i];
  const ba=bs/be/255,ma=ms/(me-be)/255,ha=hs/(n-me)/255;
  const te=ba+ma+ha,br=te>0?ba/te:0;
  if(!activeVoiceAudio||(activeVoiceAudio&&activeVoiceAudio.paused)){if(br>0.12&&te>0.3)audioMode='music';}
  let fl=0;for(let i=0;i<n;i++){const d=freqData[i]-(prevFreqData[i]||0);if(d>0)fl+=d;}
  fl/=n*255;beatEnergy=fl;smoothedBeat+=(fl-smoothedBeat)*0.15;
  prevFreqData.set(freqData);
}

// ============================================================
// Ripple
// ============================================================
function addRipple(c){const r=document.createElement('span');r.className='ripple';c.appendChild(r);setTimeout(()=>r.remove(),800);}

// ============================================================
// 3D Confetti + Full-Screen Wish Effect
// ============================================================
let confettiPieces=[];
const CONFETTI_COLORS=['#FFD700','#FF69B4','#00BFFF','#7FFF00','#FF4500','#DA70D6','#FFA500','#E8C4B8','#88ccff','#F0D060','#ffffff','#ff88aa'];
const CONFETTI_SHAPES=['rect','ribbon','circle'];

class ConfettiPiece{
  constructor(){this.reset(true);}
  reset(init){
    const W=logicalW,H=logicalH;
    this.x=Math.random()*W;
    this.y=init?(Math.random()-0.5)*H*0.5:(-20-Math.random()*80);
    this.vx=(Math.random()-0.5)*200;
    this.vy=init?(Math.random()*200+50):(150+Math.random()*250);
    this.vr=(Math.random()-0.5)*720;
    this.rx=(Math.random()-0.5)*360;
    this.ry=(Math.random()-0.5)*360;
    this.rz=Math.random()*360;
    this.drx=(Math.random()-0.5)*180;
    this.dry=(Math.random()-0.5)*180;
    this.drz=(Math.random()-0.5)*90;
    this.w=6+Math.random()*14;
    this.h=this.w*(0.35+Math.random()*0.4);
    this.color=CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)];
    this.shape=CONFETTI_SHAPES[Math.floor(Math.random()*3)];
    this.life=1;
    this.decay=0.004+Math.random()*0.004;
    this.drag=0.992;
    this.gravity=200+Math.random()*100;
    this.wave=Math.random()*Math.PI*2;
    this.waveAmp=30+Math.random()*50;
    this.waveFreq=0.5+Math.random()*1.5;
  }
  update(dt){
    this.vy+=this.gravity*dt;
    this.vx*=this.drag; this.vy*=this.drag;
    this.x+=this.vx*dt+Math.sin(this.wave)*this.waveAmp*dt;
    this.y+=this.vy*dt;
    this.wave+=this.waveFreq*dt;
    this.rx+=this.drx*dt; this.ry+=this.dry*dt; this.rz+=this.drz*dt;
    this.life-=this.decay;
    if(this.y>logicalH+30)this.reset(false);
  }
  draw(ctx){
    if(this.life<=0)return;
    ctx.save();
    ctx.globalAlpha=Math.min(1,this.life*2)*0.92;
    ctx.translate(this.x,this.y);
    // Simulate 3D rotation via scaleX (perspective projection of rotateY)
    const scaleX=Math.cos(this.ry*Math.PI/180);
    const scaleY=Math.cos(this.rx*Math.PI/180);
    ctx.rotate(this.rz*Math.PI/180);
    ctx.scale(scaleX||0.05,scaleY||0.05);
    ctx.fillStyle=this.color;
    if(this.shape==='circle'){
      ctx.beginPath();ctx.arc(0,0,this.w*0.5,0,Math.PI*2);ctx.fill();
    } else if(this.shape==='ribbon'){
      ctx.beginPath();ctx.moveTo(-this.w,-this.h*0.5);
      ctx.bezierCurveTo(-this.w*0.2,-this.h*1.2,this.w*0.2,this.h*1.2,this.w,this.h*0.5);
      ctx.bezierCurveTo(this.w*0.2,this.h*0.2,-this.w*0.2,-this.h*0.2,-this.w,-this.h*0.5);
      ctx.fill();
    } else {
      ctx.fillRect(-this.w*0.5,-this.h*0.5,this.w,this.h);
    }
    ctx.restore();
  }
}

let confettiActive=false,confettiTimer=0;
function triggerFullWishEffect(){
  confettiActive=true;confettiTimer=performance.now();
  confettiPieces=[];
  const cc = isMobile() ? 80 : 180;
  for (let i = 0; i < cc; i++) confettiPieces.push(new ConfettiPiece());
  triggerParticleText();
  for(let i=0;i<12;i++)setTimeout(spawnFirework,i*220);
}
function updateConfetti(dt,timestamp){
  if(!confettiActive)return;
  if(timestamp-confettiTimer>8000){confettiActive=false;confettiPieces=[];return;}
  for(const p of confettiPieces)p.update(dt);
}
function drawConfetti(ctx){
  if(!confettiActive||!confettiPieces.length)return;
  ctx.save();ctx.globalCompositeOperation='source-over';
  for(const p of confettiPieces)p.draw(ctx);
  ctx.restore();
}

wishBtn.addEventListener('click',()=>{addRipple(wishRing);openEnding();triggerFullWishEffect();});

// ============================================================
// Ending Overlay
// ============================================================
const endingSrcs=['素材/ending-1.png','素材/ending-2.png','素材/ending-3.png'];
const endingTypewriterText='福如东海，寿比南山~~';
let endingIdx=0,endingOpen=false,endingOnTypewriter=false,typewriterTimer=null;

function openEnding(){
  if(endingOpen)return;
  endingOpen=true;endingIdx=0;endingOnTypewriter=false;
  const overlay=document.getElementById('endingOverlay');
  const img=document.getElementById('endingImg');
  const tw=document.getElementById('endingTypewriter');
  const stage=document.getElementById('endingStage');
  img.src=endingSrcs[0];img.style.display='';img.classList.remove('switching','hidden');
  tw.innerHTML='';tw.classList.remove('done','active');
  stage.classList.remove('has-typewriter');
  overlay.classList.add('open');
}
function closeEnding(){
  if(!endingOpen)return;
  endingOpen=false;
  clearTimeout(typewriterTimer);
  document.getElementById('endingOverlay').classList.remove('open');
  setTimeout(()=>{
    const img=document.getElementById('endingImg');
    const tw=document.getElementById('endingTypewriter');
    img.style.display='none';img.classList.remove('hidden');
    tw.innerHTML='';tw.classList.remove('active','done');
    document.getElementById('endingStage').classList.remove('has-typewriter');
  },600);
}
function nextEnding(){
  if(!endingOpen)return;
  if(endingOnTypewriter)return;
  if(endingIdx>=endingSrcs.length-1){showTypewriterScreen();return;}
  endingIdx++;
  const img=document.getElementById('endingImg');
  img.classList.add('switching');
  setTimeout(()=>{
    img.src=endingSrcs[endingIdx];img.classList.remove('switching');
  },300);
}
function prevEnding(){
  if(!endingOpen)return;
  if(endingOnTypewriter){hideTypewriterScreen();return;}
  if(endingIdx<=0)return;
  endingIdx--;
  clearTimeout(typewriterTimer);
  const tw=document.getElementById('endingTypewriter');
  tw.innerHTML='';tw.classList.remove('done','active');
  document.getElementById('endingStage').classList.remove('has-typewriter');
  document.getElementById('endingImg').classList.remove('hidden');
  const img=document.getElementById('endingImg');
  img.classList.add('switching');
  setTimeout(()=>{
    img.src=endingSrcs[endingIdx];img.classList.remove('switching');
  },300);
}
function showTypewriterScreen(){
  endingOnTypewriter=true;
  const img=document.getElementById('endingImg');
  const stage=document.getElementById('endingStage');
  img.classList.add('hidden');
  stage.classList.add('has-typewriter');
  startTypewriter();
}
function hideTypewriterScreen(){
  endingOnTypewriter=false;
  clearTimeout(typewriterTimer);
  const tw=document.getElementById('endingTypewriter');
  tw.innerHTML='';tw.classList.remove('done','active');
  document.getElementById('endingStage').classList.remove('has-typewriter');
  document.getElementById('endingImg').classList.remove('hidden');
}
function startTypewriter(){
  const tw=document.getElementById('endingTypewriter');
  tw.innerHTML='';tw.classList.remove('done');tw.classList.add('active');
  const track=document.createElement('div');track.className='tw-track';
  const cursor=document.createElement('span');cursor.className='tw-cursor';
  track.appendChild(cursor);
  tw.appendChild(track);

  const chars=endingTypewriterText.split('');
  let i=0;let shiftX=0;
  const charW=30;
  const phase1End=Math.floor(chars.length*0.55);

  function type(){
    if(i>=chars.length){tw.classList.add('done');return;}
    // Create and insert char span before cursor
    const s=document.createElement('span');s.className='tw-char';s.textContent=chars[i];
    track.insertBefore(s,cursor);
    // Trigger visible on next frame for CSS transition
    requestAnimationFrame(()=>{s.classList.add('visible');});
    // Phase 1: shift left; Phase 2: shift back to center
    if(i<phase1End){shiftX+=charW*0.55;}
    else{shiftX=Math.max(0,shiftX-charW*0.45);}
    track.style.transform=`translateX(${-shiftX}px)`;
    i++;
    typewriterTimer=setTimeout(type,1500);
  }
  type();
}
document.getElementById('endingBack').addEventListener('click',closeEnding);
document.getElementById('endingImg').addEventListener('click',nextEnding);
document.getElementById('endingTypewriter').addEventListener('click',(e)=>{
  if(endingOnTypewriter)return;
  e.stopPropagation();
});
document.getElementById('endingOverlay').addEventListener('wheel',(e)=>{
  e.preventDefault();e.stopPropagation();
  if(e.deltaY>20)nextEnding();
  else if(e.deltaY<-20)prevEnding();
},{passive:false});

// Ending swipe gestures (mobile)
let endingTouchStartX = 0, endingTouchStartY = 0;
document.getElementById('endingOverlay').addEventListener('touchstart', (e) => {
  endingTouchStartX = e.touches[0].clientX;
  endingTouchStartY = e.touches[0].clientY;
}, {passive: true});
document.getElementById('endingOverlay').addEventListener('touchend', (e) => {
  if (!endingOpen) return;
  const dx = endingTouchStartX - e.changedTouches[0].clientX;
  const dy = endingTouchStartY - e.changedTouches[0].clientY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < 30) return; // too small
  if (absDx > absDy) {
    // Horizontal swipe
    if (dx > 40) nextEnding();
    else if (dx < -40) prevEnding();
  }
});
document.addEventListener('keydown',(e)=>{
  if(!endingOpen)return;
  if(e.key==='Escape')closeEnding();
  else if(e.key==='ArrowRight'||e.key==='ArrowDown')nextEnding();
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp')prevEnding();
});

// ============================================================
// Photo Carousel — infinite scroll driven by mouse wheel
// ============================================================
const labels=['最美的你','笑容如花','温暖时光','星光闪耀','美好瞬间','珍贵的你','生日快乐'];
const photoSrcs=[];
for(let i=1;i<=7;i++)photoSrcs.push(`照片墙/${i}.jpg`);

let carouselOffset=0,carouselContinuous=0,carouselRowH=0,carouselTotalH=0;
let carouselTrack=null,carouselViewport=null;

function buildPhotoWall(){
  carouselTrack=document.getElementById('photoCarouselTrack');
  carouselViewport=document.getElementById('photoCarouselViewport');
  if(!carouselTrack||!carouselViewport)return;

  const srcLen=photoSrcs.length; // 7

  if (isMobile()) {
    // Mobile — flat vertical list, no loop, each photo direct child
    for (let i = 0; i < srcLen; i++) {
      const item = document.createElement('div');
      item.className = 'photo-item';
      item.innerHTML = `<img src="${photoSrcs[i]}" alt="${labels[i]}" loading="lazy" /><div class="photo-item-overlay"><span>${labels[i]}</span></div>`;
      item.addEventListener('click', () => openLightbox(i));
      photoItems[i] = item;
      carouselTrack.appendChild(item);
    }
    return;
  }

  // Desktop — rows of 2 with clone loop
  const extSrcs=[...photoSrcs,...photoSrcs];
  const extLabels=[...labels,...labels];

  // Create rows — items placed 2-per-row (alternating left/right offset via CSS)
  for(let i=0;i<extSrcs.length;i+=2){
    const row=document.createElement('div');row.className='carousel-row';
    [0,1].forEach(j=>{
      const idx=i+j;if(idx>=extSrcs.length)return;
      const item=document.createElement('div');item.className='photo-item';
      const realIdx=idx%srcLen;
      item.innerHTML=`<img src="${extSrcs[idx]}" alt="${extLabels[idx]}" loading="lazy" /><div class="photo-item-overlay"><span>${extLabels[idx]}</span></div>`;
      item.addEventListener('click',()=>openLightbox(realIdx));
      photoItems[realIdx]=photoItems[realIdx]||item; // first real instance wins for lightbox
      row.appendChild(item);
    });
    carouselTrack.appendChild(row);
  }

  // Measure after layout
  requestAnimationFrame(()=>{
    const rows=carouselTrack.querySelectorAll('.carousel-row');
    if(rows.length<2)return;
    carouselRowH=rows[0].offsetHeight+20; // 20 = gap from CSS
    const realRowCount=Math.ceil(srcLen/2); // rows for one full cycle (4 rows for 7 items)
    carouselTotalH=carouselRowH*realRowCount;
    carouselOffset=0;carouselContinuous=0;
  });
}

// Smooth carousel animation (desktop only — mobile uses CSS overflow scroll)
function updateCarousel(){
  if(!carouselTrack||carouselTotalH===0||isMobile())return;
  carouselOffset+=(carouselContinuous-carouselOffset)*0.08;
  const display=((carouselOffset%carouselTotalH)+carouselTotalH)%carouselTotalH;
  carouselTrack.style.transform=`translateY(${-display}px)`;
}

function openLightbox(idx){
  if(lightboxOpen)return;
  lightboxOpen=true;lightboxIdx=idx;
  const overlay=document.getElementById('lightboxOverlay');
  const wrap=document.getElementById('lightboxImageWrap');
  const img=document.getElementById('lightboxImg');
  img.src=photoSrcs[idx];
  img.style.display='';

  if (isMobile()) {
    // Bottom sheet — CSS handles the slide-up animation
    overlay.classList.add('open');
    return;
  }

  // Desktop — expand from thumbnail position
  const thumb=photoItems[idx];const r=thumb.getBoundingClientRect();
  wrap.style.top=r.top+'px';wrap.style.left=r.left+'px';wrap.style.width=r.width+'px';wrap.style.height=r.height+'px';wrap.style.borderRadius='var(--radius-md)';
  overlay.classList.add('open');
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      const mw=window.innerWidth*0.82,mh=window.innerHeight*0.82;
      const ar=img.naturalWidth/img.naturalHeight||4/5;
      let w,h;
      if(mw/mh>ar){h=mh;w=h*ar;}else{w=mw;h=w/ar;}
      wrap.style.top=((window.innerHeight-h)/2)+'px';wrap.style.left=((window.innerWidth-w)/2)+'px';
      wrap.style.width=w+'px';wrap.style.height=h+'px';wrap.style.borderRadius='var(--radius-sm)';
    });
  });
}
function closeLightbox(){
  if(!lightboxOpen)return;
  const overlay=document.getElementById('lightboxOverlay'),wrap=document.getElementById('lightboxImageWrap');

  if (isMobile()) {
    overlay.classList.remove('open');lightboxOpen=false;
    setTimeout(()=>{const lb=document.getElementById('lightboxImg');lb.removeAttribute('src');lb.style.display='none';},400);
    return;
  }

  const thumb=photoItems[lightboxIdx];const r=thumb.getBoundingClientRect();
  wrap.style.top=r.top+'px';wrap.style.left=r.left+'px';wrap.style.width=r.width+'px';wrap.style.height=r.height+'px';wrap.style.borderRadius='var(--radius-md)';
  overlay.classList.remove('open');lightboxOpen=false;
  setTimeout(()=>{const lb=document.getElementById('lightboxImg');lb.removeAttribute('src');lb.style.display='none';},500);
}
function lightboxNav(dir){
  if(!lightboxOpen)return;
  let ni=lightboxIdx+dir;if(ni<0)ni=photoSrcs.length-1;if(ni>=photoSrcs.length)ni=0;
  lightboxIdx=ni;document.getElementById('lightboxImg').src=photoSrcs[ni];
}
document.getElementById('lightboxClose').addEventListener('click',closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click',()=>lightboxNav(-1));
document.getElementById('lightboxNext').addEventListener('click',()=>lightboxNav(1));
document.getElementById('lightboxOverlay').addEventListener('click',(e)=>{if(e.target===e.currentTarget)closeLightbox();});

// ============================================================
// Music Panel
// ============================================================
const musicPanel=document.getElementById('musicPanel');
const musicToggle=document.getElementById('musicToggle');
const musicPlayBtn=document.getElementById('musicPlayBtn');
const musicVolBtn=document.getElementById('musicVolBtn');
const musicProgressFill=document.getElementById('musicProgressFill');

function updateMusicUI(){
  musicToggle.classList.toggle('playing',bgmPlaying);
  musicPlayBtn.innerHTML=bgmPlaying
    ?'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  musicVolBtn.innerHTML=bgmAudio.volume<0.05
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
    :bgmAudio.volume<0.3
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
}

musicToggle.addEventListener('click',(e)=>{
  e.stopPropagation();
  musicExpanded=!musicExpanded;
  musicPanel.classList.toggle('expanded',musicExpanded);
  if(!musicExpanded){updateMusicUI();}
});

musicPlayBtn.addEventListener('click',(e)=>{
  e.stopPropagation();
  if(bgmPlaying){bgmAudio.pause();bgmPlaying=false;}
  else{bgmAudio.play().then(()=>{bgmPlaying=true;}).catch(()=>{});bgmPlaying=true;}
  if(bgmPlaying)spawnMusicNotes();
  updateMusicUI();
});

musicVolBtn.addEventListener('click',(e)=>{
  e.stopPropagation();
  const vols=[0,0.2,0.45,0.7];
  const ci=vols.findIndex(v=>Math.abs(v-bgmAudio.volume)<0.04);
  const ni=(ci+1)%vols.length;
  bgmAudio.volume=vols[ni];smoothVol(vols[ni]);saveVolume();
  updateMusicUI();
});
musicVolBtn.addEventListener('wheel',(e)=>{
  e.stopPropagation();e.preventDefault();
  const v=Math.max(0,Math.min(1,bgmAudio.volume-(e.deltaY>0?0.06:-0.06)));
  bgmAudio.volume=v;smoothVol(v);saveVolume();
  updateMusicUI();
},{passive:false});

bgmAudio.addEventListener('timeupdate',()=>{
  if(bgmAudio.duration){const p=(bgmAudio.currentTime/bgmAudio.duration)*100;musicProgressFill.style.width=p+'%';}
});

function spawnMusicNotes(){
  const notes=['♪','♫','♬','✦'];
  for(let i=0;i<3;i++){
    const n=document.createElement('span');n.className='music-note';
    n.textContent=notes[Math.floor(Math.random()*notes.length)];
    n.style.setProperty('--nx',`${(Math.random()-0.5)*70}px`);n.style.setProperty('--ny',`${-Math.random()*70-20}px`);
    n.style.setProperty('--nr',`${(Math.random()-0.5)*200}deg`);n.style.animationDelay=`${i*0.15}s`;
    musicToggle.appendChild(n);setTimeout(()=>n.remove(),2400);
  }
}


// ============================================================
// BGM Init
// Volume persistence
const VOL_KEY = 'birthday_bgm_vol';
function saveVolume() {
  try { localStorage.setItem(VOL_KEY, bgmAudio.volume); } catch(e) {}
}
function loadVolume() {
  try { const v = localStorage.getItem(VOL_KEY); return v !== null ? parseFloat(v) : BGM_NORMAL; } catch(e) { return BGM_NORMAL; }
}

// ============================================================
function initBGM(){
  initAudioCtx();
  bgmAudio.volume = loadVolume();
  bgmAudio.play().then(()=>{bgmPlaying=true;updateMusicUI();}).catch(()=>{bgmPlaying=false;updateMusicUI();});
}
let bgmTried=false;
function tryBGM(){if(!bgmTried){bgmTried=true;initBGM();}}
document.addEventListener('click',tryBGM,{once:true});

// ============================================================
// Main Loop
// ============================================================
let lastTime=performance.now();
function animate(timestamp){
  const dt=Math.min((timestamp-lastTime)/1000,0.1);lastTime=timestamp;

  // Spring scroll — no oscillation
  const diff=targetY-currentY;
  if(Math.abs(diff)<0.3)currentY=targetY;
  else currentY+=diff*0.12;
  scenesWrapper.style.transform=`translateY(${-currentY}px)`;

  smoothMouseX+=(mouseX-smoothMouseX)*0.06;smoothMouseY+=(mouseY-smoothMouseY)*0.06;
  updateAudio(timestamp);checkSceneChange();
  drawStarfield(currentY);
  drawTrailParticles(timestamp,currentY);
  drawRibbons(timestamp,currentY);
  updateParticleText();
  updateConfetti(dt,timestamp);
  drawFireworks(dt);
  drawConfetti(fireworksCtx);
  updateCarousel();

  if(particleTextPhase==='converging'&&timestamp-particleTextTimer>2500)particleTextPhase='holding';
  if(Math.random()<0.008&&shootingStars.length<3)spawnShootingStar();
  if(activeScene===3&&Math.random()<0.03&&fireworksRockets.length<2)spawnFirework();

  animFrameId=requestAnimationFrame(animate);
}

// ============================================================
// Init
// ============================================================
function init(){
  resizeCanvases();createStars();createRibbons();createTrailParticles();createParticleText();
  buildPhotoWall();init3DCard('cardGojo','cardGojoInner');init3DCard('cardXia','cardXiaInner');
  triggerScene1();updateMusicUI();
  // Hide loading screen
  const ls = document.getElementById('loadingScreen');
  if (ls) { ls.classList.add('hidden'); setTimeout(() => ls.remove(), 600); }
  animFrameId=requestAnimationFrame(animate);
}
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  const newW = window.innerWidth;
  resizeTimer = setTimeout(() => {
    if (newW !== logicalW) {
      // Width changed (orientation) — full rebuild
      resizeCanvases();
      createStars();
      createRibbons();
      createTrailParticles();
      createParticleText();
    }
    // Always update scroll target (address bar may have changed height)
    targetY = currentScene * vh();
  }, 800);
});

// visualViewport fires on mobile address bar show/hide — no canvas rebuild needed
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    targetY = currentScene * vh();
  });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(bgmPlaying)bgmAudio.pause();}else{if(bgmPlaying)bgmAudio.play().catch(()=>{});}});
init();

