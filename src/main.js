import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { buildSpecterOperator,createSpecterViewMaterials,poseSpecterOperator } from './specter-operator.js?v=5.0.0-release';
import { buildWorldOverhaul } from './world-overhaul.js?v=5.0.0-release';
import { EnemyAISystem } from './enemy-ai.js?v=5.0.0-release';
import { createGraphicsPipeline,GRAPHICS_QUALITY_PRESETS } from './graphics-pipeline.js?v=5.0.1-graphics';
import { createAudioDirector } from './audio-overhaul.js?v=5.1.1-tactical-voices';
import { createTacticalAnimator } from './tactical-animation.js?v=5.0.0-release';

const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.14;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x050a08);
scene.fog=new THREE.FogExp2(0x050a08,.012);

const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.035,900);
camera.position.set(0,1.72,7);
camera.rotation.order='YXZ';
scene.add(camera); // Critical: camera must be in scene.

const controls=new PointerLockControls(camera,renderer.domElement);
// Embedded app browsers are commonly hosted in a frame where requesting pointer
// lock produces a browser-level error before the fallback event can fire.
const embeddedDocument=(()=>{try{return window.top!==window}catch{return true}})();
const pointerLockSupported=!embeddedDocument&&typeof renderer.domElement.requestPointerLock==='function'&&'pointerLockElement' in document;
let embeddedMouseLook=!pointerLockSupported;

scene.add(new THREE.HemisphereLight(0x8ebda8,0x101512,.38));
const emergency=new THREE.PointLight(0xff2a13,7,18,2);
emergency.position.set(0,2.8,-16);
scene.add(emergency);

const loader=new GLTFLoader();
const assetMap=new Map();
const assetProgress={ar15:0,m9:0,soldier:0,environment:0,props:0,audio:0};
let requiredAssetFailure=false;
const environmentTextures={};
const weaponSamplePayloads={};
const enemyVoiceSamplePayloads={};
const footstepSamplePayloads={};
const startButton=document.getElementById('startButton'),startPanel=document.getElementById('startPanel'),promptEl=document.getElementById('prompt');
const graphicsButton=document.getElementById('graphicsButton'),graphicsQuickButton=document.getElementById('graphicsQuickButton');
const graphicsPanel=document.getElementById('graphicsPanel'),graphicsCloseButton=document.getElementById('graphicsCloseButton'),graphicsHint=document.getElementById('graphicsHint');
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
    gltf.scene.traverse(o=>{if(o.isMesh){count++;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=o.isSkinnedMesh?false:true}});
    assetMap.set(name,gltf);
    assetProgress[name]=1;updateLoading();
    status(name,'LOADED',`${count} meshes`);
  }catch(e){console.error(e);requiredAssetFailure=true;assetProgress[name]=1;updateLoading();status(name,'FAILED',e.message)}
}
async function loadEnvironmentAssets(){
  status('environment','LOADING');
  const textureLoader=new THREE.TextureLoader();
  const pbrRoot='./assets/environment/pbr-v2';
  const entries=[
    ['concreteAlbedo',`${pbrRoot}/concrete-albedo.webp`],['concreteNormal',`${pbrRoot}/concrete-normal.webp`],['concreteOrm',`${pbrRoot}/concrete-orm.webp`],
    ['paintedMetalAlbedo',`${pbrRoot}/painted-metal-albedo.webp`],['paintedMetalNormal',`${pbrRoot}/painted-metal-normal.webp`],['paintedMetalOrm',`${pbrRoot}/painted-metal-orm.webp`],
    ['diamondPlateAlbedo',`${pbrRoot}/diamond-plate-albedo.webp`],['diamondPlateNormal',`${pbrRoot}/diamond-plate-normal.webp`],['diamondPlateOrm',`${pbrRoot}/diamond-plate-orm.webp`],
    ['asphaltAlbedo',`${pbrRoot}/asphalt-albedo.webp`],['asphaltNormal',`${pbrRoot}/asphalt-normal.webp`],['asphaltOrm',`${pbrRoot}/asphalt-orm.webp`],
    ['utilityPanelAlbedo',`${pbrRoot}/utility-panel-albedo.webp`],['utilityPanelNormal',`${pbrRoot}/utility-panel-normal.webp`],['utilityPanelOrm',`${pbrRoot}/utility-panel-orm.webp`],
    ['vehiclePaintAlbedo',`${pbrRoot}/vehicle-paint-albedo.webp`],['vehiclePaintOrm',`${pbrRoot}/vehicle-paint-orm.webp`],
    ['vehicleRubberAlbedo',`${pbrRoot}/vehicle-rubber-albedo.webp`],['vehicleRubberNormal',`${pbrRoot}/vehicle-rubber-normal.webp`],['vehicleRubberOrm',`${pbrRoot}/vehicle-rubber-orm.webp`],
    ['grassSoilAlbedo',`${pbrRoot}/grass-soil-albedo.webp`],['grassSoilNormal',`${pbrRoot}/grass-soil-normal.webp`],['grassSoilOrm',`${pbrRoot}/grass-soil-orm.webp`]
  ];
  let completed=0;
  try{
    await Promise.all(entries.map(([name,url])=>new Promise((resolve,reject)=>textureLoader.load(url,texture=>{
      texture.colorSpace=name.endsWith('Albedo')?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());environmentTextures[name]=texture;
      completed++;assetProgress.environment=completed/entries.length;updateLoading();resolve();
    },undefined,reject))));
    status('environment','LOADED','8 PBR families · 23 maps');
  }catch(error){
    console.error(error);requiredAssetFailure=true;assetProgress.environment=1;updateLoading();status('environment','FAILED',error.message);
  }
}
async function loadAudioAssets(){
  status('audio','LOADING');
  const entries=[
    {kind:'weapon',id:'rifle',url:'./assets/audio/cc-by-3.0-tabasco/rifle-sks-01.wav'},
    {kind:'weapon',id:'pistol',url:'./assets/audio/cc-by-3.0-tabasco/pistol-cz-01.wav'},
    {kind:'voice',id:'contact:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_target_engaged.ogg'},
    {kind:'voice',id:'contact:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_target_engaged.ogg'},
    {kind:'voice',id:'investigate:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_look_out.ogg'},
    {kind:'voice',id:'investigate:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_look_out.ogg'},
    {kind:'voice',id:'backup:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_call_for_backup.ogg'},
    {kind:'voice',id:'backup:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_call_for_backup.ogg'},
    {kind:'voice',id:'flank:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_cover_me.ogg'},
    {kind:'voice',id:'flank:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_cover_me.ogg'},
    {kind:'voice',id:'retreat:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_get_down.ogg'},
    {kind:'voice',id:'retreat:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_get_down.ogg'},
    {kind:'voice',id:'suppress:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_suppressing_fire.ogg'},
    {kind:'voice',id:'suppress:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_supressing_fire.ogg'},
    {kind:'voice',id:'down:male',url:'./assets/audio/cc0-kenney-voiceover/Male-war_medic.ogg'},
    {kind:'voice',id:'down:female',url:'./assets/audio/cc0-kenney-voiceover/Female-war_medic.ogg'},
    ...Array.from({length:10},(_,index)=>({kind:'footstep',id:String(index).padStart(2,'0'),url:`./assets/audio/cc0-kenney-rpg-footsteps/footstep${String(index).padStart(2,'0')}.ogg`}))
  ];
  let completed=0;
  const results=await Promise.allSettled(entries.map(async({kind,id,url})=>{
      const response=await fetch(url);
      if(!response.ok)throw new Error(`${id} returned ${response.status}`);
      const target=kind==='weapon'?weaponSamplePayloads:kind==='voice'?enemyVoiceSamplePayloads:footstepSamplePayloads;
      target[id]=await response.arrayBuffer();
      completed++;assetProgress.audio=completed/entries.length;updateLoading();
  }));
  const failures=results.filter(result=>result.status==='rejected').length;
  assetProgress.audio=1;updateLoading();
  const reports=Object.keys(weaponSamplePayloads).length,voices=Object.keys(enemyVoiceSamplePayloads).length,footsteps=Object.keys(footstepSamplePayloads).length;
  if(reports||voices||footsteps)status('audio','LOADED',`${reports} reports + ${voices} CC0 voice lines + ${footsteps} footsteps${failures?` + ${failures} fallback`:''}`);
  else status('audio','LOADED','procedural fallback');
}
async function loadSetDressAsset(name,url){
  status('props','LOADING');
  try{
    const gltf=await new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
    let meshes=0;
    gltf.scene.traverse(object=>{if(object.isMesh){meshes++;object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true}});
    assetMap.set(name,gltf);assetProgress.props=1;updateLoading();
    status('props','LOADED',`${meshes} mesh CC0 industrial shelf`);
    return true;
  }catch(error){
    console.warn(`Optional set-dressing asset ${name} unavailable; procedural props remain active.`,error);
    assetProgress.props=1;updateLoading();status('props','LOADED','procedural prop fallback');
    return false;
  }
}
function cloneAsset(name,skinned=false){
  const gltf=assetMap.get(name);
  if(!gltf)return null;
  return skinned?cloneSkeleton(gltf.scene):gltf.scene.clone(true);
}
function visibleWorldBounds(root){
  root.updateWorldMatrix(true,true);const result=new THREE.Box3();let found=false;
  root.traverse(object=>{
    if(!object.isMesh||!effectivelyVisible(object,root))return;
    object.geometry.computeBoundingBox();if(!object.geometry.boundingBox)return;
    result.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));found=true;
  });
  return found?result:null;
}
function normalize(object,maxDimension,floorAlign=false){
  object.updateWorldMatrix(true,true);
  let box=visibleWorldBounds(object);if(!box)return;
  const size=box.getSize(new THREE.Vector3());
  object.scale.multiplyScalar(maxDimension/(Math.max(size.x,size.y,size.z)||1));
  object.updateWorldMatrix(true,true);
  box=visibleWorldBounds(object);if(!box)return;
  const center=box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  if(floorAlign){
    object.updateWorldMatrix(true,true);
    box=visibleWorldBounds(object);if(!box)return;
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

const qualityStorageKey='specter-graphics-quality';
const queryQuality=new URLSearchParams(location.search).get('quality');
let rememberedGraphicsQuality='';
try{rememberedGraphicsQuality=localStorage.getItem(qualityStorageKey)||''}catch{ /* Storage is optional in embedded previews. */ }
const requestedGraphicsQuality=Object.hasOwn(GRAPHICS_QUALITY_PRESETS,queryQuality)?queryQuality:(Object.hasOwn(GRAPHICS_QUALITY_PRESETS,rememberedGraphicsQuality)?rememberedGraphicsQuality:'high');
const graphics=await createGraphicsPipeline({renderer,scene,camera,quality:requestedGraphicsQuality,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio});
const graphicsDiagnostics=graphics.getDiagnostics();
status('graphics','LOADED',`${graphicsDiagnostics.preset.label} · ${graphicsDiagnostics.ambientOcclusionEnabled?'SSAO':'direct'}${graphicsDiagnostics.bloomEnabled?' + bloom':''}`);

function graphicsSummary(diagnostics=graphics.getDiagnostics()){
  const preset=diagnostics.preset;
  return `${preset.label.toUpperCase()} · ${diagnostics.ambientOcclusionEnabled?'SSAO':'DIRECT'}${diagnostics.bloomEnabled?' + BLOOM':''}`;
}
function renderGraphicsControls(diagnostics=graphics.getDiagnostics()){
  const summary=graphicsSummary(diagnostics);
  graphicsButton.textContent=`GRAPHICS: ${summary}`;
  graphicsHint.textContent=`${summary} · ${diagnostics.effectivePixelRatio.toFixed(2)}× RENDER SCALE`;
  graphicsQuickButton.textContent=`GFX · ${diagnostics.quality.toUpperCase()}`;
  document.querySelectorAll('[data-quality]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.quality===diagnostics.quality)));
  status('graphics','LOADED',summary);
}
function setGraphicsQuality(quality,{persist=true}={}){
  if(!Object.hasOwn(GRAPHICS_QUALITY_PRESETS,quality))return;
  const diagnostics=graphics.setQuality(quality);
  if(persist){try{localStorage.setItem(qualityStorageKey,quality)}catch{ /* Embedded previews can reject persistent storage. */ }}
  renderGraphicsControls(diagnostics);
  toast(`GRAPHICS · ${diagnostics.preset.label.toUpperCase()}`);
}
function toggleGraphicsPanel(force){
  const open=force??!graphicsPanel.classList.contains('active');
  graphicsPanel.classList.toggle('active',open);graphicsPanel.setAttribute('aria-hidden',String(!open));graphicsQuickButton.setAttribute('aria-expanded',String(open));
  if(open){fireHeld=false;setAim(false)}
}
graphicsButton.onclick=()=>toggleGraphicsPanel(true);
graphicsQuickButton.onclick=()=>toggleGraphicsPanel();
graphicsCloseButton.onclick=()=>toggleGraphicsPanel(false);
document.querySelectorAll('[data-quality]').forEach(button=>button.onclick=()=>setGraphicsQuality(button.dataset.quality));
renderGraphicsControls(graphicsDiagnostics);

function tiledTexture(source,x,y,color=true){
  if(!source)return null;const texture=source.clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(x,y);texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.needsUpdate=true;return texture;
}
function pbrTextureSet(prefix,x,y){
  const map=tiledTexture(environmentTextures[`${prefix}Albedo`],x,y,true),normalMap=tiledTexture(environmentTextures[`${prefix}Normal`],x,y,false),orm=tiledTexture(environmentTextures[`${prefix}Orm`],x,y,false);
  return {map,normalMap,roughnessMap:orm,metalnessMap:orm};
}

const worldMat=new THREE.MeshStandardMaterial({color:0xffffff,...pbrTextureSet('concrete',7,20),normalScale:new THREE.Vector2(.55,.55),roughness:1,metalness:1});
const floorMat=new THREE.MeshStandardMaterial({color:0xffffff,...pbrTextureSet('diamondPlate',9,27),normalScale:new THREE.Vector2(.8,.8),roughness:1,metalness:1});
const metalMat=new THREE.MeshStandardMaterial({color:0xffffff,...pbrTextureSet('utilityPanel',4,12),normalScale:new THREE.Vector2(.8,.8),roughness:1,metalness:1});
const trimMat=new THREE.MeshStandardMaterial({color:0x111817,roughness:.38,metalness:.82});
const crateMat=new THREE.MeshStandardMaterial({color:0x647068,...pbrTextureSet('paintedMetal',2,2),normalScale:new THREE.Vector2(.25,.25),roughness:1,metalness:1});
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
box('floor',0,-.15,-18,18,.3,54,floorMat,false);
box('ceiling',0,4.1,-18,18,.25,54,metalMat,false);
box('left-wall',-9,2,-18,.35,4.2,54);
box('right-wall',9,2,-18,.35,4.2,54);
box('rear-wall',0,2,9,18,4.2,.35);
box('exit-wall-left',-5.6,2,-45,6.8,4.2,.35);
box('exit-wall-right',5.6,2,-45,6.8,4.2,.35);
box('exit-wall-header',0,3.72,-45,4.4,.75,.35);
box('partition-a',-4.8,2,-9,.35,4,12);
box('partition-b',4.8,2,-19,.35,4,14);
box('crate-a',-2.4,.7,-3.5,2.2,1.4,1.6,crateMat);
box('crate-b',3.2,.6,-11,2.4,1.2,1.7,crateMat);
box('crate-c',-2.7,.9,-22,1.8,1.8,1.8,crateMat);

// Architectural trim, service channels, pipes, and access doors give the corridor a believable scale.
box('left-base-trim',-8.76,.18,-18,.18,.36,53.4,trimMat,false);
box('right-base-trim',8.76,.18,-18,.18,.36,53.4,trimMat,false);
box('floor-service-runner',0,.012,-18,1.35,.025,52.5,metalMat,false);
for(let z=6;z>=-42;z-=6){
  box('left-column',-8.62,2,z,.42,4,.55,trimMat,false);
  box('right-column',8.62,2,z,.42,4,.55,trimMat,false);
  box('ceiling-crossmember',0,3.86,z,17.2,.18,.3,trimMat,false);
}
const pipeRed=new THREE.MeshStandardMaterial({color:0x5e211c,roughness:.55,metalness:.62});
cylinder('utility-pipe-a',-7.8,3.48,-18,.065,51,pipeRed,Math.PI/2);
cylinder('utility-pipe-b',-7.48,3.48,-18,.055,51,trimMat,Math.PI/2);
cylinder('utility-pipe-c',7.72,3.54,-18,.075,51,trimMat,Math.PI/2);
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
for(let z=5;z>-43;z-=6){
  box('fixture-housing',0,3.83,z,3.4,.14,.46,trimMat,false);
  const lensMat=new THREE.MeshStandardMaterial({color:0xc9e5dc,emissive:0xa7e8d1,emissiveIntensity:.18,roughness:.25});
  box('fixture-lens',0,3.74,z,2.9,.035,.24,lensMat,false);
  const l=new THREE.PointLight(0xd7fff0,0,13,2);l.position.set(0,3.5,z);scene.add(l);facilityLights.push(l);
}

const worldOverhaul=buildWorldOverhaul({scene,collision,environmentTextures,facilityLights});
const dynamicColliders=new Set([worldOverhaul.exit.left,worldOverhaul.exit.right]);
const staticColliderBounds=collision.filter(object=>!dynamicColliders.has(object)).map(object=>new THREE.Box3().setFromObject(object).expandByScalar(.3));
const dynamicColliderBounds=[new THREE.Box3(),new THREE.Box3()];
function installIndustrialShelving(){
  const source=assetMap.get('steelShelves')?.scene;if(!source)return;
  const placements=[
    {x:-7.52,z:-5.7,rotation:Math.PI/2},
    {x:7.52,z:-17.7,rotation:-Math.PI/2},
    {x:-7.52,z:-29.7,rotation:Math.PI/2}
  ];
  for(const [index,placement] of placements.entries()){
    const shelfRoot=new THREE.Group();shelfRoot.name=`cc0-industrial-shelf-${index+1}`;
    shelfRoot.position.set(placement.x,0,placement.z);shelfRoot.rotation.y=placement.rotation;
    const shelf=source.clone(true);normalize(shelf,2.1,true);shelf.name=`steel-frame-shelves-01-${index+1}`;
    shelf.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true}});
    shelfRoot.add(shelf);scene.add(shelfRoot);collision.push(shelfRoot);
    shelfRoot.updateWorldMatrix(true,true);staticColliderBounds.push(new THREE.Box3().setFromObject(shelfRoot).expandByScalar(.12));
  }
}
const switchGroup=worldOverhaul.breaker.group;
const audio=createAudioDirector({seed:0x5ec7e2,powerOn:false,masterVolume:.78,musicVolume:.28,sfxVolume:.88,ambienceVolume:.5});
let recordedAudioDecodePromise=null;

