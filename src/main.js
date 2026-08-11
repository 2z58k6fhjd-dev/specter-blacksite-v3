import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { buildSpecterOperator,createSpecterViewMaterials,poseSpecterOperator } from './specter-operator.js?v=5.8.0-fir-lod';
import { buildWorldOverhaul } from './world-overhaul.js?v=5.8.0-fir-lod';
import { EnemyAISystem } from './enemy-ai.js?v=5.8.0-fir-lod';
import { createGraphicsPipeline,GRAPHICS_QUALITY_PRESETS } from './graphics-pipeline.js?v=5.8.0-fir-lod';
import { createAudioDirector } from './audio-overhaul.js?v=5.8.0-fir-lod';
import { createTacticalAnimator,WeaponActionTimeline,TacticalWeaponAction } from './tactical-animation.js?v=5.8.0-fir-lod';

const graphicsCustomStorageKey='specter-custom-graphics';
const voiceSettingsStorageKey='specter-voice-settings';
const startupQualityQuery=String(new URLSearchParams(location.search).get('quality')||'').toLowerCase();
// A link that deliberately selects a tier must be reproducible.  Do not let a
// previous custom menu state silently turn an Intel/QA URL into an Extreme one.
const hasExplicitGraphicsQualityQuery=/^(?:auto|intel|performance|balanced|high|ultra|extreme)$/i.test(startupQualityQuery||'');
let bootGraphicsCustomSettings={};
try{bootGraphicsCustomSettings=hasExplicitGraphicsQualityQuery?{}:JSON.parse(localStorage.getItem(graphicsCustomStorageKey)||'{}')||{}}catch{bootGraphicsCustomSettings={}}
let bootVoiceVolume=.86;
try{
  const savedVoiceSettings=JSON.parse(localStorage.getItem(voiceSettingsStorageKey)||'{}')||{};
  const candidate=Number(savedVoiceSettings.enemyVoiceVolume);
  if(Number.isFinite(candidate))bootVoiceVolume=THREE.MathUtils.clamp(candidate,0,1);
}catch{ /* Embedded previews can reject optional persistent settings. */ }
const renderer = new THREE.WebGLRenderer({antialias:bootGraphicsCustomSettings.antialiasing!=='off',powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.02;
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
const embeddedDesktopRuntime=/(?:chatgpt|codex|electron)/i.test(globalThis.navigator?.userAgent||'');
const pointerLockPolicy=document.permissionsPolicy||document.featurePolicy;
const pointerLockAllowedByPolicy=!pointerLockPolicy||typeof pointerLockPolicy.allowsFeature!=='function'||pointerLockPolicy.allowsFeature('pointer-lock');
const pointerLockSupported=!embeddedDocument&&!embeddedDesktopRuntime&&pointerLockAllowedByPolicy&&typeof renderer.domElement.requestPointerLock==='function'&&'pointerLockElement' in document;
let embeddedMouseLook=!pointerLockSupported;
// The desktop in-app preview has a restricted WebGL compositor. It can render
// the game cleanly at High, but its SSR shader validation is not dependable.
// Keep a requested Extreme tier honest by showing the applied safe fallback;
// ordinary standalone browsers still receive the full 10 GB Extreme preset.
function runtimeGraphicsQuality(quality){return embeddedDesktopRuntime&&quality==='extreme'?'high':quality}

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
let worldOverhaul=null;
// Optional high-vegetation details stream only after the core mission is
// playable. Competitive Low and Low texture-quality custom setups never
// request them, so the low-end path stays lightweight from the first load.
let missionAssetsReady=false;
let forestFernsRoot=null,forestFernLoadPromise=null,forestFernLoadAttempted=false;
let forestHeroFirLoadPromise=null,forestHeroFirLoadAttempted=false;
let graphicsTextureStatus='2K PBR';
let missionHasStarted=false;
const materialTextureSlots=['map','alphaMap','aoMap','bumpMap','displacementMap','emissiveMap','metalnessMap','normalMap','roughnessMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','iridescenceMap','iridescenceThicknessMap','sheenColorMap','sheenRoughnessMap','specularColorMap','specularIntensityMap','transmissionMap','thicknessMap','lightMap'];
const materialTextureBackups=new WeakMap();
const lowWeaponTextureCache=new WeakMap();
const startButton=document.getElementById('startButton'),startPanel=document.getElementById('startPanel'),promptEl=document.getElementById('prompt');
const graphicsButton=document.getElementById('graphicsButton'),graphicsQuickButton=document.getElementById('graphicsQuickButton');
const graphicsPanel=document.getElementById('graphicsPanel'),graphicsCloseButton=document.getElementById('graphicsCloseButton'),graphicsHint=document.getElementById('graphicsHint');
const graphicsResetButton=document.getElementById('graphicsResetButton'),graphicsRenderScale=document.getElementById('graphicsRenderScale'),graphicsRenderScaleValue=document.getElementById('graphicsRenderScaleValue'),graphicsTextureTier=document.getElementById('graphicsTextureTier'),graphicsShadowQuality=document.getElementById('graphicsShadowQuality'),graphicsVegetationDensity=document.getElementById('graphicsVegetationDensity'),graphicsSSAO=document.getElementById('graphicsSSAO'),graphicsSSR=document.getElementById('graphicsSSR'),graphicsBloom=document.getElementById('graphicsBloom'),graphicsAntialias=document.getElementById('graphicsAntialias'),graphicsGrass=document.getElementById('graphicsGrass'),graphicsFog=document.getElementById('graphicsFog'),graphicsVramEstimate=document.getElementById('graphicsVramEstimate');
const enemySubtitle=document.getElementById('enemySubtitle'),voiceVolumeControl=document.getElementById('voiceVolume'),voiceVolumeValue=document.getElementById('voiceVolumeValue'),extractionFade=document.getElementById('extractionFade');
const loadBar=document.getElementById('loadBar'),loadPercent=document.getElementById('loadPercent'),loadMessage=document.getElementById('loadMessage');
const startupQualityKey='specter-graphics-quality';
const AUTO_GRAPHICS_QUALITY='auto';
function isGraphicsQualityChoice(value){return value===AUTO_GRAPHICS_QUALITY||Object.hasOwn(GRAPHICS_QUALITY_PRESETS,value)}
function inspectGraphicsCapabilities(){
  const gl=renderer.getContext(),debugInfo=gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName=debugInfo?String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)||''):'';
  return Object.freeze({
    renderer:rendererName,
    webgl2:typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext,
    maxTextureSize:Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)||0),
    maxRenderbufferSize:Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||0),
    maxSamples:gl.MAX_SAMPLES?Number(gl.getParameter(gl.MAX_SAMPLES)||0):0,
    maxAnisotropy:Number(renderer.capabilities.getMaxAnisotropy?.()||1),
    deviceMemoryGB:Number(navigator.deviceMemory||0),
    cpuCores:Number(navigator.hardwareConcurrency||0),
    displayPixels:Math.max(1,screen.width*screen.height*(devicePixelRatio||1)**2)
  });
}
function recommendedGraphicsQuality(capabilities,benchmarkMs=null){
  const rendererName=capabilities.renderer.toLowerCase();
  const namedIntel=/intel.*(?:hd|4000|4400|4600|5000)/.test(rendererName);
  const limitedTextures=capabilities.maxTextureSize>0&&capabilities.maxTextureSize<=4096;
  const lowReportedMemory=capabilities.deviceMemoryGB>0&&capabilities.deviceMemoryGB<=2;
  // Some privacy-restricted browsers hide the useful renderer name. Treat a
  // genuinely constrained capability set as Intel/Competitive Low instead of
  // relying on a vendor string alone. Each generic branch needs several weak
  // signals so a single conservative WebGL limit cannot demote a capable GPU.
  const legacyConstrainedRenderer=!capabilities.webgl2&&capabilities.maxTextureSize>0&&capabilities.maxTextureSize<=8192&&capabilities.maxRenderbufferSize>0&&capabilities.maxRenderbufferSize<=4096&&capabilities.maxAnisotropy>0&&capabilities.maxAnisotropy<8;
  const constrainedGenericDevice=capabilities.maxTextureSize>0&&capabilities.maxTextureSize<=8192&&capabilities.maxRenderbufferSize>0&&capabilities.maxRenderbufferSize<=8192&&capabilities.maxAnisotropy>0&&capabilities.maxAnisotropy<8&&capabilities.cpuCores>0&&capabilities.cpuCores<=2;
  // A post-warm-up P90 of 38 ms is below a stable 30 FPS. The gameplay sample
  // is deliberately conservative, so sustained timing this slow gets the
  // true low-payload Intel path even when the renderer string is unavailable.
  const verySlowBenchmark=Number.isFinite(benchmarkMs)&&benchmarkMs>=38;
  if(namedIntel||limitedTextures||lowReportedMemory||legacyConstrainedRenderer||constrainedGenericDevice||verySlowBenchmark)return 'intel';
  let rank=capabilities.deviceMemoryGB>=16?4:capabilities.deviceMemoryGB>=10?4:capabilities.deviceMemoryGB>=8?3:capabilities.deviceMemoryGB>=6?2:capabilities.deviceMemoryGB>=4?1:(capabilities.maxTextureSize>=16384&&capabilities.maxAnisotropy>=16?3:capabilities.maxTextureSize>=8192?2:0);
  if(!capabilities.webgl2||capabilities.maxRenderbufferSize<8192)rank=Math.min(rank,1);
  if(capabilities.maxAnisotropy<8)rank=Math.min(rank,1);
  if(capabilities.cpuCores&&capabilities.cpuCores<=4)rank=Math.min(rank,Math.max(0,rank-1));
  if(capabilities.displayPixels>9_000_000)rank=Math.max(0,rank-1);
  // This is a short gameplay sample, not a full combat benchmark. Never let
  // it promote more than one tier above the capability-derived baseline.
  if(Number.isFinite(benchmarkMs)){if(benchmarkMs>29)rank=Math.max(0,rank-2);else if(benchmarkMs>22)rank=Math.max(0,rank-1);else if(benchmarkMs<9)rank=Math.min(4,rank+1);else if(benchmarkMs<12&&rank<4)rank++}
  return ['performance','balanced','high','ultra','extreme'][rank];
}
const startupGraphicsCapabilities=inspectGraphicsCapabilities();
let startupRememberedQuality='';
try{startupRememberedQuality=localStorage.getItem(startupQualityKey)||''}catch{ /* Storage is optional in embedded previews. */ }
const startupGraphicsPreference=isGraphicsQualityChoice(startupQualityQuery)?startupQualityQuery:(isGraphicsQualityChoice(startupRememberedQuality)?startupRememberedQuality:AUTO_GRAPHICS_QUALITY);
const startupGraphicsQuality=startupGraphicsPreference===AUTO_GRAPHICS_QUALITY?recommendedGraphicsQuality(startupGraphicsCapabilities):startupGraphicsPreference;
const startupRuntimeGraphicsQuality=runtimeGraphicsQuality(startupGraphicsQuality);
// Low is a true payload choice on a fresh load, not just a late material
// downgrade. Keep the compact source images in use before GLTFLoader or the
// environment texture loader gets a chance to decode their 2K/4K originals.
const startupLowPayloadMode=startupGraphicsQuality==='intel'||bootGraphicsCustomSettings.textureTier==='low';
const environmentPbrEntries=Object.freeze([
  ['concreteAlbedo','concrete-albedo.webp'],['concreteNormal','concrete-normal.webp'],['concreteOrm','concrete-orm.webp'],
  ['paintedMetalAlbedo','painted-metal-albedo.webp'],['paintedMetalNormal','painted-metal-normal.webp'],['paintedMetalOrm','painted-metal-orm.webp'],
  ['diamondPlateAlbedo','diamond-plate-albedo.webp'],['diamondPlateNormal','diamond-plate-normal.webp'],['diamondPlateOrm','diamond-plate-orm.webp'],
  ['asphaltAlbedo','asphalt-albedo.webp'],['asphaltNormal','asphalt-normal.webp'],['asphaltOrm','asphalt-orm.webp'],
  ['utilityPanelAlbedo','utility-panel-albedo.webp'],['utilityPanelNormal','utility-panel-normal.webp'],['utilityPanelOrm','utility-panel-orm.webp'],
  ['vehiclePaintAlbedo','vehicle-paint-albedo.webp'],['vehiclePaintOrm','vehicle-paint-orm.webp'],
  ['vehicleRubberAlbedo','vehicle-rubber-albedo.webp'],['vehicleRubberNormal','vehicle-rubber-normal.webp'],['vehicleRubberOrm','vehicle-rubber-orm.webp'],
  ['grassSoilAlbedo','grass-soil-albedo.webp'],['grassSoilNormal','grass-soil-normal.webp'],['grassSoilOrm','grass-soil-orm.webp']
]);
let nativeEnvironment4KLoaded=false,nativeEnvironment4KManifestPromise=null,nativeEnvironment4KLoadPromise=null;
function lowPayloadModelTextureUrl(url){
  if(!startupLowPayloadMode)return url;
  try{
    const absolute=new URL(url,location.href),path=decodeURIComponent(absolute.pathname);
    const match=path.match(/\/(assets\/(?:ar15|m9|soldier)\/textures\/[^?#]+|assets\/environment\/polyhaven-(?:concrete-road-barrier-02|plastic-container|power-box-01|steel-frame-shelves-01)\/textures\/[^?#]+)$/);
    if(!match)return url;
    return new URL(`./assets/low-textures/${match[1].slice('assets/'.length)}`,location.href).href;
  }catch{return url}
}
loader.manager.setURLModifier(lowPayloadModelTextureUrl);
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
function loadTexture(textureLoader,url){
  return new Promise((resolve,reject)=>textureLoader.load(url,resolve,undefined,reject));
}
function prepareFoliageTexture(texture,{color=false}={}){
  texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate=true;
  return texture;
}
async function loadHighTierTreeCards(textureLoader){
  // These project-authored card assets are deliberately high-tier only. They
  // add two realistic conifer silhouettes and a normal/roughness response
  // without making the Intel/Low boot path download any foliage artwork.
  try{
    const [firV1,douglasV2,douglasNormal,douglasRoughness]=await Promise.all([
      loadTexture(textureLoader,'./assets/environment/generated/fir-tree-billboard-v1.png'),
      loadTexture(textureLoader,'./assets/environment/generated/douglas-fir-card-v2.png'),
      loadTexture(textureLoader,'./assets/environment/generated/douglas-fir-card-v2-normal.png'),
      loadTexture(textureLoader,'./assets/environment/generated/douglas-fir-card-v2-roughness.png')
    ]);
    environmentTextures.firBillboard=prepareFoliageTexture(firV1,{color:true});
    environmentTextures.firCards=[
      {id:'fir-v1',map:environmentTextures.firBillboard},
      {id:'douglas-fir-v2',map:prepareFoliageTexture(douglasV2,{color:true}),normalMap:prepareFoliageTexture(douglasNormal),roughnessMap:prepareFoliageTexture(douglasRoughness)}
    ];
    return environmentTextures.firCards;
  }catch(error){
    console.info('Optional high-tier conifer cards unavailable; using the instanced procedural forest.',error);
    environmentTextures.firCards=[];
    return environmentTextures.firCards;
  }
}
async function loadEnvironmentAssets(){
  status('environment','LOADING');
  const textureLoader=new THREE.TextureLoader();
  let pbrRoot=startupLowPayloadMode?'./assets/low-textures/environment/pbr-v2':'./assets/environment/pbr-v2';
  const entries=environmentPbrEntries.map(([name,file])=>[name,`${pbrRoot}/${file}`]);
  let completed=0;
  try{
    await Promise.all(entries.map(([name,url])=>new Promise((resolve,reject)=>textureLoader.load(url,texture=>{
      prepareEnvironmentTexture(name,texture);environmentTextures[name]=texture;
      completed++;assetProgress.environment=completed/entries.length;updateLoading();resolve();
    },undefined,reject))));
    // Required 2K (or Low) maps always arrive first. A malformed optional 4K
    // pack can therefore never strand the loading screen; its all-or-nothing
    // upgrade is attempted only after a complete base environment exists.
    if(!startupLowPayloadMode&&startupRuntimeGraphicsQuality==='extreme')await ensureNativeEnvironment4K();
    // This generated foliage set is non-critical. A transient fetch must never
    // block the map or turn the low-end preset into an asset failure.
    if(!startupLowPayloadMode)await loadHighTierTreeCards(textureLoader);
    environmentTextures.native4K=nativeEnvironment4KLoaded;
    status('environment','LOADED',nativeEnvironment4KLoaded?'8 PBR families · native 4K maps':startupLowPayloadMode?'8 PBR families · 512px low payload':'8 PBR families · 23 maps');
  }catch(error){
    console.error(error);requiredAssetFailure=true;assetProgress.environment=1;updateLoading();status('environment','FAILED',error.message);
  }
}
function prepareEnvironmentTexture(name,texture){
  texture.colorSpace=name.endsWith('Albedo')?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  texture.userData.specterEnvironmentKey=name;texture.needsUpdate=true;
  return texture;
}
function nativeEnvironmentManifestIsComplete(manifest){
  const dimensions=manifest?.runtimeFormat?.dimensions;
  if(!Array.isArray(dimensions)||dimensions.length<2||Math.min(Number(dimensions[0])||0,Number(dimensions[1])||0)<4096)return false;
  const records=new Map((manifest.materials||[]).flatMap(material=>material.maps||[]).filter(map=>map?.file).map(map=>[map.file,map]));
  return environmentPbrEntries.every(([,file])=>{
    const record=records.get(file),mapDimensions=record?.dimensions;
    return record&&Array.isArray(mapDimensions)&&mapDimensions.length>=2&&Math.min(Number(mapDimensions[0])||0,Number(mapDimensions[1])||0)>=4096&&Number(record.bytes)>0&&/^[a-f0-9]{64}$/i.test(String(record.sha256||''));
  });
}
async function getNativeEnvironment4KManifest(){
  if(!nativeEnvironment4KManifestPromise)nativeEnvironment4KManifestPromise=(async()=>{
    try{
      const response=await fetch('./assets/environment/pbr-v2-4k/manifest.json',{cache:'no-store'});
      if(!response.ok)return null;
      const manifest=await response.json();
      return nativeEnvironmentManifestIsComplete(manifest)?manifest:null;
    }catch{return null}
  })();
  return nativeEnvironment4KManifestPromise;
}
function replaceEnvironmentTextureSource(name,source){
  const target=environmentTextures[name];
  if(!target){environmentTextures[name]=source;return}
  target.image=source.image;target.needsUpdate=true;
  scene.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of (Array.isArray(object.material)?object.material:[object.material]))for(const slot of materialTextureSlots){
      const texture=material?.[slot];
      if(texture?.userData?.specterEnvironmentKey===name){texture.image=source.image;texture.needsUpdate=true}
    }
  });
}
async function ensureNativeEnvironment4K(){
  if(nativeEnvironment4KLoaded)return true;
  if(!nativeEnvironment4KLoadPromise)nativeEnvironment4KLoadPromise=(async()=>{
    if(!await getNativeEnvironment4KManifest())return false;
    const loaded=[];
    try{
      const textureLoader=new THREE.TextureLoader();
      // Preserve the verified base pack until every optional map has decoded
      // and demonstrated that it is genuinely native 4K.  A partial upgrade
      // must never replace only some of the environment material inputs.
      for(const [name,file] of environmentPbrEntries){
        const texture=prepareEnvironmentTexture(name,await loadTexture(textureLoader,`./assets/environment/pbr-v2-4k/${file}`));
        const width=Number(texture.image?.naturalWidth||texture.image?.width||0),height=Number(texture.image?.naturalHeight||texture.image?.height||0);
        if(Math.min(width,height)<4096)throw new Error(`${file} is not a native 4K image.`);
        loaded.push([name,texture]);
      }
      for(const [name,texture] of loaded)replaceEnvironmentTextureSource(name,texture);
      nativeEnvironment4KLoaded=true;environmentTextures.native4K=true;
      status('environment','LOADED','8 PBR families · native 4K maps');
      return true;
    }catch(error){
      for(const [,texture] of loaded)texture.dispose();
      console.info('Native 4K environment pack could not be loaded; retaining the verified lower-resolution pack.',error);
      return false;
    }
  })();
  return nativeEnvironment4KLoadPromise;
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
async function loadSetDressAsset(name,url,label='CC0 set-dressing prop'){
  status('props','LOADING');
  try{
    const gltf=await new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
    let meshes=0;
    gltf.scene.traverse(object=>{if(object.isMesh){meshes++;object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true}});
    assetMap.set(name,gltf);assetProgress.props=1;updateLoading();
    status('props','LOADED',`${meshes} mesh ${label}`);
    return true;
  }catch(error){
    console.warn(`Optional set-dressing asset ${name} unavailable; procedural props remain active.`,error);
    assetProgress.props=1;updateLoading();status('props','LOADED','procedural prop fallback');
    return false;
  }
}
async function loadForestFernAsset(){
  const available=await loadSetDressAsset('fern02','./assets/environment/polyhaven-fern-02/fern_02_4k.gltf','CC0 4K forest fern');
  if(!available)return false;
  try{
    // Fern 02's browser glTF refers to a JPEG base-color map. The official
    // alpha mask is loaded beside it so its MASK material retains scanned leaf
    // cutouts instead of rendering opaque cards in WebGL.
    const alphaMask=await new Promise((resolve,reject)=>new THREE.TextureLoader().load('./assets/environment/polyhaven-fern-02/textures/fern_02_alpha_4k.png',resolve,undefined,reject));
    alphaMask.colorSpace=THREE.NoColorSpace;alphaMask.flipY=false;alphaMask.wrapS=alphaMask.wrapT=THREE.ClampToEdgeWrapping;
    alphaMask.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());alphaMask.needsUpdate=true;
    const source=assetMap.get('fern02')?.scene;
    if(!source)throw new Error('Fern 02 source scene was unavailable after loading.');
    source.traverse(object=>{
      if(!object.isMesh)return;
      for(const material of (Array.isArray(object.material)?object.material:[object.material])){
        if(!material)continue;
        material.alphaMap=alphaMask;material.alphaTest=Math.max(.5,Number(material.alphaTest)||0);
        material.transparent=false;material.depthWrite=true;material.side=THREE.DoubleSide;material.needsUpdate=true;
      }
    });
    return true;
  }catch(error){
    // Do not show an unmasked fern as a white/opaque cutout if a partial
    // download is interrupted. The existing procedural forest remains active.
    assetMap.delete('fern02');
    console.warn('Optional Fern 02 alpha mask unavailable; using procedural forest foliage.',error);
    status('props','LOADED','procedural forest fallback');
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

function applyTextureSampling(texture,anisotropy){
  if(!texture?.isTexture)return;
  texture.anisotropy=anisotropy;texture.needsUpdate=true;
}
function reducedWeaponTexture(source,maxDimension=512){
  if(!source?.isTexture)return source||null;
  // A live scope uses a WebGL render target rather than a browser image. It
  // must remain live at every quality tier, never be copied through Canvas.
  if(source.isRenderTargetTexture||source.isFramebufferTexture||source.isDataTexture||source.isCompressedTexture)return source;
  const image=source.image;
  const drawable=Boolean(image)&&(
    typeof HTMLImageElement!=='undefined'&&image instanceof HTMLImageElement||
    typeof HTMLCanvasElement!=='undefined'&&image instanceof HTMLCanvasElement||
    typeof HTMLVideoElement!=='undefined'&&image instanceof HTMLVideoElement||
    typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap||
    typeof OffscreenCanvas!=='undefined'&&image instanceof OffscreenCanvas||
    typeof SVGImageElement!=='undefined'&&image instanceof SVGImageElement||
    typeof VideoFrame!=='undefined'&&image instanceof VideoFrame
  );
  if(!drawable)return source;
  const width=Number(image.naturalWidth||image.videoWidth||image.width||0),height=Number(image.naturalHeight||image.videoHeight||image.height||0);
  if(!image||Math.max(width,height)<=maxDimension)return source;
  const cached=lowWeaponTextureCache.get(source);if(cached)return cached;
  try{
    const scale=maxDimension/Math.max(width,height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d',{alpha:true});context.drawImage(image,0,0,canvas.width,canvas.height);
    const reduced=new THREE.CanvasTexture(canvas);
    reduced.colorSpace=source.colorSpace;reduced.flipY=source.flipY;reduced.premultiplyAlpha=source.premultiplyAlpha;
    reduced.wrapS=source.wrapS;reduced.wrapT=source.wrapT;reduced.repeat.copy(source.repeat);reduced.offset.copy(source.offset);reduced.center.copy(source.center);reduced.rotation=source.rotation;
    reduced.minFilter=THREE.LinearMipmapLinearFilter;reduced.magFilter=THREE.LinearFilter;reduced.generateMipmaps=true;reduced.anisotropy=1;reduced.needsUpdate=true;
    lowWeaponTextureCache.set(source,reduced);return reduced;
  }catch(error){console.warn('Weapon texture reduction unavailable; keeping the source texture.',error);return source}
}
function applyMaterialTextureTier(material,textureTier,anisotropy,keepReducedTexture=false,releasedTextures=null){
  if(!material)return;
  let backup=materialTextureBackups.get(material);
  if(!backup){backup={};for(const slot of materialTextureSlots)backup[slot]=material[slot]||null;materialTextureBackups.set(material,backup)}
  if(textureTier==='low'){
    for(const slot of materialTextureSlots){
      const source=backup[slot],replacement=keepReducedTexture?reducedWeaponTexture(source):null;
      material[slot]=replacement;
      // Texture.dispose() only releases the GPU allocation; it preserves the
      // decoded source image so a later high-tier switch can re-upload it.
      if(source?.isTexture&&source.image&&source!==replacement&&releasedTextures&&!releasedTextures.has(source)){releasedTextures.add(source);source.dispose()}
    }
  }else{
    for(const slot of materialTextureSlots)if(backup[slot]){material[slot]=backup[slot];applyTextureSampling(backup[slot],anisotropy)}
  }
  material.needsUpdate=true;
}
function graphicsRenderTargetEstimate(){
  const targets=new Set(),visited=new WeakSet(),candidateKeys=/(?:renderTarget|renderTargets|readBuffer|writeBuffer|beauty|normal|depth|blur|mask|outputBuffer)/i;
  const inspect=(value,depth=0)=>{
    if(!value||typeof value!=='object'||depth>3||visited.has(value))return;
    visited.add(value);
    if(value.isWebGLRenderTarget){targets.add(value);return}
    if(Array.isArray(value)){for(const item of value)inspect(item,depth+1);return}
    for(const [key,item] of Object.entries(value))if(candidateKeys.test(key))inspect(item,depth+1);
  };
  inspect(graphics?.composer);
  for(const pass of Object.values(graphics?.passes||{}))inspect(pass);
  let bytes=0;
  for(const target of targets){
    const pixels=Math.max(0,(target.width||0)*(target.height||0));
    const textures=target.textures?.length?target.textures:(target.texture?[target.texture]:[]);
    const colorBytes=textures.reduce((total,texture)=>{
      const bytesPerPixel=texture?.type===THREE.FloatType?16:texture?.type===THREE.HalfFloatType?8:4;
      return total+pixels*bytesPerPixel;
    },0);
    const depthBytes=target.depthBuffer?pixels*4:0,stencilBytes=target.stencilBuffer?pixels:0;
    // Multisampled buffers require a transient copy in addition to the resolve.
    bytes+=colorBytes+depthBytes+stencilBytes+(target.samples>0?(colorBytes+depthBytes+stencilBytes):0);
  }
  return {bytes,count:targets.size};
}
function graphicsMemoryEstimate(preset){
  const textures=new Set(),geometries=new Set(),instanceBuffers=new Set(),skeletonBuffers=new Set();let textureBytes=0,geometryBytes=0,instanceBytes=0,skeletonBytes=0;
  scene.traverse(object=>{
    if(object.isMesh&&object.geometry&&!geometries.has(object.geometry)){
      geometries.add(object.geometry);
      for(const attribute of Object.values(object.geometry.attributes||{}))geometryBytes+=attribute?.array?.byteLength||0;
      geometryBytes+=object.geometry.index?.array?.byteLength||0;
    }
    if(object.isInstancedMesh)for(const attribute of [object.instanceMatrix,object.instanceColor])if(attribute?.array&&!instanceBuffers.has(attribute)){instanceBuffers.add(attribute);instanceBytes+=attribute.array.byteLength}
    if(object.isSkinnedMesh&&object.skeleton?.boneMatrices&&!skeletonBuffers.has(object.skeleton)){skeletonBuffers.add(object.skeleton);skeletonBytes+=object.skeleton.boneMatrices.byteLength||0}
    if(!object.isMesh&&!object.isSprite)return;
    for(const material of (Array.isArray(object.material)?object.material:[object.material]))for(const slot of materialTextureSlots){
      const texture=material?.[slot],image=texture?.image;
      if(texture?.isTexture&&!textures.has(texture)){textures.add(texture);textureBytes+=(image?.width||0)*(image?.height||0)*4*1.333}
    }
  });
  const ratio=Math.min(devicePixelRatio||1,preset.pixelRatioCap||1),pixels=Math.max(1,innerWidth*innerHeight*ratio*ratio);
  const actualTargets=graphicsRenderTargetEstimate();
  const targetCount=preset.postProcessing===false?0:2+(preset.ambientOcclusion?1:0)+(preset.screenSpaceReflections?5:0)+(preset.bloom?2:0);
  const targetBytes=actualTargets.bytes||pixels*8*targetCount;
  const shadowBytes=preset.shadows&&preset.shadowMapSize?(preset.shadowMapSize*preset.shadowMapSize*4*1.333):0;
  const totalBytes=textureBytes+geometryBytes+instanceBytes+skeletonBytes+targetBytes+shadowBytes;
  return {textureMB:textureBytes/1048576,geometryMB:geometryBytes/1048576,instanceMB:instanceBytes/1048576,skeletonMB:skeletonBytes/1048576,targetMB:targetBytes/1048576,targetCount:actualTargets.count||targetCount,shadowMB:shadowBytes/1048576,totalMB:totalBytes/1048576};
}
function renderGraphicsMemoryEstimate(preset=graphics?.getDiagnostics?.().preset){
  if(!preset||!graphicsVramEstimate)return;
  const estimate=graphicsMemoryEstimate(preset),total=estimate.totalMB>=1024?`${(estimate.totalMB/1024).toFixed(2)} GB`:`${Math.round(estimate.totalMB)} MB`;
  graphicsVramEstimate.textContent=`EST. GPU MEMORY: ${total} · textures ${Math.round(estimate.textureMB)} MB · geometry ${Math.round(estimate.geometryMB)} MB · targets ${Math.round(estimate.targetMB)} MB · shadows ${Math.round(estimate.shadowMB)} MB`;
}
function applyGraphicsHardwareBudget(quality,effectivePreset=null){
  const requestedPreset=effectivePreset||GRAPHICS_QUALITY_PRESETS[quality]||GRAPHICS_QUALITY_PRESETS.high;
  // Loading the actual 512px sources is a boot-time decision: it prevents the
  // original 2K/4K images from decoding at all.  Preserve the currently loaded
  // material maps during a live High-to-Low change and make the reload need
  // explicit instead of replacing the world with blank stand-in materials.
  const lowTexturesReloadPending=requestedPreset.textureTier==='low'&&!startupLowPayloadMode;
  const highTexturesReloadPending=requestedPreset.textureTier!=='low'&&startupLowPayloadMode;
  const textureReloadPending=lowTexturesReloadPending||highTexturesReloadPending;
  const activeTextureTier=textureReloadPending?(startupLowPayloadMode?'low':'standard'):requestedPreset.textureTier;
  const preset=activeTextureTier===requestedPreset.textureTier?requestedPreset:{...requestedPreset,textureTier:activeTextureTier};
  const maxAnisotropy=renderer.capabilities.getMaxAnisotropy?.()||1;
  const anisotropy=Math.min(maxAnisotropy,requestedPreset.textureAnisotropy||1);
  const releasedTextures=activeTextureTier==='low'?new Set():null;
  const keepLowPayloadTextures=startupLowPayloadMode&&preset.textureTier==='low';
  renderer.shadowMap.enabled=Boolean(preset.shadows);
  renderer.shadowMap.type=!preset.shadows||quality==='performance'||quality==='intel'?THREE.BasicShadowMap:THREE.PCFSoftShadowMap;
  for(const texture of Object.values(environmentTextures)){
    if(Array.isArray(texture))for(const card of texture)for(const map of [card?.map,card?.normalMap,card?.roughnessMap])applyTextureSampling(map,anisotropy);
    else applyTextureSampling(texture,anisotropy);
  }
  scene.traverse(object=>{
    if(!object.isMesh)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    for(const material of materials)applyMaterialTextureTier(material,preset.textureTier,anisotropy,Boolean(object.userData.specterViewmodel)||keepLowPayloadTextures,releasedTextures);
  });
  const environmentIs4K=environmentPbrEntries.every(([name])=>Math.max(environmentTextures[name]?.image?.width||0,environmentTextures[name]?.image?.height||0)>=4096);
  graphicsTextureStatus=lowTexturesReloadPending?'LOW 512 PBR ON RELOAD':highTexturesReloadPending?'HIGH TEXTURES ON RELOAD':preset.textureTier==='4k-preferred'?(environmentIs4K?'NATIVE 4K PBR':'2K PBR FALLBACK'):(preset.textureTier==='low'?'LOW-PAYLOAD 512 PBR':'2K PBR');
  worldOverhaul?.setGraphicsQuality(quality,preset);
  updateForestFernsForGraphics(preset);
  updateForestHeroFirsForGraphics(preset);
  renderGraphicsMemoryEstimate(preset);
  if(preset.textureTier==='4k-preferred'&&!environmentIs4K)void ensureNativeEnvironment4K().then(loaded=>{
    if(!loaded)return;
    const current=graphics?.getDiagnostics?.();
    if(!current||current.preset.textureTier!=='4k-preferred')return;
    applyGraphicsHardwareBudget(current.quality,current.preset);renderGraphicsControls(current);
  });
  return {anisotropy,textureStatus:graphicsTextureStatus,textureReloadPending};
}

const qualityStorageKey='specter-graphics-quality';
const requestedGraphicsQuality=startupRuntimeGraphicsQuality;
const graphics=await createGraphicsPipeline({renderer,scene,camera,quality:requestedGraphicsQuality,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio});
let activeGraphicsPreference=startupGraphicsPreference;
const savedRuntimeCustomSettings=Object.fromEntries(Object.entries(bootGraphicsCustomSettings).filter(([key])=>key!=='antialiasing'));
if(Object.keys(savedRuntimeCustomSettings).length)graphics.setCustomSettings(savedRuntimeCustomSettings);
let graphicsDiagnostics=graphics.getDiagnostics();
applyGraphicsHardwareBudget(requestedGraphicsQuality,graphicsDiagnostics.preset);
status('graphics','LOADED',`${graphicsDiagnostics.preset.label} · ${graphicsDiagnostics.ambientOcclusionEnabled?'SSAO':'direct'}${graphicsDiagnostics.screenSpaceReflectionsEnabled?' + SSR':''}${graphicsDiagnostics.bloomEnabled?' + bloom':''}`);

function graphicsSummary(diagnostics=graphics.getDiagnostics()){
  const preset=diagnostics.preset;
  const mode=activeGraphicsPreference===AUTO_GRAPHICS_QUALITY?`AUTO → ${preset.label.toUpperCase()}`:activeGraphicsPreference!==diagnostics.quality?`${activeGraphicsPreference.toUpperCase()} SAFE FALLBACK → ${preset.label.toUpperCase()}`:preset.label.toUpperCase();
  return `${mode} · ${diagnostics.ambientOcclusionEnabled?'SSAO':'DIRECT'}${diagnostics.screenSpaceReflectionsEnabled?' + SSR':''}${diagnostics.bloomEnabled?' + BLOOM':''} · ${graphicsTextureStatus}`;
}
function graphicsCustomDraft(){
  const shadowMapSize=Number(graphicsShadowQuality.value)||0,textureTier=graphicsTextureTier.value;
  const requestedPostEffects=graphicsSSAO.checked||graphicsSSR.checked||graphicsBloom.checked;
  const basePostProcessing=GRAPHICS_QUALITY_PRESETS[graphicsDiagnostics?.quality]?.postProcessing!==false;
  return {
    pixelRatioCap:Number(graphicsRenderScale.value),textureTier,textureAnisotropy:{low:1,standard:4,high:8,'4k-preferred':16}[textureTier]||4,
    shadows:shadowMapSize>0,shadowMapSize,postProcessing:basePostProcessing||requestedPostEffects,ambientOcclusion:graphicsSSAO.checked,
    screenSpaceReflections:graphicsSSR.checked,bloom:graphicsBloom.checked,grassEnabled:graphicsGrass.checked,
    forestDensity:graphicsVegetationDensity.value,fogEnabled:graphicsFog.checked
  };
}
function syncGraphicsCustomControls(diagnostics=graphics.getDiagnostics()){
  const preset=diagnostics.preset;
  graphicsRenderScale.value=String(preset.pixelRatioCap);graphicsRenderScaleValue.textContent=`${Number(preset.pixelRatioCap).toFixed(2)}×`;
  graphicsTextureTier.value=preset.textureTier||'standard';graphicsShadowQuality.value=String(preset.shadows?preset.shadowMapSize:0);
  graphicsVegetationDensity.value=['off','low','medium','high','ultra','extreme'].includes(preset.forestDensity)?preset.forestDensity:'medium';
  graphicsSSAO.checked=Boolean(preset.ambientOcclusion);graphicsSSR.checked=Boolean(preset.screenSpaceReflections);graphicsBloom.checked=Boolean(preset.bloom);
  graphicsGrass.checked=Boolean(preset.grassEnabled);graphicsFog.checked=preset.fogEnabled!==false;
  graphicsAntialias.checked=bootGraphicsCustomSettings.antialiasing!=='off';renderGraphicsMemoryEstimate(graphicsCustomDraft());
}
function renderGraphicsControls(diagnostics=graphics.getDiagnostics()){
  graphicsDiagnostics=diagnostics;
  const summary=graphicsSummary(diagnostics);
  graphicsButton.textContent=`GRAPHICS: ${summary}`;
  graphicsHint.textContent=`${summary} · ${diagnostics.effectivePixelRatio.toFixed(2)}× RENDER SCALE`;
  graphicsQuickButton.textContent=`GFX · ${diagnostics.quality.toUpperCase()}`;
  document.querySelectorAll('[data-quality]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.quality===activeGraphicsPreference)));
  syncGraphicsCustomControls(diagnostics);
  status('graphics','LOADED',summary);
}
function refreshGraphicsDiagnostics(){
  const latest=graphics.getDiagnostics();
  const current=graphicsDiagnostics;
  if(!current||latest.mode!==current.mode||latest.ambientOcclusionEnabled!==current.ambientOcclusionEnabled||latest.screenSpaceReflectionsEnabled!==current.screenSpaceReflectionsEnabled||latest.bloomEnabled!==current.bloomEnabled||latest.fallback!==current.fallback)renderGraphicsControls(latest);
}
const autoBenchmark={active:false,pending:false,samples:[],warmupFrames:45,warmup:0,minimumFrames:120,hitches:0};
function cancelAutoGraphicsBenchmark(){autoBenchmark.active=false;autoBenchmark.pending=false;autoBenchmark.samples.length=0;autoBenchmark.warmup=0;autoBenchmark.hitches=0}
function beginAutoGraphicsBenchmark(){
  autoBenchmark.active=false;autoBenchmark.samples.length=0;autoBenchmark.warmup=autoBenchmark.warmupFrames;autoBenchmark.hitches=0;
  if(!missionHasStarted){
    autoBenchmark.pending=true;graphicsHint.textContent='AUTO BENCHMARK — begins after entering the mission.';
    return;
  }
  autoBenchmark.pending=false;autoBenchmark.active=true;
  graphicsHint.textContent='AUTO BENCHMARK — measuring active gameplay…';
}
function finishAutoGraphicsBenchmark(){
  if(!autoBenchmark.active||activeGraphicsPreference!==AUTO_GRAPHICS_QUALITY||autoBenchmark.samples.length<autoBenchmark.minimumFrames)return;
  autoBenchmark.active=false;const sorted=[...autoBenchmark.samples].sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.9)];
  // Retain long-frame stalls as a conservative score penalty instead of
  // silently excluding them from the AUTO recommendation.
  const scoredP90=autoBenchmark.hitches>=2?Math.max(p90,24):p90;
  const selected=recommendedGraphicsQuality(startupGraphicsCapabilities,scoredP90),runtimeSelected=runtimeGraphicsQuality(selected),diagnostics=graphics.setQuality(runtimeSelected);
  applyGraphicsHardwareBudget(runtimeSelected,diagnostics.preset);renderGraphicsControls(diagnostics);
  toast(`AUTO GRAPHICS → ${runtimeSelected.toUpperCase()} (${Math.round(p90)} MS P90)`);
}
function sampleAutoGraphicsBenchmark(deltaSeconds){
  if(!autoBenchmark.active||!Number.isFinite(deltaSeconds)||deltaSeconds<=0)return;
  if(deltaSeconds>.35){autoBenchmark.hitches++;return}
  if(autoBenchmark.warmup>0){autoBenchmark.warmup--;return}
  autoBenchmark.samples.push(deltaSeconds*1000);finishAutoGraphicsBenchmark();
}
function setGraphicsQuality(quality,{persist=true}={}){
  if(!isGraphicsQualityChoice(quality))return;
  const isAuto=quality===AUTO_GRAPHICS_QUALITY,selected=isAuto?recommendedGraphicsQuality(startupGraphicsCapabilities):quality,runtimeSelected=runtimeGraphicsQuality(selected);
  cancelAutoGraphicsBenchmark();activeGraphicsPreference=quality;
  const diagnostics=graphics.setQuality(runtimeSelected);
  applyGraphicsHardwareBudget(runtimeSelected,diagnostics.preset);
  if(isAuto)beginAutoGraphicsBenchmark();
  if(persist){try{localStorage.setItem(qualityStorageKey,quality);localStorage.removeItem(graphicsCustomStorageKey)}catch{ /* Embedded previews can reject persistent storage. */ }}
  renderGraphicsControls(diagnostics);
  toast(`GRAPHICS · ${isAuto?'AUTO':diagnostics.preset.label.toUpperCase()}`);
}
function applyCustomGraphicsSettings(){
  cancelAutoGraphicsBenchmark();
  const customSettings=graphicsCustomDraft(),diagnostics=graphics.setCustomSettings(customSettings);
  activeGraphicsPreference=diagnostics.quality;applyGraphicsHardwareBudget(diagnostics.quality,diagnostics.preset);
  bootGraphicsCustomSettings={...customSettings,antialiasing:graphicsAntialias.checked?'on':'off'};
  try{localStorage.setItem(qualityStorageKey,diagnostics.quality);localStorage.setItem(graphicsCustomStorageKey,JSON.stringify(bootGraphicsCustomSettings))}catch{ /* Embedded previews can reject persistent storage. */ }
  renderGraphicsControls(diagnostics);
}
function resetCustomGraphicsSettings(){
  cancelAutoGraphicsBenchmark();bootGraphicsCustomSettings={};try{localStorage.removeItem(graphicsCustomStorageKey)}catch{ /* Storage is optional. */ }
  const diagnostics=graphics.clearCustomSettings();activeGraphicsPreference=diagnostics.quality;applyGraphicsHardwareBudget(diagnostics.quality,diagnostics.preset);renderGraphicsControls(diagnostics);toast('GRAPHICS CUSTOM SETTINGS RESET');
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
graphicsRenderScale.oninput=()=>{graphicsRenderScaleValue.textContent=`${Number(graphicsRenderScale.value).toFixed(2)}×`;renderGraphicsMemoryEstimate(graphicsCustomDraft())};
for(const control of [graphicsRenderScale,graphicsTextureTier,graphicsShadowQuality,graphicsVegetationDensity,graphicsSSAO,graphicsSSR,graphicsBloom,graphicsAntialias,graphicsGrass,graphicsFog])control.onchange=applyCustomGraphicsSettings;
graphicsResetButton.onclick=resetCustomGraphicsSettings;
renderGraphicsControls(graphicsDiagnostics);
if(activeGraphicsPreference===AUTO_GRAPHICS_QUALITY)beginAutoGraphicsBenchmark();

function tiledTexture(source,x,y,color=true){
  if(!source)return null;const texture=source.clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(x,y);texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
  if(source.userData?.specterEnvironmentKey)texture.userData.specterEnvironmentKey=source.userData.specterEnvironmentKey;
  texture.needsUpdate=true;return texture;
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

worldOverhaul=buildWorldOverhaul({scene,collision,environmentTextures,facilityLights});
applyGraphicsHardwareBudget(graphics.getDiagnostics().quality,graphics.getDiagnostics().preset);
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
function installPowerBox(){
  const source=assetMap.get('powerBox')?.scene;if(!source)return;
  const breaker=worldOverhaul.breaker;
  const cabinetRoot=new THREE.Group();cabinetRoot.name='cc0-power-box-cabinet';
  const cabinet=source.clone(true);cabinet.name='power-box-01-2k';
  // The source cabinet has a separate static door. Hide it so the existing
  // mission-critical door, lamps, and lever keep their real-time animation.
  // Hide it before fitting the cabinet so the body centers exactly on the
  // recessed frame instead of inheriting the source door's open-pose bounds.
  cabinet.traverse(object=>{
    if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true}
    if(object.name==='power_box_01_door')object.visible=false;
  });
  normalize(cabinet,1.26,true);cabinet.position.set(0,-.63,.015);cabinetRoot.add(cabinet);breaker.group.add(cabinetRoot);
  for(const name of ['breaker-enclosure','breaker-inset','breaker-hinge']){
    const authoredPart=breaker.group.getObjectByName(name);if(authoredPart)authoredPart.visible=false;
  }
}
function installPlasticContainers(){
  const source=assetMap.get('plasticContainer')?.scene;if(!source)return 0;
  const placements=[
    {x:-9.2,z:-96.4,rotation:.2,scale:.95},{x:-11.6,z:-99.1,rotation:-.42,scale:.76},
    {x:-8.1,z:-102.2,rotation:.78,scale:.68},{x:-15.5,z:-112.1,rotation:-.18,scale:.9},
    {x:9.4,z:-76.5,rotation:.4,scale:.84},{x:20.2,z:-87.6,rotation:-.72,scale:.72}
  ];
  for(const [index,placement] of placements.entries()){
    const root=new THREE.Group();root.name=`cc0-plastic-container-${index+1}`;root.position.set(placement.x,0,placement.z);root.rotation.y=placement.rotation;
    const container=source.clone(true);normalize(container,.92,true);container.scale.multiplyScalar(placement.scale);container.name=`plastic-container-${index+1}`;
    container.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true}});
    root.add(container);scene.add(root);collision.push(root);root.updateWorldMatrix(true,true);staticColliderBounds.push(new THREE.Box3().setFromObject(root).expandByScalar(.08));
  }
  return placements.length;
}
function installRoadBarriers(){
  const source=assetMap.get('roadBarrier')?.scene;if(!source)return 0;
  // Keep the central route clear while giving the checkpoint, motor pool, and
  // perimeter enough real hard cover for the tactical AI to use visually.
  const placements=[
    {x:-3.9,z:-56.5,rotation:0,scale:1},{x:3.9,z:-56.5,rotation:0,scale:1},
    {x:-17.4,z:-81.6,rotation:Math.PI/2,scale:.94},{x:17.8,z:-94.3,rotation:Math.PI/2,scale:.96},
    {x:-12.6,z:-105.4,rotation:.16,scale:.9},{x:11.8,z:-116.5,rotation:-.22,scale:.92}
  ];
  for(const [index,placement] of placements.entries()){
    const root=new THREE.Group();root.name=`cc0-road-barrier-${index+1}`;root.position.set(placement.x,0,placement.z);root.rotation.y=placement.rotation;
    const barrier=source.clone(true);normalize(barrier,1.62,true);barrier.scale.multiplyScalar(placement.scale);barrier.name=`concrete-road-barrier-02-${index+1}`;
    barrier.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true}});
    root.add(barrier);scene.add(root);collision.push(root);root.updateWorldMatrix(true,true);staticColliderBounds.push(new THREE.Box3().setFromObject(root).expandByScalar(.12));
  }
  return placements.length;
}
function forestFernsEnabledForPreset(preset={}){
  const density=String(preset.forestDensity||'').toLowerCase();
  return preset.textureTier!=='low'&&['high','ultra','extreme'].includes(density);
}
function installForestFerns(){
  if(forestFernsRoot)return forestFernsRoot.children.length;
  const source=assetMap.get('fern02')?.scene;if(!source)return 0;
  // Sparse foreground clusters add real scanned leaf detail around the fence
  // and extraction approach without making a 6K-triangle clump a forest-wide
  // draw-call burden. They are visual only and never affect collision.
  const placements=[
    {x:-36.8,z:-68.2,rotation:.18,scale:.82},{x:36.5,z:-73.1,rotation:-.44,scale:1.04},
    {x:-35.7,z:-94.4,rotation:.74,scale:.96},{x:36.8,z:-103.6,rotation:-.26,scale:.76},
    {x:-34.9,z:-124.8,rotation:-.52,scale:1.08},{x:35.8,z:-136.4,rotation:.32,scale:.89},
    {x:-35.9,z:-154.6,rotation:.62,scale:.94},{x:35.2,z:-163.8,rotation:-.68,scale:1.1},
    {x:-17.8,z:-181.9,rotation:.4,scale:.88},{x:17.1,z:-182.7,rotation:-.22,scale:1.05},
    {x:-10.8,z:-189.6,rotation:.86,scale:.78},{x:11.7,z:-192.2,rotation:-.51,scale:.98},
    {x:-26.4,z:-198.3,rotation:.13,scale:1.06},{x:26.8,z:-201.8,rotation:-.77,scale:.84},
    {x:-4.8,z:-207.4,rotation:.28,scale:.94},{x:5.6,z:-210.1,rotation:-.32,scale:.76}
  ];
  const root=new THREE.Group();root.name='cc0-forest-fern-dressing';
  for(const [index,placement] of placements.entries()){
    const holder=new THREE.Group();holder.name=`cc0-fern-02-${index+1}`;holder.position.set(placement.x,0,placement.z);holder.rotation.y=placement.rotation;
    const fern=source.clone(true);normalize(fern,1.35,true);fern.scale.multiplyScalar(placement.scale);fern.name=`fern-02-4k-${index+1}`;
    fern.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=true;object.frustumCulled=true}});
    holder.add(fern);root.add(holder);
  }
  scene.add(root);forestFernsRoot=root;
  return placements.length;
}
function updateForestFernsForGraphics(preset={}){
  const enabled=forestFernsEnabledForPreset(preset);
  if(forestFernsRoot){forestFernsRoot.visible=enabled;return}
  // Initial graphics setup happens before the world is constructed. Hold this
  // optional 4K source until the core mission has finished its required check.
  if(!enabled||!missionAssetsReady||!worldOverhaul||forestFernLoadAttempted)return;
  forestFernLoadAttempted=true;
  forestFernLoadPromise=loadForestFernAsset()
    .then(available=>{
      if(!available)return;
      const count=installForestFerns();
      if(count){
        const diagnostics=graphics.getDiagnostics();
        forestFernsRoot.visible=forestFernsEnabledForPreset(diagnostics.preset);
        // A user can switch back to Competitive Low while the optional glTF is
        // still streaming. Reapply the active budget once it arrives so hidden
        // foliage cannot retain full-resolution textures in that edge case.
        applyGraphicsHardwareBudget(diagnostics.quality,diagnostics.preset);
        status('props','LOADED',`${count} CC0 forest ferns · high vegetation detail`);
      }
    })
    .finally(()=>{forestFernLoadPromise=null});
}
function forestHeroFirsEnabledForPreset(preset={}){
  const density=String(preset.forestDensity||'').toLowerCase();
  return preset.textureTier!=='low'&&['high','ultra','extreme'].includes(density);
}
async function loadForestHeroFirAssets(){
  const [lod0,lod1]=await Promise.all([
    loadSetDressAsset('firSaplingLod0','./assets/environment/polyhaven-fir-sapling-runtime/fir_sapling_lod0.gltf','CC0 Fir Sapling LOD0'),
    loadSetDressAsset('firSaplingLod1','./assets/environment/polyhaven-fir-sapling-runtime/fir_sapling_lod1.gltf','CC0 Fir Sapling LOD1')
  ]);
  return Boolean(lod0&&lod1&&assetMap.get('firSaplingLod0')?.scene&&assetMap.get('firSaplingLod1')?.scene);
}
function updateForestHeroFirsForGraphics(preset={}){
  const enabled=forestHeroFirsEnabledForPreset(preset);
  if(!enabled||!missionAssetsReady||!worldOverhaul?.forest||forestHeroFirLoadAttempted)return;
  forestHeroFirLoadAttempted=true;
  forestHeroFirLoadPromise=loadForestHeroFirAssets()
    .then(available=>{
      if(!available)return;
      const count=worldOverhaul.forest.installHeroSaplings(assetMap.get('firSaplingLod0')?.scene,assetMap.get('firSaplingLod1')?.scene);
      if(count){
        const diagnostics=graphics.getDiagnostics();
        // A quality change can arrive while the optional derivative streams.
        // Reapply the active budget after installation so Intel/Low never keeps
        // PBR hero textures resident or renders a stale high-detail layer.
        applyGraphicsHardwareBudget(diagnostics.quality,diagnostics.preset);
        status('props','LOADED',`${count} CC0 fir saplings · PBR LOD0/1/2`);
      }
    })
    .finally(()=>{forestHeroFirLoadPromise=null});
}
const switchGroup=worldOverhaul.breaker.interactionTarget;
const audio=createAudioDirector({seed:0x5ec7e2,powerOn:false,masterVolume:.78,musicVolume:.28,sfxVolume:.88,voiceVolume:bootVoiceVolume,ambienceVolume:.5});
let recordedAudioDecodePromise=null;

