export const CONFIG = {
  build: '3.0.0-FOUNDATION',
  assets: {
    rifle: './assets/ar15/scene.gltf',
    pistol: './assets/m9/scene.gltf',
    soldier: './assets/soldier/scene.gltf'
  },
  performance: {
    maxPixelRatio: 1.35,
    shadows: true,
    shadowMapSize: 512
  },
  weaponPoses: {
    rifle: {
      modelScale: 0.92,
      modelRotation: [0, Math.PI / 2, 0],
      modelPosition: [0, -0.02, -0.18],
      hip: [0.31, -0.29, -0.50],
      ads: [0, -0.135, -0.36],
      sprint: [0.43, -0.46, -0.43]
    },
    pistol: {
      modelScale: 0.78,
      modelRotation: [0, Math.PI / 2, 0],
      modelPosition: [0, -0.035, -0.12],
      hip: [0.27, -0.27, -0.46],
      ads: [0, -0.145, -0.34],
      sprint: [0.39, -0.42, -0.40]
    }
  }
};
