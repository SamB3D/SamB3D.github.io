import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";



// Color configuration
const COLORS = {
  hover: 0x00ff00, // Green on hover
  default: 0xff0000, // Red by default
};

// Initiate basics
// const w = window.innerWidth;
// const h = window.innerHeight;
const w = 1000;
const h = 1000;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(37, w / h, 0.1, 1000);
camera.position.set(0, 0, 5);
const defaultTarget = new THREE.Vector3(0, 0, 0);
const defaultPosition = new THREE.Vector3(0, 0, 5); // Default camera position
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.getElementById("contact-container").appendChild(renderer.domElement);

// Orbit Controls
const ctrls = new OrbitControls(camera, renderer.domElement);
ctrls.enableDamping = true;
ctrls.dampingFactor = 0.1;
ctrls.enableZoom = false; // Disable zoom to maintain a fixed distance from the scene
ctrls.enableRotate = true;
ctrls.target.set(0, 0, 0);

// Set hard limits for horizontal and vertical orbiting
ctrls.minAzimuthAngle = THREE.MathUtils.degToRad(-30);
ctrls.maxAzimuthAngle = THREE.MathUtils.degToRad(30);
ctrls.minPolarAngle = THREE.MathUtils.degToRad(60);
ctrls.maxPolarAngle = THREE.MathUtils.degToRad(120);

let isSnappingBack = true;
let isUserRotating = false;
let lastMeshMoveTime = Date.now(); // Timer to track the last mesh movement

// Bone movement variables
let selectedBone = null;
let isDragging = false;
let clickedOnController = false;
let gltfMesh;
let deformBones = []; // To store deform bones
let controllers = []; // To store the controllers created for bones

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

// Load GLTF
const gltfLoader = new GLTFLoader();
gltfLoader.load("./assets/blender/Sam_Browser.glb", (gltf) => {
  gltfMesh = gltf.scene;

  // console.log(gltfMesh);

  gltfMesh.traverse((child) => {
    if (child.isMesh) {
      child.geometry;

      // Create a material that uses vertex colors
      const gltfMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.5,
        metalness: 0.1,
      });

      // Assign the material to the mesh
      child.material = gltfMat;

      // console.log(child);
    }
    if (child.isBone && child.name.startsWith("DEF-") && !child.name.endsWith("_leaf")) {

      // If bone name starts with "DEF-", add it to deformBones
      deformBones.push(child);
      // console.log(`Deform Bone Found: ${child.name} at position:`, child.position);

      // Find the corresponding _leaf bone
      const leafBone = gltfMesh.getObjectByName(`${child.name}_leaf`);
      let controllerSize = 1; // Default size

      if (leafBone) {
        const bonePosition = new THREE.Vector3();
        const leafPosition = new THREE.Vector3();
        child.getWorldPosition(bonePosition);
        leafBone.getWorldPosition(leafPosition);

        // Compute distance and set controller size
        controllerSize = bonePosition.distanceTo(leafPosition) * 0.5; // Adjust scaling factor as needed
      }

      // Create a controller with the computed size
      const controllerGeometry = new THREE.SphereGeometry(controllerSize);

      const controllerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,    // Alpha transparency
      });
      const controller = new THREE.Mesh(controllerGeometry, controllerMaterial);
      controller.position.copy(child.position);
      scene.add(controller);

      // Store the controller and the associated bone
      controllers.push({ bone: child, controller: controller });

      // Store the initial rest position of the bone
      child.userData.restPosition = child.position.clone();
      springVelocities[child.name] = new THREE.Vector3(); // Initialize spring velocity

    }
  });

  scene.add(gltfMesh);
});

// Add light
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(hemiLight);

const light = new THREE.DirectionalLight(0xffffff, 0.5);
light.position.set(10, 10, 10);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Softer overall lighting
scene.add(ambientLight);

// Mouse Events
window.addEventListener("mousedown", onMouseDown, false);
window.addEventListener("mousemove", onMouseMove, false);
window.addEventListener("mouseup", onMouseUp, false);
window.addEventListener("mousemove", onMouseHover, false); // To handle hovering over controllers

function onMouseDown(event) {
  // Only proceed if left mouse button is clicked (button === 0)
  if (event.button !== 0) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  clickedOnController = false;

  // Check for intersection with controllers
  controllers.forEach(({ controller, bone }) => {
    const intersects = raycaster.intersectObject(controller);
    if (intersects.length > 0) {
      clickedOnController = true;
      selectedBone = bone;
      isDragging = true;
      // console.log(`Clicked on controller, moving bone: ${bone.name}`);

      // Lock the camera when dragging starts
      ctrls.enableRotate = false;
      lastMeshMoveTime = Date.now(); // Reset mesh inactivity timer
    }
  });

  if (!clickedOnController) {
    ctrls.enableRotate = true;
    isUserRotating = true;
  }
}

// Global mouse vector, raycaster, and plane for eye tracking
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane();

