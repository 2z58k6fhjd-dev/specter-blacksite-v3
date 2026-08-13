import {
  DETERMINISTIC_SCENE_BVH_CASE,
  SCENE_BVH_BUFFER_LAYOUT,
  inspectPackedSceneBvh
} from './scene-bvh-pack.js';

const EPSILON = 1e-7;

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function transformVector(matrix, vector, w) {
  return [
    matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * w,
    matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * w,
    matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * w
  ];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  if (!(length > 0)) throw new Error('Packed transform produced a zero-length ray direction.');
  return Object.freeze({ vector: vector.map(component => component / length), length });
}

function intersectBounds(origin, direction, minimum, maximum) {
  let near = 0;
  let far = Number.POSITIVE_INFINITY;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) <= Number.EPSILON) {
      if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
      continue;
    }
    let axisNear = (minimum[axis] - origin[axis]) / direction[axis];
    let axisFar = (maximum[axis] - origin[axis]) / direction[axis];
    if (axisNear > axisFar) [axisNear, axisFar] = [axisFar, axisNear];
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (far < near) return null;
  }
  return near;
}

function intersectTriangle(origin, direction, a, b, c) {
  const edge1 = subtract(b, a);
  const edge2 = subtract(c, a);
  const normal = cross(edge1, edge2);
  const determinant = -dot(direction, normal);
  if (Math.abs(determinant) < 1e-15) return null;
  const inverseDeterminant = 1 / determinant;
  const fromA = subtract(origin, a);
  const dao = cross(fromA, direction);
  const u = dot(edge2, dao) * inverseDeterminant;
  if (u < 0 || u > 1) return null;
  const v = -dot(edge1, dao) * inverseDeterminant;
  if (v < 0 || u + v > 1) return null;
  const distance = dot(fromA, normal) * inverseDeterminant;
  if (distance < 0) return null;
  return Object.freeze({ distance, barycentric: Object.freeze([1 - u - v, u, v]) });
}

function readNode(nodesU32, nodesF32, index) {
  const offset = index * SCENE_BVH_BUFFER_LAYOUT.nodeStrideWords;
  return Object.freeze({
    minimum: Object.freeze(Array.from(nodesF32.subarray(offset, offset + 3))),
    maximum: Object.freeze(Array.from(nodesF32.subarray(offset + 3, offset + 6))),
    infoY: nodesU32[offset + 6] >>> 0,
    infoX: nodesU32[offset + 7] >>> 0
  });
}

function readPosition(attributesF32, index) {
  const offset = index * SCENE_BVH_BUFFER_LAYOUT.attributeStrideWords;
  return Array.from(attributesF32.subarray(offset, offset + 3));
}

function approximatelyEqual(actual, expected, epsilon = EPSILON) {
  return Math.abs(actual - expected) <= epsilon;
}

/**
 * Independent CPU oracle for the exact packed-buffer traversal protocol. It is
 * useful for deterministic QA, but its `backend` field makes explicit that it
 * is not GPU-dispatch evidence and cannot activate a renderer claim.
 */
