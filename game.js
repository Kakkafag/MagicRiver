'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const loading = document.getElementById('loading');
const imagePaths = {
  scene: 'river_scene.png',
  animals: 'animals.png'
};
const soundPaths = {
  music: 'pixel_hunt_rush.ogg',
  shot: 'gunshot_pro.ogg',
  DUCK: 'duck.ogg',
  FISH: 'splat.ogg',
  DEER: 'moose.ogg',
  BEAVER: 'squeek.ogg',
  GOLDEN_PLATYPUS: 'victory.ogg'
};

const images = {};
const TYPES = {
  DUCK: { row: 0, points: 5, speed: 120, size: .050, w: 1.72, h: 1.20, losesLife: true },
  FISH: { row: 1, points: 3, speed: 105, size: .043, w: 1.72, h: 1.18, losesLife: true },
  BEAVER: { row: 2, points: 8, speed: 110, size: .056, w: 1.75, h: 1.18, losesLife: true },
  DEER: { row: 3, points: 10, speed: 95, size: .068, w: 1.95, h: 1.62, losesLife: true },
  GOLDEN_PLATYPUS: { row: 4, points: 100, speed: 190, size: .060, w: 1.75, h: 1.18, losesLife: false }
};

const state = {
  mode: 'menu', score: 0, shots: 0, lives: 3,
  highScore: Number(localStorage.getItem('magicRiverHighScore') || 0),
  sound: localStorage.getItem('magicRiverSound') !== 'off',
  animals: [], particles: [], notices: [],
  spawnTimer: 0, started: false, last: performance.now(),
  menuAnimals: [], frame: 0
};

const music = new Audio(soundPaths.music);
music.loop = true;
music.volume = 0.25;
const sfx = {};
for (const [key, src] of Object.entries(soundPaths)) {
  if (key !== 'music') { const a = new Audio(src); a.preload = 'auto'; sfx[key] = a; }
}
function unlockAudio() {
  if (!state.sound) return;
  music.play().catch(() => {});
}
function playSound(key, volume = 1) {
  if (!state.sound || !sfx[key]) return;
  const a = sfx[key].cloneNode(); a.volume = volume; a.play().catch(() => {});
}
function setSound(enabled) {
  state.sound = enabled;
  localStorage.setItem('magicRiverSound', enabled ? 'on' : 'off');
  if (enabled) unlockAudio(); else music.pause();
}

aSyncLoad();
async function aSyncLoad() {
  await Promise.all(Object.entries(imagePaths).map(([k, src]) => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => { images[k] = img; resolve(); }; img.onerror = reject; img.src = src;
  })));
  loading.remove();
  resize();
  createMenuAnimals();
  requestAnimationFrame(loop);
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
  canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);

function loop(now) {
  const dt = Math.min((now - state.last) / 1000, .05); state.last = now;
  update(dt); draw(now / 1000);
  requestAnimationFrame(loop);
}

function update(dt) {
  const list = state.mode === 'menu' ? state.menuAnimals : state.animals;
  for (const a of list) a.x += a.speed * a.dir * dt;
  if (state.mode === 'menu') {
    for (const a of list) if ((a.dir > 0 && a.x > innerWidth + a.size * 4) || (a.dir < 0 && a.x < -a.size * 4)) a.x = a.dir > 0 ? -a.size * 4 : innerWidth + a.size * 4;
  } else if (state.mode === 'play') {
    state.spawnTimer -= dt;
    const max = Math.min(8, 5 + Math.floor(state.score / 400));
    if (!state.started) { for (let i = 0; i < 3; i++) spawnAnimal(); state.started = true; state.spawnTimer = .35; }
    if (state.spawnTimer <= 0 && state.animals.length < max) { spawnAnimal(); state.spawnTimer = Math.max(.28, Math.random() * .45 + .40 - Math.max(0, state.score - 120) / 1800); }
    for (let i = state.animals.length - 1; i >= 0; i--) {
      const a = state.animals[i];
      if ((a.dir > 0 && a.x > innerWidth + a.size * 2) || (a.dir < 0 && a.x < -a.size * 2)) {
        state.animals.splice(i, 1);
        if (TYPES[a.type].losesLife && --state.lives <= 0) { state.lives = 0; state.mode = 'gameover'; }
      }
    }
  }
  for (const p of state.particles) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; }
  state.particles = state.particles.filter(p => p.t > 0);
  for (const n of state.notices) n.t -= dt;
  state.notices = state.notices.filter(n => n.t > 0);
}

