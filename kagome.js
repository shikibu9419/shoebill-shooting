import { SHOEBILL_COUNT, RADIUS } from './utils.js';

export const shoebillPosition = (model, index) => {
  const phi = 2 * Math.PI / SHOEBILL_COUNT * index;
  model.position.setFromCylindricalCoords(RADIUS, phi, 0);
  model.rotation.y = phi + Math.PI / 2;
}

export const shoebillMovement = (model, delta) => function() {
  const rad = delta * Math.PI / 10;
  const newZ = model.position.z * Math.cos(rad) - model.position.x * Math.sin(rad);
  const newX = model.position.z * Math.sin(rad) + model.position.x * Math.cos(rad);
  model.position.set(newX, model.position.y, newZ);
  model.rotation.y += rad;
}