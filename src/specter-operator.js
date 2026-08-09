import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const canonical=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');

const BONE_NAMES={
  spine:'spine 3_05',
  chest:'spine 4_01',
  head:'head neck lower_06',
  rightShoulder:'arm right shoulder 2_011',
  rightElbow:'arm rght elbow_012',
  rightWrist:'arm right wrist_013',
  leftShoulder:'arm left shoulder 2_035',
  leftElbow:'arm left elbow_036',
  leftWrist:'arm left wrist_037',
  rightThigh:'leg right thigh_057',
  rightKnee:'leg right knee_058',
  leftThigh:'leg left thigh_061',
  leftKnee:'leg left knee_062'
};

function normalizeModel(object,height){
  object.updateMatrixWorld(true);
  let bounds=new THREE.Box3().setFromObject(object);
  const size=bounds.getSize(new THREE.Vector3());
  object.scale.multiplyScalar(height/(size.y||1));
  object.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(object);
  const center=bounds.getCenter(new THREE.Vector3());
  object.position.x-=center.x;object.position.z-=center.z;object.position.y-=bounds.min.y;
}

function classifyMaterial(name){
  const text=String(name||'').toLowerCase();
  if(text.includes('ground'))return 'ground';
  if(text.includes('material74'))return 'skin';
  if(text.includes('.eye.'))return 'eye';
  if(text.includes('goggle'))return 'lens';
  if(text.includes('.mask.'))return 'mask';
  if(text.includes('rsa05h'))return 'helmet';
  if(text.includes('material75')||text.includes('material76'))return 'uniform';
  if(text.includes('material77'))return 'boots';
  if(text.includes('material78'))return 'helmet';
  if(text.includes('material79'))return 'armor';
  if(text.includes('material81'))return 'gloves';
  if(text.includes('material73'))return 'pack';
  if(text.includes('material82')||text.includes('material83'))return 'pouches';
  return 'gear';
}

function tuneMaterial(source){
  const material=source.clone();
  const type=classifyMaterial(material.name);
  material.name=`SPECTER_${type}_${material.name}`;
  if(type==='uniform'){
    material.color.set(0x343b37);material.roughness=.9;material.metalness=.02;
  }else if(type==='armor'||type==='pack'||type==='pouches'){
    material.color.set(type==='armor'?0x252b28:0x303733);material.roughness=.82;material.metalness=.08;
  }else if(type==='boots'||type==='gloves'||type==='mask'){
    material.color.set(type==='gloves'?0x303633:0x202522);material.roughness=.88;material.metalness=.03;
  }else if(type==='helmet'){
    material.color.set(0x2b312e);material.roughness=.58;material.metalness=.22;
  }else if(type==='lens'){
    material.color.set(0x101a18);material.roughness=.12;material.metalness=.72;
  }else if(type==='skin'){
    material.color.set(0x8f8278);material.roughness=.9;material.metalness=0;
  }else if(type==='eye'){
    material.color.set(0x59645e);material.roughness=.25;material.metalness=0;
  }else{
    material.color.set(0x343b37);material.roughness=.78;material.metalness=.12;
  }
  material.side=THREE.FrontSide;
  material.needsUpdate=true;
  return {material,type};
}

function patchTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#171b19';ctx.fillRect(0,0,256,144);
  ctx.strokeStyle='#59635d';ctx.lineWidth=6;ctx.strokeRect(3,3,250,138);
  if(kind==='flag'){
    for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#262c29':'#6a746e';ctx.fillRect(8,8+i*18,240,18)}
    ctx.fillStyle='#222825';ctx.fillRect(8,8,105,72);ctx.fillStyle='#8b958f';
    for(let y=0;y<4;y++)for(let x=0;x<5;x++)ctx.fillRect(17+x*19,17+y*16,5,5);
  }else if(kind==='spade'){
    ctx.fillStyle='#929c96';ctx.font='bold 104px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♠',128,77);
  }else{
    ctx.fillStyle='#aab5af';ctx.font='bold 42px Consolas, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('SPECTER',128,76);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}

function makePatch(kind,width=.12,height=.075){
  const material=new THREE.MeshBasicMaterial({map:patchTexture(kind),side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
  const patch=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);patch.name=`SPECTER_${kind}_patch`;return patch;
}

function gearMesh(name,geometry,material){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

function setTransform(object,position,rotation=new THREE.Euler(),scale=null){
  object.position.copy(position);object.rotation.copy(rotation);if(scale)object.scale.copy(scale);return object;
}

function attachPreservingPose(root,bone,object){
  root.add(object);root.updateMatrixWorld(true);if(bone)bone.attach(object);return object;
}

function tube(name,start,end,radius,material,segments=10){
  const direction=end.clone().sub(start),length=direction.length();
  const mesh=gearMesh(name,new THREE.CylinderGeometry(radius,radius,length,segments),material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
}

function addEquipment(root,rig){
  const armor=new THREE.MeshStandardMaterial({color:0x222825,roughness:.7,metalness:.24});
  const fabric=new THREE.MeshStandardMaterial({color:0x303733,roughness:.9,metalness:.03});
  const rubber=new THREE.MeshStandardMaterial({color:0x171c1a,roughness:.92,metalness:0});
  const metal=new THREE.MeshStandardMaterial({color:0x303936,roughness:.38,metalness:.76});
  const lens=new THREE.MeshStandardMaterial({color:0x122a24,emissive:0x081b16,emissiveIntensity:.45,roughness:.12,metalness:.68});

  // Helmet rails, NVG shroud, IR strobe, headset cups, and boom microphone.
  attachPreservingPose(root,rig.head,setTransform(gearMesh('helmet-nvg-shroud',new THREE.BoxGeometry(.085,.075,.034),metal),new THREE.Vector3(0,1.69,.145),new THREE.Euler(-.13,0,0)));
  attachPreservingPose(root,rig.head,setTransform(gearMesh('helmet-ir-strobe',new THREE.BoxGeometry(.055,.025,.07),armor),new THREE.Vector3(0,1.81,.015),new THREE.Euler(0,0,0)));
  for(const side of [-1,1]){
    attachPreservingPose(root,rig.head,setTransform(gearMesh(`${side<0?'left':'right'}-headset`,new THREE.CylinderGeometry(.047,.047,.035,14),rubber),new THREE.Vector3(side*.116,1.62,.005),new THREE.Euler(0,0,Math.PI/2)));
    attachPreservingPose(root,rig.head,setTransform(gearMesh(`${side<0?'left':'right'}-helmet-rail`,new THREE.BoxGeometry(.027,.055,.13),armor),new THREE.Vector3(side*.105,1.71,.02),new THREE.Euler(0,0,side*.08)));
  }
  attachPreservingPose(root,rig.head,tube('boom-microphone',new THREE.Vector3(-.13,1.61,.025),new THREE.Vector3(-.074,1.55,.145),.008,rubber,8));
  attachPreservingPose(root,rig.head,setTransform(gearMesh('boom-microphone-tip',new THREE.SphereGeometry(.014,10,8),rubber),new THREE.Vector3(-.074,1.55,.145)));
  attachPreservingPose(root,rig.head,setTransform(gearMesh('goggle-lens-accent',new THREE.BoxGeometry(.205,.052,.018),lens),new THREE.Vector3(0,1.655,.155),new THREE.Euler(-.04,0,0)));

  // Three rifle magazines and the compact carrier admin pouch.
  for(const [index,x] of [-.09,0,.09].entries()){
    const magazine=gearMesh(`front-rifle-mag-${index+1}`,new THREE.BoxGeometry(.068,.205,.047),armor);
    setTransform(magazine,new THREE.Vector3(x,1.265,.19),new THREE.Euler(-.06,0,x*.5));attachPreservingPose(root,rig.chest,magazine);
  }
  attachPreservingPose(root,rig.chest,setTransform(gearMesh('carrier-admin-pouch',new THREE.BoxGeometry(.19,.09,.045),fabric),new THREE.Vector3(0,1.455,.185),new THREE.Euler(-.04,0,0)));
  attachPreservingPose(root,rig.chest,setTransform(gearMesh('carrier-radio',new THREE.BoxGeometry(.075,.145,.055),armor),new THREE.Vector3(-.205,1.28,.025),new THREE.Euler(0,0,.08)));
  attachPreservingPose(root,rig.chest,tube('radio-antenna',new THREE.Vector3(-.205,1.34,.01),new THREE.Vector3(-.18,1.72,-.02),.008,rubber,8));

  // Belt pouches, tourniquet, holster, and a visible secondary weapon silhouette.
  for(const [name,x,z] of [['utility-pouch-left',-.19,-.03],['utility-pouch-right',.19,-.03],['dump-pouch',-.16,-.11]]){
    const size=name==='dump-pouch'?new THREE.Vector3(.095,.13,.055):new THREE.Vector3(.075,.11,.055);
    attachPreservingPose(root,rig.spine,setTransform(gearMesh(name,new THREE.BoxGeometry(size.x,size.y,size.z),fabric),new THREE.Vector3(x,1.02,z),new THREE.Euler(0,0,x*.16)));
  }
  attachPreservingPose(root,rig.rightThigh,setTransform(gearMesh('drop-leg-platform',new THREE.BoxGeometry(.09,.18,.025),fabric),new THREE.Vector3(.145,.76,.005),new THREE.Euler(0,0,-.04)));
  attachPreservingPose(root,rig.rightThigh,setTransform(gearMesh('sidearm-holster',new THREE.BoxGeometry(.075,.17,.045),armor),new THREE.Vector3(.16,.76,.045),new THREE.Euler(-.08,0,-.04)));
  attachPreservingPose(root,rig.rightThigh,setTransform(gearMesh('holstered-m9-grip',new THREE.BoxGeometry(.03,.1,.035),rubber),new THREE.Vector3(.17,.85,.055),new THREE.Euler(-.2,0,-.14)));
  attachPreservingPose(root,rig.leftThigh,setTransform(gearMesh('tourniquet-pouch',new THREE.BoxGeometry(.065,.09,.04),fabric),new THREE.Vector3(-.145,.79,.03),new THREE.Euler(0,0,.04)));

  // Low-profile hard knee shells layered over the source model pads.
  for(const [bone,x,name] of [[rig.leftKnee,-.105,'left-knee-shell'],[rig.rightKnee,.105,'right-knee-shell']]){
    const pad=gearMesh(name,new THREE.SphereGeometry(.09,14,10,0,Math.PI*2,0,Math.PI*.62),armor);
    setTransform(pad,new THREE.Vector3(x,.51,.105),new THREE.Euler(Math.PI/2,0,0),new THREE.Vector3(.8,.45,1));attachPreservingPose(root,bone,pad);
  }

  // Subdued insignia from the supplied turnaround sheet.
  attachPreservingPose(root,rig.rightShoulder,setTransform(makePatch('flag',.11,.07),new THREE.Vector3(.235,1.47,.035),new THREE.Euler(0,Math.PI/2,0)));
  attachPreservingPose(root,rig.leftShoulder,setTransform(makePatch('spade',.1,.075),new THREE.Vector3(-.235,1.47,.035),new THREE.Euler(0,-Math.PI/2,0)));
  attachPreservingPose(root,rig.chest,setTransform(makePatch('name',.12,.055),new THREE.Vector3(.075,1.485,.211),new THREE.Euler(-.04,0,0)));

  return {armor,fabric,rubber,metal,lens};
}

function captureRig(model){
  const nodes=new Map();model.traverse(object=>nodes.set(canonical(object.name),object));
  const rig={};
  for(const [key,name] of Object.entries(BONE_NAMES)){
    const bone=nodes.get(canonical(name));if(bone)rig[key]=bone;
  }
  return rig;
}

export function buildSpecterOperator(sourceScene,{height=1.85,equipment=true}={}){
  const root=new THREE.Group();root.name='SPECTER_OPERATOR';
  const model=cloneSkeleton(sourceScene);model.name='SPECTER_RIGGED_BODY';
  normalizeModel(model,height);root.add(model);root.updateMatrixWorld(true);
  const materialTypes=new Map(),sourceMaps={uniform:null,gloves:null};
  model.traverse(object=>{
    if(!object.isMesh)return;
    if(object.name.toLowerCase().includes('ground')){object.visible=false;return}
    const original=Array.isArray(object.material)?object.material:[object.material];
    const tuned=original.map(entry=>{
      const result=tuneMaterial(entry);materialTypes.set(result.material,result.type);
      if(result.type==='uniform'&&!sourceMaps.uniform)sourceMaps.uniform=result.material.map;
      if(result.type==='gloves'&&!sourceMaps.gloves)sourceMaps.gloves=result.material.map;
      return result.material;
    });
    object.material=Array.isArray(object.material)?tuned:tuned[0];object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;
  });
  const rig=captureRig(model),gear=equipment?addEquipment(root,rig):null;
  const basePose={};for(const [name,bone] of Object.entries(rig))basePose[name]=bone.quaternion.clone();
  root.userData={kind:'specter-player',height,rig,basePose,sourceMaps,gear};
  return {root,model,rig,basePose,sourceMaps,gear};
}

const poseQuaternion=new THREE.Quaternion();
function poseBone(operator,name,x=0,y=0,z=0){
  const bone=operator.rig[name],base=operator.basePose[name];if(!bone||!base)return;
  poseQuaternion.setFromEuler(new THREE.Euler(x,y,z));bone.quaternion.copy(base).multiply(poseQuaternion);
}

export function poseSpecterOperator(operator,{time=0,moving=false,sprinting=false,aiming=false}={}){
  const pace=sprinting?10:7.2,stride=moving?Math.sin(time*pace):0,breath=Math.sin(time*1.7);
  poseBone(operator,'spine',aiming?-.07:breath*.012,0,moving?stride*.018:breath*.012);
  poseBone(operator,'head',0,0,0);
  poseBone(operator,'rightShoulder',aiming?-.9:-.14+stride*.08,0,aiming?.52:.06);
  poseBone(operator,'rightElbow',aiming?-.78:-.12,0,aiming?1.28:.28);
  poseBone(operator,'leftShoulder',aiming?-.9:-.14-stride*.08,0,aiming?-.52:-.06);
  poseBone(operator,'leftElbow',aiming?-.78:-.12,0,aiming?-1.28:-.28);
  poseBone(operator,'rightThigh',stride*(sprinting?.44:.3),0,0);poseBone(operator,'leftThigh',-stride*(sprinting?.44:.3),0,0);
  poseBone(operator,'rightKnee',Math.max(0,-stride)*(sprinting?.4:.28),0,0);poseBone(operator,'leftKnee',Math.max(0,stride)*(sprinting?.4:.28),0,0);
}

export function createSpecterViewMaterials(operator){
  const sleeve=new THREE.MeshBasicMaterial({map:operator?.sourceMaps?.uniform||null,color:0x718078,toneMapped:true});
  const glove=new THREE.MeshBasicMaterial({map:operator?.sourceMaps?.gloves||null,color:0x5d6962,toneMapped:true});
  sleeve.name='SPECTER_FIRST_PERSON_SLEEVE';glove.name='SPECTER_FIRST_PERSON_GLOVE';
  return {sleeve,glove};
}
