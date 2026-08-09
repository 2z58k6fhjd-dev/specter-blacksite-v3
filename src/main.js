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
scene.background=new THREE.Color(0x050a08);
scene.fog=new THREE.FogExp2(0x050a08,.012);

const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.035,120);
camera.position.set(0,1.72,7);
scene.add(camera); // Critical: camera must be in scene.

const controls=new PointerLockControls(camera,renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8ebda8,0x101512,.38));
const emergency=new THREE.PointLight(0xff2a13,7,18,2);
emergency.position.set(0,2.8,-16);
scene.add(emergency);

const loader=new GLTFLoader();
const assetMap=new Map();
const assetProgress={ar15:0,m9:0,soldier:0,environment:0};
const environmentTextures={};
const loadBar=document.getElementById('loadBar'),loadPercent=document.getElementById('loadPercent'),loadMessage=document.getElementById('loadMessage');
function updateLoading(){
  const values=Object.values(assetProgress),value=values.reduce((a,b)=>a+b,0)/values.length;
  const pct=Math.round(value*100);
  loadBar.style.width=`${pct}%`;loadPercent.textContent=`${pct}%`;
  loadMessage.textContent=pct<100?'Downloading and checking mission assets…':'Assets verified. Mission ready.';
}
function status(name,state,detail=''){
  const el=document.getElementById(`diag-${name}`);
  if(el){el.textContent=`${name.toUpperCase()}: ${state}${detail?` — ${detail}`:''}`;el.className=state==='LOADED'?'ok':state==='FAILED'?'bad':'loading'}
}
async function loadAsset(name,url){
  status(name,'LOADING');
  try{
    const gltf=await new Promise((resolve,reject)=>loader.load(url,resolve,event=>{
      if(event.total>0)assetProgress[name]=Math.min(.98,event.loaded/event.total);
      else assetProgress[name]=Math.min(.92,assetProgress[name]+.025);
      updateLoading();
    },reject));
    let count=0;
    gltf.scene.traverse(o=>{if(o.isMesh){count++;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
    assetMap.set(name,gltf);
    assetProgress[name]=1;updateLoading();
    status(name,'LOADED',`${count} meshes`);
  }catch(e){console.error(e);assetProgress[name]=1;updateLoading();status(name,'FAILED',e.message)}
}
async function loadEnvironmentAssets(){
  status('environment','LOADING');
  const textureLoader=new THREE.TextureLoader();
  const entries=[
    ['concrete','./assets/environment/concrete-wall.webp'],
    ['floor','./assets/environment/metal-floor.webp'],
    ['panels','./assets/environment/utility-panels.webp']
  ];
  let completed=0;
  try{
    await Promise.all(entries.map(([name,url])=>new Promise((resolve,reject)=>textureLoader.load(url,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());environmentTextures[name]=texture;
      completed++;assetProgress.environment=completed/entries.length;updateLoading();resolve();
    },undefined,reject))));
    status('environment','LOADED','3 materials');
  }catch(error){
    console.error(error);assetProgress.environment=1;updateLoading();status('environment','FAILED',error.message);
  }
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

await loadEnvironmentAssets();

function tiledTexture(source,x,y,color=true){
  if(!source)return null;const texture=source.clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(x,y);texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.needsUpdate=true;return texture;
}

const worldMat=new THREE.MeshStandardMaterial({color:0x8b948d,map:tiledTexture(environmentTextures.concrete,4,2),bumpMap:tiledTexture(environmentTextures.concrete,4,2,false),bumpScale:.025,roughness:.9,metalness:.04});
const floorMat=new THREE.MeshStandardMaterial({color:0x6d7472,map:tiledTexture(environmentTextures.floor,8,18),bumpMap:tiledTexture(environmentTextures.floor,8,18,false),bumpScale:.035,roughness:.7,metalness:.52});
const metalMat=new THREE.MeshStandardMaterial({color:0x626866,map:tiledTexture(environmentTextures.panels,3,3),bumpMap:tiledTexture(environmentTextures.panels,3,3,false),bumpScale:.018,roughness:.56,metalness:.64});
const trimMat=new THREE.MeshStandardMaterial({color:0x111817,roughness:.38,metalness:.82});
const crateMat=new THREE.MeshStandardMaterial({color:0x39463d,roughness:.64,metalness:.48});
const collision=[];
function box(name,x,y,z,w,h,d,mat=worldMat,collide=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
  if(collide)collision.push(m);return m;
}
function cylinder(name,x,y,z,radius,length,mat=trimMat,rotationX=0){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),mat);
  mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.x=rotationX;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
box('floor',0,-.15,-12,18,.3,42,floorMat,false);
box('ceiling',0,4.1,-12,18,.25,42,metalMat,false);
box('left-wall',-9,2,-12,.35,4.2,42);
box('right-wall',9,2,-12,.35,4.2,42);
box('rear-wall',0,2,9,18,4.2,.35);
box('front-wall',0,2,-33,18,4.2,.35);
box('partition-a',-4.8,2,-9,.35,4,12);
box('partition-b',4.8,2,-19,.35,4,14);
box('crate-a',-2.4,.7,-3.5,2.2,1.4,1.6,crateMat);
box('crate-b',3.2,.6,-11,2.4,1.2,1.7,crateMat);
box('crate-c',-2.7,.9,-22,1.8,1.8,1.8,crateMat);

// Architectural trim, service channels, pipes, and access doors give the corridor a believable scale.
box('left-base-trim',-8.76,.18,-12,.18,.36,41.4,trimMat,false);
box('right-base-trim',8.76,.18,-12,.18,.36,41.4,trimMat,false);
box('floor-service-runner',0,.012,-12,1.35,.025,40.5,metalMat,false);
for(let z=6;z>=-30;z-=6){
  box('left-column',-8.62,2,z,.42,4,.55,trimMat,false);
  box('right-column',8.62,2,z,.42,4,.55,trimMat,false);
  box('ceiling-crossmember',0,3.86,z,17.2,.18,.3,trimMat,false);
}
const pipeRed=new THREE.MeshStandardMaterial({color:0x5e211c,roughness:.55,metalness:.62});
cylinder('utility-pipe-a',-7.8,3.48,-12,.065,39,pipeRed,Math.PI/2);
cylinder('utility-pipe-b',-7.48,3.48,-12,.055,39,trimMat,Math.PI/2);
cylinder('utility-pipe-c',7.72,3.54,-12,.075,39,trimMat,Math.PI/2);
for(const z of [2,-10,-22]){
  box('access-door-left',-8.76,1.55,z,.08,2.8,1.55,metalMat,false);
  box('door-frame-left-top',-8.62,3,z,.28,.16,1.8,trimMat,false);
  box('door-frame-left-a',-8.62,1.55,z-.86,.28,2.9,.14,trimMat,false);
  box('door-frame-left-b',-8.62,1.55,z+.86,.28,2.9,.14,trimMat,false);
  const keypad=box('door-keypad',-8.48,1.5,z+.58,.08,.38,.2,trimMat,false);
  const indicator=new THREE.PointLight(0x42ff9c,.7,1.2,2);indicator.position.copy(keypad.position).add(new THREE.Vector3(.12,.08,0));scene.add(indicator);
}
for(const z of [-4,-16,-28]){
  box('wall-vent',8.76,2.7,z,.08,.85,1.5,trimMat,false);
  for(let offset=-.55;offset<=.55;offset+=.22)box('vent-slat',8.64,2.7,z+offset,.08,.55,.06,metalMat,false);
}
function facilitySign(text,x,y,z,rotationY){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#111816';ctx.fillRect(0,0,512,128);ctx.fillStyle='#53d39c';ctx.fillRect(0,0,18,128);
  ctx.strokeStyle='#40564e';ctx.lineWidth=6;ctx.strokeRect(3,3,506,122);ctx.fillStyle='#d5eee4';
  ctx.font='bold 46px Consolas, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,275,66);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.45),material);sign.position.set(x,y,z);sign.rotation.y=rotationY;scene.add(sign);
}
facilitySign('SECURITY',-8.53,2.8,6.2,Math.PI/2);
facilitySign('ARMORY',8.53,2.8,-10.2,-Math.PI/2);
facilitySign('LAB WING',-8.53,2.8,-22.2,Math.PI/2);

const facilityLights=[];
for(let z=5;z>-31;z-=6){
  box('fixture-housing',0,3.83,z,3.4,.14,.46,trimMat,false);
  const lensMat=new THREE.MeshStandardMaterial({color:0xc9e5dc,emissive:0xa7e8d1,emissiveIntensity:.18,roughness:.25});
  box('fixture-lens',0,3.74,z,2.9,.035,.24,lensMat,false);
  const l=new THREE.PointLight(0xd7fff0,0,13,2);l.position.set(0,3.5,z);scene.add(l);facilityLights.push(l);
}

const switchGroup=new THREE.Group();
switchGroup.position.set(-7.9,1.45,5.4);switchGroup.rotation.y=Math.PI/2;
const plate=new THREE.Mesh(new THREE.BoxGeometry(.12,.9,.55),metalMat);
const lever=new THREE.Mesh(new THREE.BoxGeometry(.12,.44,.12),metalMat);lever.position.set(-.1,.08,0);
switchGroup.add(plate,lever);scene.add(switchGroup);

const flashlight=new THREE.SpotLight(0xf0fff7,52,24,Math.PI/6,.42,1.2);
flashlight.position.set(.18,-.08,-.10);
flashlight.target.position.set(0,0,-8);
camera.add(flashlight,flashlight.target);

const weaponRoot=new THREE.Group();camera.add(weaponRoot);
const rifleHolder=new THREE.Group(),pistolHolder=new THREE.Group();
weaponRoot.add(rifleHolder,pistolHolder);pistolHolder.visible=false;

const weaponRig={
  rifle:{holder:rifleHolder,muzzle:null,eject:null},
  pistol:{holder:pistolHolder,muzzle:null,eject:null}
};
let pistolSlide=null,pistolSlideTime=-1,pistolSlideLocked=false;
const pistolSlideBase=new THREE.Vector3(),pistolSlideTravel=new THREE.Vector3();

function effectivelyVisible(object,root){
  for(let current=object;current&&current!==root.parent;current=current.parent)if(!current.visible)return false;
  return true;
}
function boundsInSpace(root,space){
  root.updateWorldMatrix(true,true);space.updateWorldMatrix(true,false);
  const result=new THREE.Box3();let found=false;
  root.traverse(object=>{
    if(!object.isMesh||!effectivelyVisible(object,root))return;
    object.geometry.computeBoundingBox();const box=object.geometry.boundingBox;if(!box)return;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const point=new THREE.Vector3(x,y,z);object.localToWorld(point);space.worldToLocal(point);result.expandByPoint(point);found=true;
    }
  });
  return found?result:null;
}
function addAnchor(holder,position,name){
  const anchor=new THREE.Group();anchor.name=name;anchor.position.copy(position);holder.add(anchor);return anchor;
}
function faceWeaponForward(model,holder,frontName,rearName){
  const front=model.getObjectByName(frontName),rear=model.getObjectByName(rearName);
  if(!front||!rear)return;
  const frontBox=boundsInSpace(front,holder),rearBox=boundsInSpace(rear,holder);
  if(frontBox&&rearBox&&frontBox.getCenter(new THREE.Vector3()).z>rearBox.getCenter(new THREE.Vector3()).z){
    model.rotation.y+=Math.PI;model.updateWorldMatrix(true,true);
  }
}

