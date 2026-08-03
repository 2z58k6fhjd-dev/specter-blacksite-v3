export const CONFIG = {
  build: '3.0.1-FULL-REFRESH',
  assets: {
    rifle: './assets/ar15/scene.gltf',
    pistol: './assets/m9/scene.gltf',
    soldier: './assets/soldier/scene.gltf'
  },
  performance: {
    maxPixelRatio: 1.25,
    shadows: true,
    shadowMapSize: 512
  },
  weaponPoses: {
    rifle: {
      normalizeSize: 1.34,
      modelScale: 1.0,
      modelRotation: [0, Math.PI / 2, 0],
      modelPosition: [0, 0.005, -0.13],
      hip: [0.22, -0.20, -0.43],
      ads: [0, -0.085, -0.30],
      sprint: [0.40, -0.43, -0.39]
    },
    pistol: {
      normalizeSize: 0.50,
      modelScale: 1.0,
      modelRotation: [0, Math.PI / 2, 0],
      modelPosition: [0, -0.015, -0.09],
      hip: [0.22, -0.21, -0.39],
      ads: [0, -0.105, -0.28],
      sprint: [0.36, -0.38, -0.36]
    }
  }
};
