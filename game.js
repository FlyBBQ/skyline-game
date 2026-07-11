import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';

const $=s=>document.querySelector(s);
const ui={menu:$('#menu'),over:$('#gameOver'),score:$('#score'),scoreWrap:$('#scoreWrap'),menuBest:$('#menuBest'),finalScore:$('#finalScore'),finalBest:$('#finalBest'),perfect:$('#perfect'),hint:$('#hint'),sound:$('#sound')};
const CFG={size:3.5,height:.72,bound:4.35,gravity:19,maxSize:3.5};
let scene,camera,renderer,clock,state='menu',blocks=[],falling=[],current=null,axis='x',score=0,combo=0,speed=2.6,cameraY=5.6,targetCameraY=5.6,audio=null,soundOn=true,lastInput=0;

function safeGet(key,fallback){try{const v=localStorage.getItem(key);return v===null?fallback:v}catch{return fallback}}
function safeSet(key,v){try{localStorage.setItem(key,String(v))}catch{}}
function loadSettings(){soundOn=safeGet('skylineSound','true')!=='false';ui.sound.setAttribute('aria-pressed',String(!soundOn));ui.sound.setAttribute('aria-label',soundOn?'Sesi kapat':'Sesi aç');updateBestUI()}
function best(){return Number(safeGet('skylineBest','0'))||0}
function updateBestUI(){ui.menuBest.textContent=best();ui.finalBest.textContent=best()}
function initAudio(){if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}
function tone(freq,duration=.09,type='sine',gain=.035,delay=0){if(!soundOn)return;initAudio();const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+duration+.02)}
function playSound(kind){if(kind==='place')tone(330,.07,'sine',.028);if(kind==='cut')tone(145,.12,'triangle',.025);if(kind==='perfect'){tone(520,.12,'sine',.035);tone(780,.14,'sine',.025,.055)}if(kind==='over'){tone(260,.25,'triangle',.035);tone(155,.3,'sine',.025,.15)}}

