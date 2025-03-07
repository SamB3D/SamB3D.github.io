import * as THREE from "three";

const loader = new THREE.TextureLoader();

function getSprite({ hasFog, color, opacity, path, pos, size }) {
  const spriteMat = new THREE.SpriteMaterial({
    color, // Fixed color
    fog: hasFog,
    map: loader.load(path),
    transparent: true,
    opacity,
  });

  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(pos.x, -pos.y, pos.z);
  sprite.scale.set(size, size, size);
  sprite.material.rotation = 0;
  return sprite;
}

function getLayer({
  hasFog = true,
  color = "#898EC5", // Default: Red (Hex format)
  numSprites = 10,
  opacity = 1,
  path = "./grad.png",
  radius = 1,
  size = 1,
  z = 0,
}) {
  const layerGroup = new THREE.Group();
  const fixedColor = new THREE.Color(color); // Convert Hex/RGB to THREE.Color

  for (let i = 0; i < numSprites; i += 1) {
    let angle = (i / numSprites) * Math.PI * 2;
    const pos = new THREE.Vector3(
      Math.cos(angle) * Math.random() * radius,
      Math.sin(angle) * Math.random() * radius,
      z + Math.random()
    );

    const sprite = getSprite({ hasFog, color: fixedColor, opacity, path, pos, size });
    layerGroup.add(sprite);
  }
  return layerGroup;
}

export default getLayer;