function renderVoiceVolume(value=audio.volumes.voice){
  const normalized=THREE.MathUtils.clamp(Number(value)||0,0,1);
  voiceVolumeControl.value=String(Math.round(normalized*100));
  voiceVolumeValue.textContent=`${Math.round(normalized*100)}%`;
}
function setVoiceVolume(value,{persist=true}={}){
  const normalized=THREE.MathUtils.clamp(Number(value)/100,0,1);
  audio.setVoiceVolume(normalized);
  renderVoiceVolume(normalized);
  if(persist){
    try{localStorage.setItem(voiceSettingsStorageKey,JSON.stringify({enemyVoiceVolume:normalized}))}catch{ /* Storage is optional in embedded previews. */ }
  }
}
voiceVolumeControl.oninput=()=>setVoiceVolume(voiceVolumeControl.value);
renderVoiceVolume(bootVoiceVolume);

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
 scopeSurface.name='live-scope-picture';scopeSurface.userData.specterViewmodel=true;scopeSurface.position.set(0,0,-.34);scopeSurface.renderOrder=10000;scopeSurface.visible=false;camera.add(scopeSurface);
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
  rifle:{uiName:'HK416',family:'rifle',capacity:30,startReserve:120,fireModes:['semi','auto'],defaultMode:'auto',rpm:652,damage:38,adsFov:31,trueScope:true,reloadSeconds:{tactical:1.45,empty:1.86},recoil:.05,recoilPitch:.055,recoilRecovery:.38,recoilPitchRecovery:.46,bobMultiplier:1,landingMultiplier:1,sprint:new THREE.Vector3(.40,-.43,-.39)},
  pistol:{uiName:'M9A4',family:'pistol',capacity:15,startReserve:60,fireModes:['semi'],defaultMode:'semi',rpm:261,damage:28,adsFov:52,trueScope:false,reloadSeconds:{tactical:1.05,empty:1.38},recoil:.08,recoilPitch:.12,recoilRecovery:.54,recoilPitchRecovery:.7,bobMultiplier:.86,landingMultiplier:.88,sprint:new THREE.Vector3(.36,-.38,-.36)},
  compact:{uiName:'C5-K',family:'rifle',capacity:30,startReserve:150,fireModes:['semi','auto'],defaultMode:'auto',rpm:780,damage:34,adsFov:40,trueScope:true,reloadSeconds:{tactical:1.82,empty:2.18},recoil:.047,recoilPitch:.052,recoilRecovery:.42,recoilPitchRecovery:.5,bobMultiplier:1.07,landingMultiplier:.96,sprint:new THREE.Vector3(.39,-.42,-.38)},
  marksman:{uiName:'R7.62',family:'rifle',capacity:20,startReserve:80,fireModes:['semi'],defaultMode:'semi',rpm:420,damage:68,adsFov:24,trueScope:true,reloadSeconds:{tactical:2.24,empty:2.68},recoil:.086,recoilPitch:.092,recoilRecovery:.28,recoilPitchRecovery:.34,bobMultiplier:.74,landingMultiplier:1.14,sprint:new THREE.Vector3(.43,-.45,-.36)},
  suppressed:{uiName:'MCR-300',family:'rifle',capacity:30,startReserve:120,fireModes:['semi','auto'],defaultMode:'semi',rpm:700,damage:45,adsFov:40,trueScope:true,suppressed:true,reloadSeconds:{tactical:1.9,empty:2.28},recoil:.055,recoilPitch:.06,recoilRecovery:.36,recoilPitchRecovery:.44,bobMultiplier:.9,landingMultiplier:1.03,sprint:new THREE.Vector3(.41,-.44,-.38)}
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
const viewmodelActionTimeline=new WeaponActionTimeline({weapon:'rifle'});
let viewmodelActionKind=null,pendingReload=null,pendingWeaponSwitch=null;

