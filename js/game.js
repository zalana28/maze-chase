// ═══════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════
const CELL = 22;
const COLS = 21;
const ROWS = 23;

// Tile ids
const WALL=1, DOT=0, PWR=2, EMPTY=3, HOUSE=4;

// ═══════════════════════════════════════════════
//  MAZE LAYOUT  (21 × 23)
// ═══════════════════════════════════════════════
const BASE_MAP=[
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,2,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,2,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,0,1,1,1,3,1,3,1,1,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,3,3,3,3,3,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,1,4,4,4,1,3,1,0,1,1,1,1,1],
  [3,3,3,3,3,0,3,3,1,4,4,4,1,3,3,0,3,3,3,3,3],
  [1,1,1,1,1,0,1,3,1,1,1,1,1,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,3,3,3,3,3,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,1,1,3,1,3,1,1,1,0,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,0,1,0,0,0,0,0,0,3,0,0,0,0,0,0,1,0,0,1],
  [1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Ghost configs
const GHOST_CFG=[
  {color:'#FF2222',sc:'#FF7777',col:10,row:9, tx:20,ty:0,  name:'Blinky',houseDelay:0},
  {color:'#FF88FF',sc:'#FFbbFF',col:9, row:10,tx:0, ty:0,  name:'Pinky', houseDelay:3000},
  {color:'#00FFFF',sc:'#88FFFF',col:10,row:10,tx:20,ty:22, name:'Inky',  houseDelay:6000},
  {color:'#FFAA00',sc:'#FFcc88',col:11,row:10,tx:0, ty:22, name:'Clyde', houseDelay:9000},
];

// ═══════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════
let map=[], pac={}, ghosts=[];
let score=0, highScore=0, lives=3, totalDots=0, dotsEaten=0;
let gameState='idle';
let powerMode=false, powerTimer=0;
let raf=0, lastTs=0, accTime=0;
let readyTimer=0;
let dyingTimer=0, dyingPhase=0;

const PAC_STEP = 130;
const GHOST_STEP=160;
let pacAcc=0, ghostAcc=0;

let mouthAngle=0.25, mouthOpen=true;
let mouthAcc=0;

const canvas=document.getElementById('gc');
const ctx=canvas.getContext('2d');
canvas.width=COLS*CELL;
canvas.height=ROWS*CELL;

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function dist(ax,ay,bx,by){return Math.abs(ax-bx)+Math.abs(ay-by);}

function canWalk(col,row,isGhost,mode){
  if(col<0||col>=COLS) return row===10;
  if(row<0||row>=ROWS) return false;
  const t=map[row][col];
  if(t===WALL) return false;
  if(t===HOUSE){
    if(!isGhost) return false;
    return mode==='house'||mode==='eaten';
  }
  return true;
}

function wrapCol(col){ if(col<0)return COLS-1; if(col>=COLS)return 0; return col; }

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
function initGame(){
  map=BASE_MAP.map(r=>[...r]);

  totalDots=0; dotsEaten=0;
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++)
      if(map[r][c]===DOT||map[r][c]===PWR) totalDots++;

  pac={col:10,row:16,dx:0,dy:0,ndx:-1,ndy:0,alive:true};

  ghosts=GHOST_CFG.map(cfg=>({
    ...cfg,
    col:cfg.col, row:cfg.row,
    dx:0, dy:-1,
    mode:'house',
    houseTimer:cfg.houseDelay,
    frightTimer:0,
    eaten:false,
    stepAcc:0,
  }));

  score=0;
  lives=3;
  powerMode=false; powerTimer=0;
  pacAcc=0; ghostAcc=0; mouthAcc=0;
  mouthAngle=0.25; mouthOpen=true;
  updateHUD();
}

function resetPositions(){
  pac={col:10,row:16,dx:0,dy:0,ndx:-1,ndy:0,alive:true};
  ghosts.forEach((g,i)=>{
    g.col=GHOST_CFG[i].col; g.row=GHOST_CFG[i].row;
    g.dx=0; g.dy=-1;
    g.mode='house';
    g.houseTimer=GHOST_CFG[i].houseDelay;
    g.frightTimer=0; g.eaten=false; g.stepAcc=0;
  });
  powerMode=false; powerTimer=0;
  pacAcc=0; ghostAcc=0;
}

