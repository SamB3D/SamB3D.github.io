import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";

// Initiate basics
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, w / h, 0.1, 1000);
camera.position.set(0, 0, 2.5);
const defaultTarget = new THREE.Vector3(0, 0, 0);
const defaultPosition = new THREE.Vector3(0, 0, 2.5); // Default camera position
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

// Orbit Controls
const ctrls = new OrbitControls(camera, renderer.domElement);
ctrls.enableDamping = true;
ctrls.dampingFactor = 0.1;
ctrls.enableZoom = false;
ctrls.enableRotate = true;
ctrls.target.set(0, 0, 0);

// Set hard limits for horizontal and vertical orbiting
// Horizontal limits: free zone: ±25°, hard limit: ±45°
// Vertical limits: center at 90°; free zone: 90°±25° (65° to 115°); hard limit: 90°±45° (45° to 135°)
ctrls.minAzimuthAngle = THREE.MathUtils.degToRad(-30);
ctrls.maxAzimuthAngle = THREE.MathUtils.degToRad(30);
ctrls.minPolarAngle = THREE.MathUtils.degToRad(60);
ctrls.maxPolarAngle = THREE.MathUtils.degToRad(120);

let isSnappingBack = true;
let isUserRotating = false;
let isDraggingMesh = false;
let lastMeshMoveTime = Date.now(); // Timer to track the last mesh movement

// Raycaster for detecting clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Bone movement variables
let selectedBone = null;
let isDragging = false;
let clickedOnSphere = false;
let testSuzanne, skinnedMesh, skeleton;
let deformBones = []; // To store deform bones
let spheres = [];     // To store the spheres created for bones

// Spring dynamics variables for rubber effect
const springDamping = 0.1;  // Damping factor to control speed of spring return
const springStiffness = 0.1;  // Stiffness factor for the spring effect
let springVelocities = {};    // Store velocities for each bone

// Sprites BG
const gradientBackground = getLayer({
  hue: 0.5,
  numSprites: 8,
  opacity: 0.2,
  radius: 10,
  size: 24,
  z: -15.5,
});
scene.add(gradientBackground);

// Create Skydome Geometry
const skydomeGeometry = new THREE.SphereGeometry(50, 32, 32);
const skydomeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color1: { value: new THREE.Color("#0D0709") }, // Solid background color
  },
  vertexShader: `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color1;
    void main() {
      gl_FragColor = vec4(color1, 1.0); // Solid color background
    }
  `,
  side: THREE.BackSide, // Render inside the sphere
});

const skydome = new THREE.Mesh(skydomeGeometry, skydomeMaterial);
scene.add(skydome);

// Keep Skydome Fixed
function updateSkydome() {
  skydome.position.copy(camera.position);
}


// Load GLTF
const gltfLoader = new GLTFLoader();
gltfLoader.load("./blender/testSuzanne.glb", (gltf) => {
  testSuzanne = gltf.scene;

  console.log(testSuzanne);

  testSuzanne.traverse((child) => {
    if (child.isMesh) {
      console.log(child);
      child.geometry.center();
      skinnedMesh = child;
    }
    if (child.isBone && child.name.startsWith("DEF-")) {

      // If bone name starts with "DEF-", add it to deformBones
      deformBones.push(child);
      console.log(`Deform Bone Found: ${child.name} at position:`, child.position);

      // Create a sphere for each deform bone with increased size (radius 0.5)
      const sphereGeometry = new THREE.SphereGeometry(0.5);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff, // Red color
        transparent: true,
        opacity: 0,    // Alpha transparency
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(child.position);
      scene.add(sphere);

      // Store the sphere and the associated bone
      spheres.push({ bone: child, sphere: sphere });

      // Store the initial rest position of the bone
      child.userData.restPosition = child.position.clone();
      springVelocities[child.name] = new THREE.Vector3(); // Initialize spring velocity
    }
  });

  skeleton = testSuzanne.getObjectByName("RIG-suzanne");
  scene.add(testSuzanne);
});

// Add light
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(hemiLight);



// Mouse Events
window.addEventListener("mousedown", onMouseDown, false);
window.addEventListener("mousemove", onMouseMove, false);
window.addEventListener("mouseup", onMouseUp, false);
window.addEventListener("mousemove", onMouseHover, false); // To handle hovering over spheres

function onMouseDown(event) {
  // Only proceed if left mouse button is clicked (button === 0)
  if (event.button !== 0) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  clickedOnSphere = false;

  // Check for intersection with spheres
  spheres.forEach(({ sphere, bone }) => {
    const intersects = raycaster.intersectObject(sphere);
    if (intersects.length > 0) {
      clickedOnSphere = true;
      selectedBone = bone;
      isDragging = true;
      console.log(`Clicked on sphere, moving bone: ${bone.name}`);

      // Lock the camera when dragging starts
      ctrls.enableRotate = false;
      lastMeshMoveTime = Date.now(); // Reset mesh inactivity timer
    }
  });

  if (!clickedOnSphere) {
    ctrls.enableRotate = true;
    isUserRotating = true;
  }
}


