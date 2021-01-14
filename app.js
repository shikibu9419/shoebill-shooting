import 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r123/three.min.js';
import 'https://cdn.jsdelivr.net/npm/webvr-boilerplate@latest/build/webvr-manager.min.js';
import 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r123/examples/js/loaders/GLTFLoader.js';
import 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r123/examples/js/controls/DeviceOrientationControls.js';
import './threejs/VRControls.js';
import './threejs/VREffect.js';
import './webvr-boilerplate/webvr-polyfill.js';
import { VRButton } from './threejs/VRButton.js';
import { cloneGltf } from './cloneGLTF.js';
import { VRDesktopControls } from './VRDesktopControls.js';
import { getRandomInt, SHOEBILL_COUNT, RADIUS } from './utils.js';

const GLTF_PATH = 'shoebill';

const bgm = document.getElementById('bgm');
bgm.loop = true;
bgm.volume = 0;

let initialized = false;
let opening = true;
let level = 50;
let gameOver = false;

const mixers = [];
const controls = [];
let animations = {};
let textures = [];
const shoebills = [];
const bullets = [];
let clock, renderer, manager, scene, camera, gltf, light;
let totalTime = 0;
let eventsCount = 1;
let baseScale = 100;
let score = 0;

export const shoebillPosition = (model, index) => {
  const phi = 2 * Math.PI / SHOEBILL_COUNT * index;
  model.position.setFromCylindricalCoords(RADIUS, phi, 0);
  model.rotation.y = phi + Math.PI / 2;
}

export const shoebillMovement = (model, delta, level) => function() {
  const now = new THREE.Cylindrical().setFromVector3(model.position);
  now.radius -= delta * level;

  if (now.radius < 50) {
    gameOver = true;
    document.getElementById('gameover-screen').classList.add('active');
  }

  model.position.setFromCylindrical(now);
}

const createBullet = () => {
  if (opening) {
    return;
  }
  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 50, 50),
    new THREE.MeshPhongMaterial({ color: 0xFFF100 })
  );
  const direction = new THREE.Vector3;
  camera.getWorldDirection(direction);
  bullet.position.set(camera.position.x, camera.position.y, camera.position.z);
  bullet.position.addScaledVector(direction, 50);

  bullet.rayCaster = new THREE.Raycaster(bullet.position, direction);

  bullets.push(bullet);
  scene.add(bullet);
}

const deleteShoebillFromDescendant = (obj) => {
  if (obj.name === 'OSG_Scene') {
    obj.clear();
    const index = shoebills.findIndex(s => s.uuid === obj.uuid)
    if (index >= 0) {
      shoebills[index].clear();
      shoebills.splice(index, 1);
      score += 50;
      document.getElementById('score').textContent = score;
    }
  } else {
    deleteShoebillFromDescendant(obj.parent);
  }
}

const removeBullet = (bullet, index) => {
  scene.remove(bullet);
  bullet.geometry.dispose();
  bullet.material.dispose();
  bullets.splice(index, 1);
}

const bulletMovement = (bullet, bIndex, delta) => function() {
  bullet.position.y -= 100;
  const now = new THREE.Spherical().setFromVector3(bullet.position);
  now.radius += delta * 500;
  bullet.position.setFromSpherical(now);
  bullet.position.y += 100;
  bullet.rayCaster.ray.origin.set(bullet.position.x, bullet.position.y, bullet.position.z);

  const intersected = bullet.rayCaster.intersectObjects(shoebills, true);
  if (intersected.length && intersected[0].distance < 50) {
    deleteShoebillFromDescendant(intersected[0].object);
    removeBullet(bullet, bIndex)
  }
}

const main = async () => {
  // setup renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#canvas'),
  });
  const width = document.getElementById('canvas-wrapper').getBoundingClientRect().width;
  const height = document.getElementById('canvas-wrapper').getBoundingClientRect().height;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.xr.enabled = true;

  // add VRButton
  document.body.appendChild(VRButton.createButton(renderer));

  // setup scene
  scene = new THREE.Scene();

  // setup camera
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
  camera.position.y = 100;

  // for VR
  const effect = new THREE.VREffect(renderer);
  effect.setSize(window.innerWidth, window.innerHeight);
  manager = new WebVRManager(renderer, effect);

  // setup controls
  const desktopControls = new VRDesktopControls(camera, renderer.domElement);
  desktopControls.lookAt(0, 100, RADIUS);
  controls.push(desktopControls);

  // preload textures
  textures = await Promise.all([
    `${GLTF_PATH}/textures/body_diffuse.png`,
    `${GLTF_PATH}/textures/wing_diffuse.png`,
    `${GLTF_PATH}/textures/eyes_specularGlossiness.png`,
    `${GLTF_PATH}/textures/feather_specularGlossiness.png`,
    `${GLTF_PATH}/textures/material_specularGlossiness.png`,
    `${GLTF_PATH}/textures/peck_specularGlossiness.png`,
    `${GLTF_PATH}/textures/tongue_specularGlossiness.png`,
    `${GLTF_PATH}/textures/wing_specularGlossiness.png`
  ].map(s => {
    const t = new THREE.TextureLoader().load(s);
    t.outputEncoding = THREE.sRGBEncoding;
    return t;
  }));

  // setup light
  scene.add(new THREE.AmbientLight(0xFFFFFF, 3.0));

  if (!getRandomInt(10)) {
    offSetRad = Math.PI / 2;
  }

  clock = new THREE.Clock();
  onResize();
  render();
}