function draw(time) {
  drawScene(time);
  const list = state.mode === 'menu' ? state.menuAnimals : state.animals;
  drawAnimals(list, time);
  drawParticles();
  if (state.mode === 'menu') drawMenu(time);
  else { drawHud(); drawNotices(); if (state.mode === 'gameover') drawGameOver(); }
}

function drawScene(time) {
  const img = images.scene;
  const iw = img.width, ih = img.height, sw = innerWidth, sh = innerHeight;
  const ia = iw / ih, sa = sw / sh;
  let sx = 0, sy = 0, sWidth = iw, sHeight = ih;
  if (ia > sa) { sWidth = ih * sa; sx = (iw - sWidth) / 2; } else { sHeight = iw / sa; sy = (ih - sHeight) / 2; }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sw, sh);
  ctx.fillStyle = 'rgba(225,245,255,.25)';
  for (let r = 0; r < 7; r++) {
    const y = sh * (.46 + r * .036), spacing = sw * (.24 + r * .008), off = ((time * (8 + r * 1.1)) % spacing) * (r % 2 ? -1 : 1);
    for (let x = -spacing + off; x < sw + spacing; x += spacing) ctx.fillRect(x, y, sw * (r % 3 ? .065 : .095), Math.max(1, sh * .0026));
  }
}

function createMenuAnimals() {
  const b = innerWidth * .095;
  state.menuAnimals = [
    animal('DUCK', -b*2, innerHeight*.475, 48, b*1.15, 1),
    animal('FISH', innerWidth+b*2, innerHeight*.565, 42, b*1.05, -1),
    animal('BEAVER', -b*3.5, innerHeight*.665, 36, b*1.18, 1),
    animal('DEER', innerWidth+b*5, innerHeight*.835, 30, b*1.35, -1)
  ];
}
function animal(type, x, y, speed, size, dir) { return { type, x, y, speed, size, dir }; }
function spawnAnimal() {
  const roll = Math.floor(Math.random() * 150);
  const type = roll === 0 ? 'GOLDEN_PLATYPUS' : roll < 36 ? 'DUCK' : roll < 76 ? 'FISH' : roll < 106 ? 'BEAVER' : 'DEER';
  const t = TYPES[type], size = innerHeight * t.size;
  let y;
  if (type === 'DUCK') y = innerHeight * .42 + size * .03;
  else if (type === 'DEER') y = innerHeight * (.73 + Math.random() * .12);
  else if (type === 'FISH') y = innerHeight * (.43 + Math.random() * .21);
  else y = innerHeight * .70 - size * .78;
  const dir = Math.random() < .5 ? 1 : -1;
  const level = Math.min(15, Math.floor(state.score / 100));
  const speed = t.speed * (type === 'GOLDEN_PLATYPUS' ? 1.05 : .8) * (1 + Math.min(.9, level*.06)) + Math.random()*35 + Math.max(0, state.score-120)*.03;
  state.animals.push(animal(type, dir > 0 ? -size*2 : innerWidth+size*2, y, speed, size, dir));
}

function drawAnimals(list, time) {
  const sheet = images.animals, fw = sheet.width / 4, fh = sheet.height / 5, frame = Math.floor(time / .18) % 4;
  for (const a of list) {
    const t = TYPES[a.type], dw = a.size*t.w, dh = a.size*t.h, dx = a.x-a.size*.32, dy = a.y-a.size*.28;
    ctx.save();
    if (a.dir === 1) { ctx.translate(dx+dw/2, 0); ctx.scale(-1,1); ctx.translate(-(dx+dw/2),0); }
    ctx.drawImage(sheet, frame*fw, t.row*fh, fw, fh, dx, dy, dw, dh);
    ctx.restore();
  }
}