const flashlight=new THREE.SpotLight(0xf0fff7,74,30,Math.PI/6,.48,1.2);
flashlight.position.set(0,0,0);flashlight.target.position.set(0,-.03,-8);
camera.add(flashlight,flashlight.target);
const weaponFill=new THREE.PointLight(0xd8eee4,4.8,3.2,2);weaponFill.position.set(.28,.12,.12);camera.add(weaponFill);

const weaponRoot=new THREE.Group();camera.add(weaponRoot);
const rifleHolder=new THREE.Group(),pistolHolder=new THREE.Group(),compactHolder=new THREE.Group(),marksmanHolder=new THREE.Group(),suppressedHolder=new THREE.Group();
const weaponHolders={rifle:rifleHolder,pistol:pistolHolder,compact:compactHolder,marksman:marksmanHolder,suppressed:suppressedHolder};
weaponRoot.add(...Object.values(weaponHolders));
for(const [kind,holder] of Object.entries(weaponHolders))holder.visible=kind==='rifle';
const playerArmsRoot=new THREE.Group();weaponRoot.add(playerArmsRoot);
const scopeRenderTarget=new THREE.WebGLRenderTarget(768,768,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});scopeRenderTarget.texture.colorSpace=THREE.SRGBColorSpace;
const scopeCamera=new THREE.PerspectiveCamera(20,1,.05,900);
// A single camera-fixed live optic surface fills the reticle aperture.  Scaling it
// from the active camera FOV keeps every rifle optic the same usable screen size.
const scopeSurface=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshBasicMaterial({map:scopeRenderTarget.texture,depthTest:false,depthWrite:false,toneMapped:false}));
scopeSurface.name='live-scope-picture';scopeSurface.position.set(0,0,-.34);scopeSurface.renderOrder=10000;scopeSurface.visible=false;camera.add(scopeSurface);
let playerArms=null;
let playerOperator=null;
const playerBodyForward=new THREE.Vector3();

