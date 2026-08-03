// SPECTER 2.4 licensed glTF model integration and browser optimization update.
// Adds procedural spatial audio, synthesized original VOLK radio voices, shell casings,
// muzzle smoke, automatic rifle fire, sprint/weapon inertia, and tactical vs empty reloads.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const root = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020504);
scene.fog = new THREE.FogExp2(0x020605, 0.026);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 120);
camera.position.set(0, 1.72, 7);
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.object);

const hemi = new THREE.HemisphereLight(0x466052, 0x080a09, 0.12); scene.add(hemi);
const emergency = new THREE.PointLight(0xff2400, 10, 16, 2); emergency.position.set(0,2.8,-16); scene.add(emergency);
const mainLights = [];
const wallMat = new THREE.MeshStandardMaterial({color:0x38403d,roughness:.9,metalness:.08});
const floorMat = new THREE.MeshStandardMaterial({color:0x202724,roughness:.72,metalness:.18});
const metalMat = new THREE.MeshStandardMaterial({color:0x161c1a,roughness:.48,metalness:.72});
const trimMat = new THREE.MeshStandardMaterial({color:0x0b0f0e,roughness:.55,metalness:.5});

// --- Licensed glTF asset pipeline ------------------------------------------
// Models remain optional at runtime: if a model fails to load, the tested
// procedural fallback remains visible and gameplay continues.
const gltfLoader=new GLTFLoader();
const modelTemplates={ar15:null,m9:null,soldier:null};
const pendingEnemyModels=[];
function loadGLTF(url){return new Promise((resolve,reject)=>gltfLoader.load(url,resolve,undefined,reject));}
function prepareModel(root,{maxDimension=1,exclude=[]}={}){
  const container=new THREE.Group();container.add(root);
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(o.isMesh){
      const n=(o.name||'').toLowerCase();
      if(exclude.some(x=>n.includes(x))){o.visible=false;return}
      o.castShadow=true;o.receiveShadow=true;
      if(o.material){
        const mats=Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{if('envMapIntensity'in m)m.envMapIntensity=.65;m.needsUpdate=true});
      }
    }
  });
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
  const largest=Math.max(size.x,size.y,size.z)||1;
  root.scale.multiplyScalar(maxDimension/largest);
  root.updateMatrixWorld(true);
  const scaledBox=new THREE.Box3().setFromObject(root),center=scaledBox.getCenter(new THREE.Vector3());
  root.position.sub(center);
  return container;
}
function orientLongAxisToForward(root){
  root.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  if(size.x>size.z*1.2)root.rotation.y=-Math.PI/2;
  else if(size.y>size.z*1.2)root.rotation.x=Math.PI/2;
  return root;
}
function installWeaponModel(template,holder,kind){
  if(!template||holder.userData.realModel)return;
  const model=template.clone(true);model.name=`${kind}-licensed-model`;
  model.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.frustumCulled=false}});
  holder.add(model);holder.userData.realModel=model;
  // Hide procedural pieces but keep the group itself for recoil/reload motion.
  holder.children.forEach(c=>{if(c!==model)c.visible=false});
  if(kind==='rifle'){
    model.scale.multiplyScalar(.92);model.position.set(0,-.04,-.82);model.rotation.set(.02,Math.PI,0);
  }else{
    model.scale.multiplyScalar(.72);model.position.set(0,-.05,-.20);model.rotation.set(.02,Math.PI,0);
  }
}
function poseSoldier(model){
  const bones={};model.traverse(o=>{if(o.isBone)bones[(o.name||'').toLowerCase()]=o});
  const find=(part)=>Object.entries(bones).find(([n])=>n.includes(part))?.[1];
  const rs=find('arm right shoulder 2'),ls=find('arm left shoulder 2');
  const re=find('arm rght elbow'),le=find('arm left elbow');
  // Bring the supplied T-pose closer to a low-ready tactical stance.
  if(rs){rs.rotation.z-=1.05;rs.rotation.x-=.38}
  if(ls){ls.rotation.z+=1.05;ls.rotation.x-=.38}
  if(re)re.rotation.y-=.72;if(le)le.rotation.y+=.72;
  return {rightShoulder:rs,leftShoulder:ls,rightElbow:re,leftElbow:le,
    rightThigh:find('leg right thigh'),leftThigh:find('leg left thigh')};
}
function installSoldierModel(enemy){
  if(!modelTemplates.soldier||enemy.userData.realModel||enemy.userData.dead)return;
  const model=cloneSkeleton(modelTemplates.soldier);model.name='licensed-russian-soldier';
  model.traverse(o=>{if(o.isMesh){o.userData.enemy=enemy;o.castShadow=true;o.receiveShadow=true}});
  enemy.children.filter(c=>c.userData.fallbackVisual).forEach(c=>c.visible=false);
  enemy.add(model);enemy.userData.realModel=model;enemy.userData.bones=poseSoldier(model);
  model.position.set(0,0,0);model.rotation.y=Math.PI;
}
async function loadLicensedModels(){
  const results=await Promise.allSettled([
    loadGLTF('./assets/models/ar15/scene.gltf'),
    loadGLTF('./assets/models/m9/scene.gltf'),
    loadGLTF('./assets/models/soldier/scene.gltf')
  ]);
  if(results[0].status==='fulfilled'){
    const r=prepareModel(results[0].value.scene,{maxDimension:1.85,exclude:['ground','stand','plane','glass','bullet','mag001','mag002','scope001','stock001']});
    orientLongAxisToForward(r);modelTemplates.ar15=r;installWeaponModel(r,rifle,'rifle');
  }else console.warn('AR-15 model fallback active',results[0].reason);
  if(results[1].status==='fulfilled'){
    const r=prepareModel(results[1].value.scene,{maxDimension:.72});orientLongAxisToForward(r);modelTemplates.m9=r;installWeaponModel(r,pistol,'pistol');
  }else console.warn('M9 model fallback active',results[1].reason);
  if(results[2].status==='fulfilled'){
    const r=prepareModel(results[2].value.scene,{maxDimension:2.05,exclude:['dummy_root ground']});
    // Place feet at y=0 after normalization.
    r.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(r);r.position.y-=b.min.y;
    modelTemplates.soldier=r;pendingEnemyModels.splice(0).forEach(installSoldierModel);
  }else console.warn('Soldier model fallback active',results[2].reason);
  document.body.classList.add('models-ready');
}


