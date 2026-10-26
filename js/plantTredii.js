import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";


// ======================================================
// VIEWER
// ======================================================
const viewer = document.getElementById("animalViewer");

// ======================================================
// LOADING ELEMENTS
// ======================================================
const modelLoading = document.getElementById("modelLoading");
const loadingPercentage = document.getElementById("loadingPercentage");
const infoLoading = document.getElementById("infoLoading");
const organelleInfo = document.getElementById("organelleInfo");
const zoomControls = document.querySelector(".zoomControls");
const loadingProgress = document.getElementById("loadingProgress");

// ======================================================
// INITIAL LOADING STATE
// ======================================================
viewer.classList.add("loading");
if (zoomControls) {
    zoomControls.style.display = "none";
}

// ======================================================
// PLANT CELL
// ======================================================
let plantCell = null;
let originalPlantPosition = new THREE.Vector3();
let originalMaxDimension = 1;

// ======================================================
// MODE STATE
// ======================================================
let currentMode = "separate"; // "separate" or "whole"

// true while a single organelle is shown alone (separate mode)
let isolatedView = false;

// ======================================================
// DESIRED MODEL ROTATION
// ======================================================
const MODEL_ROTATION = { x: 0.5, y: 10.0, z: 0.0 };

// ======================================================
// CAMERA DISTANCE  (EDIT THESE TO ZOOM IN / OUT)
// Bigger number = zoomed out (model looks smaller)
// Smaller number = zoomed in (model looks bigger)
// ======================================================
const WHOLE_CAMERA_DISTANCE = 3.4;     // whole cell / reset view (was 3.0)
const SEPARATE_CAMERA_DISTANCE = 3.0;  // one organelle alone     (was 2.6)

// ======================================================
// AUTO-ROTATE PIVOT (separate mode)
// The point (in the model's local space) where the isolated
// organelle sits, so "Rotate 3D model" spins it in place
// instead of swinging it around the model's origin.
// ======================================================
const isolatedPivotLocal = new THREE.Vector3();
const _pivotBefore = new THREE.Vector3();
const _pivotAfter = new THREE.Vector3();

function rotateAroundIsolatedPivot(step) {
    if (!plantCell) return;

    plantCell.updateMatrixWorld(true);
    _pivotBefore.copy(isolatedPivotLocal);
    plantCell.localToWorld(_pivotBefore);

    plantCell.rotation.y += step;

    plantCell.updateMatrixWorld(true);
    _pivotAfter.copy(isolatedPivotLocal);
    plantCell.localToWorld(_pivotAfter);

    // Move the model back so the pivot point stays exactly where it was
    plantCell.position.add(_pivotBefore.sub(_pivotAfter));
    plantCell.updateMatrixWorld(true);
}

// ======================================================
// SCENE
// ======================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF3F8F5);

// ======================================================
// CAMERA
// ======================================================
const camera = new THREE.PerspectiveCamera(
    30,
    viewer.clientWidth / viewer.clientHeight,
    0.01,
    1000
);

// ======================================================
// MOBILE DETECTION
// Phones have high device pixel ratios (3x–4x) which
// multiplies GPU work massively. We detect mobile once
// and use it to tune the renderer settings below.
// ======================================================
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ======================================================
// RENDERER
// FIX: antialias off on mobile (high DPR already smooths
// edges), lower pixel ratio cap, cheaper tone mapping,
// and powerPreference hint for the GPU.
// ======================================================
const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    powerPreference: "high-performance"
});
renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1) : Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = isMobile ? THREE.LinearToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
viewer.appendChild(renderer.domElement);

// ======================================================
// LIGHTING
// ======================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1);
fillLight.position.set(-5, 3, 5);
scene.add(fillLight);

// ======================================================
// CONTROLS (Smoothed Interaction)
// ======================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08; // Smoother damping
controls.rotateSpeed = 0.6;    // Smoother rotation
controls.panSpeed = 0.8;       // Smooth right-click drag (panning)
controls.zoomSpeed = 3.0;      // Smoother zoom
controls.enableRotate = true;  // Left-click drag to rotate
controls.enablePan = true;     // Right-click drag to pan (kept true for smooth dragging)
controls.enableZoom = true;    // Mouse wheel to zoom

// ======================================================
// ZOOM BUTTONS
// ======================================================
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const resetViewButton = document.getElementById("resetView");
const organelleButtons = document.querySelectorAll(".organelleButton");