const weaponRig={
  rifle:{holder:rifleHolder,muzzle:null,eject:null,lightMount:null,hip:new THREE.Vector3(.25,-.235,-.47),ads:new THREE.Vector3(0,-.245,-.235)},
  pistol:{holder:pistolHolder,muzzle:null,eject:null,lightMount:null,hip:new THREE.Vector3(.30,-.29,-.65),ads:new THREE.Vector3(.1,-.19,-.66)},
  compact:{holder:compactHolder,muzzle:null,eject:null,lightMount:null,hip:new THREE.Vector3(.22,-.235,-.47),ads:new THREE.Vector3(0,-.205,-.255)},
  marksman:{holder:marksmanHolder,muzzle:null,eject:null,lightMount:null,hip:new THREE.Vector3(.245,-.255,-.5),ads:new THREE.Vector3(0,-.222,-.275)},
  suppressed:{holder:suppressedHolder,muzzle:null,eject:null,lightMount:null,hip:new THREE.Vector3(.24,-.245,-.49),ads:new THREE.Vector3(0,-.215,-.27)}
};
const weaponProfiles={
  rifle:{uiName:'HK416',family:'rifle',capacity:30,startReserve:120,fireModes:['semi','auto'],defaultMode:'auto',rpm:652,damage:38,adsFov:31,trueScope:true,reloadSeconds:1.45,recoil:.05,recoilPitch:.055,sprint:new THREE.Vector3(.40,-.43,-.39)},
  pistol:{uiName:'M9A4',family:'pistol',capacity:15,startReserve:60,fireModes:['semi'],defaultMode:'semi',rpm:261,damage:28,adsFov:52,trueScope:false,reloadSeconds:1.05,recoil:.08,recoilPitch:.12,sprint:new THREE.Vector3(.36,-.38,-.36)},
  compact:{uiName:'C5-K',family:'rifle',capacity:30,startReserve:150,fireModes:['semi','auto'],defaultMode:'auto',rpm:780,damage:34,adsFov:40,trueScope:true,reloadSeconds:1.82,recoil:.047,recoilPitch:.052,sprint:new THREE.Vector3(.39,-.42,-.38)},
  marksman:{uiName:'R7.62',family:'rifle',capacity:20,startReserve:80,fireModes:['semi'],defaultMode:'semi',rpm:420,damage:68,adsFov:24,trueScope:true,reloadSeconds:2.24,recoil:.086,recoilPitch:.092,sprint:new THREE.Vector3(.43,-.45,-.36)},
  suppressed:{uiName:'MCR-300',family:'rifle',capacity:30,startReserve:120,fireModes:['semi','auto'],defaultMode:'semi',rpm:700,damage:45,adsFov:40,trueScope:true,suppressed:true,reloadSeconds:1.9,recoil:.055,recoilPitch:.06,sprint:new THREE.Vector3(.41,-.44,-.38)}
};
const weaponModes=Object.fromEntries(Object.entries(weaponProfiles).map(([kind,profile])=>[kind,profile.defaultMode]));
let pistolSlide=null,pistolSlideTime=-1,pistolSlideLocked=false;
const pistolSlideBase=new THREE.Vector3(),pistolSlideTravel=new THREE.Vector3();
const arRearApertureSource=new THREE.Vector3(.08608143,.38814822,-.02164795);
const m9RearSightSource=new THREE.Vector3(-.196750448,.211048509,-.096209845);

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
function sourcePointInSpace(model,sourcePoint,space){
  model.updateWorldMatrix(true,true);space.updateWorldMatrix(true,false);
  return space.worldToLocal(model.localToWorld(sourcePoint.clone()));
}
function faceWeaponForward(model,holder,frontName,rearName){
  const front=model.getObjectByName(frontName),rear=model.getObjectByName(rearName);
  if(!front||!rear)return;
  const frontBox=boundsInSpace(front,holder),rearBox=boundsInSpace(rear,holder);
  if(frontBox&&rearBox&&frontBox.getCenter(new THREE.Vector3()).z>rearBox.getCenter(new THREE.Vector3()).z){
    model.rotation.y+=Math.PI;model.updateWorldMatrix(true,true);
  }
}

let currentWeapon='rifle',fireMode=weaponModes.rifle;
const ammo=Object.fromEntries(Object.entries(weaponProfiles).map(([kind,profile])=>[kind,profile.capacity]));
const reserve=Object.fromEntries(Object.entries(weaponProfiles).map(([kind,profile])=>[kind,profile.startReserve]));
let reloading=false,lastShot=0,recoil=0,recoilPitch=0,aiming=false,aimBlend=0,sprinting=false,moving=false,fireHeld=false;
let swayX=0,swayY=0;
let reloadAnimationTime=0,reloadAnimationDuration=1,equipAnimationTime=0;

function installRifle(){
  const model=cloneAsset('ar15');if(!model)return;
  hideByName(model,['ground','stand','plane001','plane002','plane003','bullets','mag byulle','mag001','mag002','scope001','sight001','handle001','stock001']);
  model.rotation.set(0,-Math.PI/2,0);
  normalize(model,1.38);
  model.position.add(new THREE.Vector3(0,.005,-.18));
  rifleHolder.add(model);
  weaponRig.rifle.visuals=[model];
  faceWeaponForward(model,rifleHolder,'Handguard','Stock');
  const modelBox=boundsInSpace(model,rifleHolder);
  const handguardBox=boundsInSpace(model.getObjectByName('Handguard')||model,rifleHolder);
  const receiverBox=boundsInSpace(model.getObjectByName('Dust cover')||model.getObjectByName('upper receiver part')||model,rifleHolder);
  const aperture=sourcePointInSpace(model,arRearApertureSource,rifleHolder);
  weaponRig.rifle.ads.set(-aperture.x,-aperture.y,scopeSurface.position.z-aperture.z);
  if(modelBox&&handguardBox){
    const center=handguardBox.getCenter(new THREE.Vector3());center.z=modelBox.min.z-.012;
    weaponRig.rifle.muzzle=addAnchor(rifleHolder,center,'rifle-muzzle');
    const lightPosition=center.clone();lightPosition.y-=.07;lightPosition.z+=.2;weaponRig.rifle.lightMount=addAnchor(rifleHolder,lightPosition,'rifle-underbarrel-light');
  }
  if(receiverBox){
    const center=receiverBox.getCenter(new THREE.Vector3());center.x=receiverBox.max.x+.018;center.y+=.012;
    weaponRig.rifle.eject=addAnchor(rifleHolder,center,'rifle-ejection-port');
  }
  const stockBox=boundsInSpace(model.getObjectByName('Stock')||model.getObjectByName('stock')||model,rifleHolder);
  if(stockBox){const stockSeat=new THREE.Vector3((stockBox.min.x+stockBox.max.x)*.5,(stockBox.min.y+stockBox.max.y)*.5,stockBox.max.z);weaponRig.rifle.hip.copy(new THREE.Vector3(.2,-.25,-.07).sub(stockSeat))}
}
function installPistol(){
  const model=cloneAsset('m9');if(!model)return;
  // Keep only tan/gold version and hide black duplicate.
  model.traverse(o=>{
    const text=`${o.name} ${o.material?.name||''}`.toLowerCase();
    if(text.includes('black'))o.visible=false;
  });
  model.rotation.set(0,Math.PI/2,0);
  normalize(model,.52);
  model.position.add(new THREE.Vector3(0,-.01,-.10));
  pistolHolder.add(model);
  weaponRig.pistol.visuals=[model];
  const barrel=model.getObjectByName('Barrel_lp.001');
  pistolSlide=model.getObjectByName('Shutter_lp.001');
  const barrelBox=boundsInSpace(barrel||model,pistolHolder);
  const slideBox=boundsInSpace(pistolSlide||model,pistolHolder);
  const rearSight=sourcePointInSpace(model,m9RearSightSource,pistolHolder);weaponRig.pistol.ads.set(-rearSight.x,-rearSight.y,-.66);
  if(barrelBox){
    const center=barrelBox.getCenter(new THREE.Vector3());center.z=barrelBox.min.z-.008;
    weaponRig.pistol.muzzle=addAnchor(pistolHolder,center,'pistol-muzzle');
    const lightPosition=center.clone();lightPosition.y-=.055;lightPosition.z+=.12;weaponRig.pistol.lightMount=addAnchor(pistolHolder,lightPosition,'pistol-underbarrel-light');
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
function installRifleVariants(){
  const variants={
    compact:{length:1.28,lengthScale:.88,tint:0xd4d8d2,suppressed:false},
    marksman:{length:1.48,lengthScale:1.1,tint:0xc8baa4,suppressed:false},
    suppressed:{length:1.36,lengthScale:.98,tint:0xc6ccc8,suppressed:true}
  };
  let visibleMeshes=0,visibleTriangles=0;
  for(const [kind,variant] of Object.entries(variants)){
    const model=cloneAsset('ar15'),holder=weaponHolders[kind],rig=weaponRig[kind];
    if(!model){status('arsenal','FAILED','bundled rifle source unavailable');return}
    hideByName(model,['ground','stand','plane001','plane002','plane003','bullets','mag byulle','mag001','mag002','scope001','sight001','handle001','stock001']);
    model.rotation.set(0,-Math.PI/2,0);normalize(model,variant.length);model.scale.x*=variant.lengthScale;model.position.add(new THREE.Vector3(0,.005,-.18));model.name=`${kind}-high-resolution-rifle`;
    model.traverse(object=>{
      if(!object.isMesh)return;visibleMeshes++;
      const geometry=object.geometry,triangles=geometry?.index?geometry.index.count/3:(geometry?.attributes?.position?.count||0)/3;visibleTriangles+=triangles;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      const clones=materials.map(material=>{const clone=material?.clone?.()||material;if(clone?.color)clone.color.multiply(new THREE.Color(variant.tint));return clone});object.material=Array.isArray(object.material)?clones:clones[0];
    });
    holder.add(model);rig.visuals=[model];faceWeaponForward(model,holder,'Handguard','Stock');
    const modelBox=boundsInSpace(model,holder),handguardBox=boundsInSpace(model.getObjectByName('Handguard')||model,holder),receiverBox=boundsInSpace(model.getObjectByName('Dust cover')||model.getObjectByName('upper receiver part')||model,holder),aperture=sourcePointInSpace(model,arRearApertureSource,holder);
    rig.ads.set(-aperture.x,-aperture.y,scopeSurface.position.z-aperture.z);
    if(modelBox&&handguardBox){
      const barrelEnd=handguardBox.getCenter(new THREE.Vector3());barrelEnd.z=modelBox.min.z-.012;
      const muzzlePosition=barrelEnd.clone();
      if(variant.suppressed){
        const suppressorMaterial=new THREE.MeshStandardMaterial({color:0x202523,roughness:.42,metalness:.88});
        const suppressor=new THREE.Mesh(new THREE.CylinderGeometry(.043,.048,.25,32,1,false),suppressorMaterial);suppressor.name='mcr-300-suppressor';suppressor.rotation.x=Math.PI/2;suppressor.position.copy(barrelEnd);suppressor.position.z-=.125;suppressor.castShadow=true;holder.add(suppressor);rig.visuals.push(suppressor);muzzlePosition.z-=.255;
        const endCap=new THREE.Mesh(new THREE.TorusGeometry(.032,.006,10,28),suppressorMaterial);endCap.name='suppressor-end-cap';endCap.position.copy(muzzlePosition);endCap.rotation.x=Math.PI/2;holder.add(endCap);rig.visuals.push(endCap);
      }
      rig.muzzle=addAnchor(holder,muzzlePosition,`${kind}-muzzle`);
      const lightPosition=barrelEnd.clone();lightPosition.y-=.07;lightPosition.z+=.2;rig.lightMount=addAnchor(holder,lightPosition,`${kind}-underbarrel-light`);
    }
    if(receiverBox){const center=receiverBox.getCenter(new THREE.Vector3());center.x=receiverBox.max.x+.018;center.y+=.012;rig.eject=addAnchor(holder,center,`${kind}-ejection-port`)}
    const stockBox=boundsInSpace(model.getObjectByName('Stock')||model.getObjectByName('stock')||model,holder);
    if(stockBox){const stockSeat=new THREE.Vector3((stockBox.min.x+stockBox.max.x)*.5,(stockBox.min.y+stockBox.max.y)*.5,stockBox.max.z);rig.hip.copy(new THREE.Vector3(.2,-.25,-.07).sub(stockSeat))}
  }
  status('arsenal','LOADED',`3 high-resolution rifle variants · ${visibleMeshes} meshes · ${Math.round(visibleTriangles/1000)}K tris`);
}
function attachFlashlightToWeapon(kind){
  const mount=weaponRig[kind]?.lightMount;if(!mount)return;mount.add(flashlight,flashlight.target);flashlight.position.set(0,0,0);flashlight.target.position.set(0,-.03,-8);flashlight.target.updateMatrixWorld();
}

const armUp=new THREE.Vector3(0,1,0),armDirection=new THREE.Vector3(),armMidpoint=new THREE.Vector3();
function placePlayerLimb(mesh,start,end){
  armDirection.copy(end).sub(start);const length=armDirection.length();
  armMidpoint.copy(start).add(end).multiplyScalar(.5);mesh.position.copy(armMidpoint);
  mesh.quaternion.setFromUnitVectors(armUp,armDirection.normalize());mesh.scale.set(1,length,1);
}
function createPlayerArm(side,sleeveMaterial,gloveMaterial){
  const group=new THREE.Group();
  const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1,14,1),sleeveMaterial);
  const hand=new THREE.Group(),palm=new THREE.Mesh(new THREE.SphereGeometry(.038,14,10),gloveMaterial);palm.scale.set(.76,1.02,.58);hand.add(palm);
  for(let index=0;index<4;index++){
    const finger=new THREE.Mesh(new THREE.CylinderGeometry(.005,.006,.03-index*.0015,8),gloveMaterial);
    finger.position.set((index-1.5)*.013,-.034,.004);finger.rotation.x=.18;hand.add(finger);
  }
  const thumb=new THREE.Mesh(new THREE.CylinderGeometry(.006,.007,.028,8),gloveMaterial);thumb.position.set(side*.031,-.004,.006);thumb.rotation.z=side*.85;hand.add(thumb);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.043,.048,.058,14),gloveMaterial);
  group.add(sleeve,hand,cuff);playerArmsRoot.add(group);
  return {group,sleeve,hand,cuff,elbow:new THREE.Vector3(side*.26,-.48,.16),grip:new THREE.Vector3(side*.025,-.1,-.08)};
}
function installPlayerModel(){
  const soldier=assetMap.get('soldier')?.scene;if(!soldier){status('player','FAILED','rigged soldier base missing');return}
  playerOperator=buildSpecterOperator(soldier,{height:1.85,equipment:true});playerOperator.root.visible=false;scene.add(playerOperator.root);
  status('player','LOADED','SPECTER operator · 127-joint rig');
}
function installPlayerArms(){
  if(!playerOperator){status('player','FAILED','SPECTER operator missing');return}
  const materials=createSpecterViewMaterials(playerOperator);
  playerArms={right:createPlayerArm(1,materials.sleeve,materials.glove),left:createPlayerArm(-1,materials.sleeve,materials.glove)};
  status('player','LOADED','SPECTER operator · full body + view arms');
}

