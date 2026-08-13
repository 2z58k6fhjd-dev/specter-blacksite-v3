// Deterministic CPU-side scene pack for the isolated WebGPU lab. This module
// intentionally accepts the already resolved vendored modules as arguments so
// importing it never reaches a CDN and never couples the r185 graph to the
// shipped r166 game.

export const DETERMINISTIC_SCENE_BVH_CASE = Object.freeze({
  schema: 'specter.webgpu.scene-bvh-pack/v1',
  testId: 'three-mesh-bvh-tlas-blas-front-hit-v1',
  sourceObjectCount: 3,
  sourceTriangleCount: 12,
  sourceVertexCount: 36,
  expectedPackSha256: '3df2fa772816a233c21326f2135065e30579713615b3988b07cdaab70e9b3bba',
  ray: Object.freeze({
    origin: Object.freeze([0.25, 0.25, 2]),
    direction: Object.freeze([0, 0, -1])
  }),
  expectedHit: Object.freeze({
    distance: 2,
    barycentric: Object.freeze([0.5, 0.25, 0.25])
  })
});

export const SCENE_BVH_BUFFER_LAYOUT = Object.freeze({
  nodeStrideWords: 8,
  transformStrideWords: 36,
  attributeStrideWords: 4,
  indexStrideWords: 3,
  tlasLeafTag: 0xff000000,
  blasLeafTag: 0xffff0000
});

const PACK_SECTIONS = Object.freeze([
  Object.freeze(['nodes', 'nodesU32']),
  Object.freeze(['transforms', 'transformsU32']),
  Object.freeze(['indices', 'indicesU32']),
  Object.freeze(['attributes', 'attributesU32'])
]);

function requiredExport(module, name, packageName) {
  const value = module?.[name];
  if (typeof value !== 'function') {
    throw new Error(`Deterministic scene BVH requires ${packageName}.${name}.`);
  }
  return value;
}

function appendTriangle(target, a, b, c) {
  target.push(...a, ...b, ...c);
}

function createCanonicalPositions() {
  const positions = [];
  appendTriangle(positions, [0, 0, 0], [1, 0, 0], [0, 1, 0]);

  // Eleven spatially separated decoys force a non-trivial BLAS while leaving
  // one unambiguous, exactly representable front hit for the canonical ray.
  for (let triangle = 1; triangle < DETERMINISTIC_SCENE_BVH_CASE.sourceTriangleCount; triangle++) {
    const x = 4 + (triangle - 1) * 2;
    const z = -triangle / 8;
    appendTriangle(positions, [x, 0, z], [x + 1, 0, z], [x, 1, z]);
  }

  return new Float32Array(positions);
}

function storageWords(bvhData, name) {
  const attribute = bvhData?.storage?.[name]?.proxyNode?.value;
  const source = attribute?.array;
  if (!ArrayBuffer.isView(source)) {
    throw new Error(`BVHComputeData did not expose the ${name} storage array after update().`);
  }
  return new Uint32Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
}

function nodeInfo(nodesU32, nodeIndex) {
  const offset = nodeIndex * SCENE_BVH_BUFFER_LAYOUT.nodeStrideWords;
  return Object.freeze({
    rightChildOrTriangleOffset: nodesU32[offset + 6] >>> 0,
    splitAxisOrTriangleCount: nodesU32[offset + 7] >>> 0
  });
}

function collectTlasNodes(nodesU32) {
  const nodeCount = nodesU32.length / SCENE_BVH_BUFFER_LAYOUT.nodeStrideWords;
  const visited = new Set();
  const leaves = [];
  const stack = [0];
  while (stack.length > 0) {
    const nodeIndex = stack.pop();
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= nodeCount || visited.has(nodeIndex)) {
      throw new Error('Packed TLAS contains an invalid or cyclic child reference.');
    }
    visited.add(nodeIndex);
    const info = nodeInfo(nodesU32, nodeIndex);
    const isLeaf = (info.splitAxisOrTriangleCount & 0xffff0000) !== 0;
    if (isLeaf) {
      if (((info.splitAxisOrTriangleCount & 0xff000000) >>> 0) !== SCENE_BVH_BUFFER_LAYOUT.tlasLeafTag) {
        throw new Error('Packed top-level tree contains a non-TLAS leaf tag.');
      }
      leaves.push(Object.freeze({ nodeIndex, ...info }));
    } else {
      stack.push(nodeIndex + info.rightChildOrTriangleOffset, nodeIndex + 1);
    }
  }
  return Object.freeze({ nodes: Object.freeze([...visited].sort((a, b) => a - b)), leaves: Object.freeze(leaves) });
}

