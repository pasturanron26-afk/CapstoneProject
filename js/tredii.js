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
const zoomControls = document.getElementById("zoomControls");
const loadingProgress = document.getElementById("loadingProgress");

// ======================================================
// INITIAL LOADING STATE
// ======================================================
viewer.classList.add("loading");
if (zoomControls) {
    zoomControls.style.display = "none";
}

// ======================================================
// ANIMAL CELL
// ======================================================
let animalCell = null;
let originalAnimalPosition = new THREE.Vector3();
let originalMaxDimension = 1;

// ======================================================
// MODE STATE
// ======================================================
let currentMode = "separate"; // "separate" or "whole"

// ======================================================
// DESIRED MODEL ROTATION
// ======================================================
const MODEL_ROTATION = { x: 0.5, y: -1.0, z: 0.0 };

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
// RENDERER
// ======================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
controls.enablePan = true;     // Right-click drag to pan
controls.enableZoom = true;    // Mouse wheel to zoom

// ======================================================
// ZOOM BUTTONS
// ======================================================
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const resetViewButton = document.getElementById("resetView");
const organelleButtons = document.querySelectorAll(".organelleButton");

// ======================================================
// MESH NAME MAPPING
// ======================================================
const meshNameMap = {
    cellMem: "cellMem",
    cytoplasm: "cytoplasm",
    cytoskeleton: "cytoskeleton",
    centriole: "centriole",
    golgiApparatus: "golgiApparatus",
    lysosome: "lysosome",
    mitochondria: ["mitochondria", "mito002"], // Array in case of multiple meshes
    nucleus: "nucleus",
    Nucleolus: "Nucleolus",
    peroxisome: "peroxisome",
    ribosomes: "ribosomes",
    endoplasmicReticulum: ["roughER", "smoothER", "ribosomesER"],
    vacuole: "vacuole"
};

// ======================================================
// MATERIAL STATE MANAGEMENT (Highlight & Restore)
// ======================================================
function saveMaterialState(mesh) {
    if (!mesh.userData.originalMaterialState) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.userData.originalMaterialState = materials.map(mat => ({
            emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
            emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 0
        }));
    }
}

