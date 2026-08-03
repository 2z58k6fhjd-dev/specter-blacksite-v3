import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
document.getElementById('game').appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07100d);
scene.fog=new THREE.FogExp2(0x07100d,.018);

const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.035,120);
camera.position.set(0,1.72,7);
scene.add(camera); // Critical: camera must be in scene.

const controls=new PointerLockControls(camera,renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8ebda8,0x101512,.62));
const emergency=new THREE.PointLight(0xff2a13,10,18,2);
emergency.position.set(0,2.8,-16);
scene.add(emergency);

const loader=new GLTFLoader();
const assetMap=new Map();
function status(name,state,detail=''){
  const el=document.getElementById(`diag-${name}`);
  if(el){el.textContent=`${name.toUpperCase()}: ${state}${detail?` — ${detail}`:''}`;el.className=state==='LOADED'?'ok':state==='FAILED'?'bad':'loading'}
}
async function loadAsset(name,url){
  status(name,'LOADING');
  try{
    const gltf=await loader.loadAsync(url);
    let count=0;
    gltf.scene.traverse(o=>{if(o.isMesh){count++;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
    assetMap.set(name,gltf);
    status(name,'LOADED',`${count} meshes`);
  }catch(e){console.error(e);status(name,'FAILED',e.message)}
}
function cloneAsset(name,skinned=false){
  const gltf=assetMap.get(name);
  if(!gltf)return null;
  return skinned?cloneSkeleton(gltf.scene):gltf.scene.clone(true);
}
function normalize(object,maxDimension,floorAlign=false){
  object.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(object);
  const size=box.getSize(new THREE.Vector3());
  object.scale.multiplyScalar(maxDimension/(Math.max(size.x,size.y,size.z)||1));
  object.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(object);
  const center=box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  if(floorAlign){
    object.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(object);
    object.position.y-=box.min.y;
  }
}
function hideByName(root,patterns){
  root.traverse(o=>{
    const text=`${o.name} ${o.material?.name||''}`.toLowerCase();
    if(patterns.some(p=>text.includes(p)))o.visible=false;
  });
}

const worldMat=new THREE.MeshStandardMaterial({color:0x3a4741,roughness:.85,metalness:.12});
const floorMat=new THREE.MeshStandardMaterial({color:0x26312c,roughness:.68,metalness:.18});
const metalMat=new THREE.MeshStandardMaterial({color:0x121817,roughness:.46,metalness:.68});
const collision=[];
function box(name,x,y,z,w,h,d,mat=worldMat,collide=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
  if(collide)collision.push(m);return m;
}
box('floor',0,-.15,-12,18,.3,42,floorMat,false);
box('ceiling',0,4.1,-12,18,.25,42,worldMat,false);
box('left-wall',-9,2,-12,.35,4.2,42);
box('right-wall',9,2,-12,.35,4.2,42);
box('rear-wall',0,2,9,18,4.2,.35);
box('front-wall',0,2,-33,18,4.2,.35);
box('partition-a',-4.8,2,-9,.35,4,12);
box('partition-b',4.8,2,-19,.35,4,14);
box('crate-a',-2.4,.7,-3.5,2.2,1.4,1.6,metalMat);
box('crate-b',3.2,.6,-11,2.4,1.2,1.7,metalMat);
box('crate-c',-2.7,.9,-22,1.8,1.8,1.8,metalMat);

const facilityLights=[];
for(let z=5;z>-31;z-=6){
  box('beam',0,3.8,z,18,.18,.28,metalMat,false);
  const l=new THREE.PointLight(0xd7fff0,0,13,2);l.position.set(0,3.5,z);scene.add(l);facilityLights.push(l);
}

const switchGroup=new THREE.Group();
switchGroup.position.set(-7.9,1.45,5.4);switchGroup.rotation.y=Math.PI/2;
const plate=new THREE.Mesh(new THREE.BoxGeometry(.12,.9,.55),metalMat);
const lever=new THREE.Mesh(new THREE.BoxGeometry(.12,.44,.12),metalMat);lever.position.set(-.1,.08,0);
switchGroup.add(plate,lever);scene.add(switchGroup);

const flashlight=new THREE.SpotLight(0xf0fff7,105,24,Math.PI/6,.4,1.2);
flashlight.position.set(.18,-.08,-.10);
flashlight.target.position.set(0,0,-8);
camera.add(flashlight,flashlight.target);

const weaponRoot=new THREE.Group();camera.add(weaponRoot);
const rifleHolder=new THREE.Group(),pistolHolder=new THREE.Group();
weaponRoot.add(rifleHolder,pistolHolder);pistolHolder.visible=false;

let currentWeapon='rifle',fireMode='auto',ammo={rifle:30,pistol:15},reserve={rifle:120,pistol:60};
let reloading=false,lastShot=0,recoil=0,aiming=false,sprinting=false,moving=false,fireHeld=false;

function installRifle(){
  const model=cloneAsset('ar15');if(!model)return;
  hideByName(model,['ground','stand','plane001','plane002','plane003']);
  normalize(model,1.38);
  model.rotation.set(0,Math.PI/2,0);
  model.position.set(0,.01,-.18);
  rifleHolder.add(model);
}
function installPistol(){
  const model=cloneAsset('m9');if(!model)return;
  // Keep only tan/gold version and hide black duplicate.
  model.traverse(o=>{
    const text=`${o.name} ${o.material?.name||''}`.toLowerCase();
    if(text.includes('black'))o.visible=false;
  });
  normalize(model,.52);
  model.rotation.set(0,Math.PI/2,0);
  model.position.set(0,-.01,-.10);
  pistolHolder.add(model);
}

const enemies=[];
function spawnEnemy(x,z,heavy=false){
  const root=new THREE.Group();root.position.set(x,0,z);root.userData={health:heavy?170:100,dead:false,phase:Math.random()*6};
  const model=cloneAsset('soldier',true);
  if(model){
    normalize(model,heavy?2.12:1.98,true); // feet automatically aligned to y=0
    model.rotation.y=Math.PI;
    model.traverse(o=>{if(o.isMesh)o.userData.enemy=root});
    root.add(model);
  }
  scene.add(root);enemies.push(root);
}
function updateEnemies(dt,t){
  for(const e of enemies){
    if(e.userData.dead)continue;
    const v=camera.position.clone().sub(e.position);v.y=0;
    const d=v.length();
    if(d<15){e.rotation.y=Math.atan2(v.x,v.z)+Math.PI;if(d>4.2)e.position.addScaledVector(v.normalize(),dt*.42)}
    e.position.y=Math.sin(t*2+e.userData.phase)*.008;
  }
}

let audioCtx;
function ensureAudio(){audioCtx ||= new (window.AudioContext||window.webkitAudioContext)()}
function gunshot(kind){
  ensureAudio();
  const now=audioCtx.currentTime;
  const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
  const noise=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),ng=audioCtx.createGain();
  const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.12,audioCtx.sampleRate);
  const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  noise.buffer=buffer;filter.type='bandpass';filter.frequency.value=kind==='rifle'?900:1200;
  osc.type='square';osc.frequency.setValueAtTime(kind==='rifle'?120:170,now);osc.frequency.exponentialRampToValueAtTime(45,now+.08);
  gain.gain.setValueAtTime(.18,now);gain.gain.exponentialRampToValueAtTime(.001,now+.1);
  ng.gain.setValueAtTime(.35,now);ng.gain.exponentialRampToValueAtTime(.001,now+.12);
  osc.connect(gain).connect(audioCtx.destination);noise.connect(filter).connect(ng).connect(audioCtx.destination);
  osc.start(now);osc.stop(now+.11);noise.start(now);
}
function muzzleFlash(){
  const light=new THREE.PointLight(0xffa34a,12,5,2);
  const p=new THREE.Vector3(0,0,currentWeapon==='rifle'?-1.25:-.42);weaponRoot.localToWorld(p);light.position.copy(p);scene.add(light);
  const flash=new THREE.Mesh(new THREE.SphereGeometry(currentWeapon==='rifle'?.075:.05,8,6),new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}));
  flash.position.copy(p);scene.add(flash);
  setTimeout(()=>{scene.remove(light,flash);flash.geometry.dispose();flash.material.dispose()},55);
}
const raycaster=new THREE.Raycaster();
function impact(hit){
  if(!hit?.face)return;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const mark=new THREE.Mesh(new THREE.CircleGeometry(.04,12),new THREE.MeshBasicMaterial({color:0x111111,polygonOffset:true,polygonOffsetFactor:-4}));
  mark.position.copy(hit.point).addScaledVector(normal,.006);mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);scene.add(mark);
  setTimeout(()=>scene.remove(mark),30000);
}
function shoot(){
  const now=performance.now(),delay=currentWeapon==='rifle'?92:230;
  if(reloading||now-lastShot<delay||ammo[currentWeapon]<=0)return;
  lastShot=now;ammo[currentWeapon]--;recoil=Math.min(.15,recoil+(currentWeapon==='rifle'?.05:.08));
  gunshot(currentWeapon);muzzleFlash();
  raycaster.setFromCamera(new THREE.Vector2(),camera);
  const hits=raycaster.intersectObjects([...enemies,...collision],true);
  if(hits[0]){
    impact(hits[0]);const e=hits[0].object.userData.enemy;
    if(e&&!e.userData.dead){e.userData.health-=currentWeapon==='rifle'?38:28;if(e.userData.health<=0){e.userData.dead=true;e.rotation.z=Math.PI/2;kills++;toast('HOSTILE NEUTRALIZED')}}
  }
  hud();
}
function reload(){
  if(reloading)return;const cap=currentWeapon==='rifle'?30:15;if(ammo[currentWeapon]>=cap||reserve[currentWeapon]<=0)return;
  reloading=true;setTimeout(()=>{const n=Math.min(cap-ammo[currentWeapon],reserve[currentWeapon]);ammo[currentWeapon]+=n;reserve[currentWeapon]-=n;reloading=false;hud()},currentWeapon==='rifle'?1450:1050);
}
function switchWeapon(kind){
  if(reloading)return;currentWeapon=kind;rifleHolder.visible=kind==='rifle';pistolHolder.visible=kind==='pistol';setAim(false);hud();
}
function setAim(value){
  aiming=value&&!sprinting;
  document.getElementById('scopeOverlay').classList.toggle('active',aiming&&currentWeapon==='rifle');
  document.getElementById('crosshair').style.display=aiming&&currentWeapon==='rifle'?'none':'block';
  camera.fov=aiming?(currentWeapon==='rifle'?28:52):72;camera.updateProjectionMatrix();
}
function toggleMode(){if(currentWeapon==='rifle'){fireMode=fireMode==='auto'?'semi':'auto';toast(`FIRE MODE · ${fireMode.toUpperCase()}`);hud()}}
function updateWeapon(dt,t){
  const hip=currentWeapon==='rifle'?new THREE.Vector3(.22,-.20,-.43):new THREE.Vector3(.22,-.21,-.39);
  const ads=currentWeapon==='rifle'?new THREE.Vector3(0,-.085,-.30):new THREE.Vector3(0,-.105,-.28);
  const spr=currentWeapon==='rifle'?new THREE.Vector3(.40,-.43,-.39):new THREE.Vector3(.36,-.38,-.36);
  const target=sprinting?spr:aiming?ads:hip;
  const bob=moving?(sprinting?.014:.007):.0015;target.x+=Math.sin(t*(sprinting?10:7))*bob;target.y-=Math.abs(Math.cos(t*(sprinting?10:7)))*bob*.7;target.z+=recoil;
  weaponRoot.position.lerp(target,1-Math.pow(.001,dt));recoil=Math.max(0,recoil-dt*.35);
  const rx=sprinting?.42:0,ry=sprinting?.22:(aiming?0:-.05),rz=sprinting?-.32:0;
  weaponRoot.rotation.x+=(rx-weaponRoot.rotation.x)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.y+=(ry-weaponRoot.rotation.y)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.z+=(rz-weaponRoot.rotation.z)*(1-Math.exp(-7*dt));
}