export function tracePackedSceneBvhCpu(pack, ray = DETERMINISTIC_SCENE_BVH_CASE.ray) {
  const facts = inspectPackedSceneBvh(pack);
  const nodesU32 = pack.nodesU32;
  const nodesF32 = new Float32Array(nodesU32.buffer, nodesU32.byteOffset, nodesU32.length);
  const transformsF32 = new Float32Array(pack.transformsU32.buffer, pack.transformsU32.byteOffset, pack.transformsU32.length);
  const attributesF32 = new Float32Array(pack.attributesU32.buffer, pack.attributesU32.byteOffset, pack.attributesU32.length);
  const nodeStack = new Uint32Array(64);
  nodeStack[0] = 0;

  const worldOrigin = Array.from(ray.origin, Number);
  const worldDirectionNormalized = normalize(Array.from(ray.direction, Number)).vector;
  let localOrigin = worldOrigin;
  let localDirection = worldDirectionNormalized;
  let rayScalar = 1;
  let stackPointer = 0;
  let tlasReset = 0;
  let isTlas = true;
  let activeObject = 0;
  let visitedNodes = 0;
  let visitedTriangles = 0;
  let best = null;

  while (true) {
    if (!isTlas && tlasReset === stackPointer) {
      isTlas = true;
      activeObject = 0;
      localOrigin = worldOrigin;
      localDirection = worldDirectionNormalized;
      rayScalar = 1;
    }
    if (stackPointer < 0) break;
    if (stackPointer >= nodeStack.length) throw new Error('CPU oracle exceeded the pinned BVH traversal stack.');

    const nodeIndex = nodeStack[stackPointer--];
    if (nodeIndex >= facts.nodeCount) throw new Error('CPU oracle encountered an out-of-range node.');
    visitedNodes++;
    const node = readNode(nodesU32, nodesF32, nodeIndex);
    const boundsDistance = intersectBounds(localOrigin, localDirection, node.minimum, node.maximum);
    if (boundsDistance === null || (best && boundsDistance * rayScalar >= best.distance)) continue;

    const isLeaf = (node.infoX & 0xffff0000) !== 0;
    if (isLeaf) {
      if (isTlas) {
        activeObject = node.infoX & 0x00ffffff;
        const transformOffset = activeObject * SCENE_BVH_BUFFER_LAYOUT.transformStrideWords;
        if (pack.transformsU32[transformOffset + 32] === 0) continue;
        const inverseMatrix = transformsF32.subarray(transformOffset + 16, transformOffset + 32);
        localOrigin = transformVector(inverseMatrix, worldOrigin, 1);
        const transformedDirection = normalize(transformVector(inverseMatrix, worldDirectionNormalized, 0));
        localDirection = transformedDirection.vector;
        rayScalar = 1 / transformedDirection.length;
        tlasReset = stackPointer;
        isTlas = false;
        stackPointer++;
        nodeStack[stackPointer] = node.infoY;
      } else {
        const triangleCount = node.infoX & 0x0000ffff;
        for (let triangle = node.infoY; triangle < node.infoY + triangleCount; triangle++) {
          visitedTriangles++;
          const indexOffset = triangle * SCENE_BVH_BUFFER_LAYOUT.indexStrideWords;
          const i0 = pack.indicesU32[indexOffset];
          const i1 = pack.indicesU32[indexOffset + 1];
          const i2 = pack.indicesU32[indexOffset + 2];
          const hit = intersectTriangle(
            localOrigin,
            localDirection,
            readPosition(attributesF32, i0),
            readPosition(attributesF32, i1),
            readPosition(attributesF32, i2)
          );
          const worldDistance = hit?.distance * rayScalar;
          if (hit && (!best || worldDistance < best.distance)) {
            best = Object.freeze({
              triangleIndex: triangle,
              objectIndex: activeObject,
              distance: worldDistance,
              barycentric: hit.barycentric
            });
          }
        }
      }
    } else {
      const left = nodeIndex + 1;
      const right = nodeIndex + node.infoY;
      const axis = node.infoX & 0x0000ffff;
      const first = localDirection[axis] >= 0 ? left : right;
      const second = first === left ? right : left;
      stackPointer++;
      nodeStack[stackPointer] = second;
      stackPointer++;
      nodeStack[stackPointer] = first;
    }
  }

  const expected = DETERMINISTIC_SCENE_BVH_CASE.expectedHit;
  const expectedHit = Boolean(best)
    && approximatelyEqual(best.distance, expected.distance)
    && best.barycentric.every((component, index) => approximatelyEqual(component, expected.barycentric[index]));
  return Object.freeze({
    backend: 'cpu-oracle',
    gpuEvidence: false,
    packSha256: pack.packSha256,
    hit: Boolean(best),
    expectedHit,
    triangleIndex: best?.triangleIndex ?? null,
    objectIndex: best?.objectIndex ?? null,
    distance: best?.distance ?? null,
    barycentric: best?.barycentric ?? null,
    visitedNodes,
    visitedTriangles
  });
}
