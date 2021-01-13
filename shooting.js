import { SHOEBILL_COUNT, RADIUS } from './utils.js';

export const shoebillPosition = (model, index) => {
  const phi = 2 * Math.PI / SHOEBILL_COUNT * index;
  model.position.setFromCylindricalCoords(RADIUS, phi, 0);
  model.rotation.y = phi + Math.PI / 2;
}

export const shoebillMovement = (model, delta, level) => function() {
  const now = new THREE.Cylindrical().setFromVector3(model.position);
  model.position.setFromCylindricalCoords(now.radius - delta * level, now.theta, now.y);
}