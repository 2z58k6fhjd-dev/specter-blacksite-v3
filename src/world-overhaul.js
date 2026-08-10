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
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.065,0,0,.065,0,0,0,.38,0],3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color:0x2f4e28,roughness:1,metalness:0,side:THREE.DoubleSide});
  const count=3600,grass=new THREE.InstancedMesh(geometry,material,count),matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),random=mulberry32(4242);
  for(let index=0;index<count;index++){
    let x=(random()-.5)*82,z=-48-random()*86;
    if(Math.abs(x)<5.1&&z>-115)x=(x<0?-1:1)*(5.4+random()*34);
    position.set(x,-.01,z);quaternion.setFromAxisAngle(up,random()*Math.PI);scale.set(.7+random()*.95,.55+random()*1.15,.7+random()*.95);matrix.compose(position,quaternion,scale);grass.setMatrixAt(index,matrix);
  }
  grass.instanceMatrix.needsUpdate=true;grass.castShadow=true;grass.receiveShadow=true;grass.frustumCulled=true;grass.name='instanced-grass';scene.add(grass);return grass;
}

function addPerimeterTrees(scene){
  const trunkMaterial=new THREE.MeshStandardMaterial({color:0x44372b,roughness:.96});
  const leafMaterial=new THREE.MeshStandardMaterial({color:0x25482c,roughness:.96,side:THREE.DoubleSide});
  const trees=new THREE.Group();trees.name='perimeter-trees';const random=mulberry32(818);
  for(let index=0;index<34;index++){
    const side=index%2?-1:1,x=side*(34+random()*13),z=-49-random()*86,height=5.5+random()*5;
    const trunk=createCylinder('tree-trunk',.16+random()*.12,height*.55,trunkMaterial,new THREE.Vector3(x,height*.275,z),null,10);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(height*.23,1),leafMaterial);crown.name='tree-crown';crown.position.set(x,height*.72,z);crown.scale.set(.8+random()*.45,1.15+random()*.35,.8+random()*.45);crown.castShadow=true;crown.receiveShadow=true;trees.add(trunk,crown);
  }
  scene.add(trees);return trees;
}

function addCitySkyline(scene){
  const facadeCanvas=document.createElement('canvas');facadeCanvas.width=256;facadeCanvas.height=512;const facadeContext=facadeCanvas.getContext('2d');facadeContext.fillStyle='#1f292b';facadeContext.fillRect(0,0,256,512);
  for(let y=22;y<500;y+=30)for(let x=14;x<248;x+=30){const lit=(x*7+y*11)%9<2;facadeContext.fillStyle=lit?'#8c9271':'#314043';facadeContext.fillRect(x,y,12,9)}
  const facadeTexture=new THREE.CanvasTexture(facadeCanvas);facadeTexture.colorSpace=THREE.SRGBColorSpace;facadeTexture.wrapS=facadeTexture.wrapT=THREE.RepeatWrapping;facadeTexture.repeat.set(1.5,3);
  const count=82,geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({color:0x526064,map:facadeTexture,roughness:.86,metalness:.12,emissive:0x0c1213,emissiveIntensity:.28});
  const towers=new THREE.InstancedMesh(geometry,material,count),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),random=mulberry32(5050),color=new THREE.Color();
  for(let index=0;index<count;index++){
    const centerBias=(index/(count-1)-.5),x=centerBias*520+(random()-.5)*24,z=-420-random()*250;
    const distanceFactor=THREE.MathUtils.clamp((-z-415)/255,0,1),height=(24+random()*72)*(1-distanceFactor*.2)+(Math.abs(x)<72?random()*26:0),width=7+random()*15,depth=7+random()*18;
    position.set(x,height*.5-.3,z);scale.set(width,height,depth);matrix.compose(position,quaternion,scale);towers.setMatrixAt(index,matrix);
    color.setHSL(.47+random()*.08,.12+random()*.12,.17+random()*.1);towers.setColorAt(index,color);
  }
  towers.instanceMatrix.needsUpdate=true;if(towers.instanceColor)towers.instanceColor.needsUpdate=true;towers.frustumCulled=true;towers.castShadow=false;towers.receiveShadow=false;towers.name='distant-city-skyline';scene.add(towers);
  const beaconMaterial=new THREE.MeshBasicMaterial({color:0xff3b2b,toneMapped:false}),beacons=new THREE.Group();beacons.name='city-rooftop-beacons';
  for(const [x,y,z] of [[-78,78,-478],[24,94,-536],[104,83,-452],[-158,72,-584]]){
    const mast=createCylinder('city-mast',.09,5,new THREE.MeshStandardMaterial({color:0x354244,metalness:.8,roughness:.4}),new THREE.Vector3(x,y,z));mast.castShadow=false;
    const beacon=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),beaconMaterial);beacon.position.set(x,y+2.6,z);beacons.add(mast,beacon);
  }
  scene.add(beacons);return {towers,beacons};
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

