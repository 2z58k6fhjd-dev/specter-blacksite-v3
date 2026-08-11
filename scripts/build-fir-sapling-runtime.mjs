/**
 * Creates the bounded SPECTER runtime derivative of Poly Haven's CC0 Fir
 * Sapling. The upstream 1K glTF contains three high-poly saplings (about
 * 433k triangles total) with no supplied LOD hierarchy. This builder keeps
 * one authored variation, emits a full-detail LOD0 and a deterministic
 * foliage-card-reduced LOD1, then lets the runtime use its existing PBR
 * conifer-card layer as LOD2. The source archive is never fetched by the
 * game at runtime.
 *
 * Usage:
 *   node scripts/build-fir-sapling-runtime.mjs --source <download-folder> \
 *     --out assets/environment/polyhaven-fir-sapling-runtime
 *
 * The caller must download the exact anonymous, official Poly Haven 1K glTF
 * closure first. Every upstream input MD5 is checked before derivatives are
 * written so a transient/corrupt download cannot silently enter the repo.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const componentBytes = new Map([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]);
const typeComponents = new Map([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4], ['MAT2', 4], ['MAT3', 9], ['MAT4', 16]]);
const expectedInputs = Object.freeze({
  'fir_sapling_1k.gltf': '7b1a5ceae7be69954510b5a5c719b4fb',
  'fir_sapling.bin': 'b329143a90d95201891afc52daeb9698',
  'textures/fir_sapling_twigs_nor_gl_1k.jpg': '764771b717c54b86fa7d3eadc4a1ada5',
  'textures/fir_sapling_branches_diff_1k.jpg': '84f1d40b80a015d65c0ded042a10765b',
  'textures/fir_sapling_twigs_diff_1k.jpg': 'cd218269e0b34bd1bdb48a8daf21be67',
  'textures/fir_sapling_branches_nor_gl_1k.jpg': 'db70c4595cf207cc04a02b49c195b78d',
  'textures/fir_sapling_twigs_arm_1k.jpg': 'cf97b5de863ebad9a48cb187ef3c3e74',
  'textures/fir_sapling_branches_arm_1k.jpg': '29a9ff22b8f7f224069b1254db171c05'
});

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
function md5(bytes) { return createHash('md5').update(bytes).digest('hex'); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function requireFinite(value, description) {
  if (!Number.isFinite(value)) throw new Error(`Invalid ${description}`);
  return value;
}
function align4(value) { return (value + 3) & ~3; }
function deterministicKeep(group, factor) {
  if (factor <= 1) return true;
  const mixed = Math.imul(group + 1, 0x9e3779b1) >>> 0;
  return mixed % factor === 0;
}
function readIndex(buffer, offset, componentType) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (componentType === 5121) return view.getUint8(offset);
  if (componentType === 5123) return view.getUint16(offset, true);
  if (componentType === 5125) return view.getUint32(offset, true);
  throw new Error(`Unsupported glTF index component type ${componentType}`);
}
function writeIndex(buffer, offset, componentType, value) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (componentType === 5121) return view.setUint8(offset, value);
  if (componentType === 5123) return view.setUint16(offset, value, true);
  if (componentType === 5125) return view.setUint32(offset, value, true);
  throw new Error(`Unsupported glTF index component type ${componentType}`);
}

class PackedBuffer {
  constructor() { this.parts = []; this.length = 0; this.views = []; }
  append(bytes, target) {
    const offset = align4(this.length);
    if (offset > this.length) this.parts.push(Buffer.alloc(offset - this.length));
    const copy = Buffer.from(bytes);
    this.parts.push(copy);
    const view = { buffer: 0, byteOffset: offset, byteLength: copy.length };
    if (target != null) view.target = target;
    this.views.push(view);
    this.length = offset + copy.length;
    return this.views.length - 1;
  }
  finish() { return Buffer.concat([...this.parts, Buffer.alloc(align4(this.length) - this.length)]); }
}

function accessorLayout(document, accessorIndex) {
  const accessor = document.accessors[accessorIndex];
  if (!accessor || accessor.bufferView == null || accessor.sparse) throw new Error(`Accessor ${accessorIndex} is missing a direct buffer view or uses unsupported sparse data.`);
  const componentSize = componentBytes.get(accessor.componentType);
  const components = typeComponents.get(accessor.type);
  if (!componentSize || !components) throw new Error(`Accessor ${accessorIndex} has an unsupported layout.`);
  const view = document.bufferViews[accessor.bufferView];
  if (!view || view.buffer !== 0) throw new Error(`Accessor ${accessorIndex} does not use source buffer 0.`);
  const elementBytes = componentSize * components;
  const stride = view.byteStride || elementBytes;
  return { accessor, view, componentSize, components, elementBytes, stride, offset: (view.byteOffset || 0) + (accessor.byteOffset || 0) };
}
function accessorElement(source, layout, index) {
  if (index < 0 || index >= layout.accessor.count) throw new Error('Accessor index outside source range.');
  const start = layout.offset + index * layout.stride;
  const end = start + layout.elementBytes;
  if (end > source.length) throw new Error('Accessor read exceeds source buffer.');
  return source.subarray(start, end);
}
function cloneAccessorMetadata(accessor, count, bufferView) {
  const output = { bufferView, componentType: accessor.componentType, count, type: accessor.type };
  if (accessor.normalized) output.normalized = true;
  if (accessor.min) output.min = accessor.min;
  if (accessor.max) output.max = accessor.max;
  return output;
}
function packAttribute(document, source, packed, accessorIndex, selectedVertices) {
  const layout = accessorLayout(document, accessorIndex);
  const bytes = Buffer.alloc(selectedVertices.length * layout.elementBytes);
  selectedVertices.forEach((vertex, index) => accessorElement(source, layout, vertex).copy(bytes, index * layout.elementBytes));
  const bufferView = packed.append(bytes, document.bufferViews[layout.accessor.bufferView]?.target);
  return cloneAccessorMetadata(layout.accessor, selectedVertices.length, bufferView);
}
function sourceIndices(document, source, accessorIndex) {
  const layout = accessorLayout(document, accessorIndex);
  if (layout.accessor.type !== 'SCALAR') throw new Error('Indices accessor must be scalar.');
  const values = [];
  for (let index = 0; index < layout.accessor.count; index++) {
    const element = accessorElement(source, layout, index);
    values.push(readIndex(element, 0, layout.accessor.componentType));
  }
  return { values, accessor: layout.accessor };
}
function packIndices(packed, oldAccessor, indices) {
  let maximum = 0;
  for (const value of indices) if (value > maximum) maximum = value;
  const componentType = maximum <= 255 ? 5121 : maximum <= 65535 ? 5123 : 5125;
  const bytesPerIndex = componentBytes.get(componentType);
  const bytes = Buffer.alloc(indices.length * bytesPerIndex);
  indices.forEach((value, index) => writeIndex(bytes, index * bytesPerIndex, componentType, value));
  const bufferView = packed.append(bytes, 34963);
  return { bufferView, componentType, count: indices.length, type: 'SCALAR', min: [0], max: [maximum] };
}
function chooseFoliageIndices(values, factor) {
  const selected = [];
  const triangleCount = Math.floor(values.length / 3);
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    // glTF exporters normally emit the two triangles of each foliage card
    // consecutively. Hash by pair so the reduced LOD retains complete cards.
    if (!deterministicKeep(Math.floor(triangle / 2), factor)) continue;
    const offset = triangle * 3;
    selected.push(values[offset], values[offset + 1], values[offset + 2]);
  }
  return selected;
}
function packPrimitive(sourceDocument, resultDocument, source, packed, primitive, foliageFactor = 1) {
  const { values: rawIndices, accessor: indexAccessor } = sourceIndices(sourceDocument, source, primitive.indices);
  const oldIndices = foliageFactor > 1 ? chooseFoliageIndices(rawIndices, foliageFactor) : rawIndices;
  const remap = new Map();
  const vertices = [];
  const indices = oldIndices.map((oldIndex) => {
    if (!remap.has(oldIndex)) { remap.set(oldIndex, vertices.length); vertices.push(oldIndex); }
    return remap.get(oldIndex);
  });
  const attributes = {};
  for (const [semantic, accessorIndex] of Object.entries(primitive.attributes || {})) {
    attributes[semantic] = resultDocument.__accessors.push(packAttribute(sourceDocument, source, packed, accessorIndex, vertices)) - 1;
  }
  const output = { attributes, indices: resultDocument.__accessors.push(packIndices(packed, indexAccessor, indices)) - 1 };
  if (primitive.material != null) output.material = primitive.material;
  if (primitive.mode != null) output.mode = primitive.mode;
  return { primitive: output, triangles: indices.length / 3, vertices: vertices.length };
}
function buildLod(sourceDocument, sourceBuffer, foliageFactor, label) {
  const sourceMesh = sourceDocument.meshes?.[0];
  if (!sourceMesh?.primitives?.length) throw new Error('Expected mesh 0 with source primitives.');
  const packed = new PackedBuffer();
  const document = { __accessors: [] };
  const results = sourceMesh.primitives.map((primitive, index) => packPrimitive(sourceDocument, document, sourceBuffer, packed, primitive, index === 1 ? foliageFactor : 1));
  const images = (sourceDocument.images || []).map((image) => ({ ...image, uri: `textures/${basename(image.uri)}` }));
  const node = { mesh: 0, name: `specter-fir-sapling-${label}` };
  const output = {
    asset: {
      version: '2.0',
      generator: `SPECTER Fir Sapling runtime LOD builder (${label})`,
      copyright: 'Poly Haven Fir Sapling by Rico Cilliers and Rob Tuytel — CC0 1.0'
    },
    scene: 0,
    scenes: [{ name: 'SPECTER Fir Sapling', nodes: [0] }],
    nodes: [node],
    meshes: [{ name: `specter_fir_sapling_${label}`, primitives: results.map(result => result.primitive) }],
    accessors: document.__accessors,
    bufferViews: packed.views,
    buffers: [{ byteLength: packed.finish().length, uri: `fir_sapling_${label}.bin` }],
    materials: sourceDocument.materials,
    textures: sourceDocument.textures,
    images,
    samplers: sourceDocument.samplers
  };
  return { document: output, buffer: packed.finish(), triangles: results.reduce((sum, result) => sum + result.triangles, 0), vertices: results.reduce((sum, result) => sum + result.vertices, 0) };
}

const sourceDirectory = resolve(argument('--source') || '');
const outputDirectory = resolve(argument('--out') || resolve(ROOT, 'assets/environment/polyhaven-fir-sapling-runtime'));
if (!argument('--source')) throw new Error('Missing --source <download-folder>.');
if (sourceDirectory === outputDirectory) throw new Error('Source and output directories must be different.');
const existingOutput = await readdir(outputDirectory).catch(() => []);
if (existingOutput.length) throw new Error(`Refusing to overwrite non-empty output directory: ${outputDirectory}`);

const inputBytes = {};
for (const [relativePath, expectedMd5] of Object.entries(expectedInputs)) {
  const bytes = await readFile(resolve(sourceDirectory, relativePath));
  const actualMd5 = md5(bytes);
  if (actualMd5 !== expectedMd5) throw new Error(`MD5 mismatch for ${relativePath}: expected ${expectedMd5}, received ${actualMd5}`);
  inputBytes[relativePath] = bytes;
}
const sourceDocument = JSON.parse(inputBytes['fir_sapling_1k.gltf'].toString('utf8'));
const lod0 = buildLod(sourceDocument, inputBytes['fir_sapling.bin'], 1, 'lod0');
const lod1 = buildLod(sourceDocument, inputBytes['fir_sapling.bin'], 4, 'lod1');
await mkdir(resolve(outputDirectory, 'textures'), { recursive: true });
for (const relativePath of Object.keys(expectedInputs).filter(path => path.startsWith('textures/'))) {
  await copyFile(resolve(sourceDirectory, relativePath), resolve(outputDirectory, relativePath));
}
for (const [label, result] of Object.entries({ lod0, lod1 })) {
  await writeFile(resolve(outputDirectory, `fir_sapling_${label}.gltf`), `${JSON.stringify(result.document, null, 2)}\n`);
  await writeFile(resolve(outputDirectory, `fir_sapling_${label}.bin`), result.buffer);
}
const outputs = {};
for (const name of ['fir_sapling_lod0.gltf', 'fir_sapling_lod0.bin', 'fir_sapling_lod1.gltf', 'fir_sapling_lod1.bin', ...Object.keys(expectedInputs).filter(path => path.startsWith('textures/'))]) {
  const bytes = await readFile(resolve(outputDirectory, name));
  outputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
}
const manifest = {
  id: 'polyhaven-fir-sapling-runtime',
  source: {
    asset: 'Fir Sapling',
    page: 'https://polyhaven.com/a/fir_sapling',
    manifest: 'https://api.polyhaven.com/files/fir_sapling',
    license: 'CC0-1.0',
    authors: ['Rico Cilliers (modeling)', 'Rob Tuytel (photography)'],
    sourceResolution: '1K glTF',
    inputMd5: expectedInputs
  },
  conversion: {
    sourceMesh: 'fir_sapling_a',
    sourceTriangles: 157402,
    lod0: { triangles: lod0.triangles, vertices: lod0.vertices, distance: '0–42 m' },
    lod1: { triangles: lod1.triangles, vertices: lod1.vertices, distance: '42–88 m', foliageCardSampling: '1 of 4 paired foliage cards' },
    lod2: { type: 'shared project PBR crossed-card impostor', distance: '88–150 m' },
    runtimeInstances: '6 sparse fence/gate hero saplings at High/Ultra/Extreme only'
  },
  outputs
};
await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built CC0 Fir Sapling runtime derivatives: LOD0 ${lod0.triangles} tris, LOD1 ${lod1.triangles} tris.`);
