import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';

const $=s=>document.querySelector(s);
const ui={menu:$('#menu'),over:$('#gameOver'),score:$('#score'),scoreWrap:$('#scoreWrap'),menuBest:$('#menuBest'),finalScore:$('#finalScore'),finalBest:$('#finalBest'),perfect:$('#perfect'),hint:$('#hint'),sound:$('#sound')};
const CFG={size:3.5,height:.72,bound:4.35,gravity:19,maxSize:3.5};
let scene,camera,renderer,clock,state='menu',blocks=[],falling=[],current=null,axis='x',score=0,combo=0,speed=2.6,cameraY=5.6,targetCameraY=5.6,audio=null,soundOn=true,lastInput=0,paletteSeed=Math.random()*Math.PI*2,earth,stars,cloudLayers=[],planets=[],cosmicObjects=[],meteorTimer=0,alienTimer=0,creatureTimer=0;

function safeGet(key,fallback){try{const v=localStorage.getItem(key);return v===null?fallback:v}catch{return fallback}}
function safeSet(key,v){try{localStorage.setItem(key,String(v))}catch{}}
function loadSettings(){soundOn=safeGet('skylineSound','true')!=='false';ui.sound.setAttribute('aria-pressed',String(!soundOn));ui.sound.setAttribute('aria-label',soundOn?'Sesi kapat':'Sesi aç');updateBestUI()}
function best(){return Number(safeGet('skylineBest','0'))||0}
function updateBestUI(){ui.menuBest.textContent=best();ui.finalBest.textContent=best()}
function initAudio(){if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}
function tone(freq,duration=.09,type='sine',gain=.035,delay=0){if(!soundOn)return;initAudio();const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+duration+.02)}
function playSound(kind){if(kind==='place')tone(330,.07,'sine',.028);if(kind==='cut')tone(145,.12,'triangle',.025);if(kind==='perfect'){const level=Math.min(combo,16),base=480+level*20;tone(base,.11,'sine',.032);tone(base*1.5,.14,'sine',.022,.045);if(combo>=7)tone(base*2,.16,'triangle',.014,.085)}if(kind==='over'){tone(260,.25,'triangle',.035);tone(155,.3,'sine',.025,.15)}}