// ═══════════════════════════════════════════════
//  MOVEMENT
// ═══════════════════════════════════════════════
function movePac(){
  if(pac.ndx!==undefined){
    const nc=wrapCol(pac.col+pac.ndx), nr=pac.row+pac.ndy;
    if(canWalk(nc,nr,false,null)){
      pac.dx=pac.ndx; pac.dy=pac.ndy;
    }
  }
  const nc=wrapCol(pac.col+pac.dx), nr=pac.row+pac.dy;
  if(canWalk(nc,nr,false,null)){
    pac.col=nc; pac.row=nr;
  }

  const t=map[pac.row][pac.col];
  if(t===DOT){ map[pac.row][pac.col]=EMPTY; score+=10; dotsEaten++; updateHUD(); }
  if(t===PWR){
    map[pac.row][pac.col]=EMPTY; score+=50; dotsEaten++;
    activatePower(); updateHUD();
  }
  if(dotsEaten>=totalDots){ triggerWin(); }
}

function activatePower(){
  powerMode=true; powerTimer=8000;
  ghosts.forEach(g=>{ if(!g.eaten&&g.mode!=='house'){ g.mode='fright'; g.frightTimer=8000; }});
}

function moveGhost(g, dt){
  if(g.mode==='house'){
    g.houseTimer-=dt;
    if(g.houseTimer<=0){ g.mode='exit'; }
    return;
  }
  if(g.mode==='exit'){
    if(g.col===10&&g.row<=8){ g.mode='scatter'; return; }
    if(g.col<10){ if(canWalk(g.col+1,g.row,true,'exit')){ g.col++; return; } }
    if(g.col>10){ if(canWalk(g.col-1,g.row,true,'exit')){ g.col--; return; } }
    if(g.row>8&&canWalk(g.col,g.row-1,true,'exit')){ g.row--; return; }
    if(g.row<8&&canWalk(g.col,g.row+1,true,'exit')){ g.row++; return; }
    return;
  }

  let tx=g.tx, ty=g.ty;
  if(g.mode==='chase'){
    if(g.name==='Blinky'){ tx=pac.col; ty=pac.row; }
    else if(g.name==='Pinky'){ tx=pac.col+pac.dx*4; ty=pac.row+pac.dy*4; }
    else if(g.name==='Inky'){ tx=pac.col+2; ty=pac.row+2; }
    else {
      if(dist(g.col,g.row,pac.col,pac.row)>8){ tx=pac.col; ty=pac.row; }
      else { tx=g.tx; ty=g.ty; }
    }
  }
  if(g.mode==='fright'){ tx=Math.floor(Math.random()*COLS); ty=Math.floor(Math.random()*ROWS); }
  if(g.mode==='eaten'){ tx=10; ty=9; }

  const dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
  let best=null, bestDist=Infinity;
  for(const d of dirs){
    if(d.dx===-g.dx&&d.dy===-g.dy) continue;
    const nc=wrapCol(g.col+d.dx), nr=g.row+d.dy;
    if(!canWalk(nc,nr,true,g.mode)) continue;
    const dd=dist(nc,nr,tx,ty);
    if(dd<bestDist){ bestDist=dd; best=d; }
  }
  if(best){ g.col=wrapCol(g.col+best.dx); g.row=g.row+best.dy; g.dx=best.dx; g.dy=best.dy; }

  if(g.mode==='eaten'&&g.col===10&&g.row===9){
    g.mode='house'; g.houseTimer=2000; g.eaten=false;
    g.col=GHOST_CFG.find(c=>c.name===g.name).col;
    g.row=GHOST_CFG.find(c=>c.name===g.name).row;
  }
}

