import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from './config.js';
import { AssetManager } from './assets.js';
import { WeaponSystem } from './weapons.js';
import { EffectsSystem } from './effects.js';
import { EnemySystem } from './enemies.js';
import { buildWorld } from './world.js';

const root = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,CONFIG.performance.maxPixelRatio));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=CONFIG.performance.shadows;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.86;
root.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x020504);
scene.fog=new THREE.FogExp2(0x020605,.025);

const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.04,120);
camera.position.set(0,1.72,7);

const controls=new PointerLockControls(camera,renderer.domElement);
scene.add(controls.object);

scene.add(new THREE.HemisphereLight(0x5b7a6a,0x080a09,.28));
const emergency=new THREE.PointLight(0xff2600,8,18,2);
emergency.position.set(0,2.8,-16);
scene.add(emergency);

const world=buildWorld(scene);
const assets=new AssetManager(CONFIG);
const effects=new EffectsSystem(scene,camera);
const weapons=new WeaponSystem(camera,CONFIG,effects);
const enemies=new EnemySystem(scene,assets);

let started=false,powerOn=false,flashOn=true,hp=100,armor=50,kills=0,fireHeld=false;
const keys={};
const raycaster=new THREE.Raycaster();
const clock=new THREE.Clock();

const flashlight=new THREE.SpotLight(0xe8fff3,75,22,Math.PI/7,.42,1.4);
flashlight.position.set(.18,-.10,-.12);
flashlight.target.position.set(0,0,-8);
camera.add(flashlight,flashlight.target);

const toast=t=>{
  const m=document.getElementById('message');
  m.textContent=t;
  m.style.opacity=1;
  clearTimeout(toast.id);
  toast.id=setTimeout(()=>m.style.opacity=0,1600);
};

function hud(){
  document.getElementById('hp').textContent=Math.round(hp);
  document.getElementById('armor').textContent=Math.round(armor);
  document.getElementById('weaponName').textContent=weapons.current==='rifle'?`HK416 · ${weapons.fireMode.toUpperCase()}`:'M9A4 · SEMI';
  document.getElementById('ammo').textContent=`${weapons.ammo[weapons.current]}/${weapons.reserve[weapons.current]}`;
  document.getElementById('lightState').textContent=flashOn?'ON':'OFF';
  document.getElementById('powerState').textContent=powerOn?'ONLINE':'OFFLINE';
  document.getElementById('secure').textContent=`${kills}/${enemies.enemies.length||3}`;
}

function canMove(next){
  if(Math.abs(next.x)>8.45||next.z>8.3||next.z<-32.4)return false;
  const p=new THREE.Vector3(next.x,1,next.z);
  return !world.collision.some(m=>new THREE.Box3().setFromObject(m).expandByScalar(.3).containsPoint(p));
}

function movement(dt){
  const fi=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  const si=(keys.KeyD?1:0)-(keys.KeyA?1:0);

  const forward=new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y=0;
  if(forward.lengthSq()<.0001)forward.set(0,0,-1);else forward.normalize();

  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const v=forward.multiplyScalar(fi).add(right.multiplyScalar(si));

  weapons.moving=v.lengthSq()>.01;
  if(v.lengthSq()>1)v.normalize();

  weapons.sprinting=!!keys.ShiftLeft&&weapons.moving&&!weapons.aiming;
  const next=controls.object.position.clone().addScaledVector(v,(weapons.sprinting?6.1:3.7)*dt);
  if(canMove(next))controls.object.position.copy(next);
}

function restorePower(){
  if(powerOn)return;
  powerOn=true;
  world.lights.forEach((l,i)=>setTimeout(()=>l.intensity=16,i*110));
  emergency.intensity=.8;
  document.getElementById('objective').textContent='OBJECTIVE: ELIMINATE VOLK TEAM';
  toast('FACILITY POWER RESTORED');
  hud();
}

function interact(){
  raycaster.setFromCamera(new THREE.Vector2(),camera);
  const h=raycaster.intersectObject(world.switchGroup,true)[0];
  if(h&&h.distance<2.7)restorePower();
}

function shoot(){
  const now=performance.now();
  if(!weapons.shoot(now))return;

  raycaster.setFromCamera(new THREE.Vector2(),camera);
  const hits=raycaster.intersectObjects([...enemies.enemies,...world.collision],true);
  if(hits[0]){
    const hit = hits[0];
    const e=hit.object.userData.enemy;
    effects.impact(hit);

    if(e&&!e.userData.dead){
      e.userData.health-=weapons.current==='rifle'?38:28;
      if(e.userData.health<=0){
        e.userData.dead=true;
        e.rotation.z=Math.PI/2;
        kills++;
        toast('HOSTILE NEUTRALIZED');
      }
    }
  }
  hud();
}

addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyE')interact();
  if(e.code==='KeyF'){flashOn=!flashOn;flashlight.visible=flashOn;hud();}
  if(e.code==='KeyR')weapons.reload();
  if(e.code==='KeyB'&&!e.repeat)toast(weapons.toggleFireMode());
  if(e.code==='Digit1')weapons.switchWeapon('rifle');
  if(e.code==='Digit2')weapons.switchWeapon('pistol');
  hud();
});

addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{
  if(e.button===0){fireHeld=true;shoot();}
  if(e.button===2)weapons.aiming=true;
});
addEventListener('mouseup',e=>{
  if(e.button===0)fireHeld=false;
  if(e.button===2)weapons.aiming=false;
});
addEventListener('blur',()=>{fireHeld=false;weapons.aiming=false;});
addEventListener('contextmenu',e=>e.preventDefault());

document.getElementById('startButton').onclick=()=>{
  started=true;
  document.getElementById('startPanel').style.display='none';
  controls.lock();
};

renderer.domElement.addEventListener('click',()=>{if(started&&!controls.isLocked)controls.lock();});

await Promise.all([
  assets.loadModel('ar15',CONFIG.assets.rifle),
  assets.loadModel('m9',CONFIG.assets.pistol),
  assets.loadModel('soldier',CONFIG.assets.soldier)
]);

const rifle=assets.clone('ar15');
if(rifle){
  assets.normalize(rifle,CONFIG.weaponPoses.rifle.normalizeSize);
  weapons.install('rifle',rifle);
}

const pistol=assets.clone('m9');
if(pistol){
  assets.normalize(pistol,CONFIG.weaponPoses.pistol.normalizeSize);
  weapons.install('pistol',pistol);
}

enemies.spawnAll();
hud();

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);
  const t=clock.elapsedTime;

  if(started){
    movement(dt);
    weapons.update(dt,t);
    enemies.update(dt,t,controls.object);

    if(fireHeld&&weapons.current==='rifle'&&weapons.fireMode==='auto')shoot();

    raycaster.setFromCamera(new THREE.Vector2(),camera);
    const h=raycaster.intersectObject(world.switchGroup,true)[0];
    document.getElementById('prompt').textContent=h&&h.distance<2.7&&!powerOn?'PRESS E — RESTORE POWER':'';
  }
  renderer.render(scene,camera);
}
animate();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
}

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