// ======================================================
// MESH NAME MAPPING (Fixes the missing Vacuole)
// ======================================================
const meshNameMap = {
    cellwall: "cellwall",
    cellmem: "cellmem",
    cytoplasm: "cytoplasm",
    cytoskeleton: "cytoskeleton",
    chloroplas: "chloroplas",
    GolgiApparatus: "GolgiApparatus",
    mitochondria: ["mitochondria", "mitocon002"],
    nucleus: "nucleus",
    nucleolus: "nucleolus",
    peroxisome: "peroxisome",
    ribosomes: "ribosomes",
    vacuole: "Vacuole", 
    endoplasmicReticulum:"ER"
};

// ======================================================
// MATERIAL STATE MANAGEMENT (Highlight & Restore)
// ======================================================
function saveMaterialState(mesh) {
    if (!mesh.userData.originalMaterialState) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.userData.originalMaterialState = materials.map(mat => ({
            emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x1B4332),
            emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 0
        }));
    }
}

function applyHighlight(mesh) {
    saveMaterialState(mesh);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
        mat.emissive = new THREE.Color(0xEF4444); // EcoLearn light green
        mat.emissiveIntensity = 1.8;
    });
}

function restoreMaterial(mesh) {
    if (mesh.userData.originalMaterialState) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat, i) => {
            const state = mesh.userData.originalMaterialState[i];
            if (state) {
                if (mat.emissive) mat.emissive.copy(state.emissive);
                if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = state.emissiveIntensity;
            }
        });
        delete mesh.userData.originalMaterialState;
    }
}

function clearAllEffects() {
    if (!plantCell) return;
    plantCell.traverse(child => {
        if (child.isMesh) {
            child.visible = true;
            // FIX: Force emissive to black to remove any "baked-in" glows from the 3D model (like the Nucleus)
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(mat => {
                if (mat.emissive) {
                    mat.emissive.setHex(0x000000);
                    mat.emissiveIntensity = 0;
                }
            });
        }
    });
}

// ======================================================
// RESET VIEW
// ======================================================
function resetView() {
    if (!plantCell) return;

    isolatedView = false;

    plantCell.position.copy(originalPlantPosition);
    plantCell.rotation.x = MODEL_ROTATION.x;
    plantCell.rotation.y = MODEL_ROTATION.y;
    plantCell.rotation.z = MODEL_ROTATION.z;
    plantCell.updateMatrixWorld(true);

    clearAllEffects();

    camera.position.set(0, 0, originalMaxDimension * WHOLE_CAMERA_DISTANCE);
    controls.target.set(0, 0, 0);
    controls.minDistance = originalMaxDimension * 0.5;
    controls.maxDistance = originalMaxDimension * 4.5;
    controls.update();

    organelleButtons.forEach(button => {
        button.classList.remove("active");
    });

    if (window.resetOrganelleInformation) {
        window.resetOrganelleInformation();
    }

    requestRender();
}

zoomInButton.addEventListener("click", function () {
    camera.position.multiplyScalar(0.8);
    controls.update();
    requestRender();
});

zoomOutButton.addEventListener("click", function () {
    camera.position.multiplyScalar(1.25);
    controls.update();
    requestRender();
});

resetViewButton.addEventListener("click", function () {
    resetView();
    requestRender();
});

// ======================================================
// MODE SWITCHING
// ======================================================
const modeButtons = document.querySelectorAll(".viewMode [data-mode]");

modeButtons.forEach(btn => {
    btn.addEventListener("click", function () {
        const newMode = this.dataset.mode;
        modeButtons.forEach(b => b.setAttribute("aria-pressed", String(b === this)));

        if (newMode === currentMode) return;
        currentMode = newMode;

        // Keep what the student was looking at: reset the view, then re-select it in the new mode
        const activeKey = document.querySelector(".organelleButton.active")?.dataset.organelle;
        resetView();
        if (activeKey) {
            document.querySelector(`.organelleButton[data-organelle="${activeKey}"]`)?.click();
        }
    });
});

// ======================================================
// GLTF LOADER
// ======================================================
const loader = new GLTFLoader();

// Add these two lines
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
loader.setDRACOLoader(dracoLoader);