function initScene(){scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa5bde5,10,28);camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,120);camera.position.set(7,5.6,8);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#scene').appendChild(renderer.domElement);scene.add(new THREE.HemisphereLight(0xddecff,0x26305f,2.1));scene.add(new THREE.AmbientLight(0xffffff,.65));const light=new THREE.DirectionalLight(0xffe5f5,2.3);light.position.set(-5,9,6);scene.add(light);createWorldBackdrop();clock=new THREE.Clock();resizeRenderer();animate()}
function createWorldBackdrop(){
  const earthMat=new THREE.MeshStandardMaterial({color:0x3c88bd,roughness:.82,metalness:0,emissive:0x102b58,emissiveIntensity:.2});
  earth=new THREE.Mesh(new THREE.SphereGeometry(8,48,32),earthMat);earth.position.set(0,-8.15,0);scene.add(earth);
  const landMat=new THREE.MeshStandardMaterial({color:0x67a874,roughness:.95,polygonOffset:true,polygonOffsetFactor:-1});
  [[-1.8,7.88,.8,1.5,.7],[2.1,7.8,-.6,1.1,.55],[.6,7.94,2.1,.8,.45],[-3.1,7.7,-1.5,.9,.5],[3.6,7.55,1.5,.7,.35]].forEach(([x,y,z,sx,sz])=>{const land=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),landMat);land.scale.set(sx,.16,sz);land.position.set(x,y,z);earth.add(land)});
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(8.15,48,32),new THREE.MeshBasicMaterial({color:0x9be7ff,transparent:true,opacity:.11,side:THREE.BackSide,depthWrite:false})));
  createCloudLayers();createPlanets();
  const count=900,positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){const radius=18+Math.random()*35,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);positions[i*3]=radius*Math.sin(phi)*Math.cos(theta);positions[i*3+1]=radius*Math.cos(phi)+12;positions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:0xffffff,size:.34,map:createStarTexture(),transparent:true,opacity:0,alphaTest:.08,depthWrite:false,sizeAttenuation:true});stars=new THREE.Points(geometry,material);scene.add(stars);
}
function createStarTexture(){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d'),cx=32,cy=32;c.fillStyle='#fff';c.shadowColor='#bde8ff';c.shadowBlur=8;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?8:27;c.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}c.closePath();c.fill();return new THREE.CanvasTexture(canvas)}
function createCloudLayers(){const cloudMat=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.42,roughness:1,depthWrite:false});[5,14,25,38].forEach((y,layer)=>{const group=new THREE.Group();for(let i=0;i<10;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.7+Math.random()*.7,16,10),cloudMat.clone());puff.scale.y=.35;puff.position.set((Math.random()-.5)*18,(Math.random()-.5)*1.2,(Math.random()-.5)*15);group.add(puff)}group.position.y=y;group.userData.layer=layer;cloudLayers.push(group);scene.add(group)})}
function makePlanet(name,radius,color,y,x,z){const mat=new THREE.MeshStandardMaterial({color,roughness:.75,emissive:name==='sun'?color:0x000000,emissiveIntensity:name==='sun'?.75:0});const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,32,20),mat);mesh.position.set(x,y,z);mesh.userData.name=name;planets.push(mesh);scene.add(mesh);return mesh}
function createPlanets(){makePlanet('moon',1.25,0xc9ced8,38,-7,-7);makePlanet('mars',1.55,0xc95f43,61,8,-8);const saturn=makePlanet('saturn',2.05,0xd9b879,88,-8,-10);const ring=new THREE.Mesh(new THREE.RingGeometry(2.65,3.75,48),new THREE.MeshBasicMaterial({color:0xe7d2a4,side:THREE.DoubleSide,transparent:true,opacity:.72}));ring.rotation.x=Math.PI/2.5;saturn.add(ring);makePlanet('sun',3.2,0xffb43b,122,10,-14)}
function colorFor(i,shift=0){
  // Fazları kaydırılmış RGB kanalları canlı ama pastel bir renk döngüsü üretir.
  const phase=paletteSeed+i*.48+shift;
  const r=.68+.22*Math.sin(phase);
  const g=.55+.19*Math.sin(phase+2.094);
  const b=.72+.20*Math.sin(phase+4.188);
  return new THREE.Color(r,g,b);
}
function createBlock(w,d,x,y,z,index){
  // Geçersiz bir kesim ölçüsünün tüm sahneyi bozmasını engelle.
  const width=Number.isFinite(w)?Math.max(w,.001):CFG.size;
  const depth=Number.isFinite(d)?Math.max(d,.001):CFG.size;
  const px=Number.isFinite(x)?x:0,py=Number.isFinite(y)?y:0,pz=Number.isFinite(z)?z:0;
  const geo=new THREE.BoxGeometry(width,CFG.height,depth);
  const mat=new THREE.MeshStandardMaterial({color:colorFor(index),roughness:.56,metalness:.02});
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(px,py,pz);scene.add(mesh);
  return{mesh,w:width,d:depth,index,targetColor:colorFor(index)};
}
function disposeBlock(b){scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose()}
function resizeBlockGeometry(block){
  block.mesh.geometry.dispose();
  block.mesh.geometry=new THREE.BoxGeometry(block.w,CFG.height,block.d);
  block.mesh.scale.set(1,1,1);
}
function speedForScore(value){
  if(value<=50)return 2.55+value*.014;
  if(value<=100)return 3.25+(value-50)*.018;
  if(value<=200)return 4.15+(value-100)*.009;
  return Math.min(6.1,5.05+(value-200)*.012);
}
function recoverRandomSide(block){
  const choices=[];
  if(block.w<CFG.maxSize-.001)choices.push(['x',-1],['x',1]);
  if(block.d<CFG.maxSize-.001)choices.push(['z',-1],['z',1]);
  if(!choices.length)return;
  const [dimension,side]=choices[Math.floor(Math.random()*choices.length)];
  const sizeKey=dimension==='x'?'w':'d';
  const amount=Math.min(.07,CFG.maxSize-block[sizeKey]);
  block[sizeKey]+=amount;
  block.mesh.position[dimension]+=side*amount/2;
}
function createInitialBlock(){blocks.push(createBlock(CFG.size,CFG.size,0,0,0,0))}
function spawnMovingBlock(){const prev=blocks.at(-1),y=blocks.length*CFG.height;axis=blocks.length%2?'x':'z';const fromTop=axis==='x';const pos=fromTop?-CFG.bound:CFG.bound;const direction=fromTop?1:-1;current=createBlock(prev.w,prev.d,axis==='x'?pos:prev.mesh.position.x,y,axis==='z'?pos:prev.mesh.position.z,blocks.length);current.direction=direction}
function calculateOverlap(){
  const prev=blocks.at(-1),key=axis==='x'?'x':'z',sizeKey=axis==='x'?'w':'d';
  const previousSize=prev[sizeKey],currentSize=current[sizeKey];
  const previousCenter=prev.mesh.position[key],currentCenter=current.mesh.position[key];
  const previousMin=previousCenter-previousSize/2,previousMax=previousCenter+previousSize/2;
  const currentMin=currentCenter-currentSize/2,currentMax=currentCenter+currentSize/2;
  const overlapMin=Math.max(previousMin,currentMin),overlapMax=Math.min(previousMax,currentMax);
  const overlap=Math.max(0,overlapMax-overlapMin);
  return{prev,key,sizeKey,delta:currentCenter-previousCenter,size:previousSize,currentSize,overlap,overlapMin,overlapMax,overlapCenter:(overlapMin+overlapMax)/2};
}
function createFallingPiece(info){
  const cut=Math.max(0,info.currentSize-info.overlap);
  if(cut<.001)return;
  const sign=Math.sign(info.delta)||1,p=current.mesh.position.clone();
  let pieceW=current.w,pieceD=current.d,pieceX=p.x,pieceZ=p.z;
  if(axis==='x'){
    pieceW=cut;
    pieceX=sign>0?info.overlapMax+cut/2:info.overlapMin-cut/2;
  }else{
    pieceD=cut;
    pieceZ=sign>0?info.overlapMax+cut/2:info.overlapMin-cut/2;
  }
  const piece=createBlock(pieceW,pieceD,pieceX,p.y,pieceZ,current.index);
  piece.velocity=new THREE.Vector3(axis==='x'?sign*3.4:0,-.8,axis==='z'?sign*3.4:0);
  piece.spin=new THREE.Vector3(axis==='z'?sign*1.4:.25,.25,axis==='x'?-sign*1.4:.2);
  piece.mesh.material.transparent=true;piece.mesh.material.opacity=.92;
  piece.life=0;piece.maxLife=1.45;falling.push(piece);
}
function placeCurrentBlock(){if(state!=='playing'||!current)return;const info=calculateOverlap();if(info.overlap<=0){current.velocity=new THREE.Vector3(axis==='x'?current.direction*3.2:0,-.7,axis==='z'?current.direction*3.2:0);current.spin=new THREE.Vector3(.7,.4,.8);current.mesh.material.transparent=true;current.mesh.material.opacity=.92;current.life=0;current.maxLife=1.45;falling.push(current);current=null;endGame();return}const tolerance=Math.max(.12,info.size*.06),isPerfect=Math.abs(info.delta)<=tolerance;if(isPerfect){combo++;current.mesh.position.x=info.prev.mesh.position.x;current.mesh.position.z=info.prev.mesh.position.z;current.w=info.prev.w;current.d=info.prev.d;if(combo>=7)recoverRandomSide(current);resizeBlockGeometry(current);showPerfectEffect();playSound('perfect')}else{combo=0;createFallingPiece(info);current[info.sizeKey]=info.overlap;current.mesh.position[info.key]=info.overlapCenter;resizeBlockGeometry(current);playSound('cut')}blocks.push(current);current=null;score++;speed=speedForScore(score);updateScoreUI();targetCameraY=Math.max(5.6,blocks.at(-1).mesh.position.y+3.9);spawnMovingBlock()}
function showPerfectEffect(){ui.perfect.textContent=combo>1?`PERFECT ×${combo}`:'PERFECT';ui.perfect.classList.remove('show');void ui.perfect.offsetWidth;ui.perfect.classList.add('show');document.body.style.setProperty('--accent',combo>3?'#ffe19c':'#f477c2')}
function updateScoreUI(){ui.score.textContent=score;ui.scoreWrap.classList.remove('bump');void ui.scoreWrap.offsetWidth;ui.scoreWrap.classList.add('bump')}
function clearWorld(){[...blocks,...falling,current].filter(Boolean).forEach(disposeBlock);blocks=[];falling=[];current=null}
function resetGame(){clearWorld();clearCosmicObjects();score=0;combo=0;speed=speedForScore(0);paletteSeed=Math.random()*Math.PI*2;cameraY=targetCameraY=5.6;camera.position.set(7,cameraY,8);updateScoreUI();createInitialBlock()}
function startGame(){initAudio();resetGame();state='playing';ui.menu.classList.remove('active');ui.over.classList.remove('active');ui.scoreWrap.classList.remove('hidden');ui.hint.classList.remove('hidden');spawnMovingBlock()}
function endGame(){state='gameOver';playSound('over');const high=Math.max(best(),score);safeSet('skylineBest',high);ui.finalScore.textContent=score;updateBestUI();ui.hint.classList.add('hidden');setTimeout(()=>ui.over.classList.add('active'),420);targetCameraY+=.35}
function showMenu(){resetGame();state='menu';ui.over.classList.remove('active');ui.menu.classList.add('active');ui.scoreWrap.classList.add('hidden');ui.hint.classList.add('hidden');updateBestUI()}
function updateMovingBlock(dt){if(!current||state!=='playing')return;const key=axis==='x'?'x':'z';current.mesh.position[key]+=current.direction*speed*dt;if(current.mesh.position[key]>CFG.bound){current.mesh.position[key]=CFG.bound;current.direction=-1}else if(current.mesh.position[key]<-CFG.bound){current.mesh.position[key]=-CFG.bound;current.direction=1}}
function updateFalling(dt){for(let i=falling.length-1;i>=0;i--){const p=falling[i];p.life+=dt;p.velocity.y-=CFG.gravity*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.y+=p.spin.y*dt;p.mesh.rotation.z+=p.spin.z*dt;const maxLife=p.maxLife||1.45;p.mesh.material.opacity=Math.max(0,.92-p.life/maxLife*.92);if(p.life>maxLife||p.mesh.position.y<cameraY-10){disposeBlock(p);falling.splice(i,1)}}}
function updateBlockColors(dt){
  const shift=score*.16;
  for(const block of blocks){
    block.targetColor=colorFor(block.index,shift);
    block.mesh.material.color.lerp(block.targetColor,1-Math.exp(-2.4*dt));
  }
  if(current){
    current.targetColor=colorFor(current.index,shift);
    current.mesh.material.color.lerp(current.targetColor,1-Math.exp(-3.2*dt));
  }
}
function updateEnvironment(dt){
  const progress=THREE.MathUtils.clamp(score/65,0,1),ease=progress*progress*(3-2*progress),starProgress=THREE.MathUtils.clamp((progress-.42)/.58,0,1);
  stars.material.opacity=THREE.MathUtils.damp(stars.material.opacity,starProgress*.95,2.2,dt);
  stars.rotation.y+=dt*.006;
  earth.material.emissiveIntensity=.2+ease*.18;
  const cloudOpacity=THREE.MathUtils.clamp(1-score/62,0,1);
  for(const layer of cloudLayers){layer.rotation.y+=dt*(.012+layer.userData.layer*.002);for(const puff of layer.children)puff.material.opacity=THREE.MathUtils.damp(puff.material.opacity,cloudOpacity*.48,2,dt)}
  for(const planet of planets)planet.rotation.y+=dt*(planet.userData.name==='sun'?.035:.08);
  const fogTarget=new THREE.Color().lerpColors(new THREE.Color(0xa5bde5),new THREE.Color(0x101531),ease);
  scene.fog.color.lerp(fogTarget,1-Math.exp(-1.8*dt));
  document.documentElement.style.setProperty('--bg1',`rgb(${Math.round(159*(1-ease)+10*ease)},${Math.round(217*(1-ease)+16*ease)},${Math.round(239*(1-ease)+43*ease)})`);
  document.documentElement.style.setProperty('--bg2',`rgb(${Math.round(140*(1-ease)+26*ease)},${Math.round(188*(1-ease)+20*ease)},${Math.round(229*(1-ease)+65*ease)})`);
  document.documentElement.style.setProperty('--bg3',`rgb(${Math.round(119*(1-ease)+50*ease)},${Math.round(102*(1-ease)+30*ease)},${Math.round(197*(1-ease)+92*ease)})`);
}
function spawnMeteor(){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.055,.055,2.2),new THREE.MeshBasicMaterial({color:Math.random()>.5?0xbbe8ff:0xffd1ef,transparent:true,opacity:.9}));mesh.position.set((Math.random()-.5)*18,cameraY+5+Math.random()*8,-8-Math.random()*8);mesh.rotation.set(.45,.2,-.65);scene.add(mesh);cosmicObjects.push({mesh,velocity:new THREE.Vector3(-5,-3,5),life:0,maxLife:1.5,type:'meteor'})}
function spawnAlien(){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.65,.9,.22,20),new THREE.MeshStandardMaterial({color:0x9ee9d4,emissive:0x245f69,emissiveIntensity:.5,roughness:.35})),dome=new THREE.Mesh(new THREE.SphereGeometry(.42,18,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xaeeaff,transparent:true,opacity:.72,roughness:.15}));dome.position.y=.1;group.add(body,dome);group.position.set(-11,cameraY+2.5,-3-Math.random()*5);scene.add(group);cosmicObjects.push({mesh:group,velocity:new THREE.Vector3(2.1,.08,0),life:0,maxLife:11,type:'alien'})}
function spawnCreature(){const group=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:Math.random()>.5?0x8bea78:0xb985ee,emissive:0x173f38,emissiveIntensity:.35,roughness:.65}),head=new THREE.Mesh(new THREE.SphereGeometry(.62,20,14),skin),body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.75,6,12),skin),eyeMat=new THREE.MeshBasicMaterial({color:0x101525});head.scale.y=1.25;head.position.y=.9;body.position.y=-.05;const eye1=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),eyeMat),eye2=eye1.clone();eye1.position.set(-.22,1.02,.54);eye2.position.set(.22,1.02,.54);group.add(head,body,eye1,eye2);group.position.set(10,cameraY+1.5,-4-Math.random()*4);scene.add(group);cosmicObjects.push({mesh:group,velocity:new THREE.Vector3(-1.25,.04,0),life:0,maxLife:15,type:'creature'})}
function updateCosmicEvents(dt){if(score>=100){meteorTimer-=dt;alienTimer-=dt;creatureTimer-=dt;if(meteorTimer<=0){spawnMeteor();meteorTimer=.65+Math.random()*1.2}if(alienTimer<=0){spawnAlien();alienTimer=14+Math.random()*12}if(creatureTimer<=0){spawnCreature();creatureTimer=10+Math.random()*16}}for(let i=cosmicObjects.length-1;i>=0;i--){const item=cosmicObjects[i];item.life+=dt;item.mesh.position.addScaledVector(item.velocity,dt);if(item.type==='alien')item.mesh.rotation.y+=dt*.35;else if(item.type==='creature'){item.mesh.rotation.y=Math.sin(item.life*1.8)*.22;item.mesh.position.y+=Math.sin(item.life*2.4)*dt*.15}else item.mesh.material.opacity=Math.max(0,1-item.life/item.maxLife);if(item.life>=item.maxLife){scene.remove(item.mesh);item.mesh.traverse?.(o=>{o.geometry?.dispose();o.material?.dispose()});cosmicObjects.splice(i,1)}}}
function clearCosmicObjects(){for(const item of cosmicObjects){scene.remove(item.mesh);item.mesh.traverse?.(o=>{o.geometry?.dispose();o.material?.dispose()})}cosmicObjects=[];meteorTimer=0;alienTimer=0;creatureTimer=0}
function updateCamera(dt){cameraY=THREE.MathUtils.damp(cameraY,targetCameraY,state==='gameOver'?1.8:3.2,dt);camera.position.y=cameraY;const lookY=cameraY-3.6;camera.lookAt(0,lookY,0)}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);updateMovingBlock(dt);updateFalling(dt);updateBlockColors(dt);updateEnvironment(dt);updateCosmicEvents(dt);updateCamera(dt);renderer.render(scene,camera)}
function resizeRenderer(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight,false);const portrait=innerHeight>innerWidth;camera.position.x=portrait?7.4:8.6;camera.position.z=portrait?8.8:9.4;camera.fov=portrait?39:34;camera.updateProjectionMatrix()}
function gameInput(e){if(e.target.closest('button'))return;const now=performance.now();if(now-lastInput<180)return;lastInput=now;if(state==='playing')placeCurrentBlock()}

$('#start').addEventListener('click',startGame);$('#replay').addEventListener('click',startGame);$('#home').addEventListener('click',showMenu);ui.sound.addEventListener('click',()=>{soundOn=!soundOn;safeSet('skylineSound',soundOn);ui.sound.setAttribute('aria-pressed',String(!soundOn));ui.sound.setAttribute('aria-label',soundOn?'Sesi kapat':'Sesi aç');if(soundOn){initAudio();tone(440)}});window.addEventListener('pointerdown',gameInput);window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();gameInput(e)}});window.addEventListener('resize',resizeRenderer);document.addEventListener('contextmenu',e=>e.preventDefault());
loadSettings();initScene();createInitialBlock();