let currentWeapon='rifle',fireMode='auto',ammo={rifle:30,pistol:15},reserve={rifle:120,pistol:60};
let reloading=false,lastShot=0,recoil=0,recoilPitch=0,aiming=false,aimBlend=0,sprinting=false,moving=false,fireHeld=false;
let swayX=0,swayY=0;

function installRifle(){
  const model=cloneAsset('ar15');if(!model)return;
  hideByName(model,['ground','stand','plane001','plane002','plane003','bullets','mag byulle','mag001','mag002','scope001','sight001','handle001','stock001']);
  normalize(model,1.38);
  model.rotation.set(0,-Math.PI/2,0);
  model.position.set(0,.005,-.18);
  rifleHolder.add(model);
  faceWeaponForward(model,rifleHolder,'Handguard','Stock');
  const modelBox=boundsInSpace(model,rifleHolder);
  const handguardBox=boundsInSpace(model.getObjectByName('Handguard')||model,rifleHolder);
  const receiverBox=boundsInSpace(model.getObjectByName('Dust cover')||model.getObjectByName('upper receiver part')||model,rifleHolder);
  if(modelBox&&handguardBox){
    const center=handguardBox.getCenter(new THREE.Vector3());center.z=modelBox.min.z-.012;
    weaponRig.rifle.muzzle=addAnchor(rifleHolder,center,'rifle-muzzle');
  }
  if(receiverBox){
    const center=receiverBox.getCenter(new THREE.Vector3());center.x=receiverBox.max.x+.018;center.y+=.012;
    weaponRig.rifle.eject=addAnchor(rifleHolder,center,'rifle-ejection-port');
  }
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
  const barrel=model.getObjectByName('Barrel_lp.001');
  pistolSlide=model.getObjectByName('Shutter_lp.001');
  const barrelBox=boundsInSpace(barrel||model,pistolHolder);
  const slideBox=boundsInSpace(pistolSlide||model,pistolHolder);
  if(barrelBox){
    const center=barrelBox.getCenter(new THREE.Vector3());center.z=barrelBox.min.z-.008;
    weaponRig.pistol.muzzle=addAnchor(pistolHolder,center,'pistol-muzzle');
  }
  if(slideBox){
    const center=slideBox.getCenter(new THREE.Vector3());center.x=slideBox.max.x+.012;center.y+=.008;
    weaponRig.pistol.eject=addAnchor(pistolHolder,center,'pistol-ejection-port');
  }
  if(pistolSlide){
    pistolSlideBase.copy(pistolSlide.position);
    pistolSlide.parent.updateWorldMatrix(true,true);pistolHolder.updateWorldMatrix(true,true);
    const start=pistolSlide.parent.worldToLocal(pistolHolder.localToWorld(new THREE.Vector3()));
    const back=pistolSlide.parent.worldToLocal(pistolHolder.localToWorld(new THREE.Vector3(0,0,.045)));
    pistolSlideTravel.copy(back.sub(start));
  }
}

