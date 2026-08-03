import * as THREE from 'three';

export class EnemySystem {
  constructor(scene, assetManager) {
    this.scene = scene;
    this.assets = assetManager;
    this.enemies = [];
    this.spawnPoints = [[-2.5,-8],[2.9,-18],[-1.2,-27]];
  }

  spawnAll() {
    this.spawnPoints.forEach(([x,z],i) => this.spawn(x,z,i===2));
  }

  spawn(x,z,heavy=false) {
    const root = new THREE.Group();
    root.position.set(x,0,z);
    root.userData = { health: heavy ? 170 : 100, dead:false, phase:Math.random()*6 };
    const model = this.assets.clone('soldier', true);
    if (model) {
      this.assets.normalize(model, heavy ? 2.12 : 1.98, true);
      model.rotation.y = Math.PI;
      root.add(model);
      root.userData.model = model;
      model.traverse(o => { if (o.isMesh) o.userData.enemy = root; });
    } else {
      const fallback = new THREE.Mesh(
        new THREE.CapsuleGeometry(.34,1.2,6,10),
        new THREE.MeshStandardMaterial({color:0x161b19})
      );
      fallback.position.y=1.05;fallback.userData.enemy=root;root.add(fallback);
    }
    this.scene.add(root);this.enemies.push(root);return root;
  }

  update(dt,t,player) {
    for (const e of this.enemies) {
      if (e.userData.dead) continue;
      const toPlayer = player.position.clone().sub(e.position);toPlayer.y=0;
      if (toPlayer.length() < 13) {
        e.rotation.y = Math.atan2(toPlayer.x,toPlayer.z)+Math.PI;
        if (toPlayer.length()>4) e.position.addScaledVector(toPlayer.normalize(),dt*.45);
      }
      e.position.y = Math.sin(t*2+e.userData.phase)*.012;
    }
  }
}
