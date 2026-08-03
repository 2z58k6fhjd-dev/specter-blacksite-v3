import * as THREE from 'three';

export class EffectsSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.flashes = [];
    this.impacts = [];
  }

  muzzle(kind, weaponRoot) {
    const light = new THREE.PointLight(0xffa34a, 8, 4, 2);
    const pos = new THREE.Vector3(kind === 'rifle' ? 0 : 0, kind === 'rifle' ? 0 : 0, kind === 'rifle' ? -1.20 : -.38);
    weaponRoot.localToWorld(pos);
    light.position.copy(pos);
    this.scene.add(light);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(kind === 'rifle' ? .07 : .05, 8, 6),
      new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending})
    );
    flash.position.copy(pos);
    this.scene.add(flash);
    setTimeout(() => { this.scene.remove(light); this.scene.remove(flash); flash.geometry.dispose(); flash.material.dispose(); }, 55);
  }

  impact(hit) {
    if (!hit?.face) return;
    const mat = new THREE.MeshBasicMaterial({color:0x151515,transparent:true,opacity:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
    const mark = new THREE.Mesh(new THREE.CircleGeometry(.04,12),mat);
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    mark.position.copy(hit.point).addScaledVector(normal,.005);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    this.scene.add(mark);
    this.impacts.push(mark);
    if (this.impacts.length > 60) {
      const old = this.impacts.shift();
      this.scene.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
  }
}