const enemies=[];
const enemiesByAIId=new Map();
const enemyAISystem=new EnemyAISystem({
  seed:'specter-blacksite-compound-v5',
  difficulty:'hardened',
  config:{
    perception:{visionDistance:38,fieldOfViewDegrees:110},
    combat:{engageDistance:27,preferredDistance:12,accuracy:.67},
    squad:{radioRange:86,alertRadius:38}
  }
});
const enemyCoverCandidates=[
  {position:{x:-2.4,y:0,z:-3.5},coverage:.82,priority:.25},{position:{x:3.2,y:0,z:-11},coverage:.82,priority:.2},{position:{x:-2.7,y:0,z:-22},coverage:.9,priority:.25},
  {position:{x:-7,y:0,z:-58},coverage:.92,priority:.45},{position:{x:6.2,y:0,z:-63},coverage:.92,priority:.4},{position:{x:-12,y:0,z:-79},coverage:.96,priority:.35},
  {position:{x:-4,y:0,z:-89},coverage:.92,priority:.4},{position:{x:5,y:0,z:-107},coverage:.92,priority:.4},{position:{x:-18,y:0,z:-99},coverage:.94,priority:.34},
  {position:{x:13,y:0,z:-118},coverage:.88,priority:.3},{position:{x:21,y:0,z:-120},coverage:.92,priority:.3}
];
let enemySequence=0;
const enemyGunMat=new THREE.MeshStandardMaterial({color:0x303733,roughness:.42,metalness:.76});
const enemyGunAccent=new THREE.MeshStandardMaterial({color:0x4c574f,roughness:.62,metalness:.38});
const enemyGunLens=new THREE.MeshStandardMaterial({color:0x315148,emissive:0x15342b,emissiveIntensity:.55,roughness:.18,metalness:.5});
const enemyArmorMat=new THREE.MeshStandardMaterial({color:0x28352d,roughness:.78,metalness:.22});
const enemyKitGeometry=Object.freeze({
  plate:new THREE.BoxGeometry(.5,.38,.16),
  collar:new THREE.BoxGeometry(.56,.11,.19),
  pouch:new THREE.BoxGeometry(.13,.19,.085),
  smallPouch:new THREE.BoxGeometry(.09,.13,.07),
  belt:new THREE.BoxGeometry(.58,.12,.2),
  backpack:new THREE.BoxGeometry(.4,.5,.2),
  radio:new THREE.BoxGeometry(.09,.25,.065),
  antenna:new THREE.CylinderGeometry(.008,.008,.58,8),
  shoulder:new THREE.SphereGeometry(.14,12,8),
  knee:new THREE.SphereGeometry(.125,12,8),
  helmet:new THREE.SphereGeometry(.19,16,10,0,Math.PI*2,0,Math.PI*.55),
  helmetRail:new THREE.BoxGeometry(.025,.055,.15),
  visor:new THREE.BoxGeometry(.24,.075,.035),
  cap:new THREE.CylinderGeometry(.15,.18,.075,16),
  capBrim:new THREE.BoxGeometry(.24,.025,.12),
  headset:new THREE.CylinderGeometry(.052,.052,.028,10),
  holster:new THREE.BoxGeometry(.13,.28,.075),
  patch:new THREE.BoxGeometry(.13,.04,.11)
});
function enemyWeaponPart(group,geometry,material,position,rotation=null){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);if(rotation)mesh.rotation.copy(rotation);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function createEnemyRifle(heavy=false,role='rifleman'){
  const marksman=role==='marksman',compact=role==='breacher',suppressed=marksman||role==='scout';
  const group=new THREE.Group();group.name='enemy-rifle';group.position.set(-.09,1.3,-.38);group.rotation.x=-.06;
  const model=cloneAsset('ar15');
  const proxy=new THREE.Mesh(new THREE.BoxGeometry(.13,.16,marksman?1.06:compact?.76:.91),enemyGunMat);proxy.name='enemy-rifle-distance-lod';proxy.position.z=-.08;proxy.castShadow=false;proxy.receiveShadow=false;proxy.visible=!model;group.add(proxy);
  let muzzlePosition=new THREE.Vector3(0,.018,marksman?-.94:suppressed?-.79:compact?-.5:-.61);
  let ejectPosition=new THREE.Vector3(.09,.05,-.06);
  if(model){
    hideByName(model,['ground','stand','plane001','plane002','plane003','bullets','mag byulle','mag001','mag002','scope001','sight001','handle001','stock001']);
    model.rotation.set(0,-Math.PI/2,0);
    normalize(model,marksman?1.16:compact?.94:1.04);
    const weaponTint={rifleman:0xffffff,scout:0xa8b1ab,breacher:0xb5aea1,marksman:0xc0ad91,commander:0xaba27c}[role]||0xffffff;
    model.traverse(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      const clones=materials.map(material=>{const clone=material?.clone?.()||material;if(clone?.color)clone.color.multiply(new THREE.Color(weaponTint));clone.roughness=Math.max(clone.roughness??.42,.38);return clone});
      object.material=Array.isArray(object.material)?clones:clones[0];object.castShadow=false;object.receiveShadow=false;
    });
    group.add(model);faceWeaponForward(model,group,'Handguard','Stock');
    const modelBox=boundsInSpace(model,group),handguardBox=boundsInSpace(model.getObjectByName('Handguard')||model,group),receiverBox=boundsInSpace(model.getObjectByName('Dust cover')||model.getObjectByName('upper receiver part')||model,group);
    if(modelBox&&handguardBox){muzzlePosition=handguardBox.getCenter(new THREE.Vector3());muzzlePosition.z=modelBox.min.z-.012}
    if(receiverBox){ejectPosition=receiverBox.getCenter(new THREE.Vector3());ejectPosition.x=receiverBox.max.x+.012;ejectPosition.y+=.008}
    if(suppressed){
      const suppressorLength=marksman?.25:.19,suppressorMaterial=new THREE.MeshStandardMaterial({color:0x222725,roughness:.46,metalness:.84});
      const suppressorMesh=new THREE.Mesh(new THREE.CylinderGeometry(.035,.041,suppressorLength,24,1,false),suppressorMaterial);suppressorMesh.name='enemy-suppressor';suppressorMesh.rotation.x=Math.PI/2;suppressorMesh.position.copy(muzzlePosition);suppressorMesh.position.z-=suppressorLength*.5;suppressorMesh.castShadow=false;group.add(suppressorMesh);muzzlePosition.z-=suppressorLength+.008;
    }
  }
  const muzzle=new THREE.Group();muzzle.position.copy(muzzlePosition);group.add(muzzle);
  const eject=new THREE.Group();eject.position.copy(ejectPosition);group.add(eject);
  if(heavy)group.scale.setScalar(1.06);
  return {group,muzzle,eject,detail:model,proxy,basePosition:group.position.clone()};
}