function pixelPanel(x,y,w,h, fill='#241b14', border='#754821', hi='#d39443') {
  const p = Math.max(3, w*.018); ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(x+p*2,y+p*2,w,h);
  ctx.fillStyle=border; ctx.fillRect(x+p,y,w-p*2,h); ctx.fillRect(x,y+p,w,h-p*2);
  ctx.fillStyle=fill; ctx.fillRect(x+p*2,y+p*2,w-p*4,h-p*4); ctx.fillStyle=hi; ctx.fillRect(x+p*2,y+p*2,w-p*4,p);
}
function text(s,x,y,size,color='#fff',align='center') {
  ctx.save(); ctx.font=`900 ${size}px monospace`; ctx.textAlign=align; ctx.textBaseline='alphabetic'; ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillText(s,x+size*.06,y+size*.06); ctx.fillStyle=color; ctx.fillText(s,x,y); ctx.restore();
}
function drawMenu(time) {
  ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(0,0,innerWidth,innerHeight);
  pixelPanel(innerWidth*.075,innerHeight*.105,innerWidth*.85,innerHeight*.19,'rgba(31,24,17,.94)','#995b27','#e29a46');
  text('MAGIC',innerWidth/2,innerHeight*.177,innerWidth*.078,'#ffe076');
  text('RIVER',innerWidth/2,innerHeight*.252,innerWidth*.09,'#6fd2f5');
  pixelPanel(innerWidth*.235,innerHeight*.325,innerWidth*.53,innerHeight*.08);
  text(`HIGH SCORE  ${state.highScore}`,innerWidth/2,innerHeight*.378,Math.min(innerWidth*.037, 360/(`HIGH SCORE  ${state.highScore}`.length)),'#fff');
  const pulse=.5+.5*Math.sin(time*4);
  button(innerWidth*.15,innerHeight*.465,innerWidth*.70,innerHeight*.105,'PLAY','#ffe056','#e59826',pulse);
  button(innerWidth*.225,innerHeight*.610,innerWidth*.55,innerHeight*.078,state.sound?'SOUND ON':'SOUND OFF',state.sound?'#63b762':'#9a675b',state.sound?'#30753e':'#603e39',0);
}
function button(x,y,w,h,label,top,bottom,pulse) {
  const p=Math.max(4,innerWidth*.009); ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(x+p*2,y+p*2,w,h); ctx.fillStyle='#30200f'; ctx.fillRect(x+p,y,w-p*2,h); ctx.fillRect(x,y+p,w,h-p*2); ctx.fillStyle=bottom; ctx.fillRect(x+p*2,y+p*2,w-p*4,h-p*4); ctx.fillStyle=top; ctx.fillRect(x+p*2,y+p*2,w-p*4,h*.48); ctx.fillStyle=`rgba(255,255,255,${.12+pulse*.14})`; ctx.fillRect(x+p*3,y+p*3,w-p*6,p); text(label,x+w/2,y+h*.67,innerWidth*(label==='PLAY'? .06:.037),label==='PLAY'?'#2a1d10':'#fff');
}
function drawHud() {
  const m=innerWidth*.025, left={x:m,y:m,w:innerWidth*.575,h:innerHeight*.145}, right={x:innerWidth*.67,y:m,w:innerWidth*.305,h:innerHeight*.087};
  pixelPanel(left.x,left.y,left.w,left.h); pixelPanel(right.x,right.y,right.w,right.h,'rgba(39,22,22,.9)');
  const fs=Math.max(11,Math.min(innerWidth*.027, left.w/19));
  text(`SCORE  ${state.score}`,left.x+left.w*.08,left.y+left.h*.28,fs,'#fff','left');
  text(`SHOTS  ${state.shots}`,left.x+left.w*.08,left.y+left.h*.57,fs,'#fff','left');
  const hs=`HIGH SCORE  ${state.highScore}`, hfs=Math.min(fs, left.w*.78/(hs.length*.62)); text(hs,left.x+left.w*.08,left.y+left.h*.86,hfs,'#ffda7a','left');
  for(let i=0;i<state.lives;i++) drawHeart(right.x+right.w*.18+i*right.w*.25,right.y+right.h*.28,right.w*.13);
}
function drawHeart(x,y,s){ctx.fillStyle='#6c0000';ctx.fillRect(x+s*.2,y,s*.2,s*.2);ctx.fillRect(x+s*.6,y,s*.2,s*.2);ctx.fillRect(x,y+s*.2,s,s*.4);ctx.fillRect(x+s*.2,y+s*.6,s*.6,s*.2);ctx.fillRect(x+s*.4,y+s*.8,s*.2,s*.2);ctx.fillStyle='#f42626';ctx.fillRect(x+s*.2,y+s*.2,s*.6,s*.4);ctx.fillRect(x+s*.4,y+s*.6,s*.2,s*.2);}
function drawNotices(){for(const n of state.notices){const a=Math.min(1,n.t/.2);ctx.globalAlpha=a;pixelPanel(n.x,n.y,n.w,n.h,n.fill,n.border,n.hi);text(n.line1,n.x+n.w/2,n.y+n.h*.46,n.size,n.color);if(n.line2)text(n.line2,n.x+n.w/2,n.y+n.h*.80,n.size*.82,'#fff');ctx.globalAlpha=1;}}
function drawGameOver(){ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(0,0,innerWidth,innerHeight);const x=innerWidth*.1,y=innerHeight*.3,w=innerWidth*.8,h=innerHeight*.4;pixelPanel(x,y,w,h);text('GAME OVER',innerWidth/2,y+h*.27,innerWidth*.065,'#ffd04a');text(`SCORE  ${state.score}`,innerWidth/2,y+h*.51,innerWidth*.045);text(`HIGH SCORE  ${state.highScore}`,innerWidth/2,y+h*.68,innerWidth*.034,'#f3d58e');text('TAP TO MENU',innerWidth/2,y+h*.87,innerWidth*.027,'#ddd');}