// --- Procedural audio and original synthesized radio voices -----------------
let audioCtx=null, masterGain=null, ambienceGain=null, audioReady=false;
const audioSettings={master:.72,voices:true};
function initAudio(){
  if(audioReady)return;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  audioCtx=new AC();
  masterGain=audioCtx.createGain();masterGain.gain.value=audioSettings.master;masterGain.connect(audioCtx.destination);
  ambienceGain=audioCtx.createGain();ambienceGain.gain.value=.10;ambienceGain.connect(masterGain);
  const hum=audioCtx.createOscillator(), hum2=audioCtx.createOscillator();
  hum.type='sine';hum.frequency.value=49;hum2.type='sine';hum2.frequency.value=99;
  const hg=audioCtx.createGain();hg.gain.value=.035;hum.connect(hg);hum2.connect(hg);hg.connect(ambienceGain);hum.start();hum2.start();
  const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.12;
  const noise=audioCtx.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const filter=audioCtx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=850;filter.Q.value=.35;
  const ng=audioCtx.createGain();ng.gain.value=.018;noise.connect(filter);filter.connect(ng);ng.connect(ambienceGain);noise.start();
  audioReady=true;
}
function resumeAudio(){initAudio();if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});}
function noiseBurst(duration=.08,volume=.22,filterFreq=1800,when=0){
  if(!audioReady)return;const start=audioCtx.currentTime+when;
  const b=audioCtx.createBuffer(1,Math.max(1,audioCtx.sampleRate*duration),audioCtx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const src=audioCtx.createBufferSource();src.buffer=b;const f=audioCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=filterFreq;
  const g=audioCtx.createGain();g.gain.setValueAtTime(volume,start);g.gain.exponentialRampToValueAtTime(.001,start+duration);
  src.connect(f);f.connect(g);g.connect(masterGain);src.start(start);src.stop(start+duration+.02);
}
function tone(freq=200,duration=.08,volume=.12,type='sine',slide=0,when=0){
  if(!audioReady)return;const start=audioCtx.currentTime+when,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,start);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),start+duration);g.gain.setValueAtTime(volume,start);g.gain.exponentialRampToValueAtTime(.001,start+duration);o.connect(g);g.connect(masterGain);o.start(start);o.stop(start+duration+.02);
}
function playSound(name){
  resumeAudio();
  if(name==='rifle'){noiseBurst(.075,.42,3900);tone(115,.11,.24,'triangle',-45);noiseBurst(.16,.16,900,.025);tone(52,.18,.12,'sine',-15,.02)}
  else if(name==='pistol'){noiseBurst(.06,.31,4300);tone(155,.09,.17,'triangle',-60);noiseBurst(.12,.10,1200,.02)}
  else if(name==='enemyShot'){noiseBurst(.055,.18,3200);tone(125,.08,.10,'triangle',-35)}
  else if(name==='dry'){tone(750,.025,.08,'square',-240);tone(250,.035,.07,'square',0,.025)}
  else if(name==='impactMetal'){noiseBurst(.035,.12,6500);tone(1900,.05,.08,'square',-900)}
  else if(name==='impactConcrete'){noiseBurst(.07,.13,1100);tone(105,.05,.04,'triangle',-30)}
  else if(name==='casing'){tone(2100,.018,.035,'sine',-700);tone(1250,.025,.025,'sine',-400,.025)}
  else if(name==='magOut'){tone(420,.035,.08,'square',-100);noiseBurst(.03,.035,1400,.02)}
  else if(name==='magIn'){tone(310,.045,.10,'square',80);noiseBurst(.04,.045,1000,.01)}
  else if(name==='bolt'){noiseBurst(.045,.09,2600);tone(520,.04,.06,'square',-180,.025)}
  else if(name==='power'){tone(72,.24,.15,'sawtooth',40);tone(900,.06,.06,'square',-200,.18)}
  else if(name==='step'){noiseBurst(.035,.035,300);tone(70,.045,.025,'sine',-15)}
  else if(name==='radio'){noiseBurst(.025,.04,4200);tone(1000,.025,.025,'square',-300)}
}
const spokenQueue=[];let speaking=false;
function speakRadio(text){
  if(!audioSettings.voices||!('speechSynthesis'in window))return;
  spokenQueue.push(text);if(speaking)return;
  const next=()=>{const line=spokenQueue.shift();if(!line){speaking=false;return}speaking=true;playSound('radio');
    const u=new SpeechSynthesisUtterance(line);u.rate=.93;u.pitch=.62;u.volume=.58;u.lang='en-US';
    const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>/male|david|mark|daniel/i.test(v.name))||voices.find(v=>v.lang?.startsWith('en'))||null;
    u.onend=u.onerror=()=>setTimeout(next,90);speechSynthesis.speak(u)};next();
}