function initScene(){scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa99fe2,10,25);camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.set(7,5.6,8);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#scene').appendChild(renderer.domElement);scene.add(new THREE.HemisphereLight(0xddecff,0x65438e,2.1));scene.add(new THREE.AmbientLight(0xffffff,.65));const light=new THREE.DirectionalLight(0xffe5f5,2.3);light.position.set(-5,9,6);scene.add(light);clock=new THREE.Clock();resizeRenderer();animate()}
function colorFor(i){const c=new THREE.Color();c.setHSL((.91-i*.012+1)%1,.55,.62);return c}
function createBlock(w,d,x,y,z,index){
  // Geçersiz bir kesim ölçüsünün tüm sahneyi bozmasını engelle.
  const width=Number.isFinite(w)?Math.max(w,.001):CFG.size;
  const depth=Number.isFinite(d)?Math.max(d,.001):CFG.size;
  const px=Number.isFinite(x)?x:0,py=Number.isFinite(y)?y:0,pz=Number.isFinite(z)?z:0;
  const geo=new THREE.BoxGeometry(width,CFG.height,depth);
  const mat=new THREE.MeshStandardMaterial({color:colorFor(index),roughness:.56,metalness:.02});
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(px,py,pz);scene.add(mesh);
  return{mesh,w:width,d:depth,index};
}
function disposeBlock(b){scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose()}
function resizeBlockGeometry(block){
  block.mesh.geometry.dispose();
  block.mesh.geometry=new THREE.BoxGeometry(block.w,CFG.height,block.d);
  block.mesh.scale.set(1,1,1);
}
function createInitialBlock(){blocks.push(createBlock(CFG.size,CFG.size,0,0,0,0))}
function spawnMovingBlock(){const prev=blocks.at(-1),y=blocks.length*CFG.height;axis=blocks.length%2?'x':'z';const direction=blocks.length%4<2?1:-1;const pos=direction*-CFG.bound;current=createBlock(prev.w,prev.d,axis==='x'?pos:prev.mesh.position.x,y,axis==='z'?pos:prev.mesh.position.z,blocks.length);current.direction=direction}
function calculateOverlap(){const prev=blocks.at(-1),key=axis==='x'?'x':'z',sizeKey=axis==='x'?'w':'d',delta=current.mesh.position[key]-prev.mesh.position[key],size=prev[sizeKey];return{prev,key,sizeKey,delta,overlap:size-Math.abs(delta)}}
function createFallingPiece(info){
  const cut=Math.max(0,info.size-info.overlap);
  if(cut<.001)return;
  const sign=Math.sign(info.delta)||1,p=current.mesh.position.clone();
  let pieceW=current.w,pieceD=current.d,pieceX=p.x,pieceZ=p.z;
  if(axis==='x'){
    pieceW=cut;
    pieceX=info.prev.mesh.position.x+sign*(info.size/2+cut/2);
  }else{
    pieceD=cut;
    pieceZ=info.prev.mesh.position.z+sign*(info.size/2+cut/2);
  }
  const piece=createBlock(pieceW,pieceD,pieceX,p.y,pieceZ,current.index);
  piece.velocity=new THREE.Vector3(axis==='x'?sign*1.3:0,.4,axis==='z'?sign*1.3:0);
  piece.spin=new THREE.Vector3(axis==='z'?sign*1.4:.25,.25,axis==='x'?-sign*1.4:.2);
  piece.life=0;falling.push(piece);
}
function placeCurrentBlock(){if(state!=='playing'||!current)return;const info=calculateOverlap();if(info.overlap<=0){current.velocity=new THREE.Vector3(axis==='x'?current.direction*1.2:0,0,axis==='z'?current.direction*1.2:0);current.spin=new THREE.Vector3(.7,.4,.8);current.life=0;falling.push(current);current=null;endGame();return}const tolerance=Math.max(.045,info.size*.025),isPerfect=Math.abs(info.delta)<=tolerance;if(isPerfect){combo++;current.mesh.position[info.key]=info.prev.mesh.position[info.key];current[info.sizeKey]=Math.min(CFG.maxSize,info.size+Math.min(.035,combo*.004));resizeBlockGeometry(current);showPerfectEffect();playSound('perfect')}else{combo=0;createFallingPiece(info);current[info.sizeKey]=info.overlap;const center=info.prev.mesh.position[info.key]+info.delta/2;current.mesh.position[info.key]=center;resizeBlockGeometry(current);playSound('cut')}blocks.push(current);current=null;score++;speed=Math.min(6.2,2.6+score*.075);updateScoreUI();targetCameraY=Math.max(5.6,blocks.at(-1).mesh.position.y+3.9);spawnMovingBlock()}
function showPerfectEffect(){ui.perfect.textContent=combo>1?`PERFECT ×${combo}`:'PERFECT';ui.perfect.classList.remove('show');void ui.perfect.offsetWidth;ui.perfect.classList.add('show');document.body.style.setProperty('--accent',combo>3?'#ffe19c':'#f477c2')}
function updateScoreUI(){ui.score.textContent=score;ui.scoreWrap.classList.remove('bump');void ui.scoreWrap.offsetWidth;ui.scoreWrap.classList.add('bump')}
function clearWorld(){[...blocks,...falling,current].filter(Boolean).forEach(disposeBlock);blocks=[];falling=[];current=null}
function resetGame(){clearWorld();score=0;combo=0;speed=2.6;cameraY=targetCameraY=5.6;camera.position.set(7,cameraY,8);updateScoreUI();createInitialBlock()}
function startGame(){initAudio();resetGame();state='playing';ui.menu.classList.remove('active');ui.over.classList.remove('active');ui.scoreWrap.classList.remove('hidden');ui.hint.classList.remove('hidden');spawnMovingBlock()}
function endGame(){state='gameOver';playSound('over');const high=Math.max(best(),score);safeSet('skylineBest',high);ui.finalScore.textContent=score;updateBestUI();ui.hint.classList.add('hidden');setTimeout(()=>ui.over.classList.add('active'),420);targetCameraY+=.35}
function showMenu(){resetGame();state='menu';ui.over.classList.remove('active');ui.menu.classList.add('active');ui.scoreWrap.classList.add('hidden');ui.hint.classList.add('hidden');updateBestUI()}
function updateMovingBlock(dt){if(!current||state!=='playing')return;const key=axis==='x'?'x':'z';current.mesh.position[key]+=current.direction*speed*dt;if(current.mesh.position[key]>CFG.bound){current.mesh.position[key]=CFG.bound;current.direction=-1}else if(current.mesh.position[key]<-CFG.bound){current.mesh.position[key]=-CFG.bound;current.direction=1}}
function updateFalling(dt){for(let i=falling.length-1;i>=0;i--){const p=falling[i];p.life+=dt;p.velocity.y-=CFG.gravity*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.y+=p.spin.y*dt;p.mesh.rotation.z+=p.spin.z*dt;if(p.life>3||p.mesh.position.y<cameraY-15){disposeBlock(p);falling.splice(i,1)}}}
function updateCamera(dt){cameraY=THREE.MathUtils.damp(cameraY,targetCameraY,state==='gameOver'?1.8:3.2,dt);camera.position.y=cameraY;const lookY=cameraY-3.6;camera.lookAt(0,lookY,0)}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);updateMovingBlock(dt);updateFalling(dt);updateCamera(dt);renderer.render(scene,camera)}
function resizeRenderer(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight,false);const portrait=innerHeight>innerWidth;camera.position.x=portrait?7.4:8.6;camera.position.z=portrait?8.8:9.4;camera.fov=portrait?39:34;camera.updateProjectionMatrix()}
function gameInput(e){if(e.target.closest('button'))return;const now=performance.now();if(now-lastInput<180)return;lastInput=now;if(state==='playing')placeCurrentBlock()}

$('#start').addEventListener('click',startGame);$('#replay').addEventListener('click',startGame);$('#home').addEventListener('click',showMenu);ui.sound.addEventListener('click',()=>{soundOn=!soundOn;safeSet('skylineSound',soundOn);ui.sound.setAttribute('aria-pressed',String(!soundOn));ui.sound.setAttribute('aria-label',soundOn?'Sesi kapat':'Sesi aç');if(soundOn){initAudio();tone(440)}});window.addEventListener('pointerdown',gameInput);window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();gameInput(e)}});window.addEventListener('resize',resizeRenderer);document.addEventListener('contextmenu',e=>e.preventDefault());
loadSettings();initScene();createInitialBlock();