function addEnemyRoleEquipment(root,role){
  const palette={rifleman:0x2b3930,scout:0x24322d,breacher:0x30352f,marksman:0x374036,commander:0x3f4235};
  const armor=enemyArmorMat.clone();armor.color.setHex(palette[role]||palette.rifleman);
  const webbing=new THREE.MeshStandardMaterial({color:0x1c2620,roughness:.8,metalness:.08});
  const cloth=new THREE.MeshStandardMaterial({color:0x566455,roughness:.92,metalness:0});
  const polymer=new THREE.MeshStandardMaterial({color:0x171d1a,roughness:.55,metalness:.24});
  const marker=new THREE.MeshBasicMaterial({color:role==='commander'?0xc7b76f:role==='breacher'?0x8e4f35:0x5d8e72,toneMapped:false});
  const part=(name,geometry,material,x,y,z,rotation=null,scale=null)=>{
    const mesh=enemyWeaponPart(root,geometry,material,new THREE.Vector3(x,y,z),rotation);mesh.name=`enemy-${role}-${name}`;if(scale)mesh.scale.copy(scale);return mesh;
  };

  // Every hostile gets a present-day plate carrier, belt, and an identifiable helmet or cap.
  part('plate-carrier',enemyKitGeometry.plate,armor,0,1.34,-.105);
  part('carrier-collar',enemyKitGeometry.collar,webbing,0,1.57,-.05);
  part('battle-belt',enemyKitGeometry.belt,webbing,0,1.02,.01);
  part('left-shoulder-patch',enemyKitGeometry.patch,marker,-.35,1.55,-.015,new THREE.Euler(0,0,.25));
  part('right-shoulder-webbing',enemyKitGeometry.patch,webbing,.35,1.55,-.015,new THREE.Euler(0,0,-.25));
  for(const x of [-.17,0,.17])part(`front-pouch-${x}`,enemyKitGeometry.pouch,role==='commander'?webbing:armor,x,1.29,-.21);

  if(role==='scout'||role==='marksman'){
    part('field-cap',enemyKitGeometry.cap,cloth,0,1.79,.01);
    part('field-cap-brim',enemyKitGeometry.capBrim,cloth,0,1.79,-.145);
  }else{
    part('ballistic-helmet',enemyKitGeometry.helmet,polymer,0,1.82,.01);
    part('left-helmet-rail',enemyKitGeometry.helmetRail,webbing,-.17,1.81,.01,new THREE.Euler(0,0,.06));
    part('right-helmet-rail',enemyKitGeometry.helmetRail,webbing,.17,1.81,.01,new THREE.Euler(0,0,-.06));
  }

  if(role==='rifleman'){
    part('utility-pouch-left',enemyKitGeometry.smallPouch,webbing,-.29,1.16,-.16);
    part('utility-pouch-right',enemyKitGeometry.smallPouch,webbing,.29,1.16,-.16);
    part('thigh-holster',enemyKitGeometry.holster,polymer,.31,.76,.02,new THREE.Euler(0,0,-.08));
  }
  if(role==='scout'||role==='commander'){
    part('assault-pack',enemyKitGeometry.backpack,armor,0,1.31,.19);
    part('radio',enemyKitGeometry.radio,polymer,.24,1.43,.2);
    part('radio-antenna',enemyKitGeometry.antenna,polymer,.24,1.85,.2,new THREE.Euler(0,0,.08));
    part('headset-left',enemyKitGeometry.headset,polymer,-.18,1.73,.01,new THREE.Euler(0,Math.PI/2,0));
  }
  if(role==='breacher'){
    part('heavy-front-armor',enemyKitGeometry.plate,armor,0,1.35,-.215,new THREE.Euler(),new THREE.Vector3(1.1,1.22,1));
    part('visor',enemyKitGeometry.visor,new THREE.MeshStandardMaterial({color:0x202d28,roughness:.22,metalness:.66}),0,1.8,-.17);
    part('left-shoulder-pad',enemyKitGeometry.shoulder,armor,-.37,1.49,0,new THREE.Euler(0,0,.2),new THREE.Vector3(1.08,.64,1));
    part('right-shoulder-pad',enemyKitGeometry.shoulder,armor,.37,1.49,0,new THREE.Euler(0,0,-.2),new THREE.Vector3(1.08,.64,1));
    part('left-knee-pad',enemyKitGeometry.knee,polymer,-.18,.47,-.08,new THREE.Euler(Math.PI*.5,0,0),new THREE.Vector3(1,.58,.42));
    part('right-knee-pad',enemyKitGeometry.knee,polymer,.18,.47,-.08,new THREE.Euler(Math.PI*.5,0,0),new THREE.Vector3(1,.58,.42));
  }
  if(role==='marksman'){
    part('marksman-pack',enemyKitGeometry.backpack,armor,0,1.31,.19,new THREE.Euler(),new THREE.Vector3(.9,.9,1));
    part('rangefinder-pouch',enemyKitGeometry.smallPouch,polymer,.27,1.44,-.17);
    const shoulderCape=new THREE.Mesh(new THREE.PlaneGeometry(.82,.72,4,4),armor);shoulderCape.name='marksman-shoulder-cover';shoulderCape.position.set(0,1.45,.14);shoulderCape.rotation.x=-.18;shoulderCape.castShadow=true;root.add(shoulderCape);
  }
  if(role==='commander'){
    part('command-patch',enemyKitGeometry.patch,marker,.27,1.55,-.2);
    part('right-headset',enemyKitGeometry.headset,polymer,.18,1.73,.01,new THREE.Euler(0,Math.PI/2,0));
    part('command-holster',enemyKitGeometry.holster,polymer,-.31,.76,.02,new THREE.Euler(0,0,.08));
  }
}
function updatePlayerArms(dt,t,reloadWave,equipDrop){
  if(!playerArms)return;
  const rifle=weaponProfiles[currentWeapon].family!=='pistol',bob=moving?Math.sin(t*(sprinting?10:7))*.012:0;
  const rightElbow=new THREE.Vector3(rifle?.11:.1,(rifle?-.4:-.38)-equipDrop*.08,rifle?-.12:-.12);
  const leftElbow=new THREE.Vector3(rifle?-.16:-.1,(rifle?-.39:-.37)-equipDrop*.08,rifle?0:-.13);
  const rightGrip=new THREE.Vector3(rifle?-.015:.02,rifle?-.09:-.075,rifle?-.19:-.15);
  const leftGrip=new THREE.Vector3(rifle?.045:-.015,rifle?-.035:-.055,rifle?-.36:-.17);
  rightElbow.y+=bob;leftElbow.y-=bob;
  rightGrip.x+=reloadWave*.04;rightGrip.y-=reloadWave*.07;leftGrip.x+=reloadWave*.025;leftGrip.y-=reloadWave*.08;
  for(const [arm,elbow,grip] of [[playerArms.right,rightElbow,rightGrip],[playerArms.left,leftElbow,leftGrip]]){
    arm.elbow.lerp(elbow,1-Math.exp(-14*dt));arm.grip.lerp(grip,1-Math.exp(-14*dt));
    placePlayerLimb(arm.sleeve,arm.elbow,arm.grip);arm.hand.position.copy(arm.grip);
    arm.hand.quaternion.copy(arm.sleeve.quaternion);
    arm.cuff.position.copy(arm.grip).lerp(arm.elbow,.13);arm.cuff.quaternion.copy(arm.sleeve.quaternion);
  }
}
function updatePlayerModel(t){
  if(!playerOperator)return;
  playerOperator.root.visible=started;
  camera.getWorldDirection(playerBodyForward);playerBodyForward.y=0;if(playerBodyForward.lengthSq()<.001)playerBodyForward.set(0,0,-1);else playerBodyForward.normalize();
  playerOperator.root.position.copy(camera.position).addScaledVector(playerBodyForward,-.58);playerOperator.root.position.y=-.03;
  playerOperator.root.rotation.set(0,camera.rotation.y+Math.PI,0);
  poseSpecterOperator(playerOperator,{time:t,moving,sprinting,aiming});
}
function spawnEnemy(x,z,role='rifleman'){
  if(role===true)role='breacher';
  const heavy=role==='breacher'||role==='commander',maxHealth=role==='commander'?190:heavy?165:role==='marksman'?120:100;
  const root=new THREE.Group();root.position.set(x,0,z);
  const aiId=`hostile-${String(++enemySequence).padStart(2,'0')}`;
  root.userData={aiId,role,maxHealth,health:maxHealth,dead:false,phase:Math.random()*6,heavy,hit:0,recoil:0,deathProgress:0,intent:null};
  const model=cloneAsset('soldier',true);
  if(model){
    const height=role==='scout'?1.9:role==='commander'?2.14:heavy?2.08:1.98;
    model.rotation.y=Math.PI;normalize(model,height,true);
    const tint={rifleman:0x738074,scout:0x60746c,breacher:0x6a7068,marksman:0x78806f,commander:0x827b65}[role]||0x738074;
    model.traverse(o=>{if(o.isMesh){o.userData.enemy=root;o.frustumCulled=true;const materials=Array.isArray(o.material)?o.material:[o.material];const clones=materials.map(material=>{const clone=material?.clone?.()||material;if(clone?.color)clone.color.multiply(new THREE.Color(tint));clone.roughness=Math.max(clone.roughness??.5,.62);return clone});o.material=Array.isArray(o.material)?clones:clones[0]}});root.add(model);
    root.userData.model=model;
    root.userData.animator=createTacticalAnimator(model,{weapon:'rifle',phase:root.userData.phase});
  }
  const weapon=createEnemyRifle(heavy,role);root.add(weapon.group);
  root.userData.weapon=weapon.group;root.userData.weaponDetail=weapon.detail;root.userData.weaponProxy=weapon.proxy;root.userData.weaponBase=weapon.basePosition;root.userData.muzzle=weapon.muzzle;root.userData.eject=weapon.eject;
  addEnemyRoleEquipment(root,role);
  root.traverse(object=>{if(object.isMesh)object.userData.enemy=root});
  const interior=z>-45,patrolPoints=interior
    ?[{x:THREE.MathUtils.clamp(x-1.8,-7.8,7.8),y:0,z:THREE.MathUtils.clamp(z+2.8,-42,7)},{x:THREE.MathUtils.clamp(x+1.8,-7.8,7.8),y:0,z:THREE.MathUtils.clamp(z-2.8,-42,7)}]
    :[{x:THREE.MathUtils.clamp(x-4,-36,36),y:0,z:THREE.MathUtils.clamp(z+4,-132,-48)},{x:THREE.MathUtils.clamp(x+4,-36,36),y:0,z:THREE.MathUtils.clamp(z-4,-132,-48)}];
  const ai=enemyAISystem.addAgent({id:aiId,squadId:interior?'interior':'perimeter',difficulty:role==='commander'?'elite':heavy||role==='marksman'?'hardened':'regular',patrolPoints,health:maxHealth,maxHealth});
  root.userData.ai=ai;enemiesByAIId.set(aiId,root);
  scene.add(root);enemies.push(root);
}
function animateEnemyWeapon(enemy,dt,t,isMoving,deathProgress=0){
  const data=enemy.userData,stride=isMoving?Math.sin(t*7.5+data.phase):0,breath=Math.sin(t*1.8+data.phase);
  data.recoil=Math.max(0,data.recoil-dt*5);
  if(!data.weapon)return;
  data.weapon.position.copy(data.weaponBase);data.weapon.position.x+=stride*.018;data.weapon.position.y+=breath*.008-deathProgress*.36;data.weapon.position.z+=data.recoil*.1+deathProgress*.12;
  data.weapon.rotation.x=-.06+data.recoil*.16+stride*.025+deathProgress*.52;data.weapon.rotation.z=stride*.025+deathProgress*.28;
}
const enemyRaycaster=new THREE.Raycaster();
function enemyCanSeePlayer(enemy){
  const origin=enemy.userData.muzzle?.getWorldPosition(new THREE.Vector3())||enemy.position.clone().add(new THREE.Vector3(0,1.4,0));
  const direction=camera.position.clone().sub(origin);const length=direction.length();direction.normalize();
  enemyRaycaster.set(origin,direction);enemyRaycaster.near=0;enemyRaycaster.far=length;
  const obstruction=enemyRaycaster.intersectObjects(collision,true)[0];return !obstruction||obstruction.distance>=length-.35;
}
function damagePlayer(amount){
  const absorbed=Math.min(armor,Math.ceil(amount*.65));armor-=absorbed;hp=Math.max(0,hp-(amount-absorbed));hud();
  if(hp<=0){toast('OPERATOR DOWN');hp=100;armor=50;camera.position.set(0,1.72,7);hud()}
}
function enemyFire(enemy,distance,request=null){
  const data=enemy.userData,suppressed=data.role==='marksman'||data.role==='scout';data.recoil=1;data.animator?.triggerRecoil({strength:.86});spawnMuzzleBurst(data.muzzle,'rifle',suppressed?.28:.72,suppressed?4:7);ejectCasing('rifle',data.eject);
  const muzzlePosition=data.muzzle?.getWorldPosition(new THREE.Vector3())||enemy.position.clone().add(new THREE.Vector3(0,1.4,0));
  audio?.playWeapon?.('rifle',{position:muzzlePosition,volume:.7,suppressed});
  enemyAISystem.emitNoise({position:muzzlePosition,type:'gunshot',loudness:suppressed?.72:1,radius:suppressed?38:52,sourceId:data.aiId,sourceFaction:'hostile'});
  const requestedAccuracy=request?.accuracy??(data.heavy?.7:.6),accuracy=THREE.MathUtils.clamp(requestedAccuracy*(1-distance*.012),.18,.78);if(Math.random()<accuracy)damagePlayer(data.role==='commander'?14:data.heavy?12:8);
}
const previousAIPlayerPosition=camera.position.clone(),aiPlayerVelocity=new THREE.Vector3(),enemyForward=new THREE.Vector3(),enemyMoveDirection=new THREE.Vector3(),enemyLookDirection=new THREE.Vector3();
let lastEnemyCallTime=-Infinity;
function rotateEnemyToward(enemy,target,dt){
  if(!target)return;enemyLookDirection.set(target.x-enemy.position.x,0,target.z-enemy.position.z);if(enemyLookDirection.lengthSq()<.001)return;
  const desired=Math.atan2(enemyLookDirection.x,enemyLookDirection.z)+Math.PI,delta=Math.atan2(Math.sin(desired-enemy.rotation.y),Math.cos(desired-enemy.rotation.y));enemy.rotation.y+=delta*(1-Math.exp(-10*dt));
}
function tryMoveEnemy(enemy,target,speed,stoppingDistance,dt){
  enemyMoveDirection.set(target.x-enemy.position.x,0,target.z-enemy.position.z);const distance=enemyMoveDirection.length();if(distance<=stoppingDistance)return false;
  enemyMoveDirection.multiplyScalar(1/distance);const step=Math.min(speed*dt,Math.max(0,distance-stoppingDistance)),next=enemy.position.clone().addScaledVector(enemyMoveDirection,step);
  if(canMove(next)){enemy.position.x=next.x;enemy.position.z=next.z;return true}
  const xOnly=enemy.position.clone();xOnly.x=next.x;if(canMove(xOnly)){enemy.position.x=xOnly.x;return true}
  const zOnly=enemy.position.clone();zOnly.z=next.z;if(canMove(zOnly)){enemy.position.z=zOnly.z;return true}
  return false;
}
function updateEnemies(dt,t){
  aiPlayerVelocity.copy(camera.position).sub(previousAIPlayerPosition).multiplyScalar(1/Math.max(dt,.001));previousAIPlayerPosition.copy(camera.position);
  const intents=enemyAISystem.update(dt,(id)=>{
    const enemy=enemiesByAIId.get(id);if(!enemy)return {};
    const data=enemy.userData,distance=enemy.position.distanceTo(camera.position),outdoors=camera.position.z<-45;
    enemyForward.set(0,0,-1).applyQuaternion(enemy.quaternion).normalize();
    return {
      self:{position:enemy.position,forward:enemyForward,health:data.health,maxHealth:data.maxHealth,alive:!data.dead},
      player:{position:camera.position,velocity:aiPlayerVelocity,visible:distance<44&&enemyCanSeePlayer(enemy),visibility:outdoors?1:powerOn?.9:lightOn?.5:.2,alive:hp>0,aimingAtAgent:aiming},
      visibility:outdoors?1:powerOn?.9:lightOn?.5:.2,
      coverCandidates:enemyCoverCandidates,
      navigation:{canReach:(from,to)=>canMove(new THREE.Vector3(to.x,1.72,to.z)),projectPoint:point=>({x:THREE.MathUtils.clamp(point.x,-40,40),y:0,z:THREE.MathUtils.clamp(point.z,-133,7)})},
      combatEnabled:started&&(powerOn||outdoors)
    };
  });
  for(const enemy of enemies){
    const data=enemy.userData,distance=enemy.position.distanceTo(camera.position),showDetailedWeapon=distance<24;
    if(data.weaponDetail)data.weaponDetail.visible=showDetailedWeapon;
    if(data.weaponProxy)data.weaponProxy.visible=!showDetailedWeapon;
    if(data.dead){
      const animation=data.animator?.update(dt,{locomotion:'idle',weapon:'rifle',weaponReady:false});
      data.deathProgress=animation?.deathProgress??Math.min(1,data.deathProgress+dt*1.25);
      animateEnemyWeapon(enemy,dt,t,false,data.deathProgress);
      continue;
    }
    const intent=intents.get(data.aiId);data.intent=intent;
    if(intent?.state!==data.lastAIState){
      const voiceType=intent?.move?.mode==='flank'?'flank':{suspicious:'investigate',investigate:'investigate',search:'backup',chase:'contact',engage:'contact',retreat:'retreat',suppressed:'suppress',dead:'down'}[intent?.state];
      if(voiceType&&t-lastEnemyCallTime>4.2){lastEnemyCallTime=t;audio.playEnemyCall(enemy.position,{type:voiceType,radio:intent?.state!=='dead',intensity:data.heavy?1.05:.86})}
      data.lastAIState=intent?.state;
    }
    const lookTarget=intent?.aimAt||intent?.lookAt||intent?.move?.target;
    rotateEnemyToward(enemy,lookTarget,dt);
    const isMoving=!!intent?.move&&tryMoveEnemy(enemy,intent.move.target,intent.move.speed,intent.move.stoppingDistance,dt);
    enemy.position.y=isMoving?Math.abs(Math.sin(t*7+data.phase))*.018:Math.sin(t*1.7+data.phase)*.004;
    if(intent?.fire)enemyFire(enemy,distance,intent.fire);
    const locomotion=!isMoving?'idle':intent?.state==='chase'||intent?.move?.mode==='retreat'?'run':intent?.move?.mode==='strafe'?'strafe':'walk';
    data.animator?.updateFromIntent(dt,intent,{weapon:'rifle',locomotion,speed:isMoving?1:0,aiming:!!intent?.aimAt,crouching:intent?.stance==='crouch',alertness:intent?.alertness||0});
    animateEnemyWeapon(enemy,dt,t,isMoving,0);
  }
}

