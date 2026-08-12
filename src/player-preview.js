import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildSpecterOperator,poseSpecterOperator } from './specter-operator.js?v=5.11.0-graphics-apply';

const viewport=document.getElementById('viewport'),status=document.getElementById('status');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.55;
renderer.shadowMap.enabled=true;viewport.appendChild(renderer.domElement);

const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b09);scene.fog=new THREE.Fog(0x070b09,4.8,9);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.03,30);camera.position.set(0,1.12,4.35);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.95,0);controls.enableDamping=true;controls.autoRotate=true;controls.autoRotateSpeed=1.15;controls.minDistance=2.1;controls.maxDistance=7;

scene.add(new THREE.HemisphereLight(0xbce9d3,0x1a201d,1.75));
const key=new THREE.DirectionalLight(0xe5fff2,5.2);key.position.set(2.6,4.5,3.4);key.castShadow=true;scene.add(key);
const fill=new THREE.DirectionalLight(0x8da99c,2.8);fill.position.set(-3,2,4);scene.add(fill);
const rim=new THREE.DirectionalLight(0x5bffbd,2.6);rim.position.set(-3,2.8,-3.5);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.7,.09,64),new THREE.MeshStandardMaterial({color:0x18201c,roughness:.72,metalness:.55}));floor.position.y=-.055;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(8,32,0x385f4d,0x15241d);grid.position.y=.002;scene.add(grid);

const gltf=await new GLTFLoader().loadAsync('./assets/soldier/scene.gltf');
const operator=buildSpecterOperator(gltf.scene,{height:1.85,equipment:true});scene.add(operator.root);
status.textContent='READY · SPECTER PLAYER RIG LOADED';

const views={front:[0,1.08,4.35],back:[0,1.08,-4.35],left:[-4.35,1.08,0],right:[4.35,1.08,0]};
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
  const position=views[button.dataset.view];camera.position.set(...position);controls.target.set(0,.95,0);controls.update();
});
document.getElementById('turntable').onclick=event=>{controls.autoRotate=!controls.autoRotate;event.currentTarget.textContent=controls.autoRotate?'PAUSE ROTATION':'START ROTATION'};
let wireframe=false;
document.getElementById('wireframe').onclick=event=>{
  wireframe=!wireframe;operator.root.traverse(object=>{if(object.isMesh){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.wireframe=wireframe)}});
  event.currentTarget.textContent=wireframe?'SHADED':'WIREFRAME';
};
document.getElementById('export').onclick=async event=>{
  const button=event.currentTarget;button.disabled=true;button.textContent='BUILDING GLB…';
  try{
    const data=await new GLTFExporter().parseAsync(operator.root,{binary:true,onlyVisible:true,maxTextureSize:2048});
    if(new URLSearchParams(location.search).has('autosave')){
      const response=await fetch('/__save-model',{method:'POST',headers:{'Content-Type':'model/gltf-binary'},body:data});if(!response.ok)throw new Error(`Save failed (${response.status})`);
      button.textContent='GLB SAVED';
    }else{
      const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));link.download='SPECTER-Operator-v1.glb';link.click();
      setTimeout(()=>URL.revokeObjectURL(link.href),15000);button.textContent='GLB DOWNLOADED';
    }
  }catch(error){console.error(error);button.textContent='EXPORT FAILED';status.textContent=`EXPORT ERROR · ${error.message}`}
  setTimeout(()=>{button.disabled=false;button.textContent='DOWNLOAD GLB MODEL'},2200);
};

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);const t=clock.getElapsedTime();poseSpecterOperator(operator,{time:t,moving:false,aiming:false});controls.update();renderer.render(scene,camera);
}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