function checkGhostCollisions(){
  for(const g of ghosts){
    if(g.mode==='house'||g.mode==='exit'||g.mode==='eaten') continue;
    if(g.col===pac.col&&g.row===pac.row){
      if(g.mode==='fright'){
        g.mode='eaten'; g.eaten=true; g.frightTimer=0;
        score+=200; updateHUD();
      } else {
        triggerDeath();
        return;
      }
    }
  }
}

// ═══════════════════════════════════════════════
//  GAME EVENTS
// ═══════════════════════════════════════════════
function startGame(){
  document.getElementById('overlay').style.display='none';
  document.getElementById('msg').style.display='none';
  initGame();
  gameState='ready';
  readyTimer=2000;
  showMsg('READY!');
  lastTs=performance.now(); accTime=0;
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(loop);
}

function triggerDeath(){
  if(gameState!=='playing') return;
  gameState='dying';
  dyingTimer=1500; dyingPhase=0;
}

function triggerWin(){
  if(gameState!=='playing') return;
  gameState='won';
  if(score>highScore){ highScore=score; updateHUD(); }
  setTimeout(()=>{
    const ov=document.getElementById('overlay');
    ov.style.display='flex';
    document.getElementById('ov-score').style.display='block';
    document.getElementById('ov-score').textContent='YOU WIN! '+score+' PTS';
    document.getElementById('start-btn').textContent='▶ PAY GAS & PLAY AGAIN';
  },1500);
}

function showMsg(txt){
  const m=document.getElementById('msg');
  m.textContent=txt; m.style.display='block';
  setTimeout(()=>m.style.display='none',1200);
}

function updateHUD(){
  document.getElementById('score-el').textContent=score;
  document.getElementById('high-el').textContent=highScore;
  let h=''; for(let i=0;i<lives;i++) h+='♥';
  document.getElementById('lives-el').textContent=h||'💀';
}

// ═══════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════
function loop(ts){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(ts-lastTs,100);
  lastTs=ts;

  if(gameState==='ready'){
    readyTimer-=dt;
    if(readyTimer<=0){ gameState='playing'; document.getElementById('msg').style.display='none'; }
    render(dt);
    return;
  }

  if(gameState==='playing'){
    if(powerMode){
      powerTimer-=dt;
      if(powerTimer<=0){
        powerMode=false;
        ghosts.forEach(g=>{ if(g.mode==='fright') g.mode='chase'; });
      }
      ghosts.forEach(g=>{ if(g.mode==='fright'){ g.frightTimer-=dt; } });
    }

    pacAcc+=dt;
    if(pacAcc>=PAC_STEP){ pacAcc-=PAC_STEP; movePac(); }

    ghostAcc+=dt;
    if(ghostAcc>=GHOST_STEP){
      ghostAcc-=GHOST_STEP;
      ghosts.forEach(g=>moveGhost(g,GHOST_STEP));
    }
    checkGhostCollisions();

    mouthAcc+=dt;
    if(mouthAcc>40){
      mouthAcc=0;
      if(mouthOpen){ mouthAngle+=0.04; if(mouthAngle>=0.25)mouthOpen=false; }
      else { mouthAngle-=0.04; if(mouthAngle<=0.02)mouthOpen=true; }
    }

    ghosts.forEach(g=>{
      if(g.mode!=='house'&&g.mode!=='exit'&&g.mode!=='fright'&&g.mode!=='eaten'){
        // simple: chase after 5s from game start
        g.mode='chase';
      }
    });

    render(dt);
    return;
  }

  if(gameState==='dying'){
    dyingTimer-=dt;
    if(dyingTimer<=0){
      lives--;
      updateHUD();
      if(lives<=0){
        gameState='over';
        if(score>highScore){ highScore=score; updateHUD(); }
        setTimeout(()=>{
          const ov=document.getElementById('overlay');
          ov.style.display='flex';
          document.getElementById('ov-score').style.display='block';
          document.getElementById('ov-score').textContent='GAME OVER: '+score+' PTS';
          document.getElementById('start-btn').textContent='▶ PAY GAS & RETRY';
        },500);
      } else {
        resetPositions();
        gameState='ready'; readyTimer=1500;
        showMsg('READY!');
      }
    }
    render(dt);
    return;
  }

  render(dt);
}