loader.load(
    "./threeDyModels/PLANTCELL.glb",
    function (gltf) {
        plantCell = gltf.scene;
        scene.add(plantCell);

        const box = new THREE.Box3().setFromObject(plantCell);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        originalMaxDimension = maxDimension;

        plantCell.position.sub(center);
        originalPlantPosition = plantCell.position.clone();

        plantCell.rotation.x = MODEL_ROTATION.x;
        plantCell.rotation.y = MODEL_ROTATION.y;
        plantCell.rotation.z = MODEL_ROTATION.z;
        plantCell.updateMatrixWorld(true);

        camera.position.set(0, 0, maxDimension * WHOLE_CAMERA_DISTANCE);
        camera.near = maxDimension / 1000;
        camera.far = maxDimension * 100;
        camera.updateProjectionMatrix();

        controls.target.set(0, 0, 0);
        
        controls.minDistance = maxDimension * 0.5;
        controls.maxDistance = maxDimension * 4.5;

        controls.update();

        plantCell.traverse(child => {
            if (child.isMesh) {
                console.log("Plant Cell Object:", child.name);
                // FIX: Strip any baked-in glows from the 3D model on load
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.emissive) {
                        mat.emissive.setHex(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                });
            }
        });
        console.log("Plant Cell Loaded");

        if (loadingPercentage) loadingPercentage.textContent = "100%";
        if (loadingProgress) loadingProgress.style.width = "100%";

        window.setTimeout(() => {
            document.querySelector(".parent").classList.add("loaded");
            viewer.classList.remove("loading");
            modelLoading.classList.add("hidden");

            if (zoomControls) {
                zoomControls.style.display = "flex";
            }

            if (infoLoading) infoLoading.style.display = "none";
            if (organelleInfo) organelleInfo.classList.add("loaded");

            requestRender();
        }, 180);
    },
    function (xhr) {
        // Vercel doesn't send Content-Length, so xhr.total is 0.
        // Use real progress when available, otherwise simulate it.
        let percentage = 0;
        if (xhr.total && xhr.total > 0) {
            percentage = (xhr.loaded / xhr.total) * 100;
        } else if (xhr.loaded > 0) {
            const estimatedTotal = 30 * 1024 * 1024;
            percentage = Math.min((xhr.loaded / estimatedTotal) * 100, 90);
        }
        const formattedPercentage = percentage.toFixed(0);
        console.log("Loading:", formattedPercentage + "%");
        if (loadingPercentage) loadingPercentage.textContent = formattedPercentage + "%";
        if (loadingProgress) loadingProgress.style.width = formattedPercentage + "%";
    },
    function (error) {
        console.error("Error loading Plant Cell:", error);
        if (modelLoading) {
            modelLoading.innerHTML = `
                <div class="loadingSpinner" style="animation-play-state: paused;"></div>
                <p>Failed to load Plant Cell.</p>
                <span>Please refresh the page.</span>
            `;
        }
        if (infoLoading) {
            infoLoading.innerHTML = `<p>Unable to load information.</p>`;
        }
    }
);

// ======================================================
// CHECK IF MESH BELONGS TO ORGANELLE
// ======================================================
function meshBelongsToOrganelles(mesh, organelleNames) {
    let currentObject = mesh;
    while (currentObject) {
        if (organelleNames.includes(currentObject.name)) return true;
        currentObject = currentObject.parent;
    }
    return false;
}

// ======================================================
// SEPARATE MODE: SHOW ONLY SELECTED ORGANELLES
// (Using your preferred camera logic)
// ======================================================
function showOnlyOrganelles(organelleNames) {
    if (!plantCell) return;

    isolatedView = true;

    plantCell.position.copy(originalPlantPosition);
    plantCell.rotation.x = MODEL_ROTATION.x;
    plantCell.rotation.y = MODEL_ROTATION.y;
    plantCell.rotation.z = MODEL_ROTATION.z;
    plantCell.updateMatrixWorld(true);

    clearAllEffects(); // Resets visibility and removes glows

    plantCell.traverse(child => {
        if (!child.isMesh) return;
        child.visible = meshBelongsToOrganelles(child, organelleNames);
    });

    plantCell.updateMatrixWorld(true);

    const selectedBox = new THREE.Box3();
    plantCell.traverse(child => {
        if (child.isMesh && child.visible) {
            selectedBox.expandByObject(child);
        }
    });

    if (selectedBox.isEmpty()) {
        console.warn("Selected organelle was not found:", organelleNames);
        return;
    }

    const selectedCenter = selectedBox.getCenter(new THREE.Vector3());
    plantCell.position.x -= selectedCenter.x;
    plantCell.position.y -= selectedCenter.y;
    plantCell.position.z -= selectedCenter.z;
    plantCell.updateMatrixWorld(true);

    const centeredBox = new THREE.Box3();
    plantCell.traverse(child => {
        if (child.isMesh && child.visible) {
            centeredBox.expandByObject(child);
        }
    });

    const selectedSize = centeredBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(selectedSize.x, selectedSize.y, selectedSize.z);

    // The organelle is now centered at the world origin.
    // Remember that point in the model's local space for auto-rotate.
    isolatedPivotLocal.copy(
        plantCell.worldToLocal(new THREE.Vector3(0, 0, 0))
    );

    let cameraDistance = maxDimension * SEPARATE_CAMERA_DISTANCE;
    if (cameraDistance < 0.5) cameraDistance = 0.5;

    camera.position.set(0, 0, cameraDistance);
    camera.near = Math.max(maxDimension / 1000, 0.001);
    camera.far = Math.max(maxDimension * 100, 100);
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    
    controls.minDistance = maxDimension * 0.5;
    controls.maxDistance = maxDimension * 4.5;

    controls.update();
    requestRender();
}

