// Three.js setup only: renderer, warm late-afternoon sun with shadows that
// follow the player, sky gradient, haze, and the chase camera's home.
import * as THREE from 'three';

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const gradient = g.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#6fa8d8');
  gradient.addColorStop(0.45, '#a8c8e0');
  gradient.addColorStop(0.72, '#f2c98f');
  gradient.addColorStop(1, '#f7b96a');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xe8b98a, 200, 560);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a45, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe0b3, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75;
  sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75;
  sun.shadow.camera.bottom = -75;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  camera.position.set(0, 40, 120);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize);

  // Keep the sun and its shadow box centred on the action.
  function followSun(focusX, focusZ) {
    sun.position.set(focusX + 90, 130, focusZ + 70);
    sun.target.position.set(focusX, 0, focusZ);
    sun.target.updateMatrixWorld();
  }

  return {
    renderer,
    scene,
    camera,
    followSun,
    render() {
      renderer.render(scene, camera);
    },
  };
}