// ═══════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════
function render(dt){
  const W=canvas.width, H=canvas.height;
  ctx.fillStyle='#000010';
  ctx.fillRect(0,0,W,H);
  drawMaze();
  drawPac(dt);
  drawGhosts();
}

function drawMaze(){
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const t=map[r][c];
      const x=c*CELL, y=r*CELL;

      if(t===WALL){
        ctx.fillStyle='#0a0a3a';
        ctx.fillRect(x+1,y+1,CELL-2,CELL-2);
        ctx.strokeStyle='#0044cc';
        ctx.lineWidth=1.5;
        ctx.shadowColor='#0066ff';
        ctx.shadowBlur=6;
        ctx.strokeRect(x+1.5,y+1.5,CELL-3,CELL-3);
        ctx.shadowBlur=0;
      }

      if(t===DOT){
        ctx.beginPath();
        ctx.arc(x+CELL/2, y+CELL/2, 2, 0, Math.PI*2);
        ctx.fillStyle='#ddddff';
        ctx.shadowColor='#aaaaff';
        ctx.shadowBlur=4;
        ctx.fill();
        ctx.shadowBlur=0;
      }

      if(t===PWR){
        const pulse=0.8+0.2*Math.sin(Date.now()/200);
        ctx.beginPath();
        ctx.arc(x+CELL/2, y+CELL/2, 5*pulse, 0, Math.PI*2);
        ctx.fillStyle='#ffffff';
        ctx.shadowColor='#ffffff';
        ctx.shadowBlur=12;
        ctx.fill();
        ctx.shadowBlur=0;
      }
    }
  }
}

function drawPac(dt){
  if(!pac) return;
  const px=pac.col*CELL+CELL/2;
  const py=pac.row*CELL+CELL/2;
  const r=CELL/2-2;

  if(gameState==='dying'){
    const prog=1-(dyingTimer/1500);
    const deathAngle=prog*Math.PI;
    ctx.beginPath();
    ctx.moveTo(px,py);
    ctx.arc(px,py,r, deathAngle, Math.PI*2-deathAngle);
    ctx.closePath();
    ctx.fillStyle='#FFD700';
    ctx.shadowColor='#FFD700'; ctx.shadowBlur=15;
    ctx.fill(); ctx.shadowBlur=0;
    return;
  }

  if(gameState!=='playing'&&gameState!=='ready') return;

  let angle=0;
  if(pac.dx===1) angle=0;
  else if(pac.dx===-1) angle=Math.PI;
  else if(pac.dy===1) angle=Math.PI/2;
  else if(pac.dy===-1) angle=-Math.PI/2;

  const mouth=mouthAngle*Math.PI;

  ctx.beginPath();
  ctx.moveTo(px,py);
  ctx.arc(px,py,r, angle+mouth, angle+Math.PI*2-mouth);
  ctx.closePath();
  const grd=ctx.createRadialGradient(px-r*0.3,py-r*0.3,1,px,py,r);
  grd.addColorStop(0,'#FFEE00');
  grd.addColorStop(1,'#FF8800');
  ctx.fillStyle=grd;
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=18;
  ctx.fill();
  ctx.shadowBlur=0;

  const ex=px+Math.cos(angle-0.5)*r*0.55;
  const ey=py+Math.sin(angle-0.5)*r*0.55;
  ctx.beginPath();
  ctx.arc(ex,ey,2,0,Math.PI*2);
  ctx.fillStyle='#000';
  ctx.fill();
}