function burst(x,y,golden=false){const colors=golden?['#fff4a8','#ffda45','#ff8b18']:['#fff0a0','#ff8b30','#ad271b'];for(let i=0;i<(golden?34:18);i++){const a=Math.random()*Math.PI*2,s=(golden?130:90)+Math.random()*(golden?170:110);state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.35+Math.random()*.4,gravity:180,size:3+Math.random()*6,color:colors[i%colors.length]});}}
function drawParticles(){for(const p of state.particles){ctx.globalAlpha=Math.min(1,p.t*4);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;}
function notice(line1,line2,golden=false){state.notices.push({x:innerWidth*(golden?.19:.25),y:innerHeight*(golden?.225:.155),w:innerWidth*(golden?.62:.5),h:innerHeight*(golden?.08:.06),line1,line2,size:innerWidth*(golden?.03:.028),color:'#ffe052',fill:'rgba(48,33,18,.92)',border:golden?'#a76718':'#68451f',hi:'#ffda49',t:golden?1.45:1.25});}

function startGame(){unlockAudio();state.mode='play';state.score=0;state.shots=0;state.lives=3;state.animals=[];state.particles=[];state.notices=[];state.spawnTimer=0;state.started=false;state.startHigh=state.highScore;state.newHighShown=false;}
function hitTest(a,x,y){const t=TYPES[a.type],dw=a.size*t.w,dh=a.size*t.h,dx=a.x-a.size*.32,dy=a.y-a.size*.28;return x>=dx-a.size*.15&&x<=dx+dw+a.size*.15&&y>=dy-a.size*.15&&y<=dy+dh+a.size*.15;}
function handlePointer(e){e.preventDefault();unlockAudio();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*innerWidth/r.width,y=(e.clientY-r.top)*innerHeight/r.height;
  if(state.mode==='menu'){if(y>innerHeight*.465&&y<innerHeight*.57&&x>innerWidth*.15&&x<innerWidth*.85)startGame();else if(y>innerHeight*.610&&y<innerHeight*.688&&x>innerWidth*.225&&x<innerWidth*.775)setSound(!state.sound);return;}
  if(state.mode==='gameover'){state.mode='menu';createMenuAnimals();return;}
  state.shots++;playSound('shot',1);let hit=-1;for(let i=state.animals.length-1;i>=0;i--)if(hitTest(state.animals[i],x,y)){hit=i;break;}
  if(hit>=0){const a=state.animals[hit],t=TYPES[a.type];state.score+=t.points;playSound(a.type,a.type==='DEER'?.92:.82);burst(x,y,a.type==='GOLDEN_PLATYPUS');if(state.score>state.highScore){state.highScore=state.score;localStorage.setItem('magicRiverHighScore',state.highScore);}if(!state.newHighShown&&state.score>state.startHigh){state.newHighShown=true;notice('NEW HIGH SCORE!','',false);}if(a.type==='GOLDEN_PLATYPUS'){state.lives++;notice('GOLDEN PLATYPUS!','+100  +1 LIFE',true);playSound('GOLDEN_PLATYPUS',1);}state.animals.splice(hit,1);}else burst(x,y,false);
}
canvas.addEventListener('pointerdown',handlePointer,{passive:false});
document.addEventListener('visibilitychange',()=>{if(document.hidden)music.pause();else if(state.sound)unlockAudio();});
if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