function markViewmodelMeshes(root){
  root.traverse(object=>{if(object.isMesh)object.userData.specterViewmodel=true});
}
function captureRifleReloadParts(model,holder,rig){
  // The bundled source contains one verified inserted magazine (`mag`). Keep
  // that real mesh visible and animate it from the shared action timeline;
  // loose display magazines remain hidden by the source cleanup list.
  const magazine=model.getObjectByName('mag');
  if(!magazine?.parent)return;
  model.updateWorldMatrix(true,true);holder.updateWorldMatrix(true,false);
  const holderOrigin=holder.localToWorld(new THREE.Vector3()),holderOut=holder.localToWorld(new THREE.Vector3(-.012,-.22,.06));
  const parentOrigin=magazine.parent.worldToLocal(holderOrigin),parentOut=magazine.parent.worldToLocal(holderOut);
  rig.reloadMechanics={magazine,basePosition:magazine.position.clone(),outOffset:parentOut.sub(parentOrigin),hidden:false};
}
function capturePistolReloadParts(model,holder,rig){
  // The tan M9 source names the inserted magazine `Clip_lp.001`. It is the
  // visible gold hierarchy; the black duplicate is already hidden during
  // installation. Capture that authored mesh rather than creating a stand-in.
  const magazine=model.getObjectByName('Clip_lp.001');
  if(!magazine?.parent)return;
  model.updateWorldMatrix(true,true);holder.updateWorldMatrix(true,false);
  const holderOrigin=holder.localToWorld(new THREE.Vector3()),holderOut=holder.localToWorld(new THREE.Vector3(.006,-.155,.025));
  const parentOrigin=magazine.parent.worldToLocal(holderOrigin),parentOut=magazine.parent.worldToLocal(holderOut);
  rig.reloadMechanics={magazine,basePosition:magazine.position.clone(),outOffset:parentOut.sub(parentOrigin),hidden:false};
}
function updateRifleReloadMechanics(kind,normalizedTime=0,active=false){
  const mechanics=weaponRig[kind]?.reloadMechanics;if(!mechanics)return;
  const {magazine,basePosition,outOffset}=mechanics;
  if(!active){magazine.visible=true;magazine.position.copy(basePosition);mechanics.hidden=false;return}
  const p=THREE.MathUtils.clamp(normalizedTime,0,1);
  // Mag-out, an intentional hand-covered transfer gap, then a fresh magazine
  // entering from below. The action uses the authored marker timings rather
  // than a second, unsynchronised timeout.
  if(p<.32){
    magazine.visible=true;magazine.position.copy(basePosition).addScaledVector(outOffset,THREE.MathUtils.smoothstep(p,.13,.32));mechanics.hidden=false;
  }else if(p<.46){
    magazine.visible=false;mechanics.hidden=true;
  }else if(p<.69){
    magazine.visible=true;magazine.position.copy(basePosition).addScaledVector(outOffset,1-THREE.MathUtils.smoothstep(p,.46,.69));mechanics.hidden=false;
  }else{magazine.visible=true;magazine.position.copy(basePosition);mechanics.hidden=false}
}
function updatePistolReloadMechanics(kind,normalizedTime=0,active=false,timing=null){
  const mechanics=weaponRig[kind]?.reloadMechanics;if(!mechanics)return;
  const {magazine,basePosition,outOffset}=mechanics;
  if(!active){magazine.visible=true;magazine.position.copy(basePosition);mechanics.hidden=false;return}
  const markers=timing?.markers||{};
  const release=Number.isFinite(markers.magRelease)?markers.magRelease:.1;
  const out=Number.isFinite(markers.magOut)?markers.magOut:.23;
  const fresh=Number.isFinite(markers.freshMag)?markers.freshMag:.41;
  const seated=Number.isFinite(markers.seated)?markers.seated:.68;
  const p=THREE.MathUtils.clamp(normalizedTime,0,1);
  // Use the same authored markers as audio/ammo. The magazine remains hidden
  // only in the deliberate hand-covered transfer window, then returns from
  // below into the existing magwell.
  if(p<out){
    magazine.visible=true;magazine.position.copy(basePosition).addScaledVector(outOffset,THREE.MathUtils.smoothstep(p,release,out));mechanics.hidden=false;
  }else if(p<fresh){
    magazine.visible=false;mechanics.hidden=true;
  }else if(p<seated){
    magazine.visible=true;magazine.position.copy(basePosition).addScaledVector(outOffset,1-THREE.MathUtils.smoothstep(p,fresh,seated));mechanics.hidden=false;
  }else{magazine.visible=true;magazine.position.copy(basePosition);mechanics.hidden=false}
}