function drawGhosts(){
  for(const g of ghosts){
    const px=g.col*CELL+CELL/2;
    const py=g.row*CELL+CELL/2;
    const r=CELL/2-2;

    let bodyColor, eyeColor='#000';
    if(g.mode==='fright'){
      const flash=g.frightTimer<2000&&Math.floor(Date.now()/200)%2===0;
      bodyColor=flash?'#ffffff':'#0000ff';
      eyeColor='#ffffff';
    } else if(g.mode==='eaten'){
      drawGhostEyes(px,py,r,g.dx,g.dy,'#4444ff');
      continue;
    } else {
      bodyColor=g.color;
    }

    ctx.beginPath();
    ctx.arc(px,py-r*0.1,r,Math.PI,0);
    const skirtY=py+r*0.9;
    const bumps=3;
    const bw=(r*2)/bumps;
    for(let i=0;i<bumps;i++){
      const bx=px-r+bw*i;
      ctx.quadraticCurveTo(bx+bw*0.25,skirtY+r*0.3,bx+bw*0.5,skirtY);
      ctx.quadraticCurveTo(bx+bw*0.75,skirtY-r*0.3,bx+bw,skirtY);
    }
    ctx.lineTo(px-r,py-r*0.1);

    ctx.fillStyle=bodyColor;
    ctx.shadowColor=bodyColor; ctx.shadowBlur=12;
    ctx.fill();
    ctx.shadowBlur=0;

    if(g.mode!=='fright') drawGhostEyes(px,py-r*0.1,r,g.dx,g.dy,'#fff');
  }
}

function drawGhostEyes(px,py,r,dx,dy,bg){
  const offsets=[{x:-0.3,y:-0.1},{x:0.3,y:-0.1}];
  for(const o of offsets){
    const ex=px+o.x*r, ey=py+o.y*r;
    ctx.beginPath();
    ctx.ellipse(ex,ey,r*0.28,r*0.32,0,0,Math.PI*2);
    ctx.fillStyle=bg;
    ctx.fill();
    const pu={x:ex+(dx||0)*r*0.1,y:ey+(dy||0)*r*0.1};
    ctx.beginPath();
    ctx.arc(pu.x,pu.y,r*0.13,0,Math.PI*2);
    ctx.fillStyle='#0033ff';
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════
//  KEYBOARD INPUT
// ═══════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  const map2={
    ArrowLeft:{dx:-1,dy:0},ArrowRight:{dx:1,dy:0},
    ArrowUp:{dx:0,dy:-1},ArrowDown:{dx:0,dy:1},
    a:{dx:-1,dy:0},d:{dx:1,dy:0},
    w:{dx:0,dy:-1},s:{dx:0,dy:1},
    A:{dx:-1,dy:0},D:{dx:1,dy:0},
    W:{dx:0,dy:-1},S:{dx:0,dy:1},
  };
  const dir=map2[e.key];
  if(dir){
    e.preventDefault();
    pac.ndx=dir.dx; pac.ndy=dir.dy;
  }
});

// Touch/swipe
let touchX=0,touchY=0;
canvas.addEventListener('touchstart',e=>{
  touchX=e.touches[0].clientX; touchY=e.touches[0].clientY; e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-touchX;
  const dy=e.changedTouches[0].clientY-touchY;
  if(Math.abs(dx)>Math.abs(dy)){
    pac.ndx=dx>0?1:-1; pac.ndy=0;
  } else {
    pac.ndx=0; pac.ndy=dy>0?1:-1;
  }
  e.preventDefault();
},{passive:false});

// ═══════════════════════════════════════════════
//  D-PAD BUTTONS
// ═══════════════════════════════════════════════
function dpadPress(dir, down) {
  const id = {up:'btn-up',down:'btn-down',left:'btn-left',right:'btn-right'}[dir];
  const el = document.getElementById(id);
  if(el) down ? el.classList.add('pressed') : el.classList.remove('pressed');
  if(!down) return;
  const d = {up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[dir];
  if(d){ pac.ndx=d.dx; pac.ndy=d.dy; }
}

// ═══════════════════════════════════════════════
//  CANVAS RESPONSIVE SCALING
// ═══════════════════════════════════════════════
function scaleCanvas(){
  const maxW = Math.min(window.innerWidth - 8, 462);
  const scale = maxW / (COLS * CELL);
  canvas.style.width  = Math.floor(COLS * CELL * scale) + 'px';
  canvas.style.height = Math.floor(ROWS * CELL * scale) + 'px';
}
window.addEventListener('resize', scaleCanvas);
scaleCanvas();

// Initial render
initGame();
render(0);
