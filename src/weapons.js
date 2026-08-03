import * as THREE from 'three';

const vec = values => new THREE.Vector3(...values);

export class WeaponSystem {
  constructor(camera, config, effects) {
    this.camera = camera;
    this.config = config;
    this.effects = effects;
    this.root = new THREE.Group();
    this.camera.add(this.root);

    this.holders = { rifle: new THREE.Group(), pistol: new THREE.Group() };
    this.root.add(this.holders.rifle, this.holders.pistol);

    this.current = 'rifle';
    this.fireMode = 'auto';
    this.ammo = { rifle: 30, pistol: 15 };
    this.reserve = { rifle: 120, pistol: 60 };
    this.lastShot = 0;
    this.reloading = false;
    this.aiming = false;
    this.sprinting = false;
    this.moving = false;
    this.recoil = 0;
    this.reloadProgress = 0;
    this.holders.pistol.visible = false;

    this.buildFallbacks();
  }

  buildFallbacks() {
    const mat = new THREE.MeshStandardMaterial({color:0x121716,roughness:.45,metalness:.65});
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(.18,.18,1.4),mat);
    rifle.position.z = -.55;
    rifle.userData.fallback = true;
    this.holders.rifle.add(rifle);

    const pistol = new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.58),mat);
    pistol.position.z = -.18;
    pistol.userData.fallback = true;
    this.holders.pistol.add(pistol);
  }

  install(kind, model) {
    if (!model) return;
    const holder = this.holders[kind];
    holder.children.forEach(c => { if (c.userData.fallback) c.visible = false; });

    const pose = this.config.weaponPoses[kind];
    model.scale.multiplyScalar(pose.modelScale);
    model.rotation.set(...pose.modelRotation);
    model.position.set(...pose.modelPosition);
    model.name = `${kind}-viewmodel`;
    model.traverse(o => { if (o.isMesh) { o.renderOrder = 2; o.frustumCulled = false; } });
    holder.add(model);
  }

  toggleFireMode() {
    if (this.current !== 'rifle') return 'M9A4 · SEMI';
    this.fireMode = this.fireMode === 'auto' ? 'semi' : 'auto';
    return `FIRE MODE · ${this.fireMode.toUpperCase()}`;
  }

  switchWeapon(kind) {
    if (this.reloading || kind === this.current) return;
    this.current = kind;
    this.holders.rifle.visible = kind === 'rifle';
    this.holders.pistol.visible = kind === 'pistol';
  }

  canShoot(now) {
    const delay = this.current === 'rifle' ? 92 : 230;
    return !this.reloading && now - this.lastShot >= delay && this.ammo[this.current] > 0;
  }

  shoot(now) {
    if (!this.canShoot(now)) return false;
    this.lastShot = now;
    this.ammo[this.current]--;
    this.recoil = Math.min(.15, this.recoil + (this.current === 'rifle' ? .050 : .078));
    this.effects?.muzzle(this.current, this.root);
    return true;
  }

  reload() {
    if (this.reloading) return;
    const cap = this.current === 'rifle' ? 30 : 15;
    const current = this.ammo[this.current];
    if (current >= cap || this.reserve[this.current] <= 0) return;

    const weaponAtStart = this.current;
    const duration = this.current === 'rifle' ? 1500 : 1050;
    this.reloading = true;
    this.reloadProgress = 0;

    const started = performance.now();
    const timer = setInterval(() => {
      this.reloadProgress = Math.min(1, (performance.now() - started) / duration);
      if (this.reloadProgress >= 1 || this.current !== weaponAtStart) clearInterval(timer);
    }, 16);

    setTimeout(() => {
      if (this.current !== weaponAtStart) { this.reloading = false; return; }
      const needed = cap - this.ammo[this.current];
      const take = Math.min(needed, this.reserve[this.current]);
      this.ammo[this.current] += take;
      this.reserve[this.current] -= take;
      this.reloading = false;
      this.reloadProgress = 0;
    }, duration);
  }

  update(dt, elapsed) {
    const pose = this.config.weaponPoses[this.current];
    const target = vec(this.sprinting ? pose.sprint : this.aiming ? pose.ads : pose.hip);

    const bob = this.moving ? (this.sprinting ? .014 : .007) : .0015;
    target.x += Math.sin(elapsed * (this.sprinting ? 10 : 7)) * bob;
    target.y -= Math.abs(Math.cos(elapsed * (this.sprinting ? 10 : 7))) * bob * .7;
    target.z += this.recoil;

    this.root.position.lerp(target, 1 - Math.pow(.001, dt));
    this.recoil = Math.max(0, this.recoil - dt * .35);

    const rx = this.sprinting ? .42 : 0;
    const ry = this.sprinting ? .22 : (this.aiming ? 0 : -.055);
    const rz = this.sprinting ? -.32 : 0;

    this.root.rotation.x += (rx - this.root.rotation.x) * (1 - Math.exp(-8 * dt));
    this.root.rotation.y += (ry - this.root.rotation.y) * (1 - Math.exp(-8 * dt));
    this.root.rotation.z += (rz - this.root.rotation.z) * (1 - Math.exp(-7 * dt));

    if (this.reloading) {
      const p = this.reloadProgress;
      this.root.rotation.z += Math.sin(p * Math.PI) * .80;
      this.root.rotation.x += Math.sin(p * Math.PI) * .38;
      this.root.position.y -= Math.sin(p * Math.PI) * .12;
    }
  }
}