function onMouseMove(event) {
  // Update mouse coordinates normalized (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // ----- EYE TRACKING CODE -----
  // Get eye objects and mid target (if loaded)
  const eyeL = scene.getObjectByName('TGT-eyeL');
  const eyeR = scene.getObjectByName('TGT-eyeR');
  const tgtEyeMid = scene.getObjectByName('TGT-eye_mid');
  if (eyeL && eyeR && tgtEyeMid) {
    // Set up raycaster from camera and mouse
    raycaster.setFromCamera(mouse, camera);
    // Create a plane facing the camera with an offset distance
    const offsetDistance = -2;
    const planePoint = new THREE.Vector3(0, 0, 0).add(
      camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(offsetDistance)
    );
    plane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()), 
      planePoint
    );
    // Calculate intersection of the ray with the plane
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    // Update eye rotations to look at the intersection point
    if (intersection) {
      tgtEyeMid.lookAt(intersection);
      eyeL.rotation.setFromRotationMatrix(tgtEyeMid.matrix);
      eyeR.rotation.setFromRotationMatrix(tgtEyeMid.matrix);
    }
  }
  // ----- END EYE TRACKING -----

  // ----- BONE DRAGGING CODE (if dragging a bone) -----
  if (!isDragging || !selectedBone) return;

  // Convert mouse movement to translation offset in world space.
  const deltaX = event.movementX * 0.003;
  const deltaY = event.movementY * -0.003;
  const offset = new THREE.Vector3(deltaX, deltaY, 0);

  // Get selected bone's current world position
  const boneWorldPosition = new THREE.Vector3();
  selectedBone.getWorldPosition(boneWorldPosition);

  // Calculate new world position by adding offset
  const newBoneWorldPosition = boneWorldPosition.clone().add(offset);

  // Convert new world position to the bone's local space
  selectedBone.position.copy(selectedBone.parent.worldToLocal(newBoneWorldPosition.clone()));

  // Update the corresponding controller position for the bone
  controllers.forEach(({ controller, bone }) => {
    if (bone === selectedBone) {
      bone.getWorldPosition(controller.position);
    }
  });

  // Additional bone-specific handling (example for jaw/lip movement)
  if (selectedBone.name === "DEF-jaw_bot") {
    controllers.forEach(({ controller, bone }) => {
      if (bone.name === "DEF-lip_bot") {
        const parent = bone.parent;
        const inverseMatrix = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        const localOffset = offset.clone().applyMatrix4(inverseMatrix);
        bone.position.add(localOffset);
        bone.getWorldPosition(controller.position);
      }
    });
  }

  if (selectedBone.name === "DEF-head_top") {
    controllers.forEach(({ controller, bone }) => {
      if (bone.name === "DEF-head_lock") {
        const parent = bone.parent;
        const localOffset = offset.clone().applyMatrix4(parent.matrixWorld.clone().invert());
        bone.position.add(localOffset);
        bone.getWorldPosition(controller.position);
      }
    });
  }
  // Reset mesh inactivity timer on movement
  lastMeshMoveTime = Date.now();
  // ----- END BONE DRAGGING -----
}

function onMouseUp() {
  isDragging = false;
  if (selectedBone) {
    selectedBone = null;
  }
  ctrls.enableRotate = true;
  isUserRotating = false;

  // Trigger camera snap-back when not dragging a controller
  if (!clickedOnController) {
    isSnappingBack = true;
  }
}

function onMouseHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);

  // Check for hover over controllers
  controllers.forEach(({ controller }) => {
    const intersects = raycaster.intersectObject(controller);
    if (intersects.length > 0) {
      controller.material.color.set(COLORS.hover); // Green on hover
      controller.material.opacity = 0.2;
    } else {
      controller.material.color.set(COLORS.default);
      controller.material.opacity = 0;
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
      controllers.forEach(({ controller, bone: linkedBone }) => {
        if (linkedBone === bone) {
          controller.position.copy(bone.position);
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

// Inside the animate function
function animate() {
  requestAnimationFrame(animate);
  applySpringMovement();
  limitOrbitFalloff();
  updateSnapBack();
  ctrls.update();
  renderer.render(scene, camera);
}

animate();

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Automatic Resize
function handleWindowResize() {
  const section = document.getElementById('Home');
  const sectionWidth = section.clientWidth * 0.8;
  const sectionHeight = section.clientHeight * 0.8;
  const aspectRatio = sectionWidth / sectionHeight;

  let width, height;

  if (aspectRatio > 16 / 9) {
    width = sectionHeight * (16 / 9);
    height = sectionHeight;
  } else {
    width = sectionWidth;
    height = sectionHeight;
  }

  // Calculate the new camera z position based on the width
  const minAspectRatio = 308.8 / 392;
  const maxAspectRatio = 16 / 9;
  const minZ = 8; // Minimum z position for the camera
  const maxZ = 5; // Maximum z position for the camera

  const aspectRatioClamped = THREE.MathUtils.clamp(aspectRatio, minAspectRatio, maxAspectRatio);
  const t = (aspectRatioClamped - minAspectRatio) / (maxAspectRatio - minAspectRatio);
  const newZ = THREE.MathUtils.lerp(minZ, maxZ, t);

  // Smoothly change the camera z position
  camera.position.z = newZ;
  defaultPosition.z = newZ;

  // console.log(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener("resize", debounce(handleWindowResize, 100), false);

// Initial setup
handleWindowResize();