function box(name,x,y,z,w,h,d,mat=wallMat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
function addRoom(){
  box('floor',0,-.15,-12,18,.3,42,floorMat); box('ceiling',0,4.1,-12,18,.25,42,wallMat);
  box('left wall',-9,2,-12,.35,4.2,42,wallMat); box('right wall',9,2,-12,.35,4.2,42,wallMat);
  box('rear wall',0,2,9,18,4.2,.35,wallMat); box('front wall',0,2,-33,18,4.2,.35,wallMat);
  for(let z=6;z>-31;z-=4){ box('beam',0,3.78,z,18,.22,.28,trimMat); box('pipeL',-7.7,3.48,z,1.7,.18,.18,metalMat); }
  // side rooms and cover
  box('partition',-4.8,2,-9,.35,4,12,wallMat); box('partition',4.8,2,-19,.35,4,14,wallMat);
  box('crate',-2.4,.7,-3.5,2.2,1.4,1.6,metalMat); box('crate',3.2,.6,-11,2.4,1.2,1.7,metalMat); box('crate',-2.7,.9,-22,1.8,1.8,1.8,metalMat);
  for (let i=0;i<6;i++){
    const z=4-i*7;
    const fixture=box('light fixture',0,3.78,z,3.3,.10,.5,metalMat);
    const light=new THREE.PointLight(0xc8ffe6,0,12,2); light.position.set(0,3.55,z); light.castShadow=true; light.shadow.mapSize.set(512,512); scene.add(light); mainLights.push(light);
  }
  // exit zone
  const exitMat=new THREE.MeshStandardMaterial({color:0x102b1c,emissive:0x20ff78,emissiveIntensity:.5});
  const exit=box('extraction',0,.06,-31,4,.12,2,exitMat); exit.userData.exit=true;
}
addRoom();

// Power switch
const switchGroup=new THREE.Group(); switchGroup.position.set(-7.9,1.45,5.4); switchGroup.rotation.y=Math.PI/2;
const plate=new THREE.Mesh(new THREE.BoxGeometry(.12,.9,.55),metalMat); plate.castShadow=true; switchGroup.add(plate);
const lever=new THREE.Mesh(new THREE.BoxGeometry(.12,.44,.12),new THREE.MeshStandardMaterial({color:0xd9c8a1,roughness:.45,metalness:.5})); lever.position.set(-.10,.08,0); switchGroup.add(lever);
const indicator=new THREE.Mesh(new THREE.SphereGeometry(.07,12,12),new THREE.MeshStandardMaterial({color:0xff7a00,emissive:0xff4200,emissiveIntensity:3}));indicator.position.set(-.08,-.26,0);switchGroup.add(indicator);
switchGroup.userData.interactive='power';scene.add(switchGroup);

// Only static world geometry participates in player collision, AI sight checks, and bullet-world hits.
// Capturing it here prevents the camera-mounted weapon and enemy meshes from blocking movement or line of sight.
const collisionMeshes=[];
scene.traverse(o=>{
  if(o.isMesh && !o.userData.enemy && !o.userData.exit && !['floor','ceiling','beam','pipeL','light fixture'].includes(o.name)) collisionMeshes.push(o);
});

// Player flashlight
const flashlight=new THREE.SpotLight(0xe8fff3,85,24,Math.PI/7,.42,1.4); flashlight.position.set(.18,-.10,-.12); flashlight.target.position.set(0,0,-8); flashlight.castShadow=true; flashlight.shadow.mapSize.set(1024,1024); camera.add(flashlight); camera.add(flashlight.target);

// Detailed first-person weapons
const weaponRoot=new THREE.Group(); camera.add(weaponRoot);
const gunDark=new THREE.MeshStandardMaterial({color:0x111413,roughness:.28,metalness:.88});
const gunPoly=new THREE.MeshStandardMaterial({color:0x2d332f,roughness:.58,metalness:.35});
const gunRubber=new THREE.MeshStandardMaterial({color:0x080a09,roughness:.92,metalness:.05});
function part(g,w,h,d,x,y,z,mat=gunDark){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.userData.fallbackVisual=true;g.add(m);return m}
function cyl(g,r,l,x,y,z,rotX=Math.PI/2,mat=gunDark,segments=18){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,segments),mat);m.rotation.x=rotX;m.position.set(x,y,z);m.castShadow=true;m.userData.fallbackVisual=true;g.add(m);return m}

const rifle=new THREE.Group(); weaponRoot.add(rifle);
part(rifle,.20,.18,.68,0,0,0);                         // receiver
part(rifle,.16,.15,.82,0,.015,-.73);                   // handguard
for(let i=0;i<7;i++) part(rifle,.175,.018,.055,0,.105,-.48-i*.105,gunPoly); // top rail
cyl(rifle,.047,.48,0,.01,-1.37,Math.PI/2,gunDark,20);   // barrel
cyl(rifle,.068,.28,0,.01,-1.72,Math.PI/2,gunDark,20);   // suppressor
part(rifle,.15,.18,.34,0,-.18,-.18,gunPoly).rotation.x=-.25; // mag
part(rifle,.11,.34,.20,0,-.26,.20,gunRubber).rotation.x=-.22; // grip
part(rifle,.18,.12,.45,0,.01,.53,gunPoly);              // buffer/stock stem
part(rifle,.25,.28,.34,0,-.02,.86,gunRubber);           // stock
part(rifle,.11,.09,.30,.11,-.04,-.82,gunPoly);          // flashlight body
cyl(rifle,.065,.30,.11,-.04,-.82,Math.PI/2,gunPoly,16);
// LPVO body with open glass
// Open-ended LPVO housing: unlike a closed cylinder, this cannot place an opaque cap across the sight picture.
const scopeTube=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.48,24,1,true),gunDark);
scopeTube.rotation.x=Math.PI/2;scopeTube.position.set(0,.22,-.34);scopeTube.castShadow=true;scopeTube.userData.fallbackVisual=true;rifle.add(scopeTube);
const scopeRear=new THREE.Mesh(new THREE.TorusGeometry(.085,.012,10,28),gunDark);scopeRear.position.set(0,.22,-.095);scopeRear.rotation.x=Math.PI/2;scopeRear.userData.fallbackVisual=true;rifle.add(scopeRear);
const scopeFront=new THREE.Mesh(new THREE.TorusGeometry(.088,.012,10,28),gunDark);scopeFront.position.set(0,.22,-.585);scopeFront.rotation.x=Math.PI/2;scopeFront.userData.fallbackVisual=true;rifle.add(scopeFront);
const glassMat=new THREE.MeshBasicMaterial({color:0x9de8cf,transparent:true,opacity:.045,side:THREE.DoubleSide,depthWrite:false});
const glass=new THREE.Mesh(new THREE.CircleGeometry(.078,28),glassMat);glass.position.set(0,.22,-.59);glass.userData.fallbackVisual=true;rifle.add(glass);
const dotMat=new THREE.MeshBasicMaterial({color:0xff3c2e,transparent:true,opacity:.85,depthTest:false});
const dot=new THREE.Mesh(new THREE.CircleGeometry(.005,12),dotMat);dot.position.set(0,.22,-.596);dot.userData.fallbackVisual=true;rifle.add(dot);

const pistol=new THREE.Group(); weaponRoot.add(pistol); pistol.visible=false;
part(pistol,.18,.15,.52,0,.02,-.12);                    // slide
part(pistol,.15,.12,.40,0,-.08,-.05,gunPoly);           // frame
part(pistol,.14,.42,.20,0,-.28,.10,gunRubber).rotation.x=-.15;
cyl(pistol,.035,.46,0,.01,-.17,Math.PI/2,gunDark,16);
part(pistol,.055,.055,.08,0,.125,-.31,gunPoly);          // front sight
part(pistol,.09,.055,.05,0,.125,.12,gunPoly);            // rear sight

weaponRoot.position.set(.38,-.34,-.72); weaponRoot.rotation.set(-.05,-.08,0);
const muzzleFlash=new THREE.Group(); weaponRoot.add(muzzleFlash); muzzleFlash.visible=false;
const flashMat=new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
const flashA=new THREE.Mesh(new THREE.ConeGeometry(.10,.42,8),flashMat);flashA.rotation.x=-Math.PI/2;muzzleFlash.add(flashA);
const flashB=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));muzzleFlash.add(flashB);
const muzzleLight=new THREE.PointLight(0xffa54a,0,5,2);muzzleFlash.add(muzzleLight);
let currentWeapon='rifle';
function placeMuzzle(){ if(currentWeapon==='rifle') muzzleFlash.position.set(0,.01,-1.93); else muzzleFlash.position.set(0,.02,-.42); }
placeMuzzle();