const init = () => {
  if (initialized) return;

  initialized = true;
  document.getElementById('screen-loading').classList.add('active');

  // Load GLTF File
  const loader = new THREE.GLTFLoader();
  loader.load(
    `${GLTF_PATH}/scene.gltf`,
    (origin) => {
      document.getElementById('screen').classList.remove('active');

      gltf = origin;

      animations = gltf.animations.reduce((acc, cur) => ({ ...acc, [cur.name]: cur }), {});

      const copy = cloneGltf(gltf);
      copy.scale.set(baseScale, baseScale, baseScale);
      shoebillPosition(copy, 0);

      copy.rotation.y += Math.PI / 2;

      copy.traverse((obj) => {
        if (obj.isMesh) setupShobillGLTF(obj);
      });

      const mixer = new THREE.AnimationMixer(copy);
      const action = mixer.clipAction(animations.Shoebill_idle).setLoop(THREE.LoopRepeat);
      const nextAction = mixer.clipAction(animations.Shoebill_walk).setLoop(THREE.LoopRepeat);
      action.play();

      mixer.addEventListener('loop', (_) => {
        if (!opening) return;

        opening = false;

        action.crossFadeTo(nextAction, 1);
        nextAction.play();

        bgm.volume = 1.0;
        addShoebill();
      });

      mixers.push(mixer);

      shoebills.push(copy);
      scene.add(copy);
    }
  );
}

const addShoebill = () => {
  if (!gltf) {
    return;
  }

  const copy = cloneGltf(gltf);
  const scale = getRandomInt(20) + 80;
  copy.scale.set(scale, scale, scale);

  let radius = getRandomInt(RADIUS * 2) + RADIUS;
  const theta = 2 * Math.PI * (Math.random());

  copy.rotation.y = theta + Math.PI;
  copy.position.setFromCylindricalCoords(radius, theta, 0);
  copy.traverse((obj) => {
    if (obj.isMesh) setupShobillGLTF(obj);
  });

  const mixer = new THREE.AnimationMixer(copy);
  const action = mixer.clipAction(animations.Shoebill_walk).setLoop(THREE.LoopRepeat);
  action.play();

  mixers.push(mixer);
  shoebills.push(copy);
  scene.add(copy);
}

const render = () => {
  const delta = clock.getDelta();
  totalTime += delta;
  const fps = !delta ? 100 : 1 / delta;

  if (!gameOver && totalTime > 2 * eventsCount) {
    if (!opening && fps > 40) addShoebill();

    eventsCount++;
  }

  if (mixers.length) {
    Promise.all(mixers.map(m => m.update(delta)));
  }

  if (opening) {
    requestAnimationFrame(render);
    manager.render(scene, camera);
    return;
  }

  if (controls.length) {
    Promise.all(controls.map(c =>
      new Promise((resolve) => {
        c.update(delta);
        resolve();
      })
    ));
  }

  if (!gameOver && bullets.length) {
    Promise.all(bullets.map((b, index) => new Promise(bulletMovement(b, index, delta))))
  }

  if (!gameOver && shoebills.length) {
    Promise.all(shoebills.map((s) => new Promise(shoebillMovement(s, delta, level))))
  }

  requestAnimationFrame(render);

  manager.render(scene, camera);
}

const setupShobillGLTF = (obj) => {
  const material = obj.material;
  textures.forEach(t => {
    material.specularMap = t;
    material.glossinessMap = t;
  })
  if (material.name === 'eyelens') {
    material.opacity = 0.5;
    material.transparent = true;
  }
}

const onResize = () => {
  // サイズを取得
  const width = window.innerWidth;
  const height = window.innerHeight;

  // レンダラーのサイズを調整する
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  // カメラのアスペクト比を正す
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const updateOrientationControls = (e) => {
  if (!e.alpha || !initialized) { return; }
  const control = new THREE.DeviceOrientationControls(camera, true);
  control.connect();
  control.update();
  controls.push(control);
  camera.lookAt(0, 100, RADIUS);
  window.removeEventListener('deviceorientation', updateOrientationControls, true);
}

const onHandleClick = () => {
  var count = 0;
  return () => {
    count++;
    if (count < 10) {
      console.log(`${count}...`)
    } else if (opening) {
      offSetRad = Math.PI / 2;
      console.log('EXTRA MODE START!!')
    }
  }
}

window.addEventListener('DOMContentLoaded', main);
window.addEventListener('resize', onResize);
window.addEventListener('deviceorientation', updateOrientationControls, true);
document.getElementById('screen').addEventListener('click', init);
document.getElementById('screen').onclick = function () { bgm.play() }
document.getElementById('button').onclick = createBullet;
document.getElementById('reload').onclick = function () { location.reload() };
document.getElementById('canvas-wrapper').addEventListener('click', onHandleClick());