const enemies=[];
const enemyGunMat=new THREE.MeshStandardMaterial({color:0x303733,roughness:.42,metalness:.76});
const enemyGunAccent=new THREE.MeshStandardMaterial({color:0x4c574f,roughness:.62,metalness:.38});
const enemyGunLens=new THREE.MeshStandardMaterial({color:0x315148,emissive:0x15342b,emissiveIntensity:.55,roughness:.18,metalness:.5});
const enemyArmorMat=new THREE.MeshStandardMaterial({color:0x28352d,roughness:.78,metalness:.22});
const enemyPoseQuaternion=new THREE.Quaternion();
function enemyWeaponPart(group,geometry,material,position,rotation=null){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);if(rotation)mesh.rotation.copy(rotation);mesh.castShadow=true;group.add(mesh);return mesh;
}
function createEnemyRifle(heavy=false){
  const group=new THREE.Group();group.name='enemy-rifle';group.position.set(-.09,1.3,-.38);group.rotation.x=-.06;
  enemyWeaponPart(group,new THREE.BoxGeometry(.14,.13,.44),enemyGunMat,new THREE.Vector3(0,0,0));
  enemyWeaponPart(group,new THREE.BoxGeometry(.16,.17,.25),enemyGunAccent,new THREE.Vector3(0,-.01,.32));
  enemyWeaponPart(group,new THREE.CylinderGeometry(.027,.027,.4,10),enemyGunMat,new THREE.Vector3(0,.018,-.4),new THREE.Euler(Math.PI/2,0,0));
  enemyWeaponPart(group,new THREE.BoxGeometry(.095,.2,.12),enemyGunAccent,new THREE.Vector3(0,-.145,.04),new THREE.Euler(-.18,0,0));
  enemyWeaponPart(group,new THREE.BoxGeometry(.07,.19,.085),enemyGunMat,new THREE.Vector3(0,-.13,.2),new THREE.Euler(-.18,0,0));
  enemyWeaponPart(group,new THREE.BoxGeometry(.07,.06,.12),enemyGunMat,new THREE.Vector3(0,.095,-.04));
  enemyWeaponPart(group,new THREE.CylinderGeometry(.034,.034,.085,12),enemyGunLens,new THREE.Vector3(0,.105,-.04),new THREE.Euler(Math.PI/2,0,0));
  const muzzle=new THREE.Group();muzzle.position.set(0,.018,-.61);group.add(muzzle);
  const eject=new THREE.Group();eject.position.set(.09,.05,-.06);group.add(eject);
  if(heavy)group.scale.setScalar(1.06);
  return {group,muzzle,eject,basePosition:group.position.clone()};
}
function captureEnemyRig(model){
  const names={
    spine:'spine 3_05',head:'head neck lower_06',rightShoulder:'arm right shoulder 2_011',rightElbow:'arm rght elbow_012',
    leftShoulder:'arm left shoulder 2_035',leftElbow:'arm left elbow_036',rightThigh:'leg right thigh_057',rightKnee:'leg right knee_058',
    leftThigh:'leg left thigh_061',leftKnee:'leg left knee_062'
  };
  const canonical=value=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
  const nodes=new Map();model.traverse(object=>nodes.set(canonical(object.name),object));
  const rig={};for(const [key,name] of Object.entries(names)){const bone=nodes.get(canonical(name));if(bone)rig[key]={bone,base:bone.quaternion.clone()}}
  return rig;
}
function poseEnemyBone(entry,x=0,y=0,z=0){
  if(!entry)return;enemyPoseQuaternion.setFromEuler(new THREE.Euler(x,y,z));entry.bone.quaternion.copy(entry.base).multiply(enemyPoseQuaternion);
}
function spawnEnemy(x,z,heavy=false){
  const root=new THREE.Group();root.position.set(x,0,z);
  root.userData={health:heavy?170:100,dead:false,phase:Math.random()*6,heavy,hit:0,recoil:0,nextShot:1+Math.random()*1.5,deathProgress:0};
  const model=cloneAsset('soldier',true);
  if(model){
    normalize(model,heavy?2.12:1.98,true);model.rotation.y=Math.PI;
    model.traverse(o=>{if(o.isMesh)o.userData.enemy=root});root.add(model);
    root.userData.model=model;root.userData.rig=captureEnemyRig(model);
  }
  const weapon=createEnemyRifle(heavy);root.add(weapon.group);
  root.userData.weapon=weapon.group;root.userData.weaponBase=weapon.basePosition;root.userData.muzzle=weapon.muzzle;root.userData.eject=weapon.eject;
  if(heavy){
    enemyWeaponPart(root,new THREE.BoxGeometry(.52,.46,.18),enemyArmorMat,new THREE.Vector3(0,1.33,-.08));
    enemyWeaponPart(root,new THREE.BoxGeometry(.58,.12,.2),enemyArmorMat,new THREE.Vector3(0,1.58,-.04));
  }
  root.traverse(object=>{if(object.isMesh)object.userData.enemy=root});
  scene.add(root);enemies.push(root);
}
function animateEnemyRig(enemy,dt,t,isMoving,isAiming){
  const data=enemy.userData,rig=data.rig;if(!rig)return;
  const stride=isMoving?Math.sin(t*7+data.phase):0;
  const breath=Math.sin(t*1.8+data.phase);
  const hitLean=data.hit*(data.phase%2>.5?1:-1);
  poseEnemyBone(rig.spine,isAiming?-.08:0,0,hitLean*.18+breath*.012);
  poseEnemyBone(rig.head,0,isAiming?0:Math.sin(t*.65+data.phase)*.08,0);
  poseEnemyBone(rig.rightShoulder,isAiming?-.82:stride*.12,0,isAiming?.42:0);
  poseEnemyBone(rig.rightElbow,isAiming?-.75:0,0,isAiming?1.28:0);
  poseEnemyBone(rig.leftShoulder,isAiming?-.82:-stride*.12,0,isAiming?-.42:0);
  poseEnemyBone(rig.leftElbow,isAiming?-.75:0,0,isAiming?-1.28:0);
  poseEnemyBone(rig.rightThigh,stride*.3,0,0);poseEnemyBone(rig.leftThigh,-stride*.3,0,0);
  poseEnemyBone(rig.rightKnee,Math.max(0,-stride)*.22,0,0);poseEnemyBone(rig.leftKnee,Math.max(0,stride)*.22,0,0);
  data.hit=Math.max(0,data.hit-dt*5.5);data.recoil=Math.max(0,data.recoil-dt*5);
  if(data.weapon)data.weapon.position.copy(data.weaponBase).add(new THREE.Vector3(0,0,data.recoil*.08));
}
const enemyRaycaster=new THREE.Raycaster();
function enemyCanSeePlayer(enemy,distance){
  const origin=enemy.userData.muzzle?.getWorldPosition(new THREE.Vector3())||enemy.position.clone().add(new THREE.Vector3(0,1.4,0));
  const direction=camera.position.clone().sub(origin);const length=direction.length();direction.normalize();
  enemyRaycaster.set(origin,direction);enemyRaycaster.near=0;enemyRaycaster.far=length;
  const obstruction=enemyRaycaster.intersectObjects(collision,false)[0];return !obstruction||obstruction.distance>=distance-.4;
}
function damagePlayer(amount){
  const absorbed=Math.min(armor,Math.ceil(amount*.65));armor-=absorbed;hp=Math.max(0,hp-(amount-absorbed));hud();
  if(hp<=0){toast('OPERATOR DOWN');hp=100;armor=50;camera.position.set(0,1.72,7);hud()}
}
function enemyFire(enemy,distance){
  const data=enemy.userData;data.recoil=1;spawnMuzzleBurst(data.muzzle,'rifle',.72,7);ejectCasing('rifle',data.eject);
  const accuracy=THREE.MathUtils.clamp(.74-distance*.025,.3,.68);if(Math.random()<accuracy)damagePlayer(data.heavy?12:8);
}
function updateEnemies(dt,t){
  for(const enemy of enemies){
    const data=enemy.userData;
    if(data.dead){
      data.deathProgress=Math.min(1,data.deathProgress+dt*1.7);
      const eased=1-Math.pow(1-data.deathProgress,3);enemy.rotation.z=(data.fallDirection||1)*eased*Math.PI*.48;
      if(data.weapon)data.weapon.rotation.x=-.06+eased*.35;
      continue;
    }
    const towardPlayer=camera.position.clone().sub(enemy.position);towardPlayer.y=0;const distance=towardPlayer.length();
    const engaged=distance<18,isMoving=engaged&&distance>5.3;
    if(engaged)enemy.rotation.y=Math.atan2(towardPlayer.x,towardPlayer.z)+Math.PI;
    if(isMoving){
      const next=enemy.position.clone().addScaledVector(towardPlayer.normalize(),dt*(data.heavy?.54:.72));
      if(canMove(next)){enemy.position.x=next.x;enemy.position.z=next.z}
    }
    enemy.position.y=isMoving?Math.abs(Math.sin(t*7+data.phase))*.018:Math.sin(t*1.7+data.phase)*.004;
    const canFire=powerOn&&distance<16&&enemyCanSeePlayer(enemy,distance);
    if(canFire&&t>=data.nextShot){enemyFire(enemy,distance);data.nextShot=t+(data.heavy?.72:1.05)+Math.random()*.65}
    animateEnemyRig(enemy,dt,t,isMoving,engaged);
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
const flashMaterial=new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
const flashCoreGeometry=new THREE.SphereGeometry(1,8,6),flashConeGeometry=new THREE.ConeGeometry(1,1,8,1,true);
const casingMaterial=new THREE.MeshStandardMaterial({color:0xc89b3c,roughness:.3,metalness:.85});
const casingGeometry={
  rifle:new THREE.CylinderGeometry(.006,.006,.032,10),
  pistol:new THREE.CylinderGeometry(.005,.005,.022,10)
};
const muzzleBursts=[],casings=[];
function removeSceneObject(object){if(object?.parent)object.parent.remove(object)}
function spawnMuzzleBurst(anchor,kind,scaleMultiplier=1,intensityOverride=null){
  if(!anchor)return;
  anchor.updateWorldMatrix(true,false);
  const origin=anchor.getWorldPosition(new THREE.Vector3());
  const direction=new THREE.Vector3(0,0,-1).transformDirection(anchor.matrixWorld);
  const scale=(kind==='rifle'?1:.68)*scaleMultiplier;
  const core=new THREE.Mesh(flashCoreGeometry,flashMaterial);core.position.copy(origin);core.scale.setScalar(.062*scale);scene.add(core);
  const cone=new THREE.Mesh(flashConeGeometry,flashMaterial);
  cone.position.copy(origin).addScaledVector(direction,.09*scale);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
  cone.scale.set(.035*scale,.18*scale,.035*scale);scene.add(cone);
  const light=new THREE.PointLight(0xffa34a,intensityOverride??(kind==='rifle'?13:9),5,2);light.position.copy(origin);scene.add(light);
  muzzleBursts.push({objects:[core,cone,light],ttl:.052});
}
function muzzleFlash(){spawnMuzzleBurst(weaponRig[currentWeapon].muzzle,currentWeapon)}
function ejectCasing(kind,anchorOverride=null){
  const anchor=anchorOverride||weaponRig[kind].eject;if(!anchor)return;
  anchor.updateWorldMatrix(true,false);
  const origin=anchor.getWorldPosition(new THREE.Vector3());
  const right=new THREE.Vector3(1,0,0).transformDirection(anchor.matrixWorld);
  const up=new THREE.Vector3(0,1,0).transformDirection(anchor.matrixWorld);
  const back=new THREE.Vector3(0,0,1).transformDirection(anchor.matrixWorld);
  const mesh=new THREE.Mesh(casingGeometry[kind],casingMaterial);mesh.position.copy(origin);
  mesh.quaternion.setFromEuler(new THREE.Euler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI));
  mesh.castShadow=true;scene.add(mesh);
  const speed=kind==='rifle'?2.25:1.75;
  const velocity=right.multiplyScalar(speed*(.82+Math.random()*.35)).addScaledVector(up,1.15+Math.random()*.65).addScaledVector(back,.18+Math.random()*.35);
  casings.push({mesh,velocity,spin:new THREE.Vector3(10+Math.random()*9,7+Math.random()*11,9+Math.random()*12),ttl:6});
  while(casings.length>40)removeSceneObject(casings.shift().mesh);
}
function updateWeaponEffects(dt){
  for(let i=muzzleBursts.length-1;i>=0;i--){
    const burst=muzzleBursts[i];burst.ttl-=dt;
    if(burst.ttl<=0){burst.objects.forEach(removeSceneObject);muzzleBursts.splice(i,1)}
  }
  for(let i=casings.length-1;i>=0;i--){
    const casing=casings[i];casing.ttl-=dt;casing.velocity.y-=9.8*dt;
    casing.mesh.position.addScaledVector(casing.velocity,dt);
    casing.mesh.rotation.x+=casing.spin.x*dt;casing.mesh.rotation.y+=casing.spin.y*dt;casing.mesh.rotation.z+=casing.spin.z*dt;
    if(casing.mesh.position.y<.025){
      casing.mesh.position.y=.025;
      if(casing.velocity.y<0)casing.velocity.y=-casing.velocity.y*.3;
      casing.velocity.x*=.72;casing.velocity.z*=.72;casing.spin.multiplyScalar(.76);
    }
    if(casing.ttl<=0){removeSceneObject(casing.mesh);casings.splice(i,1)}
  }
}
const raycaster=new THREE.Raycaster();
function impact(hit){
  if(!hit?.face)return;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const mark=new THREE.Mesh(new THREE.CircleGeometry(.04,12),new THREE.MeshBasicMaterial({color:0x111111,polygonOffset:true,polygonOffsetFactor:-4}));
  mark.position.copy(hit.point).addScaledVector(normal,.006);mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);scene.add(mark);
  setTimeout(()=>scene.remove(mark),30000);
}
function triggerFireAnimation(kind){
  recoilPitch=Math.min(.15,recoilPitch+(kind==='rifle'?.025:.065));
  if(kind==='pistol'){
    pistolSlideTime=0;
    pistolSlideLocked=ammo.pistol===0;
  }
}
function updatePistolSlide(dt){
  if(!pistolSlide)return;
  if(pistolSlideTime<0){
    const amount=pistolSlideLocked?1:0;
    pistolSlide.position.copy(pistolSlideBase).addScaledVector(pistolSlideTravel,amount);return;
  }
  pistolSlideTime+=dt;
  let amount;
  if(pistolSlideTime<.055)amount=THREE.MathUtils.smoothstep(pistolSlideTime,0,.055);
  else if(pistolSlideLocked)amount=1;
  else amount=1-THREE.MathUtils.smoothstep(pistolSlideTime,.055,.155);
  pistolSlide.position.copy(pistolSlideBase).addScaledVector(pistolSlideTravel,amount);
  if(!pistolSlideLocked&&pistolSlideTime>=.155){pistolSlideTime=-1;pistolSlide.position.copy(pistolSlideBase)}
}
function shoot(){
  const now=performance.now(),delay=currentWeapon==='rifle'?92:230;
  if(reloading||now-lastShot<delay||ammo[currentWeapon]<=0)return;
  lastShot=now;ammo[currentWeapon]--;recoil=Math.min(.15,recoil+(currentWeapon==='rifle'?.05:.08));
  triggerFireAnimation(currentWeapon);gunshot(currentWeapon);muzzleFlash();ejectCasing(currentWeapon);
  raycaster.setFromCamera(new THREE.Vector2(),camera);
  const hits=raycaster.intersectObjects([...enemies,...collision],true);
  if(hits[0]){
    impact(hits[0]);const e=hits[0].object.userData.enemy;
    if(e&&!e.userData.dead){
      e.userData.health-=currentWeapon==='rifle'?38:28;
      e.userData.hit=1;
      if(e.userData.health<=0){
        e.userData.dead=true;e.userData.fallDirection=Math.random()>.5?1:-1;kills++;toast('HOSTILE NEUTRALIZED');
      }
    }
  }
  hud();
}
function reload(){
  if(reloading)return;const cap=currentWeapon==='rifle'?30:15;if(ammo[currentWeapon]>=cap||reserve[currentWeapon]<=0)return;
  const kind=currentWeapon;reloading=true;setTimeout(()=>{
    const n=Math.min(cap-ammo[kind],reserve[kind]);ammo[kind]+=n;reserve[kind]-=n;
    if(kind==='pistol'&&pistolSlideLocked){pistolSlideLocked=false;pistolSlideTime=.055}
    reloading=false;hud();
  },kind==='rifle'?1450:1050);
}
function switchWeapon(kind){
  if(reloading)return;currentWeapon=kind;rifleHolder.visible=kind==='rifle';pistolHolder.visible=kind==='pistol';setAim(false);hud();
}
function setAim(value){
  aiming=value&&!sprinting;
}
function toggleMode(){if(currentWeapon==='rifle'){fireMode=fireMode==='auto'?'semi':'auto';toast(`FIRE MODE · ${fireMode.toUpperCase()}`);hud()}}
function updateWeapon(dt,t){
  updatePistolSlide(dt);
  aimBlend=THREE.MathUtils.damp(aimBlend,aiming&&!sprinting?1:0,14,dt);
  const wantedFov=THREE.MathUtils.lerp(72,currentWeapon==='rifle'?31:52,aimBlend);
  camera.fov=THREE.MathUtils.damp(camera.fov,wantedFov,16,dt);camera.updateProjectionMatrix();
  const scoped=aimBlend>.82&&currentWeapon==='rifle';
  document.getElementById('scopeOverlay').classList.toggle('active',scoped);
  document.getElementById('crosshair').style.display=scoped?'none':'block';
  const hip=currentWeapon==='rifle'?new THREE.Vector3(.25,-.235,-.47):new THREE.Vector3(.23,-.225,-.41);
  const ads=currentWeapon==='rifle'?new THREE.Vector3(0,-.067,-.235):new THREE.Vector3(0,-.112,-.30);
  const spr=currentWeapon==='rifle'?new THREE.Vector3(.40,-.43,-.39):new THREE.Vector3(.36,-.38,-.36);
  const target=(sprinting?spr:hip.clone().lerp(ads,aimBlend)).clone();
  const bob=moving?(sprinting?.018:.008):.0015;
  const adsSteady=1-aimBlend*.82;
  target.x+=(Math.sin(t*(sprinting?10:7))*bob+swayX*.00012)*adsSteady;
  target.y-=(Math.abs(Math.cos(t*(sprinting?10:7)))*bob*.7+swayY*.0001)*adsSteady;
  target.z+=recoil;
  weaponRoot.position.lerp(target,1-Math.pow(.001,dt));recoil=Math.max(0,recoil-dt*.35);
  swayX=THREE.MathUtils.damp(swayX,0,9,dt);swayY=THREE.MathUtils.damp(swayY,0,9,dt);
  const rx=(sprinting?.42:0)+recoilPitch,ry=sprinting?.22:THREE.MathUtils.lerp(-.05,0,aimBlend),rz=sprinting?-.32:0;
  weaponRoot.rotation.x+=(rx-weaponRoot.rotation.x)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.y+=(ry-weaponRoot.rotation.y)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.z+=(rz-weaponRoot.rotation.z)*(1-Math.exp(-7*dt));
  recoilPitch=Math.max(0,recoilPitch-dt*.42);
}