const casings=[], smokePuffs=[];
const casingMat=new THREE.MeshStandardMaterial({color:0xb98b35,roughness:.32,metalness:.8});
function ejectCasing(){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.055,8),casingMat);mesh.rotation.z=Math.PI/2;
  const local=currentWeapon==='rifle'?new THREE.Vector3(.13,.05,-.25):new THREE.Vector3(.10,.08,-.05);
  mesh.position.copy(weaponRoot.localToWorld(local.clone()));scene.add(mesh);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  casings.push({mesh,vel:right.multiplyScalar(1.7+Math.random()*.8).add(up.multiplyScalar(1.2+Math.random()*.7)).add(forward.multiplyScalar(.3)),spin:new THREE.Vector3(Math.random()*9,Math.random()*9,Math.random()*9),life:2.3});
  setTimeout(()=>playSound('casing'),140+Math.random()*100);
}
function spawnSmoke(){
  const mat=new THREE.MeshBasicMaterial({color:0xaab5af,transparent:true,opacity:.18,depthWrite:false});
  const puff=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),mat);puff.position.copy(muzzleFlash.getWorldPosition(new THREE.Vector3()));scene.add(puff);
  smokePuffs.push({mesh:puff,life:.7,vel:new THREE.Vector3((Math.random()-.5)*.06,.14+Math.random()*.07,(Math.random()-.5)*.06)});
}
function updateCombatParticles(dt){
  for(let i=casings.length-1;i>=0;i--){const c=casings[i];c.life-=dt;c.vel.y-=3.8*dt;c.mesh.position.addScaledVector(c.vel,dt);c.mesh.rotation.x+=c.spin.x*dt;c.mesh.rotation.y+=c.spin.y*dt;c.mesh.rotation.z+=c.spin.z*dt;if(c.mesh.position.y<.04){c.mesh.position.y=.04;c.vel.y=Math.abs(c.vel.y)*.22;c.vel.x*=.55;c.vel.z*=.55}if(c.life<=0){scene.remove(c.mesh);casings.splice(i,1)}}
  for(let i=smokePuffs.length-1;i>=0;i--){const p=smokePuffs[i];p.life-=dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.scale.multiplyScalar(1+dt*1.5);p.mesh.material.opacity=Math.max(0,p.life*.22);if(p.life<=0){scene.remove(p.mesh);p.mesh.material.dispose();smokePuffs.splice(i,1)}}
}

const impactMat=new THREE.MeshBasicMaterial({color:0x171717,transparent:true,opacity:.92,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
const impacts=[];
function spawnImpact(hit){
  const mark=new THREE.Mesh(new THREE.CircleGeometry(.045,12),impactMat.clone());
  const worldNormal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  mark.position.copy(hit.point).addScaledVector(worldNormal,.006);
  mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),worldNormal);
  scene.add(mark); impacts.push({mesh:mark,born:performance.now()});
  if(impacts.length>80){const old=impacts.shift();scene.remove(old.mesh)}
  const sparkGeo=new THREE.BufferGeometry().setFromPoints([hit.point,hit.point.clone().add(new THREE.Vector3((Math.random()-.5)*.2,Math.random()*.18,(Math.random()-.5)*.2))]);
  const spark=new THREE.Line(sparkGeo,new THREE.LineBasicMaterial({color:0xffc46b,transparent:true,opacity:1}));scene.add(spark);setTimeout(()=>scene.remove(spark),90);
}
const enemies=[];
const AI={
  alertLevel:0,
  lastKnownPlayer:new THREE.Vector3(),
  globalAlertUntil:0,
  reinforcementsCalled:false,
  reinforcementsArrived:false,
  nextId:1,
  soundEvents:[],
  radioCooldown:0,
  totalHostiles:3
};
const patrolRoutes=[
  [new THREE.Vector3(-2.5,0,-8),new THREE.Vector3(2.8,0,-8),new THREE.Vector3(2.8,0,-13),new THREE.Vector3(-2.2,0,-13)],
  [new THREE.Vector3(2.9,0,-18),new THREE.Vector3(-2.7,0,-18),new THREE.Vector3(-2.7,0,-23),new THREE.Vector3(3.2,0,-23)],
  [new THREE.Vector3(-1.2,0,-27),new THREE.Vector3(3.0,0,-27),new THREE.Vector3(3.0,0,-30),new THREE.Vector3(-3.1,0,-30)]
];
const coverPoints=[
  new THREE.Vector3(-3.8,0,-4.2),new THREE.Vector3(-1.2,0,-4.2),
  new THREE.Vector3(2.0,0,-10.8),new THREE.Vector3(4.2,0,-11.2),
  new THREE.Vector3(-3.8,0,-21.8),new THREE.Vector3(-1.6,0,-23.0),
  new THREE.Vector3(4.0,0,-18.5),new THREE.Vector3(4.0,0,-25.0)
];
function radio(text,enemy=null){
  const now=performance.now();
  if(now<AI.radioCooldown)return;
  AI.radioCooldown=now+1100;
  const prefix=enemy?`VOLK ${enemy.userData.id}`:'VOLK';
  toast(`${prefix}: ${text}`);speakRadio(text);
}
function emitSound(position,radius,type='generic'){
  AI.soundEvents.push({position:position.clone(),radius,type,time:performance.now()});
  if(AI.soundEvents.length>12)AI.soundEvents.shift();
}
function createEnemy(x,z,heavy=false,personality='cautious',routeIndex=0){
  const g=new THREE.Group();
  g.position.set(x,0,z);
  g.userData={
    id:AI.nextId++,health:heavy?170:100,dead:false,phase:Math.random()*6,heavy,
    personality,state:'patrol',route:patrolRoutes[routeIndex%patrolRoutes.length],routeIndex:0,
    target:null,lastSeen:new THREE.Vector3(x,0,z),lastHeard:new THREE.Vector3(x,0,z),
    suspicion:0,stateTime:0,fireCooldown:Math.random()*.6,burstLeft:0,burstGap:0,
    searchAngle:Math.random()*Math.PI*2,cover:null,flankSide:Math.random()<.5?-1:1,
    callTimer:0,hasCalled:false,home:new THREE.Vector3(x,0,z),speed:heavy?.72:.95
  };
  const black=new THREE.MeshStandardMaterial({color:heavy?0x111514:0x171b19,roughness:.72,metalness:.22});
  const armor=new THREE.MeshStandardMaterial({color:0x090b0a,roughness:.48,metalness:.42});
  const skin=new THREE.MeshStandardMaterial({color:0x7b5542,roughness:.8});
  const legs=new THREE.Mesh(new THREE.BoxGeometry(.55,.95,.32),black);legs.position.y=.52;g.add(legs);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(heavy?.82:.68,.82,.38),black);torso.position.y=1.37;g.add(torso);
  const vest=new THREE.Mesh(new THREE.BoxGeometry(heavy?.86:.72,.57,.14),armor);vest.position.set(0,1.39,-.25);g.add(vest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),skin);head.position.y=1.98;g.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.25,16,10,0,Math.PI*2,0,Math.PI*.62),armor);helmet.position.y=2.04;g.add(helmet);
  const mask=new THREE.Mesh(new THREE.BoxGeometry(.31,.17,.09),armor);mask.position.set(0,1.92,-.20);g.add(mask);
  const rifleMesh=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.9),gunDark);rifleMesh.position.set(.20,1.35,-.46);rifleMesh.rotation.z=-.15;g.add(rifleMesh);
  const statusLamp=new THREE.PointLight(0xff3000,0,.7,2);statusLamp.position.set(.2,1.4,-.8);g.add(statusLamp);g.userData.muzzle=statusLamp;
  [legs,torso,vest,head,helmet,mask,rifleMesh].forEach(o=>o.userData.fallbackVisual=true);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.enemy=g}});
  scene.add(g); enemies.push(g);
  if(modelTemplates.soldier)installSoldierModel(g);else pendingEnemyModels.push(g);
  return g;
}
createEnemy(-2.5,-8,false,'cautious',0);
createEnemy(2.9,-18,false,'aggressive',1);
createEnemy(-1.2,-27,true,'defensive',2);