function applyHighlight(mesh) {
    saveMaterialState(mesh);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
        mat.emissive = new THREE.Color(0xEF4444); // Red glow
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
    if (!animalCell) return;
    animalCell.traverse(child => {
        if (child.isMesh) {
            child.visible = true;
            // FIX: Force emissive to black to remove any "baked-in" glows from the 3D model
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
    if (!animalCell) return;

    animalCell.position.copy(originalAnimalPosition);
    animalCell.rotation.x = MODEL_ROTATION.x;
    animalCell.rotation.y = MODEL_ROTATION.y;
    animalCell.rotation.z = MODEL_ROTATION.z;
    animalCell.updateMatrixWorld(true);

    clearAllEffects();

    camera.position.set(0, 0, originalMaxDimension * 2.2);
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
}

zoomInButton.addEventListener("click", function () {
    camera.position.multiplyScalar(0.8);
    controls.update();
});

zoomOutButton.addEventListener("click", function () {
    camera.position.multiplyScalar(1.25);
    controls.update();
});

resetViewButton.addEventListener("click", function () {
    resetView();
});

// ======================================================
// MODE SWITCHING
// ======================================================
const modeDropdownItems = document.querySelectorAll(".dropdown-item[data-mode]");
const modeButtonLabel = document.getElementById("modeButtonLabel");

modeDropdownItems.forEach(item => {
    item.addEventListener("click", function(e) {
        e.preventDefault();
        const newMode = this.dataset.mode;
        
        modeDropdownItems.forEach(i => i.classList.remove("active"));
        this.classList.add("active");
        modeButtonLabel.textContent = `Mode: ${newMode.charAt(0).toUpperCase() + newMode.slice(1)}`;

        if (newMode !== currentMode) {
            currentMode = newMode;
            resetView();
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
    "./threeDyModels/ANIMALCELLtry01.glb",
    function (gltf) {
        animalCell = gltf.scene;
        scene.add(animalCell);

        const box = new THREE.Box3().setFromObject(animalCell);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        originalMaxDimension = maxDimension;

        animalCell.position.sub(center);
        originalAnimalPosition = animalCell.position.clone();

        animalCell.rotation.x = MODEL_ROTATION.x;
        animalCell.rotation.y = MODEL_ROTATION.y;
        animalCell.rotation.z = MODEL_ROTATION.z;
        animalCell.updateMatrixWorld(true);

        camera.position.set(0, 0, maxDimension * 2.2);
        camera.near = maxDimension / 1000;
        camera.far = maxDimension * 100;
        camera.updateProjectionMatrix();

        controls.target.set(0, 0, 0);
        
        controls.minDistance = maxDimension * 0.5;
        controls.maxDistance = maxDimension * 4.5;

        controls.update();

        animalCell.traverse(child => {
            if (child.isMesh) {
                console.log("Animal Cell Object:", child.name);
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
        console.log("Animal Cell Loaded");

        document.querySelector(".parent").classList.add("loaded");
        viewer.classList.remove("loading");
        modelLoading.classList.add("hidden");

        if (zoomControls) {
            zoomControls.style.display = "flex";
        }

        if (infoLoading) infoLoading.style.display = "none";
        if (organelleInfo) organelleInfo.classList.add("loaded");
    },
    function (xhr) {
        if (xhr.total) {
            const percentage = (xhr.loaded / xhr.total) * 100;
            const formattedPercentage = percentage.toFixed(0);
            console.log("Loading:", formattedPercentage + "%");
            if (loadingPercentage) loadingPercentage.textContent = formattedPercentage + "%";
            if (loadingProgress) loadingProgress.style.width = formattedPercentage + "%";
        }
    },
    function (error) {
        console.error("Error loading Animal Cell:", error);
        if (modelLoading) {
            modelLoading.innerHTML = `
                <div class="loadingSpinner" style="animation-play-state: paused;"></div>
                <p>Failed to load Animal Cell.</p>
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
// ======================================================
function showOnlyOrganelles(organelleNames) {
    if (!animalCell) return;

    animalCell.position.copy(originalAnimalPosition);
    animalCell.rotation.x = MODEL_ROTATION.x;
    animalCell.rotation.y = MODEL_ROTATION.y;
    animalCell.rotation.z = MODEL_ROTATION.z;
    animalCell.updateMatrixWorld(true);

    clearAllEffects(); // Resets visibility and removes glows

    animalCell.traverse(child => {
        if (!child.isMesh) return;
        child.visible = meshBelongsToOrganelles(child, organelleNames);
    });

    animalCell.updateMatrixWorld(true);

    const selectedBox = new THREE.Box3();
    animalCell.traverse(child => {
        if (child.isMesh && child.visible) {
            selectedBox.expandByObject(child);
        }
    });

    if (selectedBox.isEmpty()) {
        console.warn("Selected organelle was not found:", organelleNames);
        return;
    }

    const selectedCenter = selectedBox.getCenter(new THREE.Vector3());
    animalCell.position.x -= selectedCenter.x;
    animalCell.position.y -= selectedCenter.y;
    animalCell.position.z -= selectedCenter.z;
    animalCell.updateMatrixWorld(true);

    const centeredBox = new THREE.Box3();
    animalCell.traverse(child => {
        if (child.isMesh && child.visible) {
            centeredBox.expandByObject(child);
        }
    });

    const selectedSize = centeredBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(selectedSize.x, selectedSize.y, selectedSize.z);

    let cameraDistance = maxDimension * 2.6;
    if (cameraDistance < 0.5) cameraDistance = 0.5;

    camera.position.set(0, 0, cameraDistance);
    camera.near = Math.max(maxDimension / 1000, 0.001);
    camera.far = Math.max(maxDimension * 100, 100);
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    
    controls.minDistance = maxDimension * 0.5;
    controls.maxDistance = maxDimension * 4.5;

    controls.update();
}

// ======================================================
// WHOLE MODE: HIGHLIGHT SELECTED ORGANELLE (NO ZOOM)
// ======================================================
function highlightOrganelleWholeMode(organelleNames) {
    if (!animalCell) return;

    animalCell.position.copy(originalAnimalPosition);
    animalCell.rotation.x = MODEL_ROTATION.x;
    animalCell.rotation.y = MODEL_ROTATION.y;
    animalCell.rotation.z = MODEL_ROTATION.z;
    animalCell.updateMatrixWorld(true);

    clearAllEffects();

    animalCell.traverse(child => {
        if (child.isMesh) {
            child.visible = true;
            if (meshBelongsToOrganelles(child, organelleNames)) {
                applyHighlight(child);
            }
        }
    });
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
                targetOrganelles = ["mitochondria", "mito002"];
            }
        } 
        // Special handling for Endoplasmic Reticulum
        else if (organelle === "endoplasmicReticulum") {
            if (currentMode === "separate") {
                // Separate Mode: Keep ribosomes visible along with the ER
                targetOrganelles = ["roughER", "smoothER", "ribosomesER"];
            } else {
                // Whole Mode: Only glow the ER membranes, leave ribosomes un-glowed
                targetOrganelles = ["roughER", "smoothER"];
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
// ANIMATION LOOP
// ======================================================
function animate() {
    requestAnimationFrame(animate);
    
    // Auto-rotate if rotation is enabled
    if (window.modelRotationState && window.modelRotationState.isAutoRotating()) {
        if (animalCell) {
            animalCell.rotation.y += window.modelRotationState.getSpeed();
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}
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