let started=false,powerOn=false,lightOn=true,hp=100,armor=50,kills=0;
const keys={},clock=new THREE.Clock(),moveVelocity=new THREE.Vector3();
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
  const targetVelocity=v.multiplyScalar(sprinting?6.1:3.7);
  moveVelocity.lerp(targetVelocity,1-Math.exp(-(moving?13:18)*dt));
  const next=camera.position.clone().addScaledVector(moveVelocity,dt);
  if(canMove(next))camera.position.copy(next);else moveVelocity.set(0,0,0);
  camera.position.y=1.72;
}
function restorePower(){if(powerOn)return;powerOn=true;facilityLights.forEach((l,i)=>setTimeout(()=>l.intensity=7.5,i*100));emergency.intensity=1;objective.textContent='OBJECTIVE: ELIMINATE VOLK TEAM';toast('FACILITY POWER RESTORED');hud()}
function interact(){raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];if(h&&h.distance<2.7)restorePower()}
const objective=document.getElementById('objective');

addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){lightOn=!lightOn;flashlight.visible=lightOn;hud()}if(e.code==='KeyR')reload();if(e.code==='KeyB'&&!e.repeat)toggleMode();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol')});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{ensureAudio();if(e.button===0){fireHeld=true;shoot()}if(e.button===2)setAim(true)});
addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2)setAim(false)});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{fireHeld=false;setAim(false)});
addEventListener('mousemove',e=>{if(controls.isLocked){swayX=THREE.MathUtils.clamp(swayX+e.movementX,-55,55);swayY=THREE.MathUtils.clamp(swayY+e.movementY,-45,45)}});

startButton.onclick=()=>{started=true;startPanel.style.display='none';ensureAudio();controls.lock()};
renderer.domElement.onclick=()=>{if(started&&!controls.isLocked)controls.lock()};

await Promise.all([
  loadAsset('ar15','./assets/ar15/scene.gltf'),
  loadAsset('m9','./assets/m9/scene.gltf'),
  loadAsset('soldier','./assets/soldier/scene.gltf')
]);
installRifle();installPistol();
spawnEnemy(-2.5,-8);spawnEnemy(2.9,-18);spawnEnemy(-1.2,-27,true);hud();
startButton.disabled=false;startButton.textContent='ENTER BLACKSITE';loadMessage.textContent='Assets verified. Mission ready.';

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(started){
    move(dt);updateWeapon(dt,t);updateWeaponEffects(dt);updateEnemies(dt,t);
    if(fireHeld&&currentWeapon==='rifle'&&fireMode==='auto')shoot();
    raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];
    prompt.textContent=h&&h.distance<2.7&&!powerOn?'PRESS E — RESTORE POWER':'';
  }
  renderer.render(scene,camera);
}
animate();

if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