const keys={}; let started=false,powerOn=false,flashOn=true,aiming=false,reloading=false,reloadStart=0,reloadDuration=0,reloadEmpty=false,ammo=30,reserve=120,pistolAmmo=15,pistolReserve=60,hp=100,armor=50,kills=0,lastShot=0,flashUntil=0,missionComplete=false,fireHeld=false,recoilKick=0,stepTimer=0;
const raycaster=new THREE.Raycaster(); const clock=new THREE.Clock();
const prompt=document.getElementById('prompt'), msg=document.getElementById('message');
function toast(t){msg.textContent=t;msg.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>msg.style.opacity=0,1700)}
function updateHud(){document.getElementById('hp').textContent=Math.max(0,Math.round(hp));document.getElementById('armor').textContent=Math.max(0,Math.round(armor));document.getElementById('weaponName').textContent=currentWeapon==='rifle'?'HK416':'M9A4';document.getElementById('ammo').textContent=currentWeapon==='rifle'?`${ammo}/${reserve}`:`${pistolAmmo}/${pistolReserve}`;document.getElementById('secure').textContent=`${kills}/${AI.totalHostiles}`;document.getElementById('lightState').textContent=flashOn?'ON':'OFF';document.getElementById('powerState').textContent=powerOn?'ONLINE':'OFFLINE'}
function togglePower(){if(powerOn)return;resumeAudio();playSound('power');powerOn=true;mainLights.forEach((l,i)=>setTimeout(()=>l.intensity=18,120*i));emergency.intensity=1;indicator.material.color.set(0x2dff81);indicator.material.emissive.set(0x00ff55);lever.rotation.z=-.65;document.getElementById('objective').textContent='OBJECTIVE: ELIMINATE VOLK TEAM';emitSound(controls.object.position,18,'power');toast('FACILITY POWER RESTORED');updateHud()}
function interact(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObject(switchGroup,true)[0];if(hit&&hit.distance<2.6)togglePower()}
function shoot(){
  const now=performance.now(); const delay=currentWeapon==='rifle'?92:230;
  if(!started||reloading||now-lastShot<delay)return;
  const activeAmmo=currentWeapon==='rifle'?ammo:pistolAmmo;
  if(activeAmmo<=0){playSound('dry');reload();return}
  resumeAudio();lastShot=now;if(currentWeapon==='rifle')ammo--;else pistolAmmo--;
  playSound(currentWeapon==='rifle'?'rifle':'pistol');emitSound(controls.object.position,currentWeapon==='rifle'?24:17,'gunshot');AI.alertLevel=Math.max(AI.alertLevel,1);
  recoilKick=Math.min(.16,recoilKick+(currentWeapon==='rifle'?.055:.085));camera.rotation.x+=currentWeapon==='rifle'?.009:.014;
  muzzleFlash.visible=true;muzzleLight.intensity=currentWeapon==='rifle'?11:8;flashUntil=now+58;placeMuzzle();ejectCasing();spawnSmoke();
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const allTargets=[...enemies,...collisionMeshes];const hits=raycaster.intersectObjects(allTargets,true);
  if(hits.length){const hit=hits[0],obj=hit.object,enemy=obj.userData.enemy;
    if(enemy&&!enemy.userData.dead){enemy.userData.state='combat';enemy.userData.lastSeen.copy(controls.object.position);enemy.userData.suspicion=1;const localHitY=hit.point.y-enemy.position.y;const headshot=localHitY>1.68;enemy.userData.health-=headshot?(currentWeapon==='rifle'?72:55):(currentWeapon==='rifle'?35:28);spawnImpact(hit);playSound('impactConcrete');
      if(enemy.userData.health<=0){enemy.userData.dead=true;kills++;enemy.rotation.z=Math.PI/2;enemy.position.y=.30;enemy.traverse(o=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(m?.color)m.color.multiplyScalar(.32);if(m)m.needsUpdate=true})}});radio(Math.random()<.5?'MAN DOWN!':'OPERATOR DOWN!');toast('HOSTILE NEUTRALIZED');if(kills===AI.totalHostiles&&AI.reinforcementsArrived){document.getElementById('objective').textContent='OBJECTIVE: REACH EXTRACTION';toast('AREA SECURE — EXTRACT')}}
    }else{spawnImpact(hit);playSound(hit.object.material?.metalness>.45?'impactMetal':'impactConcrete')}
  }
  updateHud();
}
function reload(){
  const cap=currentWeapon==='rifle'?30:15,cur=currentWeapon==='rifle'?ammo:pistolAmmo,res=currentWeapon==='rifle'?reserve:pistolReserve;
  if(reloading||cur===cap||res<=0)return;resumeAudio();reloading=true;reloadStart=performance.now();reloadEmpty=cur===0;reloadDuration=currentWeapon==='rifle'?(reloadEmpty?2050:1620):(reloadEmpty?1450:1120);toast(reloadEmpty?'EMPTY RELOAD':'TACTICAL RELOAD');
  playSound('magOut');setTimeout(()=>{if(reloading)playSound('magIn')},reloadDuration*.47);if(reloadEmpty)setTimeout(()=>{if(reloading)playSound('bolt')},reloadDuration*.76);
  const weaponAtStart=currentWeapon;
  setTimeout(()=>{if(currentWeapon!==weaponAtStart){reloading=false;return}const c=currentWeapon==='rifle'?ammo:pistolAmmo,r=currentWeapon==='rifle'?reserve:pistolReserve,take=Math.min(cap-c,r);if(currentWeapon==='rifle'){ammo+=take;reserve-=take}else{pistolAmmo+=take;pistolReserve-=take}reloading=false;reloadEmpty=false;updateHud()},reloadDuration);
}
function switchWeapon(type){if(reloading||type===currentWeapon)return;currentWeapon=type;rifle.visible=type==='rifle';pistol.visible=type==='pistol';placeMuzzle();playSound('bolt');toast(type==='rifle'?'HK416 READY':'M9A4 READY');updateHud()}
function damagePlayer(amount){let left=amount;if(armor>0){const absorb=Math.min(armor,left*.65);armor-=absorb;left-=absorb}hp-=left;document.getElementById('damage').style.opacity=.7;setTimeout(()=>document.getElementById('damage').style.opacity=0,120);if(hp<=0){hp=0;toast('MISSION FAILED');setTimeout(()=>location.reload(),1800)}updateHud()}

addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){flashOn=!flashOn;flashlight.visible=flashOn;updateHud()}if(e.code==='KeyR')reload();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol')});addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{resumeAudio();if(e.button===0){fireHeld=true;shoot()}if(e.button===2)aiming=true});addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2)aiming=false});addEventListener('blur',()=>{aiming=false;fireHeld=false});addEventListener('contextmenu',e=>e.preventDefault());
document.getElementById('startButton').onclick=()=>{resumeAudio();started=true;document.getElementById('startPanel').style.display='none';if(matchMedia('(pointer:fine)').matches)controls.lock();};
renderer.domElement.addEventListener('click',()=>{if(started&&matchMedia('(pointer:fine)').matches&&!controls.isLocked)controls.lock()});

// Mobile controls
let moveVec={x:0,y:0},lookVec={x:0,y:0};
function bindPad(id,target){const el=document.getElementById(id),stick=el.querySelector('.stick');let active=null,start={x:0,y:0};el.addEventListener('pointerdown',e=>{active=e.pointerId;start={x:e.clientX,y:e.clientY};el.setPointerCapture(active)});el.addEventListener('pointermove',e=>{if(e.pointerId!==active)return;let dx=e.clientX-start.x,dy=e.clientY-start.y;const len=Math.hypot(dx,dy),max=38;if(len>max){dx*=max/len;dy*=max/len}stick.style.transform=`translate(${dx}px,${dy}px)`;target.x=dx/max;target.y=dy/max});const end=e=>{if(e.pointerId!==active)return;active=null;target.x=target.y=0;stick.style.transform=''};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}
bindPad('movePad',moveVec);bindPad('lookPad',lookVec);
document.querySelectorAll('#mobileControls button').forEach(b=>{const a=b.dataset.action;b.addEventListener('pointerdown',e=>{e.preventDefault();if(a==='fire'){fireHeld=true;shoot()}if(a==='use')interact();if(a==='reload')reload();if(a==='flashlight'){flashOn=!flashOn;flashlight.visible=flashOn;updateHud()}if(a==='swap')switchWeapon(currentWeapon==='rifle'?'pistol':'rifle');if(a==='aim')aiming=true});const release=()=>{if(a==='aim')aiming=false;if(a==='fire')fireHeld=false};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release)});