let started=false,powerOn=false,lightOn=true,hp=100,armor=50,kills=0;
const keys={},clock=new THREE.Clock();
function toast(t){const m=document.getElementById('message');m.textContent=t;m.style.opacity=1;clearTimeout(toast.id);toast.id=setTimeout(()=>m.style.opacity=0,1500)}
function hud(){
  hpEl.textContent=hp;armorEl.textContent=armor;
  weaponName.textContent=currentWeapon==='rifle'?`HK416 · ${fireMode.toUpperCase()}`:'M9A4 · SEMI';
  ammoEl.textContent=`${ammo[currentWeapon]}/${reserve[currentWeapon]}`;
  lightState.textContent=lightOn?'ON':'OFF';powerState.textContent=powerOn?'ONLINE':'OFFLINE';secure.textContent=`${kills}/${enemies.length||3}`;
}
const hpEl=document.getElementById('hp'),armorEl=document.getElementById('armor'),weaponName=document.getElementById('weaponName'),ammoEl=document.getElementById('ammo'),lightState=document.getElementById('lightState'),powerState=document.getElementById('powerState'),secure=document.getElementById('secure');
function canMove(next){
  if(Math.abs(next.x)>8.45||next.z>8.3||next.z<-32.4)return false;
  const p=new THREE.Vector3(next.x,1,next.z);
  return !collision.some(m=>new THREE.Box3().setFromObject(m).expandByScalar(.3).containsPoint(p));
}
function move(dt){
  const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const v=forward.multiplyScalar(f).add(right.multiplyScalar(s));moving=v.lengthSq()>.01;if(v.lengthSq()>1)v.normalize();
  sprinting=!!keys.ShiftLeft&&moving&&!aiming;
  const next=camera.position.clone().addScaledVector(v,(sprinting?6.1:3.7)*dt);if(canMove(next))camera.position.copy(next);
}
function restorePower(){if(powerOn)return;powerOn=true;facilityLights.forEach((l,i)=>setTimeout(()=>l.intensity=18,i*100));emergency.intensity=1;objective.textContent='OBJECTIVE: ELIMINATE VOLK TEAM';toast('FACILITY POWER RESTORED');hud()}
function interact(){raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];if(h&&h.distance<2.7)restorePower()}
const objective=document.getElementById('objective');

addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){lightOn=!lightOn;flashlight.visible=lightOn;hud()}if(e.code==='KeyR')reload();if(e.code==='KeyB'&&!e.repeat)toggleMode();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol')});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{ensureAudio();if(e.button===0){fireHeld=true;shoot()}if(e.button===2)setAim(true)});
addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2)setAim(false)});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{fireHeld=false;setAim(false)});

startButton.onclick=()=>{started=true;startPanel.style.display='none';ensureAudio();controls.lock()};
renderer.domElement.onclick=()=>{if(started&&!controls.isLocked)controls.lock()};

await Promise.all([
  loadAsset('ar15','./assets/ar15/scene.gltf'),
  loadAsset('m9','./assets/m9/scene.gltf'),
  loadAsset('soldier','./assets/soldier/scene.gltf')
]);
installRifle();installPistol();
spawnEnemy(-2.5,-8);spawnEnemy(2.9,-18);spawnEnemy(-1.2,-27,true);hud();

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(started){
    move(dt);updateWeapon(dt,t);updateEnemies(dt,t);
    if(fireHeld&&currentWeapon==='rifle'&&fireMode==='auto')shoot();
    raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];
    prompt.textContent=h&&h.distance<2.7&&!powerOn?'PRESS E — RESTORE POWER':'';
  }
  renderer.render(scene,camera);
}
animate();

if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
