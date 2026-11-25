import * as THREE from 'three';

export function mesh(geometry: THREE.BufferGeometry, color: number) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
}

export function fit(
  model: THREE.Object3D,
  axis: 'x' | 'y',
  size: number,
  grounded = false
) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  if (grounded) center.y = box.min.y;
  const scale = size / box.getSize(new THREE.Vector3())[axis];
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  model.position.sub(center);
  group.add(model);
  return group;
}

export function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) {
    if (
      typeof ImageBitmap !== 'undefined' &&
      texture.source.data instanceof ImageBitmap
    )
      texture.source.data.close();
    texture.dispose();
  }
  for (const skeleton of skeletons) skeleton.dispose();
}