function onMouseMove(event) {
  if (!isDragging || !selectedBone) return;

  // Convert mouse movement to translation offset
  const deltaX = event.movementX * 0.003;
  const deltaY = event.movementY * -0.003;

  // Convert the mouse movement to a direction in world space
  const offset = new THREE.Vector3(deltaX, deltaY, 0);

  // Get the selected bone's world position
  const boneWorldPosition = new THREE.Vector3();
  selectedBone.getWorldPosition(boneWorldPosition);

  // Offset the bone's position based on mouse movement
  const newBonePosition = boneWorldPosition.clone().add(offset);
  selectedBone.position.copy(newBonePosition);

  // Also update sphere position
  spheres.forEach(({ sphere, bone: linkedBone }) => {
    if (linkedBone === selectedBone) {
      sphere.position.copy(newBonePosition);
    }
  });

  // Reset inactivity timer for mesh
  lastMeshMoveTime = Date.now();
}

function onMouseUp() {
  isDragging = false;
  selectedBone = null;
  ctrls.enableRotate = true;
  isUserRotating = false;

  // Trigger camera snap-back when not dragging a sphere
  if (!clickedOnSphere) {
    isSnappingBack = true;
  }
}

function onMouseHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);

  // Check for hover over spheres
  spheres.forEach(({ sphere }) => {
    const intersects = raycaster.intersectObject(sphere);
    if (intersects.length > 0) {
      sphere.material.color.set(0x00ff00); // Green on hover
      sphere.material.opacity = 0.2;
    } else {
      // sphere.material.color.set(0xff0000);
      sphere.material.opacity = 0;
    }
  });
}

// Spring-based animation for bone to return to rest position
function applySpringMovement() {
  const currentTime = Date.now();
  const inactivityDuration = currentTime - lastMeshMoveTime;
  if (inactivityDuration > 5000) {
    deformBones.forEach((bone) => {
      const restPosition = bone.userData.restPosition;
      const velocity = springVelocities[bone.name];
      const springForce = new THREE.Vector3().subVectors(restPosition, bone.position).multiplyScalar(springStiffness);
      velocity.add(springForce).multiplyScalar(1 - springDamping);
      bone.position.add(velocity);
      spheres.forEach(({ sphere, bone: linkedBone }) => {
        if (linkedBone === bone) {
          sphere.position.copy(bone.position);
        }
      });
    });
  }
}

// Soft Orbit Limit Falloff: full speed inside free zones and linear slowdown toward hard limits.
function limitOrbitFalloff() {
  // --- Horizontal (azimuth) slowdown ---
  // Free zone: up to 25°, hard limit: 45°
  const azimuthAbs = Math.abs(ctrls.getAzimuthalAngle());
  const freeAzimuth = THREE.MathUtils.degToRad(0);
  const maxAzimuth = THREE.MathUtils.degToRad(30);
  let factorX = 1;
  if (azimuthAbs > freeAzimuth) {
    factorX = (maxAzimuth - azimuthAbs) / (maxAzimuth - freeAzimuth);
    // Clamp to a minimum factor so that near the hard limit, movement is very slow (0.1 times base speed)
    factorX = THREE.MathUtils.clamp(factorX, 0.1, 1);
  }
  
  // --- Vertical (polar) slowdown ---
  // Center at 90°; free zone: ±25° (i.e. 65° to 115°); hard limit: ±45° (i.e. 45° to 135°)
  const polar = ctrls.getPolarAngle();
  const centerPolar = Math.PI / 2; // 90° in radians
  const polarOffset = Math.abs(polar - centerPolar);
  const freeOffset = THREE.MathUtils.degToRad(0);
  const maxOffset = THREE.MathUtils.degToRad(30);
  let factorY = 1;
  if (polarOffset > freeOffset) {
    factorY = (maxOffset - polarOffset) / (maxOffset - freeOffset);
    factorY = THREE.MathUtils.clamp(factorY, 0.1, 1);
  }
  

  // Use the smaller factor so that if either axis is near its limit, overall rotation slows down.
  const slowdownFactor = Math.min(factorX, factorY);
  const baseSpeed = 1.0; // Normal rotation speed
  ctrls.rotateSpeed = slowdownFactor * baseSpeed;
}

// Snap Back Animation for camera position
function updateSnapBack() {
  if (isSnappingBack && !isUserRotating) {
    ctrls.object.position.lerp(defaultPosition, 0.1);
    ctrls.target.lerp(defaultTarget, 0.05);
    if (ctrls.object.position.distanceTo(defaultPosition) < 0.000001) {
      ctrls.object.position.copy(defaultPosition);
      ctrls.target.copy(defaultTarget);
      isSnappingBack = false;
    }
  }
}

// Animation Loop
function animate() {
  requestAnimationFrame(animate);
  applySpringMovement();
  limitOrbitFalloff();
  renderer.render(scene, camera);
  ctrls.update();
  updateSnapBack();
}

animate();

// Automatic Resize
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", handleWindowResize, false);