function installRifle(){
  const model=cloneAsset('ar15');if(!model)return;
  hideByName(model,['ground','stand','plane001','plane002','plane003','bullets','mag byulle','mag001','mag002','scope001','sight001','handle001','stock001']);
  model.rotation.set(0,-Math.PI/2,0);
  normalize(model,1.38);
  model.position.add(new THREE.Vector3(0,.005,-.18));
  rifleHolder.add(model);
  markViewmodelMeshes(model);
  weaponRig.rifle.visuals=[model];
  faceWeaponForward(model,rifleHolder,'Handguard','Stock');
  captureRifleReloadParts(model,rifleHolder,weaponRig.rifle);
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
  markViewmodelMeshes(model);
  weaponRig.pistol.visuals=[model];
  const barrel=model.getObjectByName('Barrel_lp.001');
  pistolSlide=model.getObjectByName('Shutter_lp.001');
  capturePistolReloadParts(model,pistolHolder,weaponRig.pistol);
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
    holder.add(model);markViewmodelMeshes(model);rig.visuals=[model];faceWeaponForward(model,holder,'Handguard','Stock');captureRifleReloadParts(model,holder,rig);
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
  status('arsenal','LOADED',`3 bundled rifle variants · ${visibleMeshes} meshes · ${Math.round(visibleTriangles/1000)}K tris`);
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
const droppedCombatProps=[];
const droppedCombatPropPool=new Map();
const DROP_ACTIVE_LIMIT=72,DROP_POOL_LIMIT=72,DROP_POOL_PER_KEY_LIMIT=12,DROP_LIFETIME=42,ENEMY_DEATH_SETTLE_HOLD=.12;
let droppedCombatPropPoolSize=0;
const dropVelocity=new THREE.Vector3(),dropAngularVelocity=new THREE.Vector3(),dropWorldPosition=new THREE.Vector3(),dropWorldScale=new THREE.Vector3(),dropWorldQuaternion=new THREE.Quaternion();
function dropGroundHeight(){return .018}
function configureDroppedCombatProp(object){
  object.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true}});
}
// Enemy and weapon roots keep live references in userData (AI controller,
// owner model, anchors). Three's Object3D.clone serializes that metadata, so
// temporarily clear it while taking a purely visual snapshot for the drop pool.
function cloneDroppedCombatSource(source){
  const savedUserData=[];
  source.traverse(node=>{if(node.userData&&Object.keys(node.userData).length){savedUserData.push([node,node.userData]);node.userData={}}});
  try{return source.clone(true)}finally{for(const [node,userData] of savedUserData)node.userData=userData}
}
function acquireDroppedCombatProp(source,poolKey){
  if(!source?.parent)return null;
  source.updateWorldMatrix(true,false);
  source.getWorldPosition(dropWorldPosition);source.getWorldQuaternion(dropWorldQuaternion);source.getWorldScale(dropWorldScale);
  const bucket=droppedCombatPropPool.get(poolKey);
  const pooledObject=bucket?.pop();
  const object=pooledObject||cloneDroppedCombatSource(source);
  if(pooledObject&&droppedCombatPropPoolSize>0)droppedCombatPropPoolSize--;
  if(!object)return null;
  object.position.copy(dropWorldPosition);object.quaternion.copy(dropWorldQuaternion);object.scale.copy(dropWorldScale);object.visible=true;object.matrixAutoUpdate=true;
  scene.add(object);configureDroppedCombatProp(object);
  return object;
}
function releaseDroppedCombatProp(prop){
  const object=prop?.object;if(!object)return;
  removeSceneObject(object);object.visible=false;
  const bucket=droppedCombatPropPool.get(prop.poolKey)||[];
  if(bucket.length<DROP_POOL_PER_KEY_LIMIT&&droppedCombatPropPoolSize<DROP_POOL_LIMIT){
    bucket.push(object);droppedCombatPropPool.set(prop.poolKey,bucket);droppedCombatPropPoolSize++;
  }
}
function beginDroppedCombatProp(source,velocity,spin,poolKey){
  const object=acquireDroppedCombatProp(source,poolKey);if(!object)return null;
  droppedCombatProps.push({object,poolKey,velocity:velocity.clone(),spin:spin.clone(),settled:false,age:0});
  if(droppedCombatProps.length>DROP_ACTIVE_LIMIT)releaseDroppedCombatProp(droppedCombatProps.shift());
  return object;
}
function beginEnemyEquipmentDrop(enemy,direction){
  const data=enemy.userData;if(data.dropStarted)return;data.dropStarted=true;
  enemy.updateWorldMatrix(true,true);
  const forward=direction?.clone?.()||new THREE.Vector3(Math.sin(enemy.rotation.y),0,Math.cos(enemy.rotation.y));forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);else forward.normalize();
  const seed=(Number(data.aiId?.slice(-2))||1)*.618;
  const launch=(side,upward)=>dropVelocity.copy(forward).multiplyScalar(.82+Math.abs(side)*.22).add(new THREE.Vector3(side,.58+upward,.16*Math.sin(seed+side)));
  const spin=(side)=>dropAngularVelocity.set(4.5+seed*2,side*5.2,2.8-side*1.8);
  if(data.weapon){
    if(data.weaponDetail)data.weaponDetail.visible=true;if(data.weaponProxy)data.weaponProxy.visible=false;
    beginDroppedCombatProp(data.weapon,launch(.22,.22),spin(.34),`weapon:${data.role||'rifleman'}`);data.weapon.visible=false;
  }
  for(const [index,gear] of (data.droppableGear||[]).entries()){
    if(!gear?.parent)continue;
    beginDroppedCombatProp(gear,launch((index%2?1:-1)*(.13+index*.025),.08+index*.03),spin((index%2?1:-1)*.26),`gear:${gear.name||index}`);gear.visible=false;
  }
}
function beginEnemyDeath(enemy,direction,{duration=1.35}={}){
  const data=enemy?.userData;if(!data||data.dead)return false;
  const fallDuration=Math.max(.65,Number.isFinite(duration)?duration:1.35);
  data.dead=true;data.deathProgress=0;data.deathElapsed=0;data.deathSettleDuration=fallDuration;data.deathDirection=direction;data.dropQueued=true;data.dropStarted=false;
  data.animator?.triggerDeath({variant:'auto',direction,duration:fallDuration});
  return true;
}
function updateDroppedCombatProps(dt){
  for(let index=droppedCombatProps.length-1;index>=0;index--){
    const prop=droppedCombatProps[index];prop.age+=dt;
    if(!prop.settled){
      prop.velocity.y-=11.4*dt;prop.object.position.addScaledVector(prop.velocity,dt);prop.object.rotation.x+=prop.spin.x*dt;prop.object.rotation.y+=prop.spin.y*dt;prop.object.rotation.z+=prop.spin.z*dt;
      if(prop.object.position.y<=dropGroundHeight()){
        prop.object.position.y=dropGroundHeight();prop.velocity.set(0,0,0);prop.spin.multiplyScalar(.16);prop.settled=true;
      }
    }
    if(prop.age>DROP_LIFETIME){releaseDroppedCombatProp(prop);droppedCombatProps.splice(index,1)}
  }
}
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
  {position:{x:13,y:0,z:-118},coverage:.88,priority:.3},{position:{x:21,y:0,z:-120},coverage:.92,priority:.3},
  {position:{x:-10,y:0,z:-151},coverage:.96,priority:.5,tag:'utility-fuel-tanks'},{position:{x:13,y:0,z:-149},coverage:.95,priority:.48,tag:'utility-container-north'},
  {position:{x:5,y:0,z:-159},coverage:.94,priority:.48,tag:'utility-pickup'},{position:{x:-20,y:0,z:-154},coverage:.96,priority:.52,tag:'utility-pump-house'},
  {position:{x:15,y:0,z:-162},coverage:.95,priority:.5,tag:'utility-container-south'},{position:{x:0,y:0,z:-171},coverage:.9,priority:.4,tag:'extraction-service-road'},
  // These stand-off points sit on the protected side of the physical CC0
  // barriers, so a retreat or suppression response produces readable cover
  // behavior instead of sending enemies through the new checkpoint dressing.
  {position:{x:-3.9,y:0,z:-58.25},coverage:.98,priority:.62,tag:'checkpoint-barrier-west'},
  {position:{x:3.9,y:0,z:-58.25},coverage:.98,priority:.62,tag:'checkpoint-barrier-east'},
  {position:{x:-15.55,y:0,z:-81.6},coverage:.96,priority:.56,tag:'motor-pool-barrier'},
  {position:{x:15.95,y:0,z:-94.3},coverage:.96,priority:.56,tag:'service-road-barrier'},
  {position:{x:-12.6,y:0,z:-107.1},coverage:.95,priority:.52,tag:'storage-yard-barrier'},
  {position:{x:11.8,y:0,z:-118.2},coverage:.95,priority:.52,tag:'extraction-barrier'}
];
let enemySequence=0;
const enemyGunMat=new THREE.MeshStandardMaterial({color:0x303733,roughness:.42,metalness:.76});
const enemyGunAccent=new THREE.MeshStandardMaterial({color:0x4c574f,roughness:.62,metalness:.38});
const enemyGunLens=new THREE.MeshStandardMaterial({color:0x315148,emissive:0x15342b,emissiveIntensity:.55,roughness:.18,metalness:.5});
const enemyArmorMat=new THREE.MeshStandardMaterial({color:0x28352d,roughness:.78,metalness:.22});
// Cloned skinned characters share source materials.  Keep the role treatment
// visually distinct, but cache each treatment once instead of creating a full
// texture/material set for every hostile.
const enemyMaterialVariants=new Map();
const enemyRoleEquipmentMaterials=new Map();
function enemyMaterialVariant(material,variant,tint=0xffffff,minRoughness=0){
  if(!material?.clone)return material;
  let variants=enemyMaterialVariants.get(variant);
  if(!variants){variants=new WeakMap();enemyMaterialVariants.set(variant,variants)}
  let result=variants.get(material);
  if(!result){
    result=material.clone();
    if(result.color)result.color.multiply(new THREE.Color(tint));
    if(Number.isFinite(result.roughness))result.roughness=Math.max(result.roughness,minRoughness);
    variants.set(material,result);
  }
  return result;
}
function roleEquipmentMaterials(role){
  if(enemyRoleEquipmentMaterials.has(role))return enemyRoleEquipmentMaterials.get(role);
  const palette={rifleman:0x2b3930,scout:0x24322d,breacher:0x30352f,marksman:0x374036,commander:0x3f4235};
  const armor=enemyArmorMat.clone();armor.color.setHex(palette[role]||palette.rifleman);
  const materials=Object.freeze({
    armor,
    webbing:new THREE.MeshStandardMaterial({color:0x1c2620,roughness:.8,metalness:.08}),
    cloth:new THREE.MeshStandardMaterial({color:0x566455,roughness:.92,metalness:0}),
    polymer:new THREE.MeshStandardMaterial({color:0x171d1a,roughness:.55,metalness:.24}),
    marker:new THREE.MeshBasicMaterial({color:role==='commander'?0xc7b76f:role==='breacher'?0x8e4f35:0x5d8e72,toneMapped:false}),
    visor:new THREE.MeshStandardMaterial({color:0x202d28,roughness:.22,metalness:.66})
  });
  enemyRoleEquipmentMaterials.set(role,materials);return materials;
}
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
      const variants=materials.map(material=>enemyMaterialVariant(material,`weapon-${role}`,weaponTint,.38));
      object.material=Array.isArray(object.material)?variants:variants[0];object.castShadow=false;object.receiveShadow=false;
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
  const {armor,webbing,cloth,polymer,marker,visor}=roleEquipmentMaterials(role);
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
    part('visor',enemyKitGeometry.visor,visor,0,1.8,-.17);
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
function updatePlayerArms(dt,t,reloadWave,equipDrop,actionSample=null){
  if(!playerArms)return;
  const rifle=weaponProfiles[currentWeapon].family!=='pistol',bob=moving?Math.sin(t*(sprinting?10:7))*.012:0,supportHand=actionSample?.supportHand||0,prepare=actionSample?.prepare||0;
  const rightElbow=new THREE.Vector3(rifle?.11:.1,(rifle?-.4:-.38)-equipDrop*.08,rifle?-.12:-.12);
  const leftElbow=new THREE.Vector3(rifle?-.16:-.1,(rifle?-.39:-.37)-equipDrop*.08,rifle?0:-.13);
  const rightGrip=new THREE.Vector3(rifle?-.015:.02,rifle?-.09:-.075,rifle?-.19:-.15);
  const leftGrip=new THREE.Vector3(rifle?.045:-.015,rifle?-.035:-.055,rifle?-.36:-.17);
  rightElbow.y+=bob;leftElbow.y-=bob;
  rightGrip.x+=reloadWave*.04;rightGrip.y-=reloadWave*.07;leftGrip.x+=reloadWave*.025;leftGrip.y-=reloadWave*.08;
  // During an authored action curve the support hand leaves the handguard,
  // reaches the magazine well, then returns. This makes reloads/chamber checks
  // read as deliberate hand motion rather than a weapon-only dip.
  leftGrip.x-=supportHand*(rifle?.11:.065);leftGrip.y-=supportHand*.1;leftGrip.z+=supportHand*.08;
  leftElbow.x-=supportHand*.08;leftElbow.y-=prepare*.075;
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
  root.userData={aiId,role,squadId:z>-45?'interior':'perimeter',maxHealth,health:maxHealth,dead:false,phase:Math.random()*6,heavy,hit:0,recoil:0,deathProgress:0,deathElapsed:0,deathSettleDuration:0,deathDirection:null,dropQueued:false,dropStarted:false,intent:null,voiceNextAt:-Infinity,lastVoiceState:null};
  const model=cloneAsset('soldier',true);
  if(model){
    const height=role==='scout'?1.9:role==='commander'?2.14:heavy?2.08:1.98;
    model.rotation.y=Math.PI;normalize(model,height,true);
    const tint={rifleman:0x738074,scout:0x60746c,breacher:0x6a7068,marksman:0x78806f,commander:0x827b65}[role]||0x738074;
    model.traverse(o=>{if(o.isMesh){o.userData.enemy=root;o.frustumCulled=true;const materials=Array.isArray(o.material)?o.material:[o.material];const variants=materials.map(material=>enemyMaterialVariant(material,`soldier-${role}`,tint,.62));o.material=Array.isArray(o.material)?variants:variants[0]}});root.add(model);
    root.userData.model=model;
    root.userData.animator=createTacticalAnimator(model,{weapon:'rifle',phase:root.userData.phase});
  }
  const weapon=createEnemyRifle(heavy,role);root.add(weapon.group);
  root.userData.weapon=weapon.group;root.userData.weaponDetail=weapon.detail;root.userData.weaponProxy=weapon.proxy;root.userData.weaponBase=weapon.basePosition;root.userData.muzzle=weapon.muzzle;root.userData.eject=weapon.eject;
  addEnemyRoleEquipment(root,role);
  // Snapshot every meaningful external kit component after the grounded death
  // settle: carrier, belt, pouches, pads, helmet/cap, comms, packs and holster
  // all leave the corpse through the bounded pooled drop system.
  root.userData.droppableGear=root.children.filter(object=>/enemy-.*(?:helmet|field-cap|assault-pack|marksman-pack|radio|headset|holster|plate-carrier|carrier-collar|battle-belt|pouch|shoulder-(?:pad|cover)|knee-pad|visor)/.test(object.name));
  root.traverse(object=>{if(object.isMesh)object.userData.enemy=root});
  const interior=z>-45,patrolPoints=interior
    ?[{x:THREE.MathUtils.clamp(x-1.8,-7.8,7.8),y:0,z:THREE.MathUtils.clamp(z+2.8,-42,7)},{x:THREE.MathUtils.clamp(x+1.8,-7.8,7.8),y:0,z:THREE.MathUtils.clamp(z-2.8,-42,7)}]
    :[{x:THREE.MathUtils.clamp(x-4,-36,36),y:0,z:THREE.MathUtils.clamp(z+4,-176,-48)},{x:THREE.MathUtils.clamp(x+4,-36,36),y:0,z:THREE.MathUtils.clamp(z-4,-176,-48)}];
  const ai=enemyAISystem.addAgent({id:aiId,squadId:interior?'interior':'perimeter',difficulty:role==='commander'?'elite':heavy||role==='marksman'?'hardened':'regular',patrolPoints,health:maxHealth,maxHealth});
  root.userData.ai=ai;root.userData.shadowDetailed=null;enemiesByAIId.set(aiId,root);
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
const enemySightOrigin=new THREE.Vector3(),enemySightDirection=new THREE.Vector3(),enemyNextPosition=new THREE.Vector3(),enemyXAxisPosition=new THREE.Vector3(),enemyZAxisPosition=new THREE.Vector3(),enemyReactionLocal=new THREE.Vector3();
function enemyCanSeePlayer(enemy){
  const origin=enemy.userData.muzzle?.getWorldPosition(enemySightOrigin)||enemySightOrigin.copy(enemy.position).addScaledVector(THREE.Object3D.DEFAULT_UP,1.4);
  const direction=enemySightDirection.copy(camera.position).sub(origin);const length=direction.length();direction.normalize();
  enemyRaycaster.set(origin,direction);enemyRaycaster.near=0;enemyRaycaster.far=length;
  const obstruction=enemyRaycaster.intersectObjects(collision,true)[0];return !obstruction||obstruction.distance>=length-.35;
}
function damagePlayer(amount){
  // The extraction beat is a controlled handoff into the end screen. Pursuit
  // fire remains audible and visible, but cannot reset the camera mid-run.
  if(extractionSequence)return;
  const absorbed=Math.min(armor,Math.ceil(amount*.65));armor-=absorbed;hp=Math.max(0,hp-(amount-absorbed));hud();
  if(hp<=0){toast('OPERATOR DOWN');hp=100;armor=50;playerVerticalVelocity=0;playerGrounded=true;landingResponse=0;camera.position.set(0,playerEyeHeight,7);hud()}
}
function enemyFire(enemy,distance,request=null){
  const data=enemy.userData,suppressed=data.role==='marksman'||data.role==='scout';data.recoil=1;data.animator?.triggerRecoil({strength:.86});spawnMuzzleBurst(data.muzzle,'rifle',suppressed?.28:.72,suppressed?4:7);ejectCasing('rifle',data.eject);
  const muzzlePosition=data.muzzle?.getWorldPosition(new THREE.Vector3())||enemy.position.clone().add(new THREE.Vector3(0,1.4,0));
  audio?.playWeapon?.('rifle',{position:muzzlePosition,volume:.7,suppressed});
  enemyAISystem.emitNoise({position:muzzlePosition,type:'gunshot',loudness:suppressed?.72:1,radius:suppressed?38:52,sourceId:data.aiId,sourceFaction:'hostile'});
  const requestedAccuracy=request?.accuracy??(data.heavy?.7:.6),accuracy=THREE.MathUtils.clamp(requestedAccuracy*(1-distance*.012),.18,.78);if(Math.random()<accuracy)damagePlayer(data.role==='commander'?14:data.heavy?12:8);
}
const previousAIPlayerPosition=camera.position.clone(),aiPlayerVelocity=new THREE.Vector3(),enemyForward=new THREE.Vector3(),enemyMoveDirection=new THREE.Vector3(),enemyLookDirection=new THREE.Vector3();
const enemyVoiceSquadNextAt=new Map();
let enemyVoiceGlobalNextAt=-Infinity,enemySubtitleTimeout=0;
const ENEMY_VOICE_LINES=Object.freeze({
  contact:'TARGET ENGAGED!',investigate:'LOOK OUT!',search:'SEARCH THE AREA!',backup:'CALLING FOR BACKUP!',
  flank:'COVER ME!',suppress:'SUPPRESSING FIRE!',retreat:'GET DOWN!',down:'MEDIC!',clear:'AREA CLEAR!',radio:'COPY. MOVING.'
});
const ENEMY_VOICE_RULES=Object.freeze({
  suspicious:Object.freeze({type:'investigate',radio:false,enemyCooldown:10,squadCooldown:5.8,globalCooldown:2.2}),
  investigate:Object.freeze({type:'investigate',radio:false,enemyCooldown:10,squadCooldown:5.8,globalCooldown:2.2}),
  search:Object.freeze({type:'backup',radio:true,radioMix:.84,enemyCooldown:11,squadCooldown:6.5,globalCooldown:2.4}),
  chase:Object.freeze({type:'contact',radio:false,enemyCooldown:9,squadCooldown:5.2,globalCooldown:2.1}),
  engage:Object.freeze({type:'contact',radio:true,radioMix:.45,enemyCooldown:9,squadCooldown:5.2,globalCooldown:2.1}),
  retreat:Object.freeze({type:'retreat',radio:false,enemyCooldown:9,squadCooldown:5.4,globalCooldown:2.2}),
  suppressed:Object.freeze({type:'suppress',radio:false,enemyCooldown:9,squadCooldown:5.4,globalCooldown:2.2})
});
function enemyVoiceCallsign(data){
  return data.role==='commander'?'COMMAND':data.role==='marksman'?'MARKSMAN':data.role==='breacher'?'BREACHER':data.role==='scout'?'SCOUT':'HOSTILE';
}
function showEnemySubtitle(data,call){
  if(!enemySubtitle)return;
  const text=call.subtitle||ENEMY_VOICE_LINES[call.type]||ENEMY_VOICE_LINES.contact;
  enemySubtitle.textContent=`${call.radio?'RADIO · ':''}${enemyVoiceCallsign(data)}: “${text}”`;
  enemySubtitle.classList.toggle('radio',Boolean(call.radio));enemySubtitle.classList.add('active');
  clearTimeout(enemySubtitleTimeout);enemySubtitleTimeout=setTimeout(()=>enemySubtitle.classList.remove('active'),call.subtitleDuration??(call.radio?3100:2700));
}
function requestEnemyVoice(enemy,call,t=clock.elapsedTime){
  if(!enemy||!call||enemy.userData.dead)return false;
  const data=enemy.userData,squadId=data.squadId||data.ai?.squadId||'perimeter';
  if(t<(data.voiceNextAt??-Infinity)||t<(enemyVoiceSquadNextAt.get(squadId)??-Infinity)||t<enemyVoiceGlobalNextAt)return false;
  const played=audio?.playEnemyCall(enemy.position,{type:call.type,radio:call.radio,radioMix:call.radioMix,intensity:call.intensity??(data.heavy?1.05:.88),gain:call.gain,maxDistance:call.maxDistance});
  if(!played)return false;
  data.voiceNextAt=t+(call.enemyCooldown??8.5);
  enemyVoiceSquadNextAt.set(squadId,t+(call.squadCooldown??5.25));enemyVoiceGlobalNextAt=t+(call.globalCooldown??2.15);
  data.pendingVoiceCall=null;showEnemySubtitle(data,call);return true;
}
function queueEnemyVoice(enemy,call,t=clock.elapsedTime){
  if(requestEnemyVoice(enemy,call,t))return true;
  // State changes can happen in the first few milliseconds after the Start
  // click. Retain one short-lived call so a browser that resumes Web Audio a
  // frame later does not silently lose the initial contact report.
  if(!audio?.active&&!enemy?.userData?.dead)enemy.userData.pendingVoiceCall={...call,expiresAt:t+2.6};
  return false;
}
function selectEnemyVoiceCall(intent){
  if(!intent?.state)return null;
  if(intent.move?.mode==='flank')return {type:'flank',radio:true,radioMix:.58,enemyCooldown:10,squadCooldown:5.8,globalCooldown:2.2};
  return ENEMY_VOICE_RULES[intent.state]||null;
}
function requestSquadmateDownCall(casualty){
  const squadId=casualty.userData.squadId||casualty.userData.ai?.squadId;
  let speaker=null,bestDistance=Infinity;
  for(const enemy of enemies){
    if(enemy===casualty||enemy.userData.dead||(enemy.userData.squadId||enemy.userData.ai?.squadId)!==squadId)continue;
    const distance=enemy.position.distanceTo(casualty.position);if(distance<bestDistance){speaker=enemy;bestDistance=distance}
  }
  if(speaker)queueEnemyVoice(speaker,{type:'down',radio:true,radioMix:.68,enemyCooldown:10,squadCooldown:6.4,globalCooldown:2.35},clock.elapsedTime);
}
function rotateEnemyToward(enemy,target,dt){
  if(!target)return;enemyLookDirection.set(target.x-enemy.position.x,0,target.z-enemy.position.z);if(enemyLookDirection.lengthSq()<.001)return;
  const desired=Math.atan2(enemyLookDirection.x,enemyLookDirection.z)+Math.PI,delta=Math.atan2(Math.sin(desired-enemy.rotation.y),Math.cos(desired-enemy.rotation.y));enemy.rotation.y+=delta*(1-Math.exp(-10*dt));
}
function tryMoveEnemy(enemy,target,speed,stoppingDistance,dt){
  enemyMoveDirection.set(target.x-enemy.position.x,0,target.z-enemy.position.z);const distance=enemyMoveDirection.length();if(distance<=stoppingDistance)return false;
  enemyMoveDirection.multiplyScalar(1/distance);const step=Math.min(speed*dt,Math.max(0,distance-stoppingDistance)),next=enemyNextPosition.copy(enemy.position).addScaledVector(enemyMoveDirection,step);
  if(canMove(next)){enemy.position.x=next.x;enemy.position.z=next.z;return true}
  const xOnly=enemyXAxisPosition.copy(enemy.position);xOnly.x=next.x;if(canMove(xOnly)){enemy.position.x=xOnly.x;return true}
  const zOnly=enemyZAxisPosition.copy(enemy.position);zOnly.z=next.z;if(canMove(zOnly)){enemy.position.z=zOnly.z;return true}
  return false;
}
function updateEnemyShadows(enemy,enabled){
  const data=enemy.userData;
  if(data.shadowDetailed===enabled)return;
  data.shadowDetailed=enabled;
  enemy.traverse(object=>{if(object.isMesh)object.castShadow=enabled});
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
    const data=enemy.userData,distance=enemy.position.distanceTo(camera.position),showDetailedWeapon=distance<18;
    if(data.dropStarted){
      if(data.weapon)data.weapon.visible=false;
      for(const gear of data.droppableGear||[])gear.visible=false;
    }else{
      if(data.weaponDetail)data.weaponDetail.visible=showDetailedWeapon;
      if(data.weaponProxy)data.weaponProxy.visible=!showDetailedWeapon;
    }
    updateEnemyShadows(enemy,distance<18&&!data.dead);
    if(data.dead){
      data.deathElapsed=(data.deathElapsed||0)+dt;
      const animation=data.animator?.update(dt,{locomotion:'idle',weapon:'rifle',weaponReady:false});
      data.deathProgress=animation?.deathProgress??Math.min(1,data.deathProgress+dt*1.25);
      animateEnemyWeapon(enemy,dt,t,false,data.deathProgress);
      // The tactical animator holds a permanent grounded pose at progress 1.
      // A short extra hold lets its final bone blend settle before the weapon
      // and kit visibly leave the completed body.
      const grounded=data.deathElapsed>=data.deathSettleDuration+ENEMY_DEATH_SETTLE_HOLD&&(data.animator?data.deathProgress>=1:true);
      if(data.dropQueued&&!data.dropStarted&&grounded)beginEnemyEquipmentDrop(enemy,data.deathDirection);
      continue;
    }
    const intent=intents.get(data.aiId);data.intent=intent;
    const pendingVoice=data.pendingVoiceCall;
    if(pendingVoice){
      if(t>=pendingVoice.expiresAt)data.pendingVoiceCall=null;
      else requestEnemyVoice(enemy,pendingVoice,t);
    }
    if(intent?.state!==data.lastAIState){
      const call=selectEnemyVoiceCall(intent);if(call)queueEnemyVoice(enemy,call,t);
      data.lastAIState=intent?.state;
    }
    if(intent?.fire&&intent?.state==='engage'&&t>=(data.nextCombatVoiceAt??-Infinity)){
      queueEnemyVoice(enemy,{type:'suppress',radio:false,enemyCooldown:10,squadCooldown:5.8,globalCooldown:2.25},t);
      data.nextCombatVoiceAt=t+10.5+data.phase*.45;
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
  updateDroppedCombatProps(dt);
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
function gunshot(kind){ensureAudio();const profile=weaponProfiles[kind];audio.playWeapon(kind,{outdoorBlend:worldOverhaul.outdoorBlend,suppressed:!!profile?.suppressed})}
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
  const local=enemy.worldToLocal(enemyReactionLocal.copy(origin));
  return Math.abs(local.x)>Math.abs(local.z)?(local.x>0?'right':'left'):(local.z>0?'back':'front');
}
function triggerFireAnimation(kind){
  recoilPitch=Math.min(.28,recoilPitch+(weaponProfiles[kind]?.recoilPitch||.07));
  if(kind==='pistol'){
    pistolSlideTime=0;
    pistolSlideLocked=ammo.pistol===0;
  }
}
function updatePistolSlide(dt,actionSample=null){
  if(!pistolSlide)return;
  // A manual M9 chamber check has a captured slide mesh, so it can follow the
  // timeline's physical mechanism curve. Empty-reload lockback/release still
  // uses the dedicated lock state below; there is no conflicting fake rifle
  // bolt animation elsewhere in the viewmodel.
  const chamberCheck=viewmodelActionKind==='chamber'&&viewmodelActionTimeline.active&&!pistolSlideLocked&&(actionSample?.chamber||0)>.001;
  if(chamberCheck){
    const amount=THREE.MathUtils.clamp(actionSample.chamber,0,1);
    pistolSlide.position.copy(pistolSlideBase).addScaledVector(pistolSlideTravel,amount);
    return;
  }
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
  if(extractionSequence||reloading||pendingWeaponSwitch||viewmodelActionTimeline.active||now-lastShot<delay)return;
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
        const deathDirection=enemyReactionDirection(e);beginEnemyDeath(e,deathDirection,{duration:1.18+Math.random()*.34});kills++;toast('HOSTILE NEUTRALIZED');
        enemyAISystem.broadcastSquadAlert({type:'squadmate-down',sourceId:e.userData.aiId,squadId:e.userData.ai?.squadId||'perimeter',faction:'hostile',position:e.position,certainty:1});
        requestSquadmateDownCall(e);
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
  if(!started||extractionSequence||reloading||pendingWeaponSwitch||viewmodelActionTimeline.active)return;const profile=weaponProfiles[currentWeapon],cap=profile.capacity;if(ammo[currentWeapon]>=cap||reserve[currentWeapon]<=0)return;
  const kind=currentWeapon,empty=ammo[kind]===0,action=empty?TacticalWeaponAction.RELOAD_EMPTY:TacticalWeaponAction.TACTICAL_RELOAD;
  fireHeld=false;setAim(false);
  const reloadDuration=profile.reloadSeconds?.[empty?'empty':'tactical']??profile.reloadSeconds;
  viewmodelActionTimeline.start(action,{weapon:profile.family,duration:reloadDuration});
  viewmodelActionKind='reload';pendingReload={kind,cap,empty,loaded:false};reloadAnimationDuration=viewmodelActionTimeline.duration;reloadAnimationTime=0;reloading=true;
  toast(empty?'EMPTY RELOAD':'TACTICAL RELOAD');
}
function chamberCheck(){
  if(!started||extractionSequence||reloading||pendingWeaponSwitch||viewmodelActionTimeline.active)return;
  const profile=weaponProfiles[currentWeapon];
  if(profile.family==='pistol'&&pistolSlideLocked&&ammo.pistol<=0){ensureAudio();audio.playWeaponMechanism('pistol','dryFire',{gain:.48});toast('SLIDE LOCKED - RELOAD REQUIRED');return}
  fireHeld=false;setAim(false);
  viewmodelActionTimeline.start(TacticalWeaponAction.CHAMBER,{weapon:profile.family});viewmodelActionKind='chamber';
  toast(profile.family==='pistol'?'CHAMBER CHECK':'BOLT CHECK');
}
function inspectWeapon(){
  if(!started||extractionSequence||reloading||pendingWeaponSwitch||viewmodelActionTimeline.active)return;
  const profile=weaponProfiles[currentWeapon];
  fireHeld=false;setAim(false);
  viewmodelActionTimeline.start(TacticalWeaponAction.INSPECT,{weapon:profile.family});viewmodelActionKind='inspect';
  toast(`${profile.uiName} INSPECTION`);
}
function finishPendingReload(){
  const pending=pendingReload;if(!pending||pending.loaded)return;
  const n=Math.min(pending.cap-ammo[pending.kind],reserve[pending.kind]);ammo[pending.kind]+=n;reserve[pending.kind]-=n;pending.loaded=true;
}
function completeWeaponSwitch(){
  const pending=pendingWeaponSwitch;
  if(!pending||!weaponHolders[pending.kind]){pendingWeaponSwitch=null;viewmodelActionKind=null;return}
  currentWeapon=pending.kind;fireMode=weaponModes[currentWeapon];pendingWeaponSwitch=null;
  for(const [weapon,holder] of Object.entries(weaponHolders))holder.visible=weapon===currentWeapon;
  attachFlashlightToWeapon(currentWeapon);equipAnimationTime=0;
  const profile=weaponProfiles[currentWeapon];
  viewmodelActionTimeline.start(TacticalWeaponAction.EQUIP,{weapon:profile.family});viewmodelActionKind='equip';hud();
}
function updateViewmodelAction(dt){
  const sample=viewmodelActionTimeline.update(dt),markers=viewmodelActionTimeline.consumeMarkers([]),profile=weaponProfiles[currentWeapon];
  updateRifleReloadMechanics(currentWeapon,viewmodelActionTimeline.normalizedTime,viewmodelActionKind==='reload'&&profile.family==='rifle');
  updatePistolReloadMechanics(currentWeapon,viewmodelActionTimeline.normalizedTime,viewmodelActionKind==='reload'&&profile.family==='pistol',viewmodelActionTimeline.profile);
  for(const marker of markers){
    if(viewmodelActionKind==='reload'){
      if(marker.name==='magOut')audio.playWeaponMechanism(profile.family,'magOut');
      if(marker.name==='freshMag'){finishPendingReload();audio.playWeaponMechanism(profile.family,'magIn')}
      if(marker.name==='boltRelease'||marker.name==='slideRelease'){
        audio.playWeaponMechanism(profile.family,profile.family==='pistol'?'slide':'charge');
        if(profile.family==='pistol'&&pistolSlideLocked){pistolSlideLocked=false;pistolSlideTime=.055}
      }
      if(marker.name==='ready'){finishPendingReload();reloading=false;pendingReload=null;viewmodelActionKind=null;hud()}
    }else if(viewmodelActionKind==='chamber'){
      if(marker.name==='handleBack'||marker.name==='slideBack')audio.playWeaponMechanism(profile.family,profile.family==='pistol'?'slide':'charge');
      if(marker.name==='chambered'&&profile.family==='pistol'){pistolSlideLocked=false;pistolSlideTime=-1}
      if(marker.name==='ready')viewmodelActionKind=null;
    }else if(viewmodelActionKind==='holster'){
      if(marker.name==='lowered')audio.playWeaponMechanism(profile.family,'equip',{gain:.28});
      if(marker.name==='hidden')completeWeaponSwitch();
    }else if(viewmodelActionKind==='inspect'){
      if(marker.name==='raise')audio.playWeaponMechanism(profile.family,'equip',{gain:profile.family==='pistol'?.19:.24});
      if(marker.name==='ready')viewmodelActionKind=null;
    }else if(viewmodelActionKind==='equip'){
      if(marker.name==='shoulder'||marker.name==='raised')audio.playWeaponMechanism(profile.family,'equip',{gain:.56});
      if(marker.name==='ready')viewmodelActionKind=null;
    }
  }
  if(viewmodelActionKind==='reload'){
    reloadAnimationTime=viewmodelActionTimeline.time;
    if(!viewmodelActionTimeline.active){finishPendingReload();reloading=false;pendingReload=null;viewmodelActionKind=null;hud()}
  }else if(viewmodelActionKind&& !viewmodelActionTimeline.active){
    if(viewmodelActionKind==='holster'&&pendingWeaponSwitch)completeWeaponSwitch();
    else viewmodelActionKind=null;
  }
  return sample;
}
function switchWeapon(kind){
  if(!started||extractionSequence||reloading||pendingWeaponSwitch||viewmodelActionTimeline.active||kind===currentWeapon||!weaponHolders[kind])return;
  fireHeld=false;setAim(false);pendingWeaponSwitch={kind,from:currentWeapon};
  viewmodelActionTimeline.start(TacticalWeaponAction.HOLSTER,{weapon:weaponProfiles[currentWeapon].family});viewmodelActionKind='holster';equipAnimationTime=0;
  toast(`STOWING ${weaponProfiles[currentWeapon].uiName}`);
}
function setAim(value){
  aiming=value&&!sprinting&&!pendingWeaponSwitch&&!viewmodelActionTimeline.active;
}
function toggleMode(){if(extractionSequence)return;const profile=weaponProfiles[currentWeapon];if(profile.fireModes.length<2)return;const index=profile.fireModes.indexOf(fireMode);fireMode=profile.fireModes[(index+1)%profile.fireModes.length];weaponModes[currentWeapon]=fireMode;audio.playWeaponMechanism(profile.family,'selector');toast(`FIRE MODE · ${fireMode.toUpperCase()}`);hud()}
function updateWeapon(dt,t){
  equipAnimationTime=Math.min(.5,equipAnimationTime+dt);
  const actionSample=updateViewmodelAction(dt);
  updatePistolSlide(dt,actionSample);
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
  const actionActive=viewmodelActionTimeline.active||viewmodelActionKind!==null;
  const actionDip=actionActive?(actionSample?.weaponDip||0):0,actionSupport=actionActive?(actionSample?.supportHand||0):0,inspectWeight=actionActive?(actionSample?.inspect||0):0;
  const reloadWave=reloading?Math.max(Math.sin(reloadProgress*Math.PI),actionDip):actionDip;
  const twoHanded=profile.family!=='pistol';
  target.x+=reloadWave*(twoHanded?.16:.12);
  target.y-=reloadWave*(twoHanded?.25:.2)+equipDrop*.3;
  target.z+=reloadWave*.045;
  // An inspect holds the weapon closer and rolls it inward. The action curve
  // returns to zero before the timeline's ready marker, so it cannot leave the
  // viewmodel stranded if the player immediately transitions back to combat.
  target.x+=inspectWeight*(twoHanded?.075:.052);
  target.y+=inspectWeight*(twoHanded?.022:.015);
  target.z+=inspectWeight*(twoHanded?.09:.06);
  const landingMultiplier=profile.landingMultiplier??1;
  target.y-=landingResponse*.18*landingMultiplier;target.z+=landingResponse*.025*landingMultiplier;
  target.x+=actionDip*(twoHanded?.035:.024);target.y-=actionDip*(twoHanded?.055:.04);target.z+=actionDip*.018;
  const bob=(moving?(sprinting?.018:.008):.0015)*(profile.bobMultiplier??1);
  const adsSteady=1-aimBlend*.82;
  target.x+=(Math.sin(t*(sprinting?10:7))*bob+swayX*.00012)*adsSteady;
  target.y-=(Math.abs(Math.cos(t*(sprinting?10:7)))*bob*.7+swayY*.0001)*adsSteady;
  target.z+=recoil;
  weaponRoot.position.lerp(target,1-Math.pow(.001,dt));recoil=Math.max(0,recoil-dt*(profile.recoilRecovery??.35));
  swayX=THREE.MathUtils.damp(swayX,0,9,dt);swayY=THREE.MathUtils.damp(swayY,0,9,dt);
  const rx=(sprinting?.42:0)+recoilPitch+reloadWave*.18+actionDip*.08+equipDrop*.1-inspectWeight*(twoHanded?.34:.24)+landingResponse*.28*landingMultiplier;
  const ry=(sprinting?.22:THREE.MathUtils.lerp(-.05,0,aimBlend))+inspectWeight*(twoHanded?.94:.74);
  const rz=(sprinting?-.32:0)+reloadWave*(twoHanded?.68:.5)+actionSupport*(twoHanded?.12:.08)+equipDrop*.24+inspectWeight*(twoHanded?.14:.1)-landingResponse*.08;
  weaponRoot.rotation.x+=(rx-weaponRoot.rotation.x)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.y+=(ry-weaponRoot.rotation.y)*(1-Math.exp(-8*dt));
  weaponRoot.rotation.z+=(rz-weaponRoot.rotation.z)*(1-Math.exp(-7*dt));
  recoilPitch=Math.max(0,recoilPitch-dt*(profile.recoilPitchRecovery??.42));
  landingResponse=Math.max(0,landingResponse-dt*.58);
  updatePlayerArms(dt,t,reloadWave,equipDrop,actionActive?actionSample:null);
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
let extractionSequence=null;
const playerEyeHeight=1.72,playerJumpVelocity=4.15,playerGravity=13.5;
let playerVerticalVelocity=0,playerGrounded=true,landingResponse=0;
const keys={},clock=new THREE.Clock(),moveVelocity=new THREE.Vector3(),audioForward=new THREE.Vector3(),extractionPoint=new THREE.Vector3(0,1.72,-172),extractionRunTarget=new THREE.Vector3(0,1.72,-204);
const extractionPursuitAnchors=[
  new THREE.Object3D(),new THREE.Object3D(),new THREE.Object3D(),new THREE.Object3D()
];
for(const [index,anchor] of extractionPursuitAnchors.entries()){
  const positions=[[-10,1.45,-169],[11,1.6,-174],[-15,1.5,-183],[14,1.55,-188]];
  anchor.name=`extraction-pursuit-fire-${index+1}`;
  anchor.position.set(...positions[index]);anchor.rotation.y=index%2?Math.PI*.78:-Math.PI*.78;scene.add(anchor);
}
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
  if(next.z>8.3||next.z<-179.4)return false;
  if(indoors&&Math.abs(next.x)>8.45)return false;
  if(!indoors&&Math.abs(next.x)>42.35)return false;
  collisionPoint.set(next.x,1,next.z);
  if(staticColliderBounds.some(bounds=>bounds.containsPoint(collisionPoint)))return false;
  let index=0;for(const collider of dynamicColliders){if(dynamicColliderBounds[index++].setFromObject(collider).expandByScalar(.3).containsPoint(collisionPoint))return false}
  return true;
}
function tryPlayerJump(){
  if(!started||extractionSequence||!playerGrounded||pendingWeaponSwitch)return;
  playerGrounded=false;playerVerticalVelocity=playerJumpVelocity;fireHeld=false;setAim(false);
}
function updatePlayerVerticalMotion(dt){
  if(playerGrounded){camera.position.y=playerEyeHeight;return}
  playerVerticalVelocity-=playerGravity*dt;camera.position.y+=playerVerticalVelocity*dt;
  if(camera.position.y>playerEyeHeight)return;
  const impactSpeed=Math.max(0,-playerVerticalVelocity);
  camera.position.y=playerEyeHeight;playerVerticalVelocity=0;playerGrounded=true;
  if(impactSpeed<1.2)return;
  landingResponse=THREE.MathUtils.clamp(impactSpeed*.012,.025,.09);
  const surface=worldOverhaul.outdoorBlend>.52?'grass':'hard';
  audio.playFootstep(surface,{sprinting});
  enemyAISystem.emitNoise({position:camera.position,type:'landing',loudness:.5,radius:7.5,sourceId:'specter-player',sourceFaction:'specter'});
}
function move(dt){
  if(extractionSequence)return;
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
  updatePlayerVerticalMotion(dt);
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
function startExtractionSequence(){
  if(missionWon||extractionSequence)return;
  ensureAudio();fireHeld=false;setAim(false);moveVelocity.set(0,0,0);playerVerticalVelocity=0;playerGrounded=true;landingResponse=0;camera.position.y=playerEyeHeight;for(const code of Object.keys(keys))keys[code]=false;controls.unlock?.();
  extractionSequence={time:0,startZ:camera.position.z,nextShotAt:clock.elapsedTime+1.38,nextCallAt:clock.elapsedTime+1.7,nextFootstepAt:clock.elapsedTime+1.08,shotIndex:0,called:false};
  worldOverhaul.setExtractionGateOpen(true);
  const gatePosition=worldOverhaul.extractionGate.group.getWorldPosition(new THREE.Vector3());
  audio.playDoor({position:gatePosition,open:true,heavy:true,gain:1.1});
  objective.textContent='EXFILTRATE: GATE OPENING';promptEl.textContent='';
  toast('EXTRACTION GATE OPENING');
}
function playExtractionPursuitCue(sequence,t){
  if(t>=sequence.nextShotAt){
    const anchor=extractionPursuitAnchors[sequence.shotIndex++%extractionPursuitAnchors.length];
    spawnMuzzleBurst(anchor,'rifle',.45,4.5);
    audio.playWeapon('rifle',{position:anchor.position,gain:.36,outdoorBlend:1});
    sequence.nextShotAt=t+.2+(sequence.shotIndex%3)*.11;
  }
  if(!sequence.called&&t>=sequence.nextCallAt){
    sequence.called=true;
    const caller=extractionPursuitAnchors[1];
    audio.playEnemyCall(caller.position,{type:'backup',radio:false,intensity:.78,gain:.72,maxDistance:58});
    showEnemySubtitle({role:'commander'},{type:'backup',radio:false,subtitle:'GATE! STOP HIM!',subtitleDuration:2300});
  }
}
function updateExtractionSequence(dt,t){
  const sequence=extractionSequence;if(!sequence)return;
  sequence.time+=dt;
  // The player has control until extraction is secured.  The final beats are
  // deliberately cinematic: a lower sprint pose, the gate travel, then a clean
  // run into the tree line rather than an abrupt victory-panel transition.
  moving=true;sprinting=true;aiming=false;camera.rotation.y=THREE.MathUtils.damp(camera.rotation.y,0,7,dt);camera.rotation.x=THREE.MathUtils.damp(camera.rotation.x,-.025,7,dt);
  if(sequence.time>1.02){
    const runBlend=THREE.MathUtils.smoothstep(sequence.time,1.02,4.0);
    camera.position.z=THREE.MathUtils.lerp(sequence.startZ,extractionRunTarget.z,runBlend);
    camera.position.x=THREE.MathUtils.damp(camera.position.x,0,8,dt);camera.position.y=1.72;
    if(t>=sequence.nextFootstepAt){
      audio.playFootstep('grass',{sprinting:true});sequence.nextFootstepAt=t+.31;
    }
    playExtractionPursuitCue(sequence,t);
  }
  if(sequence.time>3.12)extractionFade?.classList.add('active');
  if(sequence.time>=4.08)completeMission();
}
function completeMission(){
  if(missionWon)return;missionWon=true;started=false;fireHeld=false;setAim(false);controls.unlock?.();
  extractionSequence=null;
  scopeSurface.visible=false;document.getElementById('scopeOverlay').classList.remove('active');for(const visual of weaponRig[currentWeapon].visuals||[])visual.visible=true;playerArmsRoot.visible=true;
  objective.textContent='MISSION COMPLETE · BLACKSITE SECURED';audio.setCombatIntensity(0,.8);
  document.getElementById('victoryStats').textContent=`${kills} HOSTILES NEUTRALIZED · POWER RESTORED · EXTRACTION REACHED`;
  document.getElementById('victoryPanel').classList.add('active');
}

addEventListener('keydown',e=>{if(extractionSequence){e.preventDefault();return}if(e.code==='KeyG'&&!e.repeat){e.preventDefault();toggleGraphicsPanel();return}if(e.code==='Space'){e.preventDefault();if(!e.repeat)tryPlayerJump();return}keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){lightOn=!lightOn;flashlight.visible=lightOn;hud()}if(e.code==='KeyR')reload();if(e.code==='KeyC'&&!e.repeat)chamberCheck();if(e.code==='KeyI'&&!e.repeat)inspectWeapon();if(e.code==='KeyB'&&!e.repeat)toggleMode();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol');if(e.code==='Digit3')switchWeapon('compact');if(e.code==='Digit4')switchWeapon('marksman');if(e.code==='Digit5')switchWeapon('suppressed')});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{if(e.target.closest?.('#graphicsPanel,#graphicsQuickButton'))return;if(!started||extractionSequence)return;ensureAudio();if(e.button===0){fireHeld=true;shoot()}if(e.button===2)setAim(embeddedMouseLook?!aiming:true)});
addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2&&!embeddedMouseLook)setAim(false)});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{fireHeld=false;setAim(false);for(const code of Object.keys(keys))keys[code]=false;moveVelocity.set(0,0,0)});
let fallbackPointerX=null,fallbackPointerY=null;
addEventListener('mousemove',e=>{
  const clientDx=fallbackPointerX===null?0:e.clientX-fallbackPointerX;
  const clientDy=fallbackPointerY===null?0:e.clientY-fallbackPointerY;
  fallbackPointerX=e.clientX;fallbackPointerY=e.clientY;
  if(!started||extractionSequence)return;
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
  if(localQAMode==='forest'){restorePower();camera.position.set(-39.2,1.72,-60.5);camera.lookAt(-51.2,4.7,-60.5);previousAIPlayerPosition.copy(camera.position)}
  if(localQAMode==='breaker'){camera.position.set(-5.98,1.72,5.4);camera.rotation.set(0,Math.PI/2,0);previousAIPlayerPosition.copy(camera.position)}
  if(localQAMode==='storage'){restorePower();camera.position.set(-5.95,1.72,-98);camera.rotation.set(0,Math.PI/2,0);previousAIPlayerPosition.copy(camera.position)}
  if(localQAMode==='utility'){restorePower();camera.position.set(0,1.72,-166);camera.rotation.set(0,0,0);previousAIPlayerPosition.copy(camera.position)}
  if(localQAMode==='victory'){
    restorePower();for(const enemy of enemies){if(!enemy.userData.dead){const deathDirection=enemyReactionDirection(enemy);enemy.userData.health=0;enemy.userData.ai?.setHealth(0);beginEnemyDeath(enemy,deathDirection,{duration:1.18});kills++}}
    camera.position.copy(extractionPoint);previousAIPlayerPosition.copy(camera.position);hud();
  }
}
startButton.onclick=()=>{started=true;missionHasStarted=true;startPanel.style.display='none';ensureAudio();applyLocalQA();if(activeGraphicsPreference===AUTO_GRAPHICS_QUALITY||autoBenchmark.pending)beginAutoGraphicsBenchmark();beginMouseLook()};
renderer.domElement.onclick=()=>{if(started&&!extractionSequence&&!controls.isLocked&&!embeddedMouseLook)beginMouseLook()};
document.getElementById('restartButton').onclick=()=>location.reload();

await Promise.all([
  loadAudioAssets(),
  loadSetDressAsset('steelShelves','./assets/environment/polyhaven-steel-frame-shelves-01/steel_frame_shelves_01_2k.gltf','CC0 industrial shelf'),
  loadSetDressAsset('powerBox','./assets/environment/polyhaven-power-box-01/power_box_01_2k.gltf','CC0 power box'),
  loadSetDressAsset('plasticContainer','./assets/environment/polyhaven-plastic-container/plastic_container_2k.gltf','CC0 exterior container'),
  loadSetDressAsset('roadBarrier','./assets/environment/polyhaven-concrete-road-barrier-02/concrete_road_barrier_02_2k.gltf','CC0 road barrier'),
  loadAsset('ar15','./assets/ar15/scene.gltf'),
  loadAsset('m9','./assets/m9/scene.gltf'),
  loadAsset('soldier','./assets/soldier/scene.gltf')
]);
if(requiredAssetFailure){
  startButton.disabled=true;startButton.textContent='ASSET CHECK FAILED';loadMessage.textContent='A required model or texture failed to load. Check the diagnostics above.';
}else{
  installRifle();installPistol();installRifleVariants();installPlayerModel();installPlayerArms();installIndustrialShelving();installPowerBox();const exteriorContainerCount=installPlasticContainers(),roadBarrierCount=installRoadBarriers(),activePreset=graphics.getDiagnostics().preset;const propSummary=[assetMap.has('steelShelves')?'3 industrial shelves':'',assetMap.has('powerBox')?'animated power box':'',exteriorContainerCount?`${exteriorContainerCount} exterior containers`:'',roadBarrierCount?`${roadBarrierCount} road barriers`:'',worldOverhaul.utilityYard?'expanded utility yard':'',worldOverhaul.grass&&activePreset.grassEnabled?'6.8K grass clumps':worldOverhaul.grass?'grass disabled by preset':'' ].filter(Boolean).join(' · ');status('props','LOADED',propSummary||'procedural prop fallback');attachFlashlightToWeapon(currentWeapon);
  spawnEnemy(-2.5,-8,'rifleman');spawnEnemy(2.9,-18,'scout');spawnEnemy(-1.2,-27,'breacher');
  spawnEnemy(3.8,-54,'rifleman');spawnEnemy(-7.2,-68,'scout');spawnEnemy(8.5,-88,'breacher');spawnEnemy(-5.4,-108,'marksman');spawnEnemy(12,-122,'commander');
  spawnEnemy(12.5,-145,'scout');spawnEnemy(-14,-151,'breacher');spawnEnemy(6,-165,'marksman');spawnEnemy(-9,-170,'rifleman');
  applyGraphicsHardwareBudget(graphics.getDiagnostics().quality,graphics.getDiagnostics().preset);renderGraphicsControls();
  status('soldier','LOADED',`${enemies.length} tactical hostiles · 5 role kits · full-detail rifle geometry`);hud();
  missionAssetsReady=true;
  startButton.disabled=false;startButton.textContent='ENTER BLACKSITE';loadMessage.textContent='Assets verified. Mission ready.';
   updateForestFernsForGraphics(graphics.getDiagnostics().preset);updateForestHeroFirsForGraphics(graphics.getDiagnostics().preset);
}

function animate(){
  requestAnimationFrame(animate);
  const rawDt=clock.getDelta(),dt=Math.min(rawDt,.05),t=clock.elapsedTime;
  if(started){
    if(extractionSequence)updateExtractionSequence(dt,t);else move(dt);worldOverhaul.update(dt,camera);renderer.toneMappingExposure=THREE.MathUtils.lerp(1.02,.8,worldOverhaul.outdoorBlend);weaponFill.intensity=THREE.MathUtils.lerp(4.8,1.45,worldOverhaul.outdoorBlend);
    if(!exteriorEntered&&camera.position.z<-47){exteriorEntered=true;objective.textContent='OBJECTIVE: CLEAR THE CHECKPOINT AND PERIMETER';toast('EXTERIOR COMBAT ZONE ENTERED')}
    updatePlayerModel(t);updateWeapon(dt,t);updateWeaponEffects(dt);updateEnemies(dt,t);
    camera.getWorldDirection(audioForward);const combatIntensity=enemies.reduce((level,enemy)=>Math.max(level,enemy.userData.dead?0:enemy.userData.intent?.alertness||0),0);
    audio.update(dt,{outdoorBlend:worldOverhaul.outdoorBlend,combatIntensity,powerOn,listener:{position:camera.position,forward:audioForward,up:camera.up}});
    if(fireHeld&&fireMode==='auto')shoot();
    if(!extractionSequence&&powerOn&&kills>=enemies.length&&camera.position.distanceTo(extractionPoint)<6.6)startExtractionSequence();
    raycaster.setFromCamera(new THREE.Vector2(),camera);const h=raycaster.intersectObject(switchGroup,true)[0];
    promptEl.textContent=h&&h.distance<2.7&&!powerOn?'PRESS E — FLIP MAIN BREAKER':'';
    if(!extractionSequence)sampleAutoGraphicsBenchmark(rawDt);
  }
  renderScopeView(dt);graphics.render(dt);refreshGraphicsDiagnostics();
}
animate();

if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
addEventListener('resize',()=>{graphics.resize(innerWidth,innerHeight,devicePixelRatio);renderGraphicsMemoryEstimate(graphics.getDiagnostics().preset)});