function canMove(next){const p=new THREE.Vector3(next.x,1,next.z);if(Math.abs(p.x)>8.45||p.z>8.3||p.z<-32.4)return false;for(const m of collisionMeshes){if(['floor','ceiling','beam','pipeL','light fixture'].includes(m.name))continue;const b=new THREE.Box3().setFromObject(m).expandByScalar(.30);if(b.containsPoint(p))return false}return true}
function updateMovement(dt){
  const forwardInput=(keys.KeyW?1:0)-(keys.KeyS?1:0)-moveVec.y;
  const strafeInput=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveVec.x;

  // Derive movement from the camera's actual world-facing direction. This remains correct
  // after any amount of mouse turning and avoids inverted WASD caused by reading Euler Y.
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;
  if(forward.lengthSq()<.0001)forward.set(0,0,-1);else forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const v=forward.multiplyScalar(forwardInput).add(right.multiplyScalar(strafeInput));
  const moving=v.lengthSq()>.02;if(v.lengthSq()>1)v.normalize();
  const sprinting=keys.ShiftLeft&&moving&&!aiming;controls.object.userData.sprinting=sprinting;controls.object.userData.moving=moving;
  const speed=(sprinting?6.2:3.7)*dt;const next=controls.object.position.clone().addScaledVector(v,speed);if(canMove(next))controls.object.position.copy(next);
  if(moving){stepTimer-=dt;if(stepTimer<=0){playSound('step');stepTimer=sprinting?.28:.43}}else stepTimer=0;
  if(Math.abs(lookVec.x)+Math.abs(lookVec.y)>.01){controls.object.rotation.y-=lookVec.x*dt*2.2;camera.rotation.x=Math.max(-1.3,Math.min(1.3,camera.rotation.x-lookVec.y*dt*1.8))}
}
function hasLineOfSight(from,to){
  const direction=to.clone().sub(from);const distance=direction.length();
  if(distance<.01)return true;direction.normalize();
  raycaster.set(from,direction);raycaster.far=distance;
  const hit=raycaster.intersectObjects(collisionMeshes,true)[0];
  raycaster.far=Infinity;return !hit||hit.distance>distance-.25;
}
function setEnemyState(e,state,target=null){
  if(e.userData.state===state&&(!target||e.userData.target?.distanceToSquared(target)<.05))return;
  e.userData.state=state;e.userData.stateTime=0;e.userData.target=target?target.clone():null;
  if(state==='combat')AI.alertLevel=2;
}
function moveEnemyToward(e,target,dt,mult=1){
  if(!target)return false;const delta=target.clone().sub(e.position);delta.y=0;const dist=delta.length();
  if(dist<.22)return true;delta.normalize();
  const next=e.position.clone().addScaledVector(delta,e.userData.speed*mult*dt);
  if(canMove(next)){e.position.copy(next);return false}
  const side=new THREE.Vector3(-delta.z,0,delta.x).multiplyScalar(e.userData.flankSide*.8);
  const alternate=e.position.clone().addScaledVector(side,e.userData.speed*dt);
  if(canMove(alternate))e.position.copy(alternate);else e.userData.flankSide*=-1;
  return false;
}
function chooseCover(e,playerPos){
  let best=null,bestScore=Infinity;
  for(const c of coverPoints){const travel=e.position.distanceTo(c);if(travel>10)continue;
    const hidden=!hasLineOfSight(c.clone().add(new THREE.Vector3(0,1.25,0)),playerPos.clone().add(new THREE.Vector3(0,1.35,0)));
    const score=travel+(hidden?-4:3)+Math.abs(c.distanceTo(playerPos)-7)*.15;
    if(score<bestScore){bestScore=score;best=c}}
  return best?best.clone():null;
}
function chooseFlank(e,playerPos){
  const toPlayer=playerPos.clone().sub(e.position);toPlayer.y=0;toPlayer.normalize();
  const side=new THREE.Vector3(-toPlayer.z,0,toPlayer.x).multiplyScalar(e.userData.flankSide*(e.userData.heavy?2.2:3.6));
  const behind=playerPos.clone().addScaledVector(toPlayer,-3.2).add(side);behind.y=0;
  if(canMove(behind))return behind;
  e.userData.flankSide*=-1;return playerPos.clone().add(side.multiplyScalar(-1));
}
function spawnEnemyTracer(e,playerPos){
  const from=e.localToWorld(new THREE.Vector3(.18,1.38,-.72));const to=playerPos.clone().add(new THREE.Vector3((Math.random()-.5)*.35,1.35+(Math.random()-.5)*.25,(Math.random()-.5)*.35));
  const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);
  const tracer=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffaa55,transparent:true,opacity:.75}));scene.add(tracer);setTimeout(()=>scene.remove(tracer),55);
  e.userData.muzzle.intensity=5;setTimeout(()=>{if(e.userData.muzzle)e.userData.muzzle.intensity=0},45);
}
function enemyFire(e,playerPos,dist){
  if(e.userData.fireCooldown>0)return;
  if(e.userData.burstLeft<=0){e.userData.burstLeft=e.userData.heavy?4:2+Math.floor(Math.random()*2);e.userData.burstGap=e.userData.heavy?.11:.16}
  e.userData.fireCooldown=e.userData.burstGap;e.userData.burstLeft--;
  spawnEnemyTracer(e,playerPos);playSound('enemyShot');
  const base=e.userData.heavy?.55:.44;const movementPenalty=(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD)?.10:0;
  const chance=Math.max(.12,base-dist*.025-movementPenalty+(e.userData.personality==='aggressive'?.08:0));
  if(Math.random()<chance)damagePlayer(e.userData.heavy?10:7);
  if(e.userData.burstLeft===0)e.userData.fireCooldown=e.userData.heavy?.75:1.0+Math.random()*.5;
}
function alertNearby(source,position,radius=14){
  for(const other of enemies){if(other===source||other.userData.dead)continue;if(other.position.distanceTo(position)<radius){other.userData.lastHeard.copy(position);other.userData.suspicion=Math.max(other.userData.suspicion,.72);if(other.userData.state==='patrol')setEnemyState(other,'investigate',position)}}
}
function callReinforcements(e){
  if(AI.reinforcementsCalled||e.userData.dead)return;
  AI.reinforcementsCalled=true;e.userData.hasCalled=true;radio('CONTACT! REQUESTING BACKUP!',e);
  setTimeout(()=>{
    if(AI.reinforcementsArrived)return;
    AI.reinforcementsArrived=true;AI.totalHostiles+=2;
    createEnemy(6.7,-29,false,'aggressive',2);createEnemy(-6.7,-29,false,'cautious',2);
    radio('REINFORCEMENTS ENTERING SOUTH CORRIDOR');updateHud();
  },4200);
}
function updateEnemies(dt,t){
  const now=performance.now();const playerPos=controls.object.position.clone();
  AI.soundEvents=AI.soundEvents.filter(s=>now-s.time<2600);AI.radioCooldown=Math.max(0,AI.radioCooldown);
  for(const e of enemies){
    if(e.userData.dead)continue;const u=e.userData;u.stateTime+=dt;u.fireCooldown=Math.max(0,u.fireCooldown-dt);u.callTimer=Math.max(0,u.callTimer-dt);
    const eye=e.position.clone().add(new THREE.Vector3(0,1.65,0));const playerEye=playerPos.clone().add(new THREE.Vector3(0,.05,0));
    const toPlayer=playerPos.clone().sub(e.position);const dist=toPlayer.length();const forward=new THREE.Vector3(0,0,-1).applyQuaternion(e.quaternion);const planar=toPlayer.clone();planar.y=0;planar.normalize();
    const fov=u.state==='combat'?Math.cos(THREE.MathUtils.degToRad(82)):Math.cos(THREE.MathUtils.degToRad(55));
    const visible=dist<(powerOn?18:flashOn?12:7)&&forward.dot(planar)>fov&&hasLineOfSight(eye,playerEye);
    const flashlightSeen=flashOn&&dist<16&&hasLineOfSight(playerEye,eye)&&new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).dot(e.position.clone().sub(playerPos).normalize())>.94;
    let heard=null;for(const sound of AI.soundEvents){if(e.position.distanceTo(sound.position)<sound.radius){heard=sound;break}}
    if(visible||flashlightSeen){u.lastSeen.copy(playerPos);u.suspicion=Math.min(1,u.suspicion+dt*(flashlightSeen?1.8:2.8));AI.lastKnownPlayer.copy(playerPos);AI.globalAlertUntil=now+9000;if(u.suspicion>.35&&u.state!=='combat'){setEnemyState(e,'combat',playerPos);radio(flashlightSeen?'FLASHLIGHT! CONTACT!':'CONTACT FRONT!',e);alertNearby(e,playerPos,17)}}
    else u.suspicion=Math.max(0,u.suspicion-dt*.08);
    if(heard&&u.state!=='combat'){u.lastHeard.copy(heard.position);u.suspicion=Math.max(u.suspicion,heard.type==='gunshot'?.9:.55);setEnemyState(e,'investigate',heard.position);if(heard.type==='gunshot')radio('GUNSHOTS — INVESTIGATING',e)}
    if(u.state==='patrol'){
      const target=u.route[u.routeIndex%u.route.length];if(moveEnemyToward(e,target,dt,.55)){u.routeIndex=(u.routeIndex+1)%u.route.length;u.stateTime=0}
      if(u.stateTime>4&&Math.random()<dt*.3){u.routeIndex=(u.routeIndex+1)%u.route.length;u.stateTime=0}
    }else if(u.state==='investigate'){
      if(moveEnemyToward(e,u.target||u.lastHeard,dt,.72)){setEnemyState(e,'search',u.target||u.lastHeard);u.searchAngle=Math.random()*Math.PI*2}
      if(u.stateTime>8)setEnemyState(e,'patrol');
    }else if(u.state==='search'){
      e.rotation.y+=dt*.55*u.flankSide;
      if(u.stateTime>5){const offset=new THREE.Vector3(Math.cos(u.searchAngle)*2.3,0,Math.sin(u.searchAngle)*2.3);u.searchAngle+=2.1;setEnemyState(e,'investigate',u.lastSeen.clone().add(offset))}
    }else if(u.state==='combat'){
      if(!u.hasCalled&&!AI.reinforcementsCalled&&u.stateTime>2.5)callReinforcements(e);
      const hasShot=visible&&hasLineOfSight(eye,playerEye);
      if(!visible&&now>AI.globalAlertUntil){setEnemyState(e,'search',u.lastSeen);radio('LOST VISUAL — SEARCHING',e);continue}
      if(u.personality==='defensive'){
        if(!u.cover)u.cover=chooseCover(e,playerPos);
        if(u.cover&&!moveEnemyToward(e,u.cover,dt,.68)){/* moving to cover */}else if(hasShot)enemyFire(e,playerPos,dist);
      }else if(u.personality==='aggressive'){
        if(dist>5.2)moveEnemyToward(e,playerPos,dt,1.05);else if(dist<2.8)moveEnemyToward(e,e.position.clone().add(e.position.clone().sub(playerPos).normalize().multiplyScalar(2)),dt,.9);
        if(hasShot)enemyFire(e,playerPos,dist);
      }else{
        if(u.stateTime>3.5&&(!u.target||u.target.distanceTo(playerPos)<1)){u.target=chooseFlank(e,playerPos);u.stateTime=0}
        if(u.target&&e.position.distanceTo(u.target)>.5)moveEnemyToward(e,u.target,dt,.9);else if(hasShot)enemyFire(e,playerPos,dist);
      }
    }
    const faceTarget=(u.state==='combat'?playerPos:u.target)||u.route[u.routeIndex%u.route.length];if(faceTarget){const d=faceTarget.clone().sub(e.position);e.rotation.y=Math.atan2(d.x,d.z)+Math.PI}
    const bones=u.bones;if(bones){const walking=u.state!=='search'&&u.state!=='combat'?1:(u.target?1:.25);const swing=Math.sin(t*7+u.phase)*.24*walking;if(bones.rightThigh)bones.rightThigh.rotation.x=swing;if(bones.leftThigh)bones.leftThigh.rotation.x=-swing;}
    e.position.y=Math.sin(t*2+u.phase)*.015;
  }
  if(!AI.reinforcementsCalled&&kills===AI.totalHostiles){AI.reinforcementsArrived=true;document.getElementById('objective').textContent='OBJECTIVE: REACH EXTRACTION';toast('AREA SECURE — EXTRACT')}
}
loadLicensedModels().catch(err=>console.warn('Licensed model loading failed; fallbacks retained.',err));

