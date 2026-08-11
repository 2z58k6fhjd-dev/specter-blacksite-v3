import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const up=new THREE.Vector3(0,1,0);
const damp=(value,target,speed,dt)=>THREE.MathUtils.damp(value,target,speed,dt);

function mulberry32(seed){
  return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
}

function cloneTiledTexture(source,x,y,colorSpace=THREE.SRGBColorSpace){
  if(!source)return null;const texture=source.clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(x,y);texture.colorSpace=colorSpace;texture.needsUpdate=true;return texture;
}

function pbrTextureSet(textures,prefix,x,y){
  const map=cloneTiledTexture(textures[`${prefix}Albedo`],x,y,THREE.SRGBColorSpace),normalMap=cloneTiledTexture(textures[`${prefix}Normal`],x,y,THREE.NoColorSpace),orm=cloneTiledTexture(textures[`${prefix}Orm`],x,y,THREE.NoColorSpace);
  return {map,normalMap,roughnessMap:orm,metalnessMap:orm};
}

function setShadow(object,cast=true,receive=true){
  object.traverse(child=>{if(child.isMesh){child.castShadow=cast;child.receiveShadow=receive}});return object;
}

function createBox(name,size,material,position,rotation=null){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),material);mesh.name=name;mesh.position.copy(position);if(rotation)mesh.rotation.copy(rotation);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

function createCylinder(name,radius,length,material,position,rotation=null,segments=14){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,segments),material);mesh.name=name;mesh.position.copy(position);if(rotation)mesh.rotation.copy(rotation);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

function createCloudTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,512,256);const gradient=ctx.createRadialGradient(256,126,12,256,126,205);gradient.addColorStop(0,'rgba(234,241,243,.72)');gradient.addColorStop(.45,'rgba(181,197,202,.48)');gradient.addColorStop(1,'rgba(177,194,200,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function createLabelTexture(title,subtitle=''){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#111715';ctx.fillRect(0,0,768,256);ctx.fillStyle='#d8e3dc';ctx.fillRect(0,0,22,256);ctx.strokeStyle='#53615b';ctx.lineWidth=10;ctx.strokeRect(5,5,758,246);
  ctx.fillStyle='#e7f0eb';ctx.font='700 74px Consolas, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,397,102);
  if(subtitle){ctx.fillStyle='#9fb3a9';ctx.font='600 28px Consolas, monospace';ctx.fillText(subtitle,397,184)}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function addZoneSign(scene,title,subtitle,position,rotationY=0,width=3.4){
  const material=new THREE.MeshStandardMaterial({map:createLabelTexture(title,subtitle),roughness:.48,metalness:.12,emissive:0x1c2923,emissiveIntensity:.22});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width/3),material);sign.name=`zone-sign-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;sign.position.copy(position);sign.rotation.y=rotationY;sign.castShadow=true;scene.add(sign);return sign;
}

function addCloudBank(scene){
  const texture=createCloudTexture(),material=new THREE.SpriteMaterial({map:texture,color:0xb7c5ca,transparent:true,opacity:.44,depthWrite:false,fog:false});
  const clouds=new THREE.Group();clouds.name='exterior-cloud-bank';const random=mulberry32(92);
  for(let index=0;index<20;index++){
    const cloud=new THREE.Sprite(material.clone());cloud.position.set((random()-.5)*260,42+random()*38,-58-(random()*155));cloud.scale.set(35+random()*55,10+random()*18,1);cloud.material.opacity=.24+random()*.27;clouds.add(cloud);
  }
  scene.add(clouds);return clouds;
}

function addGrassBlades(scene){
  // Three crossed, tapered blades per clump give the PBR ground actual close
  // range depth.  They are one instanced draw and intentionally do not cast
  // individual shadows, so the high preset stays within a desktop frame budget.
  const geometry=new THREE.BufferGeometry(),bladeVertices=[
    -.035,0,-.012,.035,0,.012,.008,.42,.018,
    -.028,0,.024,.028,0,-.024,-.012,.34,.002,
    -.022,0,-.031,.022,0,.031,.018,.29,-.006
  ];
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(bladeVertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.94,metalness:0,side:THREE.DoubleSide});
  const count=6800,grass=new THREE.InstancedMesh(geometry,material,count),matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),random=mulberry32(4242),color=new THREE.Color();
  const isHardscape=(x,z)=>Math.abs(x)<5.2||
    (x>-31&&x<2&&z>-171&&z<-140)||
    (x>-31&&x<2&&z>-115&&z<-92)||
    (x>1&&x<30&&z>-131&&z<-70)||
    (x>-9&&x<9&&z>-181&&z<-163)||
    (x>-16&&x<16&&z>-69&&z<-47);
  for(let index=0;index<count;index++){
    let x=0,z=0,attempts=0;
    do{x=(random()-.5)*82;z=-49-random()*130;attempts++}while(isHardscape(x,z)&&attempts<16);
    position.set(x,-.005,z);quaternion.setFromAxisAngle(up,random()*Math.PI);scale.set(.7+random()*1.15,.65+random()*1.25,.7+random()*1.15);matrix.compose(position,quaternion,scale);grass.setMatrixAt(index,matrix);
    color.setHSL(.25+random()*.06,.28+random()*.2,.19+random()*.09);grass.setColorAt(index,color);
  }
  grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;grass.computeBoundingSphere();grass.castShadow=false;grass.receiveShadow=true;grass.frustumCulled=true;grass.name='instanced-exterior-grass-clumps';scene.add(grass);return grass;
}

function addForestInstanceLayer(name,geometry,material,trees,transform,{castShadow=false,receiveShadow=false,colorOffset=0,hueOffset=0,saturationOffset=0,lightnessMultiplier=1}={}){
  const mesh=new THREE.InstancedMesh(geometry,material,trees.length),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion(),color=new THREE.Color();
  mesh.name=name;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);mesh.userData.maxInstances=trees.length;mesh.userData.forestLod=name.includes('near')?'near':name.includes('mid')?'mid':'far';mesh.userData.forestCastsShadow=castShadow;
  for(let index=0;index<trees.length;index++){
    const tree=trees[index];transform(tree,position,scale);quaternion.setFromAxisAngle(up,tree.rotation);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(index,matrix);
    if(material.vertexColors){
      color.setHSL((tree.hue+hueOffset+1)%1,THREE.MathUtils.clamp(tree.saturation+saturationOffset,.08,.82),THREE.MathUtils.clamp(tree.lightness*lightnessMultiplier+colorOffset,.08,.72));mesh.setColorAt(index,color);
    }
  }
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;mesh.frustumCulled=true;return mesh;
}

function createCrossedBillboardGeometry(){
  // Two perpendicular cards are kept in one indexed geometry, allowing every
  // photo tree to be submitted through one InstancedMesh draw call rather than
  // one Sprite / draw per tree.
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    -.5,0,0, .5,0,0, .5,1,0, -.5,1,0,
    0,0,-.5, 0,0,.5, 0,1,.5, 0,1,-.5
  ],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1
  ],2));
  geometry.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);geometry.computeBoundingSphere();return geometry;
}

function addForestBackdrop(scene,groundMaterial,firBillboard=null){
  // A licensed high-detail tree pack is not bundled yet. This is a deliberately
  // texture-free procedural fallback using the project's existing material
  // palette; it is not presented as a substitute for authored 4K foliage.
  const forest=new THREE.Group();forest.name='pnw-perimeter-forest';
  const forestFloor=new THREE.Mesh(new THREE.PlaneGeometry(460,440),groundMaterial);forestFloor.name='pnw-forest-floor';forestFloor.rotation.x=-Math.PI/2;forestFloor.position.set(0,-.16,-244);forestFloor.receiveShadow=true;forest.add(forestFloor);
  const trunkMaterial=new THREE.MeshStandardMaterial({color:0x5b422a,emissive:0x120b06,emissiveIntensity:.24,roughness:.98,metalness:0,flatShading:false});
  const lowerNeedleMaterial=new THREE.MeshStandardMaterial({color:0x2e7139,emissive:0x0b2110,emissiveIntensity:.3,roughness:.97,metalness:0,flatShading:false});
  const upperNeedleMaterial=lowerNeedleMaterial.clone();upperNeedleMaterial.color.setHex(0x3d8145);upperNeedleMaterial.emissive.setHex(0x102912);
  const trunkGeometry=new THREE.CylinderGeometry(.28,.42,1,10,2),needleGeometry=new THREE.ConeGeometry(1,1,12,3);
  const random=mulberry32(7716),nearTrees=[],midTrees=[],farTrees=[];
  const makeTree=(x,z,height)=>({x,z,height,crown:.78+random()*.52,rotation:random()*Math.PI*2,hue:.27+random()*.045,saturation:.22+random()*.18,lightness:.15+random()*.11});
  // The closest row sits beyond the physical fence. No tree mesh is added to
  // collision, so the existing readable combat boundary remains authoritative.
  for(let index=0;index<176;index++){
    const side=index%2?-1:1,x=side*(50+random()*18),z=-51-random()*132;
    nearTrees.push(makeTree(x,z,12+random()*12));
  }
  for(let index=0;index<348;index++){
    const x=(random()-.5)*204,z=-190-random()*104;
    midTrees.push(makeTree(x,z,14+random()*15));
  }
  for(let index=0;index<560;index++){
    const x=(random()-.5)*352,z=-286-random()*152;
    farTrees.push(makeTree(x,z,16+random()*19));
  }
  const layers=[];
  const addLayer=(name,geometry,material,trees,transform,options={})=>{const mesh=addForestInstanceLayer(name,geometry,material,trees,transform,options);forest.add(mesh);layers.push(mesh);return mesh};
  const trunkTransform=(tree,position,scale)=>{position.set(tree.x,tree.height*.36,tree.z);scale.set(tree.crown*.88,tree.height*.72,tree.crown*.88)};
  const lowerNeedleTransform=(tree,position,scale)=>{position.set(tree.x,tree.height*.42,tree.z);scale.set(tree.crown*2.75,tree.height*.56,tree.crown*2.75)};
  const middleNeedleTransform=(tree,position,scale)=>{position.set(tree.x,tree.height*.64,tree.z);scale.set(tree.crown*2.08,tree.height*.48,tree.crown*2.08)};
  const topNeedleTransform=(tree,position,scale)=>{position.set(tree.x,tree.height*.84,tree.z);scale.set(tree.crown*1.35,tree.height*.38,tree.crown*1.35)};
  const farNeedleTransform=(tree,position,scale)=>{position.set(tree.x,tree.height*.46,tree.z);scale.set(tree.crown*2.38,tree.height*.92,tree.crown*2.38)};
  const trunkColor={hueOffset:-.2,saturationOffset:-.13,lightnessMultiplier:1.35,colorOffset:.09};
  const lowerNeedleColor={saturationOffset:.08,lightnessMultiplier:1.5,colorOffset:.1};
  const upperNeedleColor={saturationOffset:.04,lightnessMultiplier:1.6,colorOffset:.13};
  addLayer('forest-near-trunks',trunkGeometry,trunkMaterial,nearTrees,trunkTransform,{castShadow:true,receiveShadow:true,...trunkColor});
  addLayer('forest-near-lower-needles',needleGeometry,lowerNeedleMaterial,nearTrees,lowerNeedleTransform,{castShadow:true,receiveShadow:true,...lowerNeedleColor});
  addLayer('forest-near-middle-needles',needleGeometry,upperNeedleMaterial,nearTrees,middleNeedleTransform,{castShadow:true,receiveShadow:true,...upperNeedleColor});
  addLayer('forest-near-top-needles',needleGeometry,upperNeedleMaterial,nearTrees,topNeedleTransform,{castShadow:true,receiveShadow:true,...upperNeedleColor,colorOffset:.18});
  addLayer('forest-mid-trunks',trunkGeometry,trunkMaterial,midTrees,trunkTransform,trunkColor);
  addLayer('forest-mid-lower-needles',needleGeometry,lowerNeedleMaterial,midTrees,lowerNeedleTransform,lowerNeedleColor);
  addLayer('forest-mid-top-needles',needleGeometry,upperNeedleMaterial,midTrees,middleNeedleTransform,upperNeedleColor);
  addLayer('forest-far-needles',needleGeometry,upperNeedleMaterial,farTrees,farNeedleTransform,{...upperNeedleColor,colorOffset:.1});

  // The authored photo-card layer is intentionally optional: low and medium
  // settings retain the procedural trees as the low-cost, distant fallback.
  // A generated CanvasTexture (or normal Texture) lets high-tier presets add
  // recognisable fir silhouettes without streaming the enormous raw tree mesh.
  let photoTreeLayer=null,photoTreeCount=0;
  if(firBillboard?.isTexture){
    firBillboard.colorSpace=THREE.SRGBColorSpace;
    const photoTreeMaterial=new THREE.MeshBasicMaterial({map:firBillboard,transparent:true,alphaTest:.09,side:THREE.DoubleSide,depthWrite:true,fog:true});
    const photoTreeGeometry=createCrossedBillboardGeometry(),photoTrees=[],photoRandom=mulberry32(59371);
    const addPhotoTree=(x,z)=>photoTrees.push({x,z,height:10+photoRandom()*12,width:5.6+photoRandom()*4.8,rotation:photoRandom()*Math.PI*2});
    // Keep these scenic cards just outside the perimeter and clear of the
    // extraction gate's sightline. They are never inserted into collision.
    for(let index=0;index<48;index++){
      const side=index%2?-1:1;addPhotoTree(side*(46+photoRandom()*10),-54-photoRandom()*120);
    }
    for(let index=0;index<24;index++){
      let x=0;do{x=(photoRandom()-.5)*152}while(Math.abs(x)<8);addPhotoTree(x,-188-photoRandom()*42);
    }
    photoTreeLayer=new THREE.InstancedMesh(photoTreeGeometry,photoTreeMaterial,photoTrees.length);photoTreeLayer.name='forest-high-tier-photo-impostors';photoTreeLayer.instanceMatrix.setUsage(THREE.StaticDrawUsage);photoTreeLayer.userData.maxInstances=photoTrees.length;photoTreeLayer.userData.forestLod='photo';photoTreeLayer.userData.highTierOnly=true;
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion();
    for(let index=0;index<photoTrees.length;index++){
      const tree=photoTrees[index];position.set(tree.x,-.14,tree.z);scale.set(tree.width,tree.height,tree.width);quaternion.setFromAxisAngle(up,tree.rotation);matrix.compose(position,quaternion,scale);photoTreeLayer.setMatrixAt(index,matrix);
    }
    photoTreeLayer.instanceMatrix.needsUpdate=true;photoTreeLayer.computeBoundingSphere();photoTreeLayer.castShadow=false;photoTreeLayer.receiveShadow=false;photoTreeLayer.visible=false;forest.add(photoTreeLayer);
  }
  scene.add(forest);

  const densityValue=value=>{
    if(typeof value==='number'&&Number.isFinite(value))return THREE.MathUtils.clamp(value,0,1);
    return ({off:0,low:.24,medium:.58,high:.84,ultra:.94,extreme:1}[String(value||'').toLowerCase()]??.84);
  };
  const activeTreeCounts={near:0,mid:0,far:0,photo:0};
  function setDensity(value,{photoEnabled=true}={}){
    const density=densityValue(value),fractions=density<=0?{near:0,mid:0,far:0}:{near:THREE.MathUtils.clamp((density-.24)/.76,0,1),mid:THREE.MathUtils.clamp((density-.08)/.92,0,1),far:Math.max(.18,density)};
    for(const mesh of layers){const lod=mesh.userData.forestLod;mesh.count=Math.round(mesh.userData.maxInstances*fractions[lod])}
    // High starts with a light silhouette pass; ultra and extreme fill the
    // whole deterministic batch. Off/low/medium do not render photo cards.
    const photoFraction=photoTreeLayer&&photoEnabled&&density>=.72?THREE.MathUtils.smoothstep(density,.72,1):0;
    photoTreeCount=photoTreeLayer?Math.round(photoTreeLayer.userData.maxInstances*photoFraction):0;
    if(photoTreeLayer){photoTreeLayer.count=photoTreeCount;photoTreeLayer.visible=photoTreeCount>0;photoTreeLayer.material.opacity=.48+.52*photoFraction}
    activeTreeCounts.near=Math.round(nearTrees.length*fractions.near);activeTreeCounts.mid=Math.round(midTrees.length*fractions.mid);activeTreeCounts.far=Math.round(farTrees.length*fractions.far);activeTreeCounts.photo=photoTreeCount;forest.visible=density>0;
    return {density,near:activeTreeCounts.near,mid:activeTreeCounts.mid,far:activeTreeCounts.far,photo:activeTreeCounts.photo,total:activeTreeCounts.near+activeTreeCounts.mid+activeTreeCounts.far+activeTreeCounts.photo};
  }
  function setShadows(enabled){for(const mesh of layers)mesh.castShadow=Boolean(enabled&&mesh.userData.forestCastsShadow)}
  return {group:forest,layers,setDensity,setShadows,get activeTreeCounts(){return {...activeTreeCounts}}};
}

function createBarrier(material,x,z,rotation=0){
  const group=new THREE.Group();group.name='jersey-barrier';group.position.set(x,0,z);group.rotation.y=rotation;
  const base=createBox('barrier-base',new THREE.Vector3(1.9,.24,.72),material,new THREE.Vector3(0,.12,0));
  const body=createBox('barrier-body',new THREE.Vector3(1.72,.72,.42),material,new THREE.Vector3(0,.55,0));body.geometry.translate(0,0,0);group.add(base,body);return group;
}

function createArmoredVehicle(materials){
  const {paint,glass,rubber,metal}=materials,vehicle=new THREE.Group();vehicle.name='armored-response-vehicle';vehicle.position.set(-12,0,-79);vehicle.rotation.y=.22;
  vehicle.add(createBox('vehicle-lower',new THREE.Vector3(4.7,.72,2.05),paint,new THREE.Vector3(0,.72,0)));
  vehicle.add(createBox('vehicle-cabin',new THREE.Vector3(2.45,1.05,1.86),paint,new THREE.Vector3(-.25,1.52,0)));
  vehicle.add(createBox('vehicle-hood',new THREE.Vector3(1.65,.42,1.92),paint,new THREE.Vector3(1.75,1.16,0)));
  vehicle.add(createBox('windshield',new THREE.Vector3(.035,.72,1.62),glass,new THREE.Vector3(.98,1.68,0),new THREE.Euler(0,0,-.25)));
  vehicle.add(createBox('rear-window',new THREE.Vector3(.035,.62,1.52),glass,new THREE.Vector3(-1.5,1.66,0),new THREE.Euler(0,0,.12)));
  for(const x of [-1.45,1.45])for(const z of [-1.02,1.02]){
    const wheel=createCylinder('vehicle-wheel',.48,.34,rubber,new THREE.Vector3(x,.55,z),new THREE.Euler(Math.PI/2,0,0),18);vehicle.add(wheel);
    const hub=createCylinder('wheel-hub',.2,.36,metal,new THREE.Vector3(x,.55,z),new THREE.Euler(Math.PI/2,0,0),14);vehicle.add(hub);
  }
  const lightMaterial=new THREE.MeshStandardMaterial({color:0xeaf6f2,emissive:0xd8fff4,emissiveIntensity:2.2,roughness:.18});
  for(const z of [-.68,.68])vehicle.add(createBox('headlamp',new THREE.Vector3(.04,.22,.34),lightMaterial,new THREE.Vector3(2.38,1.12,z)));
  setShadow(vehicle);return vehicle;
}

function createUtilityTruck(materials,position,rotation=0){
  const {paint,glass,rubber,metal}=materials,truck=new THREE.Group();truck.name='modern-utility-truck';truck.position.copy(position);truck.rotation.y=rotation;
  truck.add(createBox('truck-chassis',new THREE.Vector3(5.6,.38,2.15),metal,new THREE.Vector3(0,.72,0)));
  truck.add(createBox('truck-cab',new THREE.Vector3(1.85,1.55,2.02),paint,new THREE.Vector3(1.55,1.48,0)));
  truck.add(createBox('truck-hood',new THREE.Vector3(1.15,.62,2.04),paint,new THREE.Vector3(2.95,1.12,0)));
  truck.add(createBox('truck-bed',new THREE.Vector3(2.75,.18,2.04),paint,new THREE.Vector3(-1.15,1.02,0)));
  for(const z of [-.97,.97])truck.add(createBox('truck-bed-rail',new THREE.Vector3(2.75,.55,.08),paint,new THREE.Vector3(-1.15,1.33,z)));
  truck.add(createBox('truck-windshield',new THREE.Vector3(.05,.72,1.7),glass,new THREE.Vector3(2.26,1.68,0),new THREE.Euler(0,0,-.17)));
  for(const x of [-1.75,1.65,2.55])for(const z of [-1.08,1.08]){
    truck.add(createCylinder('truck-wheel',.47,.34,rubber,new THREE.Vector3(x,.55,z),new THREE.Euler(Math.PI/2,0,0),18));
    truck.add(createCylinder('truck-hub',.19,.36,metal,new THREE.Vector3(x,.55,z),new THREE.Euler(Math.PI/2,0,0),14));
  }
  setShadow(truck);return truck;
}

function createShippingContainer(materials,position,rotation=0,color=0x46524c){
  const container=new THREE.Group();container.name='shipping-container';container.position.copy(position);container.rotation.y=rotation;
  const shell=new THREE.MeshStandardMaterial({color,roughness:.64,metalness:.52}),dark=materials.trim;
  container.add(createBox('container-shell',new THREE.Vector3(2.45,2.45,6),shell,new THREE.Vector3(0,1.225,0)));
  for(let z=-2.6;z<=2.6;z+=.52){
    container.add(createBox('container-rib-left',new THREE.Vector3(.055,2.25,.09),dark,new THREE.Vector3(-1.255,1.225,z)));
    container.add(createBox('container-rib-right',new THREE.Vector3(.055,2.25,.09),dark,new THREE.Vector3(1.255,1.225,z)));
  }
  for(const x of [-.84,0,.84])container.add(createBox('container-door-rib',new THREE.Vector3(.08,2.05,.06),dark,new THREE.Vector3(x,1.22,-3.04)));
  setShadow(container);return container;
}

function createCheckpointCompound({scene,collision,materials}){
  const {concrete,darkConcrete,metal,trim,glass,asphalt,warning}=materials;
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(28,19),asphalt);pad.name='checkpoint-pad';pad.rotation.x=-Math.PI/2;pad.position.set(0,-.096,-58);pad.receiveShadow=true;scene.add(pad);
  const hut=new THREE.Group();hut.name='security-checkpoint';hut.position.set(-10.5,0,-56.5);
  hut.add(createBox('guardhouse-floor',new THREE.Vector3(5.6,.22,4.2),concrete,new THREE.Vector3(0,.11,0)));
  hut.add(createBox('guardhouse-back',new THREE.Vector3(5.6,2.7,.18),darkConcrete,new THREE.Vector3(0,1.46,-2.01)));
  hut.add(createBox('guardhouse-side',new THREE.Vector3(.18,2.7,4.2),darkConcrete,new THREE.Vector3(-2.71,1.46,0)));
  hut.add(createBox('guardhouse-front-low',new THREE.Vector3(5.4,.86,.16),darkConcrete,new THREE.Vector3(0,.54,2.01)));
  hut.add(createBox('guardhouse-window',new THREE.Vector3(5.2,1.35,.045),glass,new THREE.Vector3(0,1.62,2.11)));
  hut.add(createBox('guardhouse-roof',new THREE.Vector3(6.2,.22,4.8),metal,new THREE.Vector3(0,2.92,0)));
  hut.add(createBox('guardhouse-counter',new THREE.Vector3(4.4,.14,.72),trim,new THREE.Vector3(0,1.02,1.18)));
  scene.add(hut);setShadow(hut);const hutCollider=createBox('guardhouse-collider',new THREE.Vector3(5.7,2.7,4.3),darkConcrete,new THREE.Vector3(-10.5,1.35,-56.5));hutCollider.visible=false;scene.add(hutCollider);collision.push(hutCollider);
  for(const x of [-3.8,3.8]){
    const post=createCylinder('checkpoint-bollard',.12,1.15,warning,new THREE.Vector3(x,.575,-59.5),null,14);scene.add(post);collision.push(post);
  }
  const boomPivot=new THREE.Group();boomPivot.name='checkpoint-boom-gate';boomPivot.position.set(-3.5,1,-59.2);boomPivot.rotation.z=-1.14;
  boomPivot.add(createBox('boom-arm',new THREE.Vector3(6.2,.16,.18),warning,new THREE.Vector3(3.05,0,0)));scene.add(boomPivot);
  addZoneSign(scene,'CHECKPOINT','AUTHORIZED ACCESS ONLY',new THREE.Vector3(-10.5,3.7,-54.35),0,4.2);
  return {hut,boomPivot};
}

function createMotorPool({scene,collision,materials}){
  const {asphalt,metal,trim,paint}=materials;
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(30,16),asphalt);pad.name='motor-pool-pad';pad.rotation.x=-Math.PI/2;pad.position.set(14,-.094,-80);pad.receiveShadow=true;scene.add(pad);
  const canopy=new THREE.Group();canopy.name='motor-pool-canopy';canopy.position.set(15,0,-82);
  canopy.add(createBox('motor-pool-roof',new THREE.Vector3(13,.22,7.5),metal,new THREE.Vector3(0,3.35,0)));
  for(const x of [-6.1,0,6.1])for(const z of [-3.25,3.25])canopy.add(createBox('canopy-post',new THREE.Vector3(.18,3.3,.18),trim,new THREE.Vector3(x,1.65,z)));
  scene.add(canopy);setShadow(canopy);for(const x of [8.9,15,21.1])for(const z of [-85.25,-78.75]){
    const collider=createBox('canopy-post-collider',new THREE.Vector3(.3,3.3,.3),trim,new THREE.Vector3(x,1.65,z));collider.visible=false;scene.add(collider);collision.push(collider);
  }
  const truck=createUtilityTruck(materials,new THREE.Vector3(14,0,-82),-.13);scene.add(truck);const truckCollider=createBox('utility-truck-collider',new THREE.Vector3(6.1,2.5,2.5),paint,new THREE.Vector3(14,1.25,-82),new THREE.Euler(0,-.13,0));truckCollider.visible=false;scene.add(truckCollider);collision.push(truckCollider);
  addZoneSign(scene,'MOTOR POOL','VEHICLE CONTROL',new THREE.Vector3(15,3,-77.98),0,3.8);
  return {canopy,truck};
}

function createStorageYard({scene,collision,materials}){
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(32,21),materials.asphalt);pad.name='storage-yard-pad';pad.rotation.x=-Math.PI/2;pad.position.set(-14,-.093,-104);pad.receiveShadow=true;scene.add(pad);
  const placements=[[-19,-106,.04,0x48584e],[-15.9,-109.2,Math.PI/2,0x5b4437],[-21,-98.7,Math.PI/2,0x424d52]];
  const containers=[];
  for(const [x,z,r,color] of placements){const item=createShippingContainer(materials,new THREE.Vector3(x,0,z),r,color);scene.add(item);containers.push(item);const collider=createBox('container-collider',new THREE.Vector3(2.7,2.5,6.2),materials.metal,new THREE.Vector3(x,1.25,z),new THREE.Euler(0,r,0));collider.visible=false;scene.add(collider);collision.push(collider)}
  addZoneSign(scene,'STORAGE YARD','MATERIAL CONTROL',new THREE.Vector3(-7.3,2.3,-94.7),Math.PI/2,3.7);
  return containers;
}

function createCommunicationsArea({scene,collision,materials}){
  const {concrete,darkConcrete,metal,trim,warning}=materials;
  const slab=new THREE.Mesh(new THREE.PlaneGeometry(25,19),concrete);slab.name='communications-slab';slab.rotation.x=-Math.PI/2;slab.position.set(15,-.09,-120);slab.receiveShadow=true;scene.add(slab);
  const shed=new THREE.Group();shed.name='communications-shelter';shed.position.set(18,0,-121);
  shed.add(createBox('comms-shell',new THREE.Vector3(6.4,2.85,5),darkConcrete,new THREE.Vector3(0,1.425,0)));
  shed.add(createBox('comms-door',new THREE.Vector3(1.4,2.3,.08),metal,new THREE.Vector3(-1.45,1.15,2.55)));
  shed.add(createBox('comms-vent',new THREE.Vector3(1.25,.75,.09),trim,new THREE.Vector3(1.4,1.65,2.55)));
  for(let y=1.4;y<1.95;y+=.14)shed.add(createBox('comms-vent-slat',new THREE.Vector3(1.05,.045,.11),metal,new THREE.Vector3(1.4,y,2.61)));
  scene.add(shed);setShadow(shed);const shedCollider=createBox('communications-collider',new THREE.Vector3(6.6,2.9,5.2),darkConcrete,new THREE.Vector3(18,1.45,-121));shedCollider.visible=false;scene.add(shedCollider);collision.push(shedCollider);
  const tower=new THREE.Group();tower.name='communications-tower';tower.position.set(7,0,-123);
  for(const offset of [-1,1])for(const depth of [-1,1])tower.add(createBox('tower-leg',new THREE.Vector3(.13,13,.13),metal,new THREE.Vector3(offset,6.5,depth),new THREE.Euler(offset*.035,0,depth*.035)));
  for(let y=1;y<12.5;y+=1.4){tower.add(createBox('tower-brace-a',new THREE.Vector3(2.45,.09,.09),trim,new THREE.Vector3(0,y,-1),new THREE.Euler(0,0,(y%2?.55:-.55))));tower.add(createBox('tower-brace-b',new THREE.Vector3(.09,.09,2.45),trim,new THREE.Vector3(-1,y,0),new THREE.Euler((y%2?.55:-.55),0,0)))}
  const dish=new THREE.Mesh(new THREE.SphereGeometry(1.05,18,10,0,Math.PI*2,0,Math.PI*.42),metal);dish.name='microwave-dish';dish.scale.z=.22;dish.position.set(.15,9.5,-.85);dish.rotation.x=-.65;tower.add(dish);
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0xff3825,toneMapped:false}));beacon.position.set(0,13.3,0);tower.add(beacon);scene.add(tower);setShadow(tower);
  const generator=createBox('backup-generator',new THREE.Vector3(2.3,1.55,1.45),warning,new THREE.Vector3(10.8,.775,-117));scene.add(generator);collision.push(generator);
  addZoneSign(scene,'COMMS','RESTRICTED SYSTEMS',new THREE.Vector3(18,3.35,-118.42),0,3.5);
  return {shed,tower,generator,beacon};
}

function createUtilityYard({scene,collision,materials}){
  const {asphalt,concrete,darkConcrete,metal,trim,paint,rubber,warning}=materials;
  const group=new THREE.Group();group.name='utility-yard';
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(31,28),asphalt);pad.name='utility-yard-pad';pad.rotation.x=-Math.PI/2;pad.position.set(-15,-.094,-155);pad.receiveShadow=true;scene.add(pad);

  const pumpHouse=new THREE.Group();pumpHouse.name='utility-pump-house';pumpHouse.position.set(-20,0,-154);
  pumpHouse.add(createBox('pump-house-floor',new THREE.Vector3(7.1,.18,5.6),concrete,new THREE.Vector3(0,.09,0)));
  pumpHouse.add(createBox('pump-house-shell',new THREE.Vector3(6.55,2.9,4.9),darkConcrete,new THREE.Vector3(0,1.45,.15)));
  pumpHouse.add(createBox('pump-house-roof',new THREE.Vector3(7.25,.2,5.55),metal,new THREE.Vector3(0,3.02,.15)));
  pumpHouse.add(createBox('pump-house-door',new THREE.Vector3(1.32,2.28,.06),metal,new THREE.Vector3(-1.7,1.14,2.64)));
  for(let y=1.12;y<2.3;y+=.18)pumpHouse.add(createBox('pump-house-vent-slat',new THREE.Vector3(1.8,.06,.08),trim,new THREE.Vector3(1.4,y,2.66)));
  scene.add(pumpHouse);setShadow(pumpHouse);
  const houseCollider=createBox('pump-house-collider',new THREE.Vector3(6.8,3.1,5.2),darkConcrete,new THREE.Vector3(-20,1.55,-153.85));houseCollider.visible=false;scene.add(houseCollider);collision.push(houseCollider);

  const tankMaterial=paint.clone();tankMaterial.color.setHex(0x556866);
  const tanks=new THREE.Group();tanks.name='utility-fuel-tanks';
  for(const [x,z] of [[-10.3,-150.4],[-10.3,-158.6]]){
    const tank=createCylinder('horizontal-fuel-tank',1.16,4.9,tankMaterial,new THREE.Vector3(x,1.47,z),new THREE.Euler(0,0,Math.PI*.5),24);tank.castShadow=true;tank.receiveShadow=true;tanks.add(tank);
    for(const offset of [-1.55,1.55])tanks.add(createBox('fuel-tank-saddle',new THREE.Vector3(.32,.52,1.9),metal,new THREE.Vector3(x+offset,.34,z)));
    const tankCollider=createBox('fuel-tank-collider',new THREE.Vector3(5.2,2.45,2.6),tankMaterial,new THREE.Vector3(x,1.22,z));tankCollider.visible=false;scene.add(tankCollider);collision.push(tankCollider);
  }
  scene.add(tanks);

  const generator=createBox('utility-generator',new THREE.Vector3(3.3,1.65,1.7),warning,new THREE.Vector3(-3.9,.825,-157.8));scene.add(generator);collision.push(generator);
  const generatorCanopy=new THREE.Group();generatorCanopy.name='utility-generator-canopy';generatorCanopy.add(createBox('generator-canopy-roof',new THREE.Vector3(4.15,.12,2.45),metal,new THREE.Vector3(-3.9,2.6,-157.8)));
  for(const x of [-5.75,-2.05])for(const z of [-158.85,-156.75])generatorCanopy.add(createBox('generator-canopy-post',new THREE.Vector3(.12,2.5,.12),trim,new THREE.Vector3(x,1.25,z)));
  scene.add(generatorCanopy);setShadow(generatorCanopy);

  const containerA=createShippingContainer(materials,new THREE.Vector3(13.2,0,-148.8),Math.PI*.5,0x51595d),containerB=createShippingContainer(materials,new THREE.Vector3(14.8,0,-161.5),0,0x5a493a);scene.add(containerA,containerB);
  for(const [x,z,size,rotation] of [[13.2,-148.8,new THREE.Vector3(6.2,2.6,2.7),Math.PI*.5],[14.8,-161.5,new THREE.Vector3(2.7,2.6,6.2),0]]){
    const collider=createBox('utility-container-collider',size,metal,new THREE.Vector3(x,1.3,z),new THREE.Euler(0,rotation,0));collider.visible=false;scene.add(collider);collision.push(collider);
  }
  for(const [x,z] of [[-1.2,-146.8],[3.5,-153.5],[1.4,-165.2],[-7,-166]]){
    const crate=createBox('utility-supply-crate',new THREE.Vector3(1.45,1.18,1.25),darkConcrete,new THREE.Vector3(x,.59,z),new THREE.Euler(0,(x-z)*.04,0));scene.add(crate);collision.push(crate);
  }
  const serviceCart=createUtilityTruck(materials,new THREE.Vector3(4.5,0,-158.8),Math.PI*.92);serviceCart.name='utility-response-pickup';serviceCart.scale.set(.84,.84,.84);scene.add(serviceCart);const cartCollider=createBox('utility-pickup-collider',new THREE.Vector3(4.85,2.1,2.2),paint,new THREE.Vector3(4.5,1.05,-158.8),new THREE.Euler(0,Math.PI*.92,0));cartCollider.visible=false;scene.add(cartCollider);collision.push(cartCollider);
  addZoneSign(scene,'UTILITY YARD','PUMPS · FUEL · GENERATION',new THREE.Vector3(-10.4,3.2,-141.7),Math.PI/2,4.25);
  return {group,pumpHouse,tanks,generator,containers:[containerA,containerB],serviceCart};
}

function createExtractionZone(scene,materials){
  const group=new THREE.Group();group.name='extraction-zone';group.position.set(0,-.075,-172);
  const pad=new THREE.Mesh(new THREE.CircleGeometry(7.2,48),materials.asphalt);pad.rotation.x=-Math.PI/2;pad.receiveShadow=true;group.add(pad);
  const ringMaterial=new THREE.MeshBasicMaterial({color:0xd7e2d7,side:THREE.DoubleSide,toneMapped:false}),ring=new THREE.Mesh(new THREE.RingGeometry(5.65,5.95,48),ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.012;group.add(ring);
  for(const [x,z,w,d] of [[0,0,1.05,4.2],[-1.25,0,1.05,4.2],[1.25,0,1.05,4.2],[0,0,3.5,.92]]){
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(w,d),ringMaterial);mark.rotation.x=-Math.PI/2;mark.position.set(x,.018,z);group.add(mark);
  }
  const lampMaterial=new THREE.MeshStandardMaterial({color:0x8bc6a8,emissive:0x54ffb0,emissiveIntensity:2.2,roughness:.22});
  for(let index=0;index<12;index++){
    const angle=index/12*Math.PI*2,lamp=createCylinder('extraction-lamp',.085,.05,lampMaterial,new THREE.Vector3(Math.cos(angle)*6.35,.025,Math.sin(angle)*6.35),new THREE.Euler(0,0,Math.PI/2),10);group.add(lamp);
  }
  scene.add(group);addZoneSign(scene,'EXTRACTION','SECURE ZONE ECHO',new THREE.Vector3(0,2.55,-178.55),0,3.8);return group;
}

function createForestExtractionGate(scene,materials){
  const group=new THREE.Group();group.name='forest-extraction-gate';group.position.set(0,0,-180);
  const steel=materials.door.clone();steel.color.setHex(0x38453f);steel.roughness=.58;
  const hazard=new THREE.MeshStandardMaterial({color:0x4f3821,roughness:.58,metalness:.46});
  const left=new THREE.Group(),right=new THREE.Group();left.name='forest-gate-left';right.name='forest-gate-right';
  const makeLeaf=(root,sign)=>{
    const frame=createBox('forest-gate-leaf-frame',new THREE.Vector3(4.1,2.6,.12),steel,new THREE.Vector3(0,1.3,0));root.add(frame);
    for(let x=-1.62;x<=1.62;x+=.54){const bar=createBox('forest-gate-bar',new THREE.Vector3(.1,2.18,.06),steel,new THREE.Vector3(x,1.3,-.1));root.add(bar)}
    for(const y of [.48,1.22,1.96]){const rail=createBox('forest-gate-rail',new THREE.Vector3(3.82,.08,.07),steel,new THREE.Vector3(0,y,-.11));root.add(rail)}
    const stripe=createBox('forest-gate-hazard-stripe',new THREE.Vector3(2.4,.12,.075),hazard,new THREE.Vector3(sign*.35,2.16,-.13),new THREE.Euler(0,0,sign*.14));root.add(stripe);
  };
  makeLeaf(left,-1);makeLeaf(right,1);left.position.x=-2.08;right.position.x=2.08;
  const postMaterial=materials.trim;
  for(const x of [-4.32,4.32]){
    group.add(createBox('forest-gate-post',new THREE.Vector3(.28,3.25,.28),postMaterial,new THREE.Vector3(x,1.625,0)));
    const lamp=new THREE.PointLight(0xff6b32,.7,4,2);lamp.name='forest-gate-warning-lamp';lamp.position.set(x,3.24,-.18);group.add(lamp);
  }
  group.add(left,right);scene.add(group);setShadow(group);
  return {group,left,right,closedLeft:-2.08,closedRight:2.08,openLeft:-5.45,openRight:5.45,progress:0,target:0};
}

function createInteriorFurniture({scene,collision,materials}){
  const {desk,chair,locker,screen,metal}=materials;
  const addCollider=mesh=>{scene.add(mesh);collision.push(mesh);return mesh};
  const addDesk=(x,z,rotation=0)=>{
    const group=new THREE.Group();group.name='security-desk';group.position.set(x,0,z);group.rotation.y=rotation;
    group.add(createBox('desk-top',new THREE.Vector3(1.7,.1,.72),desk,new THREE.Vector3(0,.82,0)));
    group.add(createBox('desk-left',new THREE.Vector3(.12,.78,.62),metal,new THREE.Vector3(-.7,.39,0)));
    group.add(createBox('desk-right',new THREE.Vector3(.12,.78,.62),metal,new THREE.Vector3(.7,.39,0)));
    const monitor=createBox('monitor',new THREE.Vector3(.68,.42,.05),screen,new THREE.Vector3(0,1.16,-.08),new THREE.Euler(-.06,0,0));group.add(monitor);scene.add(group);
    const collider=createBox('desk-collider',new THREE.Vector3(1.65,.9,.7),desk,new THREE.Vector3(x,.45,z),new THREE.Euler(0,rotation,0));collider.visible=false;collision.push(collider);scene.add(collider);
    const seat=createBox('office-chair',new THREE.Vector3(.54,.72,.54),chair,new THREE.Vector3(x-.2,.46,z+.95),new THREE.Euler(0,rotation,0));addCollider(seat);
  };
  addDesk(-6.2,2.4,Math.PI/2);addDesk(6.25,-12.5,-Math.PI/2);addDesk(-6.15,-24.5,Math.PI/2);
  for(const [x,z,rotation] of [[-7.85,-3,0],[-7.85,-4.1,0],[-7.85,-5.2,0],[7.85,-25,0],[7.85,-26.1,0],[7.85,-27.2,0]]){
    const cabinet=createBox('equipment-locker',new THREE.Vector3(.82,1.92,.54),locker,new THREE.Vector3(x,.96,z),new THREE.Euler(0,rotation,0));addCollider(cabinet);
    for(let y=.25;y<1.8;y+=.28){const vent=createBox('locker-vent',new THREE.Vector3(.52,.025,.02),metal,new THREE.Vector3(x,y,z-.29));scene.add(vent)}
  }
  for(const z of [-35.5,-38.5,-41.5]){
    const rack=createBox('server-rack',new THREE.Vector3(1.05,2.05,.82),locker,new THREE.Vector3(6.9,1.025,z));addCollider(rack);
    for(let y=.25;y<1.85;y+=.22){const blade=createBox('server-blade',new THREE.Vector3(.78,.12,.035),metal,new THREE.Vector3(6.34,y,z));scene.add(blade)}
  }
}

function createBreakerBox(scene,materials){
  const {metal,trim,warning}=materials,group=new THREE.Group();group.name='breaker-box';group.position.set(-8.72,1.5,5.4);group.rotation.y=Math.PI/2;
  // A dark cavity and a proud metal frame make the breaker read as a cabinet
  // seated into the corridor wall rather than a floating interaction prop.
  const recessMaterial=trim.clone();recessMaterial.color.setHex(0x080d0b);recessMaterial.roughness=.72;
  const recess=createBox('breaker-wall-recess',new THREE.Vector3(.16,1.48,1.14),recessMaterial,new THREE.Vector3(.095,0,0));
  const recessFrameMaterial=metal.clone();recessFrameMaterial.color.setHex(0x313c38);recessFrameMaterial.roughness=.62;
  const frameTop=createBox('breaker-recess-frame-top',new THREE.Vector3(.08,.09,1.18),recessFrameMaterial,new THREE.Vector3(-.035,.74,0));
  const frameBottom=createBox('breaker-recess-frame-bottom',new THREE.Vector3(.08,.09,1.18),recessFrameMaterial,new THREE.Vector3(-.035,-.74,0));
  const frameLeft=createBox('breaker-recess-frame-left',new THREE.Vector3(.08,1.5,.09),recessFrameMaterial,new THREE.Vector3(-.035,0,-.545));
  const frameRight=createBox('breaker-recess-frame-right',new THREE.Vector3(.08,1.5,.09),recessFrameMaterial,new THREE.Vector3(-.035,0,.545));
  const enclosure=createBox('breaker-enclosure',new THREE.Vector3(.18,1.1,.78),metal,new THREE.Vector3(0,0,0));
  const inset=createBox('breaker-inset',new THREE.Vector3(.025,.78,.55),trim,new THREE.Vector3(-.105,0,0));
  const hinge=createCylinder('breaker-hinge',.035,.86,trim,new THREE.Vector3(-.13,0,-.38));
  const doorPivot=new THREE.Group();doorPivot.name='breaker-door-pivot';doorPivot.position.set(-.14,0,-.39);
  const doorPanel=createBox('breaker-door',new THREE.Vector3(.045,1.06,.76),metal,new THREE.Vector3(-.055,0,.38));doorPivot.add(doorPanel);
  const latch=createBox('breaker-door-latch',new THREE.Vector3(.07,.24,.08),trim,new THREE.Vector3(-.09,0,.71));doorPivot.add(latch);
  const leverPivot=new THREE.Group();leverPivot.name='breaker-lever-pivot';leverPivot.position.set(-.17,.05,0);
  const lever=createBox('breaker-main-handle',new THREE.Vector3(.12,.42,.14),warning,new THREE.Vector3(0,.13,0));leverPivot.add(lever);
  const busMaterial=new THREE.MeshStandardMaterial({color:0x8b7448,roughness:.34,metalness:.8});
  for(const z of [-.2,0,.2])leverPivot.add(createBox('breaker-toggle',new THREE.Vector3(.08,.13,.08),busMaterial,new THREE.Vector3(-.01,-.22,z)));
  const red=new THREE.MeshStandardMaterial({color:0x50120d,emissive:0xff2b17,emissiveIntensity:1.4,roughness:.24});
  const green=new THREE.MeshStandardMaterial({color:0x163a24,emissive:0x29ff83,emissiveIntensity:.1,roughness:.24});
  const redLamp=createCylinder('breaker-red-lamp',.055,.025,red,new THREE.Vector3(-.12,.39,-.18),new THREE.Euler(0,0,Math.PI/2),12);
  const greenLamp=createCylinder('breaker-green-lamp',.055,.025,green,new THREE.Vector3(-.12,.39,.18),new THREE.Euler(0,0,Math.PI/2),12);
  group.add(recess,frameTop,frameBottom,frameLeft,frameRight,enclosure,inset,hinge,doorPivot,leverPivot,redLamp,greenLamp);scene.add(group);setShadow(group);
  return {group,recess,doorPivot,doorPanel,leverPivot,redLamp,greenLamp,redMaterial:red,greenMaterial:green};
}

function createExitDoor(scene,collision,materials){
  const group=new THREE.Group();group.name='exterior-exit-door';group.position.set(0,0,-44.82);
  const doorMaterial=materials.door,windowMaterial=materials.glass;
  const left=createBox('exit-door-left',new THREE.Vector3(2.08,3.25,.2),doorMaterial,new THREE.Vector3(-1.06,1.62,0));
  const right=createBox('exit-door-right',new THREE.Vector3(2.08,3.25,.2),doorMaterial,new THREE.Vector3(1.06,1.62,0));
  const leftWindow=createBox('exit-window-left',new THREE.Vector3(.72,.42,.02),windowMaterial,new THREE.Vector3(-1.06,2.15,-.112));
  const rightWindow=createBox('exit-window-right',new THREE.Vector3(.72,.42,.02),windowMaterial,new THREE.Vector3(1.06,2.15,-.112));
  group.add(left,right,leftWindow,rightWindow);scene.add(group);collision.push(left,right);setShadow(group);
  return {group,left,right,leftWindow,rightWindow,closedLeft:-1.06,closedRight:1.06,openLeft:-3.05,openRight:3.05,progress:0,target:0};
}

export function buildWorldOverhaul({scene,collision,environmentTextures,facilityLights}){
  const paintedSet=pbrTextureSet(environmentTextures,'paintedMetal',3,3),concreteSet=pbrTextureSet(environmentTextures,'concrete',5,5),asphaltSet=pbrTextureSet(environmentTextures,'asphalt',7,9),rubberSet=pbrTextureSet(environmentTextures,'vehicleRubber',2,2),vehicleSet=pbrTextureSet(environmentTextures,'vehiclePaint',2,2),grassSet=pbrTextureSet(environmentTextures,'grassSoil',18,24);
  const metal=new THREE.MeshStandardMaterial({color:0x69736e,...paintedSet,normalScale:new THREE.Vector2(.25,.25),roughness:1,metalness:1});
  const trim=new THREE.MeshStandardMaterial({color:0x111816,roughness:.34,metalness:.86});
  const concrete=new THREE.MeshStandardMaterial({color:0xffffff,...concreteSet,normalScale:new THREE.Vector2(.55,.55),roughness:1,metalness:1});
  const darkConcrete=concrete.clone();darkConcrete.color.setHex(0x56605a);
  const door=metal.clone();door.color.setHex(0x56635d);
  const warning=metal.clone();warning.color.setHex(0xb35a32);
  const glass=new THREE.MeshPhysicalMaterial({color:0x7fa99a,roughness:.18,metalness:.04,transmission:.24,transparent:true,opacity:.66});
  const grassMaterial=new THREE.MeshStandardMaterial({color:0xffffff,...grassSet,normalScale:new THREE.Vector2(.55,.55),roughness:1,metalness:1});
  const asphalt=new THREE.MeshStandardMaterial({color:0xffffff,...asphaltSet,normalScale:new THREE.Vector2(.65,.65),roughness:1,metalness:1});
  const vehiclePaint=new THREE.MeshPhysicalMaterial({color:0xffffff,...vehicleSet,roughness:1,metalness:1,clearcoat:.65,clearcoatRoughness:.24});
  const rubber=new THREE.MeshStandardMaterial({color:0xffffff,...rubberSet,normalScale:new THREE.Vector2(.35,.35),roughness:1,metalness:1});
  const screen=new THREE.MeshStandardMaterial({color:0x11201b,emissive:0x1e9f6b,emissiveIntensity:.75,roughness:.19});
  const chair=new THREE.MeshStandardMaterial({color:0x242b28,roughness:.82,metalness:.14});
  const desk=metal.clone();desk.color.setHex(0x59635e);
  const locker=metal.clone();locker.color.setHex(0x4f5954);
  const materialSet={metal,trim,concrete,darkConcrete,door,warning,glass,grassMaterial,asphalt,paint:vehiclePaint,rubber,screen,chair,desk,locker};

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,142,1,1),grassMaterial);ground.name='exterior-grass-terrain';ground.rotation.x=-Math.PI/2;ground.position.set(0,-.12,-113);ground.receiveShadow=true;scene.add(ground);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(8.5,120),asphalt);road.name='service-road';road.rotation.x=-Math.PI/2;road.position.set(0,-.105,-108);road.receiveShadow=true;scene.add(road);
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(22,13),asphalt);apron.name='exit-apron';apron.rotation.x=-Math.PI/2;apron.position.set(0,-.1,-50);apron.receiveShadow=true;scene.add(apron);
  const grass=addGrassBlades(scene);
  const forest=addForestBackdrop(scene,grassMaterial,environmentTextures.firBillboard),clouds=addCloudBank(scene);

  const sky=new Sky();sky.name='physical-sky';sky.scale.setScalar(1100);scene.add(sky);
  const uniforms=sky.material.uniforms;uniforms.turbidity.value=7.2;uniforms.rayleigh.value=1.45;uniforms.mieCoefficient.value=.0032;uniforms.mieDirectionalG.value=.77;
  // Keep the low afternoon sun behind the player's right shoulder.  The old
  // azimuth put it directly into the QA exterior camera and washed out the sky.
  const phi=THREE.MathUtils.degToRad(90-34),theta=THREE.MathUtils.degToRad(45),sunPosition=new THREE.Vector3().setFromSphericalCoords(1,phi,theta);uniforms.sunPosition.value.copy(sunPosition);
  const sun=new THREE.DirectionalLight(0xffdfbd,1.65);sun.name='exterior-sun';sun.position.copy(sunPosition).multiplyScalar(110);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-48;sun.shadow.camera.right=48;sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;sun.shadow.camera.near=1;sun.shadow.camera.far=230;sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;scene.add(sun);
  const outdoorAmbient=new THREE.HemisphereLight(0x91aab5,0x263421,.48);outdoorAmbient.name='exterior-ambient';scene.add(outdoorAmbient);

  const exit=createExitDoor(scene,collision,materialSet),breaker=createBreakerBox(scene,materialSet);
  createInteriorFurniture({scene,collision,materials:materialSet});
  const checkpoint=createCheckpointCompound({scene,collision,materials:materialSet});
  const motorPool=createMotorPool({scene,collision,materials:materialSet});
  const storageYard=createStorageYard({scene,collision,materials:materialSet});
  const communications=createCommunicationsArea({scene,collision,materials:materialSet});
  const utilityYard=createUtilityYard({scene,collision,materials:materialSet});
  const extraction=createExtractionZone(scene,materialSet),extractionGate=createForestExtractionGate(scene,materialSet);

  // Loading bay details and exterior cover pieces.
  for(const [x,z] of [[-5.6,-36.2],[-3.9,-39.6],[3.9,-37.4]]){
    const pallet=createBox('cargo-pallet',new THREE.Vector3(1.5,.18,1.1),desk,new THREE.Vector3(x,.09,z));scene.add(pallet);collision.push(pallet);
    for(let level=0;level<2;level++)for(let column=0;column<2;column++){
      const crate=createBox('cargo-case',new THREE.Vector3(.66,.52,.54),darkConcrete,new THREE.Vector3(x+(column-.5)*.7,.44+level*.53,z));scene.add(crate);collision.push(crate);
    }
  }
  const barriers=[];
  for(const [x,z,r] of [[-7,-58,.15],[6.2,-63,-.22],[-4,-89,.08],[5,-107,-.15],[14,-74,Math.PI/2],[-15,-103,Math.PI/2]]){
    const barrier=createBarrier(concrete,x,z,r);scene.add(barrier);collision.push(barrier);barriers.push(barrier);
  }
  const vehicle=createArmoredVehicle(materialSet);scene.add(vehicle);const vehicleCollider=createBox('vehicle-collider',new THREE.Vector3(5.1,2.2,2.3),vehiclePaint,new THREE.Vector3(-12,1.1,-79),new THREE.Euler(0,.22,0));vehicleCollider.visible=false;scene.add(vehicleCollider);collision.push(vehicleCollider);
  for(const [x,z] of [[10,-55],[14,-58],[-11,-112],[13,-118],[-18,-67]]){
    const cover=createBox('field-supply-crate',new THREE.Vector3(1.45,1.15,1.25),darkConcrete,new THREE.Vector3(x,.575,z),new THREE.Euler(0,(x+z)*.03,0));scene.add(cover);collision.push(cover);
  }
  // Boundary fencing keeps the outdoor combat space readable without invisible walls.
  const fenceMaterial=new THREE.MeshStandardMaterial({color:0x4c5551,roughness:.58,metalness:.72,wireframe:true});
  for(let z=-49;z>=-178;z-=5){
    for(const x of [-43,43]){const panel=createBox('perimeter-fence',new THREE.Vector3(.08,2.5,4.8),fenceMaterial,new THREE.Vector3(x,1.25,z));scene.add(panel);collision.push(panel)}
  }
  for(let x=-40;x<=40;x+=5){
    if(Math.abs(x)<5.5)continue;
    const panel=createBox('far-perimeter-fence',new THREE.Vector3(4.8,2.5,.08),fenceMaterial,new THREE.Vector3(x,1.25,-180));scene.add(panel);collision.push(panel)
  }

  let powered=false,breakerProgress=0,breakerDoorProgress=0,outdoorBlend=0,communicationsBeaconClock=0;
  let lightingProfile={sun:1,ambient:1,grass:true,forestDensity:'high',fog:true,shadows:true,shadowMapSize:2048,shadowDistance:175};
  const interiorFogColor=new THREE.Color(0x050a08),exteriorFogColor=new THREE.Color(0x637582);
  function setGraphicsQuality(quality,effectivePreset={}){
    const profiles={
      intel:{sun:.78,ambient:.86,grass:false,forestDensity:'low',fog:true,shadows:false,shadowMapSize:0,shadowDistance:0},
      performance:{sun:.9,ambient:.92,grass:false,forestDensity:'low',fog:true,shadows:true,shadowMapSize:1024,shadowDistance:90},
      balanced:{sun:.96,ambient:.98,grass:true,forestDensity:'medium',fog:true,shadows:true,shadowMapSize:1536,shadowDistance:135},
      high:{sun:1,ambient:1,grass:true,forestDensity:'high',fog:true,shadows:true,shadowMapSize:2048,shadowDistance:175},
      ultra:{sun:1.04,ambient:1.03,grass:true,forestDensity:'ultra',fog:true,shadows:true,shadowMapSize:3072,shadowDistance:220},
      extreme:{sun:1.08,ambient:1.06,grass:true,forestDensity:'extreme',fog:true,shadows:true,shadowMapSize:4096,shadowDistance:270}
    };
    const profile=profiles[quality]||profiles.high,preset=effectivePreset&&typeof effectivePreset==='object'?effectivePreset:{};
    const grassEnabled=typeof preset.grassEnabled==='boolean'?preset.grassEnabled:profile.grass;
    const fogEnabled=typeof preset.fogEnabled==='boolean'?preset.fogEnabled:profile.fog;
    const shadowsEnabled=typeof preset.shadows==='boolean'?preset.shadows:profile.shadows;
    const requestedShadowMapSize=Number(preset.shadowMapSize),shadowMapSize=shadowsEnabled?(Number.isFinite(requestedShadowMapSize)&&requestedShadowMapSize>0?requestedShadowMapSize:profile.shadowMapSize):0;
    const forestDensity=preset.forestDensity??profile.forestDensity,forestState=forest.setDensity(forestDensity,{photoEnabled:preset.textureTier!=='low'});
    const shadowDistance=shadowsEnabled?profile.shadowDistance:0;
    lightingProfile={...profile,grass:grassEnabled,forestDensity:forestState.density,fog:fogEnabled,shadows:shadowsEnabled,shadowMapSize,shadowDistance};
    grass.visible=lightingProfile.grass;
    sun.castShadow=lightingProfile.shadows;
    forest.setShadows(lightingProfile.shadows);
    const shadowSize=lightingProfile.shadowMapSize;
    if(!shadowSize&&sun.shadow.map){
      sun.shadow.map.dispose();sun.shadow.map=null;
    }else if(shadowSize&&sun.shadow.mapSize.x!==shadowSize){
      sun.shadow.map?.dispose();sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.needsUpdate=true;
    }
    if(shadowSize){
      const extent=THREE.MathUtils.clamp(shadowDistance*.32,30,86),camera=sun.shadow.camera;
      if(camera.left!==-extent||camera.right!==extent||camera.top!==extent||camera.bottom!==-extent||camera.far!==shadowDistance){
        camera.left=-extent;camera.right=extent;camera.top=extent;camera.bottom=-extent;camera.far=shadowDistance;camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
      }
    }
    return {grassEnabled:lightingProfile.grass,forestDensity:forestState.density,forestTrees:forestState.total,fogEnabled:lightingProfile.fog,shadowsEnabled:lightingProfile.shadows,shadowMapSize:shadowSize,shadowDistance};
  }
  function setPowered(value){powered=!!value;exit.target=powered?1:0}
  function setExtractionGateOpen(value=true){extractionGate.target=value?1:0}
  function update(dt,playerZ){
    breakerDoorProgress=damp(breakerDoorProgress,powered?1:0,7,dt);breaker.doorPivot.rotation.y=THREE.MathUtils.lerp(0,-1.48,breakerDoorProgress);
    const leverTarget=powered?THREE.MathUtils.smoothstep(breakerDoorProgress,.38,.92):0;
    breakerProgress=damp(breakerProgress,leverTarget,10,dt);breaker.leverPivot.rotation.z=THREE.MathUtils.lerp(-.62,.62,breakerProgress);
    breaker.redMaterial.emissiveIntensity=THREE.MathUtils.lerp(1.6,.08,breakerProgress);breaker.greenMaterial.emissiveIntensity=THREE.MathUtils.lerp(.06,2.6,breakerProgress);
    exit.progress=damp(exit.progress,exit.target,3.4,dt);exit.left.position.x=THREE.MathUtils.lerp(exit.closedLeft,exit.openLeft,exit.progress);exit.right.position.x=THREE.MathUtils.lerp(exit.closedRight,exit.openRight,exit.progress);exit.leftWindow.position.x=exit.left.position.x;exit.rightWindow.position.x=exit.right.position.x;
    extractionGate.progress=damp(extractionGate.progress,extractionGate.target,2.5,dt);extractionGate.left.position.x=THREE.MathUtils.lerp(extractionGate.closedLeft,extractionGate.openLeft,extractionGate.progress);extractionGate.right.position.x=THREE.MathUtils.lerp(extractionGate.closedRight,extractionGate.openRight,extractionGate.progress);
    outdoorBlend=damp(outdoorBlend,THREE.MathUtils.smoothstep(-playerZ,42,53),2.2,dt);
    sun.intensity=THREE.MathUtils.lerp(.12,1.65,outdoorBlend)*lightingProfile.sun;outdoorAmbient.intensity=THREE.MathUtils.lerp(.06,.48,outdoorBlend)*lightingProfile.ambient;sky.visible=outdoorBlend>.015;clouds.visible=sky.visible;
    communicationsBeaconClock+=dt;communications.beacon.material.color.setHex(Math.sin(communicationsBeaconClock*2.7)>.35?0xff3825:0x3a0805);
    if(scene.fog?.isFogExp2){scene.fog.color.lerpColors(interiorFogColor,exteriorFogColor,outdoorBlend);scene.fog.density=lightingProfile.fog?THREE.MathUtils.lerp(.012,.00135,outdoorBlend):0}
  }
  setGraphicsQuality('high');
  return {exit,breaker,sky,sun,outdoorAmbient,vehicle,barriers,forest,grass,checkpoint,motorPool,storageYard,communications,utilityYard,extraction,extractionGate,setPowered,setExtractionGateOpen,setGraphicsQuality,update,get exitOpen(){return exit.progress>.9},get outdoorBlend(){return outdoorBlend}};
}