// ======================================================
// WHOLE MODE: HIGHLIGHT SELECTED ORGANELLE (NO ZOOM)
// ======================================================
function highlightOrganelleWholeMode(organelleNames) {
    if (!plantCell) return;

    isolatedView = false;

    plantCell.position.copy(originalPlantPosition);
    plantCell.rotation.x = MODEL_ROTATION.x;
    plantCell.rotation.y = MODEL_ROTATION.y;
    plantCell.rotation.z = MODEL_ROTATION.z;
    plantCell.updateMatrixWorld(true);

    clearAllEffects();

    plantCell.traverse(child => {
        if (child.isMesh) {
            child.visible = true;
            if (meshBelongsToOrganelles(child, organelleNames)) {
                applyHighlight(child);
            }
        }
    });

    requestRender();
}

// ======================================================
// ORGANELLE NAVIGATION BUTTONS
// ======================================================
organelleButtons.forEach(button => {
    button.addEventListener("click", function () {
        const organelle = this.dataset.organelle;

        organelleButtons.forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");

        let targetOrganelles;
        
        // Special handling for mitochondria
        if (organelle === "mitochondria") {
            if (currentMode === "separate") {
                // Separate Mode: Only show the main "mitochondria" mesh
                targetOrganelles = ["mitochondria"];
            } else {
                // Whole Mode: Glow both mitochondria meshes
                targetOrganelles = ["mitochondria", "mitocon002"];
            }
        } 
        // Special handling for Endoplasmic Reticulum - NO ribosomes
        else if (organelle === "endoplasmicReticulum") {
            if (currentMode === "separate") {
                // Separate Mode: Keep ribosomes visible along with the ER
                targetOrganelles = ["ER", "ribosomesER"];
            } else {
                // Whole Mode: Only glow the ER membranes, leave ribosomes un-glowed
                targetOrganelles = ["ER", "ribosomesER"];
            }
        }
        else {
            // Normal handling for other organelles
            const mappedName = meshNameMap[organelle];
            targetOrganelles = Array.isArray(mappedName) ? mappedName : [mappedName || organelle];
        }

        if (currentMode === "separate") {
            showOnlyOrganelles(targetOrganelles);
        } else {
            highlightOrganelleWholeMode(targetOrganelles);
        }

        if (window.updateOrganelleInformation) {
            window.updateOrganelleInformation(organelle);
        }
    });
});

// ======================================================
// ANIMATION LOOP (Demand-based rendering)
// FIX: Instead of rendering every frame even when nothing
// moves, we only render when something has actually changed.
// requestRender() sets the flag; the loop checks it each
// tick. Auto-rotate and OrbitControls damping keep flagging
// frames for as long as they need to.
// ======================================================
let renderRequested = false;

function requestRender() {
    renderRequested = true;
}

function animate() {
    requestAnimationFrame(animate);

    // Auto-rotate keeps requesting renders on its own
    if (window.modelRotationState && window.modelRotationState.isAutoRotating()) {
        if (plantCell) {
            const rotationStep = window.modelRotationState.getSpeed();

            if (isolatedView) {
                // Separate mode: spin the organelle in place
                rotateAroundIsolatedPivot(rotationStep);
            } else {
                plantCell.rotation.y += rotationStep;
            }
        }
        requestRender();
    }

    // OrbitControls damping needs a few extra frames after
    // interaction — update() returns true while it's still settling
    if (controls.update()) {
        requestRender();
    }

    if (renderRequested) {
        renderRequested = false;
        renderer.render(scene, camera);
    }
}

// Flag a render on any user interaction with the controls
controls.addEventListener("change", requestRender);

animate();

// ======================================================
// RESIZE
// ======================================================

let resizeTimer = null;

function updateViewerSize() {

    const width = viewer.clientWidth;
    const height = viewer.clientHeight;

    if (width <= 0 || height <= 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
    requestRender();
}


// Detect viewer size changes
const resizeObserver = new ResizeObserver(() => {

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        updateViewerSize();
    }, 350);
});

resizeObserver.observe(viewer);


// Browser resize
window.addEventListener("resize", () => {
    updateViewerSize();
});