function prepareRecordedAudio(){
  if(recordedAudioDecodePromise)return;
  const reportCount=Object.keys(weaponSamplePayloads).length,voiceCount=Object.keys(enemyVoiceSamplePayloads).length,footstepCount=Object.keys(footstepSamplePayloads).length;
  if(!reportCount&&!voiceCount&&!footstepCount)return;
  recordedAudioDecodePromise=Promise.all([
    reportCount?audio.loadWeaponSamples(weaponSamplePayloads):Promise.resolve({loaded:[]}),
    voiceCount?audio.loadEnemyVoiceSamples(enemyVoiceSamplePayloads):Promise.resolve({loaded:[]}),
    footstepCount?audio.loadFootstepSamples(footstepSamplePayloads):Promise.resolve({loaded:[]})
  ]).then(([reports,voices,footsteps])=>{
    if(reports.loaded.length||voices.loaded.length||footsteps.loaded.length)status('audio','LOADED',`${reports.loaded.length} reports + ${voices.loaded.length} CC0 voice lines + ${footsteps.loaded.length} footsteps`);
    else status('audio','LOADED','procedural fallback');
    return {reports,voices,footsteps};
  }).catch(error=>{console.warn('Recorded audio unavailable; procedural fallbacks remain active.',error);status('audio','LOADED','procedural fallback');return null});
}
function ensureAudio(){
  if(!audio.active)audio.resume().then(prepareRecordedAudio).catch(error=>console.warn('Audio unavailable.',error));
  else prepareRecordedAudio();
}
function gunshot(kind){ensureAudio();const profile=weaponProfiles[kind];audio.playWeapon(profile?.family||kind,{outdoorBlend:worldOverhaul.outdoorBlend,suppressed:!!profile?.suppressed})}
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
function muzzleFlash(){const profile=weaponProfiles[currentWeapon];spawnMuzzleBurst(weaponRig[currentWeapon].muzzle,profile.family,profile.suppressed?.3:1,profile.suppressed?5:null)}
function ejectCasing(kind,anchorOverride=null){
  const anchor=anchorOverride||weaponRig[kind].eject;if(!anchor)return;
  anchor.updateWorldMatrix(true,false);
  const origin=anchor.getWorldPosition(new THREE.Vector3());
  const right=new THREE.Vector3(1,0,0).transformDirection(anchor.matrixWorld);
  const up=new THREE.Vector3(0,1,0).transformDirection(anchor.matrixWorld);
  const back=new THREE.Vector3(0,0,1).transformDirection(anchor.matrixWorld);
  const family=weaponProfiles[kind]?.family||kind;
  const mesh=new THREE.Mesh(casingGeometry[family]||casingGeometry.rifle,casingMaterial);mesh.position.copy(origin);
  mesh.quaternion.setFromEuler(new THREE.Euler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI));
  mesh.castShadow=false;scene.add(mesh);
  const speed=family==='rifle'?2.25:1.75;
  const velocity=right.multiplyScalar(speed*(.82+Math.random()*.35)).addScaledVector(up,1.15+Math.random()*.65).addScaledVector(back,.18+Math.random()*.35);
  casings.push({mesh,velocity,spin:new THREE.Vector3(10+Math.random()*9,7+Math.random()*11,9+Math.random()*12),ttl:4});
  while(casings.length>28)removeSceneObject(casings.shift().mesh);
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
const maxImpactMarks=64,impactGeometry=new THREE.CircleGeometry(.04,12),impactMaterial=new THREE.MeshBasicMaterial({color:0x111111,polygonOffset:true,polygonOffsetFactor:-4});
const impactMarks=new THREE.InstancedMesh(impactGeometry,impactMaterial,maxImpactMarks),impactTransform=new THREE.Object3D();let impactCursor=0;
impactMarks.name='pooled-bullet-impact-marks';impactMarks.count=0;impactMarks.castShadow=false;impactMarks.receiveShadow=false;impactMarks.frustumCulled=false;impactMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(impactMarks);
function impact(hit){
  if(!hit?.face)return;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  impactTransform.position.copy(hit.point).addScaledVector(normal,.006);impactTransform.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);impactTransform.scale.setScalar(1);impactTransform.updateMatrix();
  impactMarks.setMatrixAt(impactCursor,impactTransform.matrix);impactCursor=(impactCursor+1)%maxImpactMarks;impactMarks.count=Math.min(maxImpactMarks,impactMarks.count+1);impactMarks.instanceMatrix.needsUpdate=true;
}
function enemyReactionDirection(enemy,origin=camera.position){
  const local=enemy.worldToLocal(origin.clone());
  return Math.abs(local.x)>Math.abs(local.z)?(local.x>0?'right':'left'):(local.z>0?'back':'front');
}
function triggerFireAnimation(kind){
  recoilPitch=Math.min(.28,recoilPitch+(weaponProfiles[kind]?.recoilPitch||.07));
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
  const profile=weaponProfiles[currentWeapon],now=performance.now(),delay=60000/profile.rpm;
  if(reloading||now-lastShot<delay)return;
  if(ammo[currentWeapon]<=0){lastShot=now;audio.playWeaponMechanism(profile.family,'dryFire');return}
  lastShot=now;ammo[currentWeapon]--;recoil=Math.min(.2,recoil+profile.recoil);
  triggerFireAnimation(currentWeapon);gunshot(currentWeapon);muzzleFlash();ejectCasing(currentWeapon);
  enemyAISystem.emitNoise({position:camera.position,type:'gunshot',loudness:1,radius:profile.family==='rifle'?58:42,sourceId:'specter-player',sourceFaction:'specter'});
  const hitEnemies=new Set(),projectiles=profile.projectiles||1;
  for(let projectile=0;projectile<projectiles;projectile++){
    const spread=profile.spread||0,offset=new THREE.Vector2((Math.random()-.5)*spread,(Math.random()-.5)*spread);
    raycaster.setFromCamera(offset,camera);
    const hit=raycaster.intersectObjects([...enemies,...collision],true)[0];
    if(!hit)continue;
    impact(hit);const e=hit.object.userData.enemy;
    if(e&&!e.userData.dead){
      const damage=profile.damage;e.userData.health-=damage;hitEnemies.add(e);
      e.userData.hit=1;
      e.userData.animator?.triggerHit({direction:enemyReactionDirection(e),strength:profile.family==='pistol'?.78:1,height:hit.point.y-e.position.y>1.55?'head':'torso'});
      e.userData.ai?.applyDamage(damage,{health:e.userData.health,maxHealth:e.userData.maxHealth,attackerPosition:camera.position});
      if(e.userData.health<=0){
        e.userData.dead=true;e.userData.animator?.triggerDeath({variant:'auto',direction:enemyReactionDirection(e),duration:1.18+Math.random()*.34});kills++;toast('HOSTILE NEUTRALIZED');
        enemyAISystem.broadcastSquadAlert({type:'squadmate-down',sourceId:e.userData.aiId,squadId:e.userData.ai?.squadId||'perimeter',faction:'hostile',position:e.position,certainty:1});
        if(kills>=enemies.length)objective.textContent='OBJECTIVE: EXTERIOR SECURED — REACH EXTRACTION';
      }
    }
  }
  raycaster.setFromCamera(new THREE.Vector2(),camera);
  for(const enemy of enemies){
    if(enemy.userData.dead||hitEnemies.has(enemy))continue;
    const chest=enemy.position.clone().add(new THREE.Vector3(0,1.25,0));if(raycaster.ray.distanceSqToPoint(chest)<1.8){enemy.userData.ai?.applySuppression(.18,{origin:camera.position,sourceId:'specter-player'});enemy.userData.animator?.triggerSuppression({direction:enemyReactionDirection(enemy),strength:.62})}
  }
  hud();
}
function reload(){
  if(reloading)return;const profile=weaponProfiles[currentWeapon],cap=profile.capacity;if(ammo[currentWeapon]>=cap||reserve[currentWeapon]<=0)return;
  const kind=currentWeapon;audio.playWeaponMechanism(profile.family,'reload');reloadAnimationDuration=profile.reloadSeconds;reloadAnimationTime=0;reloading=true;setTimeout(()=>{
    const n=Math.min(cap-ammo[kind],reserve[kind]);ammo[kind]+=n;reserve[kind]-=n;
    if(kind==='pistol'&&pistolSlideLocked){pistolSlideLocked=false;pistolSlideTime=.055}
    reloading=false;hud();
  },reloadAnimationDuration*1000);
}
function switchWeapon(kind){
  if(reloading||kind===currentWeapon||!weaponHolders[kind])return;currentWeapon=kind;fireMode=weaponModes[kind];audio.playWeaponMechanism(weaponProfiles[kind].family,'equip');for(const [weapon,holder] of Object.entries(weaponHolders))holder.visible=weapon===kind;attachFlashlightToWeapon(kind);equipAnimationTime=0;setAim(false);hud();
}
function setAim(value){
  aiming=value&&!sprinting;
}
function toggleMode(){const profile=weaponProfiles[currentWeapon];if(profile.fireModes.length<2)return;const index=profile.fireModes.indexOf(fireMode);fireMode=profile.fireModes[(index+1)%profile.fireModes.length];weaponModes[currentWeapon]=fireMode;audio.playWeaponMechanism(profile.family,'selector');toast(`FIRE MODE · ${fireMode.toUpperCase()}`);hud()}
function updateWeapon(dt,t){
  updatePistolSlide(dt);
  equipAnimationTime=Math.min(.5,equipAnimationTime+dt);
  if(reloading)reloadAnimationTime=Math.min(reloadAnimationDuration,reloadAnimationTime+dt);
  const profile=weaponProfiles[currentWeapon];
  aimBlend=THREE.MathUtils.damp(aimBlend,aiming&&!sprinting?1:0,14,dt);
  const wantedFov=THREE.MathUtils.lerp(sprinting?78:72,profile.adsFov,aimBlend);
  camera.fov=THREE.MathUtils.damp(camera.fov,wantedFov,16,dt);camera.updateProjectionMatrix();
  const scoped=aimBlend>.96&&profile.trueScope;
  document.getElementById('scopeOverlay').classList.toggle('active',scoped);
  scopeSurface.visible=scoped;
  for(const visual of weaponRig[currentWeapon].visuals||[])visual.visible=!scoped;
  playerArmsRoot.visible=!scoped;
  if(scoped){
    const lensRadius=Math.abs(scopeSurface.position.z)*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*.58*Math.min(1,camera.aspect);
    scopeSurface.scale.setScalar(lensRadius);
  }
  document.getElementById('crosshair').style.display=aimBlend>.28?'none':'block';
  const hip=weaponRig[currentWeapon].hip;
  const ads=weaponRig[currentWeapon].ads;
  const spr=profile.sprint;
  const target=(sprinting?spr:hip.clone().lerp(ads,aimBlend)).clone();
  const equipDrop=1-THREE.MathUtils.smoothstep(equipAnimationTime,0,.42);
  const reloadProgress=reloading?THREE.MathUtils.clamp(reloadAnimationTime/reloadAnimationDuration,0,1):0;
  const reloadWave=reloading?Math.sin(reloadProgress*Math.PI):0;
  const twoHanded=profile.family!=='pistol';
  target.x+=reloadWave*(twoHanded?.16:.12);
  target.y-=reloadWave*(twoHanded?.25:.2)+equipDrop*.3;
  target.z+=reloadWave*.045;
  const bob=moving?(sprinting?.018:.008):.0015;
  const adsSteady=1-aimBlend*.82;
  target.x+=(Math.sin(t*(sprinting?10:7))*bob+swayX*.00012)*adsSteady;
  target.y-=(Math.abs(Math.cos(t*(sprinting?10:7)))*bob*.7+swayY*.0001)*adsSteady;
  target.z+=recoil;
  weaponRoot.position.lerp(target,1-Math.pow(.001,dt));recoil=Math.max(0,recoil-dt*.35);
  swayX=THREE.MathUtils.damp(swayX,0,9,dt);swayY=THREE.MathUtils.damp(swayY,0,9,dt);
  const rx=(sprinting?.42:0)+recoilPitch+reloadWave*.18+equipDrop*.1;
  const ry=sprinting?.22:THREE.MathUtils.lerp(-.05,0,aimBlend);
  const rz=(sprinting?-.32:0)+reloadWave*(twoHanded?.68:.5)+equipDrop*.24;
  weaponRoot.rotation.x+=(rx-weaponRoot.rotation.x)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.y+=(ry-weaponRoot.rotation.y)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.z+=(rz-weaponRoot.rotation.z)*(1-Math.exp(-7*dt));
  recoilPitch=Math.max(0,recoilPitch-dt*.42);
  updatePlayerArms(dt,t,reloadWave,equipDrop);
}