function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(started){
    updateMovement(dt);updateEnemies(dt,t);updateCombatParticles(dt);
    if(fireHeld&&currentWeapon==='rifle'&&!reloading)shoot();
    recoilKick=Math.max(0,recoilKick-dt*.34);
    const sprinting=!!controls.object.userData.sprinting,moving=!!controls.object.userData.moving;
    const hip=currentWeapon==='rifle'?new THREE.Vector3(.38,-.34,-.72):new THREE.Vector3(.34,-.31,-.61);
    const ads=currentWeapon==='rifle'?new THREE.Vector3(0,-.22,-.52):new THREE.Vector3(0,-.205,-.47);
    const sprint=currentWeapon==='rifle'?new THREE.Vector3(.48,-.52,-.54):new THREE.Vector3(.45,-.48,-.52);
    const target=sprinting?sprint:(aiming?ads:hip);
    const bobAmp=moving?(sprinting?.018:.009):.002,bobRate=sprinting?10:7;
    const bobX=Math.sin(t*bobRate)*bobAmp,bobY=Math.abs(Math.cos(t*bobRate))*bobAmp*.7;
    const desired=target.clone();desired.x+=bobX;desired.y-=bobY;desired.z+=recoilKick;
    weaponRoot.position.lerp(desired,1-Math.pow(.001,dt));
    // Interpolate toward fixed orientation targets. The previous ternary expressions added
    // a constant rotation every frame while sprinting, which caused the weapon to spin.
    const targetRotX=sprinting?.42:0;
    const targetRotY=sprinting?.22:(aiming?0:-.08);
    const targetRotZ=sprinting?-.32:0;
    weaponRoot.rotation.x+=(targetRotX-weaponRoot.rotation.x)*(1-Math.exp(-8*dt));
    weaponRoot.rotation.y+=(targetRotY-weaponRoot.rotation.y)*(1-Math.exp(-8*dt));
    weaponRoot.rotation.z+=(targetRotZ-weaponRoot.rotation.z)*(1-Math.exp(-7*dt));
    if(reloading){const rp=Math.min(1,(performance.now()-reloadStart)/reloadDuration);const lower=Math.sin(Math.min(1,rp*1.8)*Math.PI*.5);weaponRoot.rotation.z+=Math.sin(rp*Math.PI)*.92;weaponRoot.rotation.x+=Math.sin(rp*Math.PI)*.50;weaponRoot.position.y-=lower*.18;if(reloadEmpty&&rp>.68&&rp<.86)weaponRoot.position.z+=Math.sin((rp-.68)/.18*Math.PI)*.09}
    if(performance.now()>flashUntil){muzzleFlash.visible=false;muzzleLight.intensity=0}else{muzzleFlash.rotation.z=Math.random()*Math.PI;muzzleFlash.scale.setScalar(.75+Math.random()*.5)}
    raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const h=raycaster.intersectObject(switchGroup,true)[0];prompt.textContent=h&&h.distance<2.6&&!powerOn?'PRESS E / USE — RESTORE POWER':'';
    if(!missionComplete&&kills===AI.totalHostiles&&controls.object.position.z<-29.5&&Math.abs(controls.object.position.x)<2.4){missionComplete=true;toast('MISSION COMPLETE');document.getElementById('objective').textContent='BLACKSITE SECURED';speakRadio('Target escaped. Blacksite compromised.');}
  }
  renderer.render(scene,camera)
}animate();updateHud();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