function validatePackedArrays(pack) {
  const { nodeStrideWords, transformStrideWords, attributeStrideWords, indexStrideWords } = SCENE_BVH_BUFFER_LAYOUT;
  if (!(pack.nodesU32 instanceof Uint32Array) || pack.nodesU32.length % nodeStrideWords !== 0) {
    throw new Error('Packed BVH node words are missing or misaligned.');
  }
  if (!(pack.transformsU32 instanceof Uint32Array) || pack.transformsU32.length % transformStrideWords !== 0) {
    throw new Error('Packed BVH transform words are missing or misaligned.');
  }
  if (!(pack.indicesU32 instanceof Uint32Array) || pack.indicesU32.length % indexStrideWords !== 0) {
    throw new Error('Packed BVH index words are missing or misaligned.');
  }
  if (!(pack.attributesU32 instanceof Uint32Array) || pack.attributesU32.length % attributeStrideWords !== 0) {
    throw new Error('Packed BVH attribute words are missing or misaligned.');
  }

  const vertexCount = pack.attributesU32.length / attributeStrideWords;
  if (pack.indicesU32.some(index => index >= vertexCount)) {
    throw new Error('Packed BVH contains an out-of-range geometry index.');
  }

  const tlas = collectTlasNodes(pack.nodesU32);
  if (tlas.leaves.length !== DETERMINISTIC_SCENE_BVH_CASE.sourceObjectCount) {
    throw new Error(`Expected ${DETERMINISTIC_SCENE_BVH_CASE.sourceObjectCount} TLAS leaves, received ${tlas.leaves.length}.`);
  }

  const transformCount = pack.transformsU32.length / transformStrideWords;
  const nodeCount = pack.nodesU32.length / nodeStrideWords;
  for (const leaf of tlas.leaves) {
    const transformIndex = leaf.splitAxisOrTriangleCount & 0x00ffffff;
    if (transformIndex >= transformCount) throw new Error('TLAS leaf references an out-of-range transform.');
    if (leaf.rightChildOrTriangleOffset >= nodeCount) throw new Error('TLAS leaf references an out-of-range BLAS root.');
    if (pack.transformsU32[transformIndex * transformStrideWords + 32] !== 1) {
      throw new Error('Canonical scene transform must be visible.');
    }
  }

  return Object.freeze({
    nodeCount,
    transformCount,
    packedTriangleCount: pack.indicesU32.length / indexStrideWords,
    packedVertexCount: vertexCount,
    tlasNodeCount: tlas.nodes.length,
    tlasLeafCount: tlas.leaves.length,
    blasNodeCount: nodeCount - tlas.nodes.length
  });
}

function concatenateForHash(pack) {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(`${DETERMINISTIC_SCENE_BVH_CASE.schema}\n`)];
  let byteLength = chunks[0].byteLength;
  for (const [label, property] of PACK_SECTIONS) {
    const bytes = new Uint8Array(pack[property].buffer, pack[property].byteOffset, pack[property].byteLength);
    const header = encoder.encode(`${label}:${bytes.byteLength}\n`);
    chunks.push(header, bytes);
    byteLength += header.byteLength + bytes.byteLength;
  }

  const combined = new Uint8Array(byteLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }
  return combined;
}

async function sha256Hex(bytes, cryptoObject) {
  if (!cryptoObject?.subtle?.digest) throw new Error('Web Crypto SHA-256 is required for deterministic BVH evidence.');
  const digest = await cryptoObject.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function computePackedSceneBvhSha256(pack, { cryptoObject = globalThis.crypto } = {}) {
  inspectPackedSceneBvh(pack);
  return sha256Hex(concatenateForHash(pack), cryptoObject);
}

/**
 * Build and copy a deterministic TLAS + BLAS using the exact vendored
 * three-mesh-bvh WebGPU packing path. No GPU claim is made here: this is CPU
 * preparation for a later compute dispatch and mapped-readback receipt.
 */
export async function packDeterministicSceneBvh({
  threeModule,
  meshBvhModule,
  cryptoObject = globalThis.crypto
} = {}) {
  const BufferGeometry = requiredExport(threeModule, 'BufferGeometry', 'three');
  const Float32BufferAttribute = requiredExport(threeModule, 'Float32BufferAttribute', 'three');
  const Mesh = requiredExport(threeModule, 'Mesh', 'three');
  const Group = requiredExport(threeModule, 'Group', 'three');
  const BVHComputeData = requiredExport(meshBvhModule, 'BVHComputeData', 'three-mesh-bvh');

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(createCanonicalPositions(), 3));

  const scene = new Group();
  const translations = [-48, 0, 48];
  for (let index = 0; index < translations.length; index++) {
    const mesh = new Mesh(geometry);
    mesh.name = `specter-bvh-proof-${index}`;
    mesh.position.x = translations[index];
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);

  const bvhData = new BVHComputeData(scene, {
    attributes: { position: 'vec4f' },
    autogenerateBvh: true
  });

  try {
    bvhData.update();
    const mutablePack = {
      schema: DETERMINISTIC_SCENE_BVH_CASE.schema,
      testId: DETERMINISTIC_SCENE_BVH_CASE.testId,
      nodesU32: storageWords(bvhData, 'nodes'),
      transformsU32: storageWords(bvhData, 'transforms'),
      indicesU32: storageWords(bvhData, 'index'),
      attributesU32: storageWords(bvhData, 'attributes')
    };
    const facts = validatePackedArrays(mutablePack);
    const packSha256 = await sha256Hex(concatenateForHash(mutablePack), cryptoObject);
    if (packSha256 !== DETERMINISTIC_SCENE_BVH_CASE.expectedPackSha256) {
      throw new Error(`Deterministic scene BVH hash mismatch: ${packSha256}`);
    }
    return Object.freeze({ ...mutablePack, facts, packSha256 });
  } finally {
    bvhData.dispose();
    geometry.dispose();
  }
}

export function inspectPackedSceneBvh(pack) {
  if (pack?.schema !== DETERMINISTIC_SCENE_BVH_CASE.schema || pack?.testId !== DETERMINISTIC_SCENE_BVH_CASE.testId) {
    throw new Error('Packed scene BVH schema or test id does not match the deterministic contract.');
  }
  return validatePackedArrays(pack);
}
