import * as THREE from 'three';

export function buildWorld(scene) {
  const wall = new THREE.MeshStandardMaterial({color:0x34403b,roughness:.9,metalness:.08});
  const floor = new THREE.MeshStandardMaterial({color:0x202724,roughness:.72,metalness:.18});
  const metal = new THREE.MeshStandardMaterial({color:0x101615,roughness:.52,metalness:.65});
  const collision = [];
  const lights = [];

  const box = (name,x,y,z,w,h,d,mat=wall,collide=true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
    if(collide) collision.push(m);
    return m;
  };

  box('floor',0,-.15,-12,18,.3,42,floor,false);
  box('ceiling',0,4.1,-12,18,.25,42,wall,false);
  box('left-wall',-9,2,-12,.35,4.2,42);
  box('right-wall',9,2,-12,.35,4.2,42);
  box('rear-wall',0,2,9,18,4.2,.35);
  box('front-wall',0,2,-33,18,4.2,.35);
  box('partition-a',-4.8,2,-9,.35,4,12);
  box('partition-b',4.8,2,-19,.35,4,14);
  box('crate-a',-2.4,.7,-3.5,2.2,1.4,1.6,metal);
  box('crate-b',3.2,.6,-11,2.4,1.2,1.7,metal);
  box('crate-c',-2.7,.9,-22,1.8,1.8,1.8,metal);

  for (let z=5; z>-31; z-=6) {
    box('beam',0,3.8,z,18,.18,.28,metal,false);
    const light = new THREE.PointLight(0xc8ffe6,0,12,2);
    light.position.set(0,3.5,z); scene.add(light); lights.push(light);
  }

  const switchGroup = new THREE.Group();
  switchGroup.position.set(-7.9,1.45,5.4);switchGroup.rotation.y=Math.PI/2;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.12,.9,.55),metal);switchGroup.add(plate);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(.12,.44,.12),metal);lever.position.set(-.1,.08,0);switchGroup.add(lever);
  scene.add(switchGroup);

  return { collision, lights, switchGroup, lever };
}