let scopeRenderElapsed=1;
function renderScopeView(dt){
  if(!scopeSurface.visible){scopeRenderElapsed=1;return}
  scopeRenderElapsed+=dt;if(scopeRenderElapsed<1/30)return;scopeRenderElapsed%=1/30;
  camera.getWorldPosition(scopeCamera.position);camera.getWorldQuaternion(scopeCamera.quaternion);scopeCamera.updateMatrixWorld(true);
  const previousTarget=renderer.getRenderTarget(),operatorWasVisible=playerOperator?.root.visible;
  scopeSurface.visible=false;if(playerOperator)playerOperator.root.visible=false;
  renderer.setRenderTarget(scopeRenderTarget);renderer.clear();renderer.render(scene,scopeCamera);renderer.setRenderTarget(previousTarget);
  if(playerOperator)playerOperator.root.visible=operatorWasVisible;scopeSurface.visible=true;
}

let started=false,powerOn=false,lightOn=true,hp=100,armor=50,kills=0,exteriorEntered=false,missionWon=false,footstepNoiseTimer=0;
const keys={},clock=new THREE.Clock(),moveVelocity=new THREE.Vector3(),audioForward=new THREE.Vector3(),extractionPoint=new THREE.Vector3(0,1.72,-128);
function toast(t){const m=document.getElementById('message');m.textContent=t;m.style.opacity=1;clearTimeout(toast.id);toast.id=setTimeout(()=>m.style.opacity=0,1500)}
function hud(){
  hpEl.textContent=hp;armorEl.textContent=armor;
  weaponName.textContent=`${weaponProfiles[currentWeapon].uiName} · ${fireMode.toUpperCase()}`;
  ammoEl.textContent=`${ammo[currentWeapon]}/${reserve[currentWeapon]}`;
  lightState.textContent=lightOn?'ON':'OFF';powerState.textContent=powerOn?'ONLINE':'OFFLINE';secure.textContent=`${kills}/${enemies.length||3}`;
}
const hpEl=document.getElementById('hp'),armorEl=document.getElementById('armor'),weaponName=document.getElementById('weaponName'),ammoEl=document.getElementById('ammo'),lightState=document.getElementById('lightState'),powerState=document.getElementById('powerState'),secure=document.getElementById('secure');
const collisionPoint=new THREE.Vector3(),moveNext=new THREE.Vector3(),moveAxisX=new THREE.Vector3(),moveAxisZ=new THREE.Vector3();
function canMove(next){
  const indoors=next.z>-44.45;
  if(next.z>8.3||next.z<-135.4)return false;
  if(indoors&&Math.abs(next.x)>8.45)return false;
  if(!indoors&&Math.abs(next.x)>42.35)return false;
  collisionPoint.set(next.x,1,next.z);
  if(staticColliderBounds.some(bounds=>bounds.containsPoint(collisionPoint)))return false;
  let index=0;for(const collider of dynamicColliders){if(dynamicColliderBounds[index++].setFromObject(collider).expandByScalar(.3).containsPoint(collisionPoint))return false}
  return true;
}
function move(dt){
  const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const v=forward.multiplyScalar(f).add(right.multiplyScalar(s));moving=v.lengthSq()>.01;if(v.lengthSq()>1)v.normalize();
  sprinting=!!keys.ShiftLeft&&moving&&!aiming;
  const targetVelocity=v.multiplyScalar(sprinting?6.1:3.7);
  moveVelocity.lerp(targetVelocity,1-Math.exp(-(moving?13:18)*dt));
  moveNext.copy(camera.position).addScaledVector(moveVelocity,dt);
  if(canMove(moveNext))camera.position.copy(moveNext);
  else{
    moveAxisX.copy(camera.position);moveAxisX.x=moveNext.x;
    moveAxisZ.copy(camera.position);moveAxisZ.z=moveNext.z;
    let slid=false;
    if(canMove(moveAxisX)){camera.position.x=moveAxisX.x;moveVelocity.z=0;slid=true}
    if(canMove(moveAxisZ)){camera.position.z=moveAxisZ.z;moveVelocity.x=0;slid=true}
    if(!slid)moveVelocity.set(0,0,0);
  }
  camera.position.y=1.72;
  footstepNoiseTimer-=dt;if(moving&&footstepNoiseTimer<=0){footstepNoiseTimer=sprinting?.34:.55;audio.playFootstep(worldOverhaul.outdoorBlend>.52?'grass':'hard',{sprinting});enemyAISystem.emitNoise({position:camera.position,type:'footsteps',loudness:sprinting?.8:.42,radius:sprinting?15:8,sourceId:'specter-player',sourceFaction:'specter'})}
}
function restorePower(){
  if(powerOn)return;powerOn=true;worldOverhaul.setPowered(true);
  audio.playBreaker({position:worldOverhaul.breaker.group.getWorldPosition(new THREE.Vector3()),on:true});
  audio.playDoor({position:worldOverhaul.exit.group.getWorldPosition(new THREE.Vector3()),open:true,heavy:true});
  facilityLights.forEach((light,index)=>setTimeout(()=>light.intensity=7.5,index*90));emergency.intensity=1;
  objective.textContent='OBJECTIVE: EXIT THE FACILITY — CLEAR THE EXTERIOR';toast('MAIN BREAKER ENGAGED · EXIT UNLOCKING');hud();
}
function interact(){raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];if(h&&h.distance<2.7)restorePower()}
const objective=document.getElementById('objective');
function completeMission(){
  if(missionWon)return;missionWon=true;started=false;fireHeld=false;setAim(false);controls.unlock?.();
  scopeSurface.visible=false;document.getElementById('scopeOverlay').classList.remove('active');for(const visual of weaponRig[currentWeapon].visuals||[])visual.visible=true;playerArmsRoot.visible=true;
  objective.textContent='MISSION COMPLETE · BLACKSITE SECURED';audio.setCombatIntensity(0,.8);
  document.getElementById('victoryStats').textContent=`${kills} HOSTILES NEUTRALIZED · POWER RESTORED · EXTRACTION REACHED`;
  document.getElementById('victoryPanel').classList.add('active');
}