function createExtractionZone(scene,materials){
  const group=new THREE.Group();group.name='extraction-zone';group.position.set(0,-.075,-128);
  const pad=new THREE.Mesh(new THREE.CircleGeometry(7.2,48),materials.asphalt);pad.rotation.x=-Math.PI/2;pad.receiveShadow=true;group.add(pad);
  const ringMaterial=new THREE.MeshBasicMaterial({color:0xd7e2d7,side:THREE.DoubleSide,toneMapped:false}),ring=new THREE.Mesh(new THREE.RingGeometry(5.65,5.95,48),ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.012;group.add(ring);
  for(const [x,z,w,d] of [[0,0,1.05,4.2],[-1.25,0,1.05,4.2],[1.25,0,1.05,4.2],[0,0,3.5,.92]]){
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(w,d),ringMaterial);mark.rotation.x=-Math.PI/2;mark.position.set(x,.018,z);group.add(mark);
  }
  const lampMaterial=new THREE.MeshStandardMaterial({color:0x8bc6a8,emissive:0x54ffb0,emissiveIntensity:2.2,roughness:.22});
  for(let index=0;index<12;index++){
    const angle=index/12*Math.PI*2,lamp=createCylinder('extraction-lamp',.085,.05,lampMaterial,new THREE.Vector3(Math.cos(angle)*6.35,.025,Math.sin(angle)*6.35),new THREE.Euler(0,0,Math.PI/2),10);group.add(lamp);
  }
  scene.add(group);addZoneSign(scene,'EXTRACTION','SECURE ZONE ECHO',new THREE.Vector3(0,2.55,-134.55),0,3.8);return group;
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
  group.add(enclosure,inset,hinge,doorPivot,leverPivot,redLamp,greenLamp);scene.add(group);setShadow(group);
  return {group,doorPivot,doorPanel,leverPivot,redLamp,greenLamp,redMaterial:red,greenMaterial:green};
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

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,96,1,1),grassMaterial);ground.name='exterior-grass-terrain';ground.rotation.x=-Math.PI/2;ground.position.set(0,-.12,-92);ground.receiveShadow=true;scene.add(ground);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(8.5,76),asphalt);road.name='service-road';road.rotation.x=-Math.PI/2;road.position.set(0,-.105,-86);road.receiveShadow=true;scene.add(road);
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(22,13),asphalt);apron.name='exit-apron';apron.rotation.x=-Math.PI/2;apron.position.set(0,-.1,-50);apron.receiveShadow=true;scene.add(apron);
  // Close-range placeholder blade cards and geometric trees were intentionally
  // removed: the PBR ground reads better than visibly low-detail vegetation.
  const city=addCitySkyline(scene),clouds=addCloudBank(scene);

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
  const extraction=createExtractionZone(scene,materialSet);

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
  for(let z=-49;z>=-134;z-=5){
    for(const x of [-43,43]){const panel=createBox('perimeter-fence',new THREE.Vector3(.08,2.5,4.8),fenceMaterial,new THREE.Vector3(x,1.25,z));scene.add(panel);collision.push(panel)}
  }
  for(let x=-40;x<=40;x+=5){const panel=createBox('far-perimeter-fence',new THREE.Vector3(4.8,2.5,.08),fenceMaterial,new THREE.Vector3(x,1.25,-136));scene.add(panel);collision.push(panel)}

  let powered=false,breakerProgress=0,breakerDoorProgress=0,outdoorBlend=0,cityBeaconClock=0;
  const interiorFogColor=new THREE.Color(0x050a08),exteriorFogColor=new THREE.Color(0x637582);
  function setPowered(value){powered=!!value;exit.target=powered?1:0}
  function update(dt,playerZ){
    breakerDoorProgress=damp(breakerDoorProgress,powered?1:0,7,dt);breaker.doorPivot.rotation.y=THREE.MathUtils.lerp(0,-1.48,breakerDoorProgress);
    const leverTarget=powered?THREE.MathUtils.smoothstep(breakerDoorProgress,.38,.92):0;
    breakerProgress=damp(breakerProgress,leverTarget,10,dt);breaker.leverPivot.rotation.z=THREE.MathUtils.lerp(-.62,.62,breakerProgress);
    breaker.redMaterial.emissiveIntensity=THREE.MathUtils.lerp(1.6,.08,breakerProgress);breaker.greenMaterial.emissiveIntensity=THREE.MathUtils.lerp(.06,2.6,breakerProgress);
    exit.progress=damp(exit.progress,exit.target,3.4,dt);exit.left.position.x=THREE.MathUtils.lerp(exit.closedLeft,exit.openLeft,exit.progress);exit.right.position.x=THREE.MathUtils.lerp(exit.closedRight,exit.openRight,exit.progress);exit.leftWindow.position.x=exit.left.position.x;exit.rightWindow.position.x=exit.right.position.x;
    outdoorBlend=damp(outdoorBlend,THREE.MathUtils.smoothstep(-playerZ,42,53),2.2,dt);
    sun.intensity=THREE.MathUtils.lerp(.12,1.65,outdoorBlend);outdoorAmbient.intensity=THREE.MathUtils.lerp(.06,.48,outdoorBlend);sky.visible=outdoorBlend>.015;clouds.visible=sky.visible;
    cityBeaconClock+=dt;communications.beacon.material.color.setHex(Math.sin(cityBeaconClock*2.7)>.35?0xff3825:0x3a0805);
    city.beacons.children.forEach((child,index)=>{if(child.isMesh&&child.geometry?.type==='SphereGeometry')child.visible=Math.sin(cityBeaconClock*2.15+index*.8)>.1});
    if(scene.fog?.isFogExp2){scene.fog.color.lerpColors(interiorFogColor,exteriorFogColor,outdoorBlend);scene.fog.density=THREE.MathUtils.lerp(.012,.00135,outdoorBlend)}
  }
  return {exit,breaker,sky,sun,outdoorAmbient,vehicle,barriers,city,checkpoint,motorPool,storageYard,communications,extraction,setPowered,update,get exitOpen(){return exit.progress>.9},get outdoorBlend(){return outdoorBlend}};
}