addEventListener('keydown',e=>{if(e.code==='KeyG'&&!e.repeat){e.preventDefault();toggleGraphicsPanel();return}keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){lightOn=!lightOn;flashlight.visible=lightOn;hud()}if(e.code==='KeyR')reload();if(e.code==='KeyB'&&!e.repeat)toggleMode();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol');if(e.code==='Digit3')switchWeapon('compact');if(e.code==='Digit4')switchWeapon('marksman');if(e.code==='Digit5')switchWeapon('suppressed')});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{if(e.target.closest?.('#graphicsPanel,#graphicsQuickButton'))return;if(!started)return;ensureAudio();if(e.button===0){fireHeld=true;shoot()}if(e.button===2)setAim(embeddedMouseLook?!aiming:true)});
addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2&&!embeddedMouseLook)setAim(false)});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{fireHeld=false;setAim(false);for(const code of Object.keys(keys))keys[code]=false;moveVelocity.set(0,0,0)});
let fallbackPointerX=null,fallbackPointerY=null;
addEventListener('mousemove',e=>{
  const clientDx=fallbackPointerX===null?0:e.clientX-fallbackPointerX;
  const clientDy=fallbackPointerY===null?0:e.clientY-fallbackPointerY;
  fallbackPointerX=e.clientX;fallbackPointerY=e.clientY;
  if(!started)return;
  const dx=controls.isLocked?(Number.isFinite(e.movementX)?e.movementX:0):THREE.MathUtils.clamp(clientDx,-120,120);
  const dy=controls.isLocked?(Number.isFinite(e.movementY)?e.movementY:0):THREE.MathUtils.clamp(clientDy,-120,120);
  if(!controls.isLocked){
    camera.rotation.y-=dx*.002;
    camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.002,-Math.PI/2+.04,Math.PI/2-.04);
  }
  swayX=THREE.MathUtils.clamp(swayX+dx,-55,55);swayY=THREE.MathUtils.clamp(swayY+dy,-45,45);
});

let fallbackNoticeShown=false;
function beginMouseLook(){
  if(embeddedMouseLook){
    if(!fallbackNoticeShown){fallbackNoticeShown=true;toast('EMBEDDED MOUSE LOOK ACTIVE')}
    return;
  }
  try{
    controls.lock();
    setTimeout(()=>{
      if(started&&!controls.isLocked){embeddedMouseLook=true;if(!fallbackNoticeShown){fallbackNoticeShown=true;toast('EMBEDDED MOUSE LOOK ACTIVE')}}
    },180);
  }catch(error){embeddedMouseLook=true;console.warn('Pointer lock unavailable; using embedded mouse look.',error)}
}
document.addEventListener('pointerlockerror',()=>{
  embeddedMouseLook=true;
  if(!fallbackNoticeShown){fallbackNoticeShown=true;toast('EMBEDDED MOUSE LOOK ACTIVE')}
});
const localQAMode=(location.hostname==='127.0.0.1'||location.hostname==='localhost')?new URLSearchParams(location.search).get('qa'):null;
function applyLocalQA(){
  if(localQAMode==='exterior'){restorePower();camera.position.set(0,1.72,-52);previousAIPlayerPosition.copy(camera.position)}
  if(localQAMode==='victory'){
    restorePower();for(const enemy of enemies){if(!enemy.userData.dead){enemy.userData.dead=true;enemy.userData.health=0;enemy.userData.ai?.setHealth(0);kills++}}
    camera.position.copy(extractionPoint);previousAIPlayerPosition.copy(camera.position);hud();
  }
}
startButton.onclick=()=>{started=true;startPanel.style.display='none';ensureAudio();applyLocalQA();beginMouseLook()};
renderer.domElement.onclick=()=>{if(started&&!controls.isLocked&&!embeddedMouseLook)beginMouseLook()};
document.getElementById('restartButton').onclick=()=>location.reload();

await Promise.all([
  loadAudioAssets(),
  loadSetDressAsset('steelShelves','./assets/environment/polyhaven-steel-frame-shelves-01/steel_frame_shelves_01_2k.gltf'),
  loadAsset('ar15','./assets/ar15/scene.gltf'),
  loadAsset('m9','./assets/m9/scene.gltf'),
  loadAsset('soldier','./assets/soldier/scene.gltf')
]);
if(requiredAssetFailure){
  startButton.disabled=true;startButton.textContent='ASSET CHECK FAILED';loadMessage.textContent='A required model or texture failed to load. Check the diagnostics above.';
}else{
  installRifle();installPistol();installRifleVariants();installPlayerModel();installPlayerArms();installIndustrialShelving();attachFlashlightToWeapon(currentWeapon);
  spawnEnemy(-2.5,-8,'rifleman');spawnEnemy(2.9,-18,'scout');spawnEnemy(-1.2,-27,'breacher');
  spawnEnemy(3.8,-54,'rifleman');spawnEnemy(-7.2,-68,'scout');spawnEnemy(8.5,-88,'breacher');spawnEnemy(-5.4,-108,'marksman');spawnEnemy(12,-122,'commander');
  status('soldier','LOADED','8 tactical hostiles · 5 role kits · full-detail rifles');hud();
  startButton.disabled=false;startButton.textContent='ENTER BLACKSITE';loadMessage.textContent='Assets verified. Mission ready.';
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(started){
    move(dt);worldOverhaul.update(dt,camera.position.z);renderer.toneMappingExposure=THREE.MathUtils.lerp(1.14,.72,worldOverhaul.outdoorBlend);weaponFill.intensity=THREE.MathUtils.lerp(4.8,1.45,worldOverhaul.outdoorBlend);
    if(!exteriorEntered&&camera.position.z<-47){exteriorEntered=true;objective.textContent='OBJECTIVE: CLEAR THE CHECKPOINT AND PERIMETER';toast('EXTERIOR COMBAT ZONE ENTERED')}
    updatePlayerModel(t);updateWeapon(dt,t);updateWeaponEffects(dt);updateEnemies(dt,t);
    camera.getWorldDirection(audioForward);const combatIntensity=enemies.reduce((level,enemy)=>Math.max(level,enemy.userData.dead?0:enemy.userData.intent?.alertness||0),0);
    audio.update(dt,{outdoorBlend:worldOverhaul.outdoorBlend,combatIntensity,powerOn,listener:{position:camera.position,forward:audioForward,up:camera.up}});
    if(fireHeld&&fireMode==='auto')shoot();
    if(powerOn&&kills>=enemies.length&&camera.position.distanceTo(extractionPoint)<6.6)completeMission();
    raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];
    promptEl.textContent=h&&h.distance<2.7&&!powerOn?'PRESS E — FLIP MAIN BREAKER':'';
  }
  renderScopeView(dt);graphics.render(dt);
}
animate();

if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
addEventListener('resize',()=>graphics.resize(innerWidth,innerHeight,devicePixelRatio));
