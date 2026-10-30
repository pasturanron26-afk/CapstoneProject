import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ======================================================
// VIEWER
// ======================================================
const viewer = document.getElementById("animalViewer");

// ======================================================
// MOBILE  PERFORMANCE SETTINGS
// ======================================================
const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const BASE_PIXEL_RATIO = isMobile
    ? Math.min(window.devicePixelRatio || 1, 2)
    : Math.min(window.devicePixelRatio || 1, 2);

let currentPixelRatio = BASE_PIXEL_RATIO;

// ======================================================
// MODEL FILE
// Phones load the lighter model, desktop loads the original.
// (File names must match exactly, including capital letters.)
// ======================================================
const MODEL_PATH = isMobile
    ? "./threeDyModels/ANIMALCELLmobile.glb"
    : "./threeDyModels/ANIMALCELL.glb";

// ======================================================
// CAMERA DISTANCE  (EDIT THESE TO ZOOM IN / OUT)
// Bigger number = zoomed out (model looks smaller)
// Smaller number = zoomed in (model looks bigger)
// ======================================================
const WHOLE_CAMERA_DISTANCE = isMobile ? 1.3 : 2.2;   // whole cell / reset view
const DEFAULT_SEPARATE_ZOOM = isMobile ? 1.7 : 2.6;   // one organelle alone

// ======================================================
// MOBILE GLASS (cytoplasm)
// On phones the "glass" (transmission) material is replaced
// by plain transparency, which is much cheaper to draw.
// 0 = invisible, 1 = solid. Try 0.15 to 0.4
// ======================================================
const GLASS_OPACITY = 0.25;

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
// ANIMAL CELL
// ======================================================
let animalCell = null;
let originalAnimalPosition = new THREE.Vector3();
let originalMaxDimension = 1;

function centerAnimalCell() {
    if (!animalCell) return;

    animalCell.updateMatrixWorld(true);

    const center =
        new THREE.Box3()
            .setFromObject(animalCell)
            .getCenter(new THREE.Vector3());

    animalCell.position.sub(center);
    animalCell.updateMatrixWorld(true);
}

// ======================================================
// MODE STATE
// ======================================================
let currentMode = "separate";

// ======================================================
// DESIRED MODEL ROTATION
// ======================================================
const MODEL_ROTATION = {
    x: 0.5,
    y: -1.0,
    z: 0.0
};

// ======================================================
// MODEL SCREEN POSITION OFFSET  (EDIT THIS TO MOVE THE MODEL)
// Range: -1 to 1  (0.2 = 10% of the canvas width/height)
// x: positive = right, negative = left
// y: positive = up,    negative = down
// ======================================================
const MODEL_SCREEN_OFFSET = isMobile
    ? { x: 0.1, y: 0 }      // mobile
    : { x: 0.2, y: 0 };     // desktop

// ======================================================
// SEPARATE MODE POSITION OFFSET  (EDIT THIS TO MOVE THE ORGANELLE)
// Used when a single organelle is shown alone.
// x: positive = right, negative = left
// y: positive = up,    negative = down
// ======================================================
const SEPARATE_SCREEN_OFFSET = isMobile
    ? { x: 0, y: 0 }      // mobile
    : { x: 0, y: 0 };     // desktop

// ======================================================
// PER-ORGANELLE POSITION OVERRIDES (separate mode)
// Any organelle listed here uses its own offset instead of
// SEPARATE_SCREEN_OFFSET. Organelles not listed use the default.
// Keys are the data-organelle names of your buttons.
// Uncomment a line and change the numbers.
// ======================================================
const ORGANELLE_SEPARATE_OFFSETS = {
    // nucleus:              { x: 0.1,  y: 0 },
    // mitochondria:         { x: 0,    y: -0.1 },
    // golgiApparatus:       { x: -0.1, y: 0 },
    endoplasmicReticulum: { x: 0.1,    y: 0.1 },
    cellMem: { x: 0.2, y: 0 },
};

// ======================================================
// PER-ORGANELLE ZOOM (separate mode)
// Smaller number = zoomed in closer, bigger = zoomed out.
// Organelles not listed use the default (2.6).
// Don't go below 0.5 (the minimum camera distance).
// ======================================================
const ORGANELLE_SEPARATE_ZOOM = isMobile
    ? {
        cellMem: 1.3,   // cell membrane (mobile)
    }
    : {
        cellMem: 2.0,   // cell membrane (desktop)
    };

function getSeparateOffsetFor(organelleKey) {
    return ORGANELLE_SEPARATE_OFFSETS[organelleKey] || SEPARATE_SCREEN_OFFSET;
}

// true while a single organelle is shown alone (separate mode).
let isolatedView = false;

// which organelle is currently shown alone
let currentOrganelleKey = null;

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
    if (!animalCell) return;

    animalCell.updateMatrixWorld(true);
    _pivotBefore.copy(isolatedPivotLocal);
    animalCell.localToWorld(_pivotBefore);

    animalCell.rotation.y += step;

    animalCell.updateMatrixWorld(true);
    _pivotAfter.copy(isolatedPivotLocal);
    animalCell.localToWorld(_pivotAfter);

    // Move the model back so the pivot point stays exactly where it was
    animalCell.position.add(_pivotBefore.sub(_pivotAfter));
    animalCell.updateMatrixWorld(true);
}

// ======================================================
// PER-ORGANELLE ROTATION OVERRIDES
// ======================================================
const ORGANELLE_ROTATION_OVERRIDES = {
    // centriole: { x: 0.5, y: -1.0, z: 0.0 },
    // golgiApparatus: { x: 0.5, y: -1.0, z: 0.0 },
};

function getRotationFor(organelleKey) {
    return ORGANELLE_ROTATION_OVERRIDES[organelleKey] || MODEL_ROTATION;
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
// RENDERER
// MOBILE OPTIMIZATION
// ======================================================
const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    powerPreference: "high-performance",
    alpha: false,
    stencil: false,
    depth: true
});

renderer.setPixelRatio(currentPixelRatio);

renderer.setSize(
    viewer.clientWidth,
    viewer.clientHeight,
    false
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

// ACES is slightly more expensive.
// Keep it on desktop, disable it on mobile.
if (!isMobile) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
} else {
    renderer.toneMapping = THREE.NoToneMapping;
}

viewer.appendChild(renderer.domElement);

// ======================================================
// DYNAMIC RESOLUTION SCALING
// While the finger is actively dragging we drop to DPR 1.0
// so the GPU pushes fewer pixels and interaction stays smooth.
// The moment the finger lifts we restore the base DPR (1.5)
// and render one final crisp frame. This is the same trick
// used by game engines — low res while moving, sharp at rest.
// ======================================================
let dprRestoreTimer = null;

function onTouchStart() {
    clearTimeout(dprRestoreTimer);
    if (renderer.getPixelRatio() !== 1.0) {
        renderer.setPixelRatio(1.0);
        currentPixelRatio = 1.0;
    }
}

function onTouchEnd() {
    clearTimeout(dprRestoreTimer);
    dprRestoreTimer = setTimeout(() => {
        renderer.setPixelRatio(BASE_PIXEL_RATIO);
        currentPixelRatio = BASE_PIXEL_RATIO;
    }, 150);
}

if (isMobile) {
    renderer.domElement.addEventListener("touchstart",  onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove",   onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchend",    onTouchEnd,   { passive: true });
    renderer.domElement.addEventListener("touchcancel", onTouchEnd,   { passive: true });
}

// ======================================================
// LIGHTING
// ======================================================
const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1.5
);

scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    3
);

directionalLight.position.set(
    5,
    10,
    7
);

scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(
    0xffffff,
    1
);

fillLight.position.set(
    -5,
    3,
    5
);

scene.add(fillLight);

// ======================================================
// CONTROLS
// ======================================================
const controls = new OrbitControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;

controls.dampingFactor = isMobile
    ? 0.06
    : 0.08;

controls.rotateSpeed = isMobile
    ? 0.45
    : 0.6;

controls.panSpeed = isMobile
    ? 0.6
    : 0.8;

controls.zoomSpeed = isMobile
    ? 2.0
    : 3.0;

controls.enableRotate = true;
controls.enablePan = true;
controls.enableZoom = true;

// ======================================================
// SNAP CONTROLS UPDATE
// ======================================================
function snapControlsUpdate() {

    const wasDamping =
        controls.enableDamping;

    controls.enableDamping = false;

    controls.update();

    controls.enableDamping =
        wasDamping;
}

function centerModelInCanvas() {
    if (!animalCell || viewer.clientWidth <= 0 || viewer.clientHeight <= 0) {
        return;
    }

    animalCell.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const bounds = new THREE.Box3();
    animalCell.traverse(child => {
        if (child.isMesh && child.visible) {
            bounds.expandByObject(child);
        }
    });

    if (bounds.isEmpty()) return;

    const projectedBounds = new THREE.Box3();

    for (let corner = 0; corner < 8; corner++) {
        projectedBounds.expandByPoint(
            new THREE.Vector3(
                corner & 1 ? bounds.max.x : bounds.min.x,
                corner & 2 ? bounds.max.y : bounds.min.y,
                corner & 4 ? bounds.max.z : bounds.min.z
            ).project(camera)
        );
    }

    const projectedCenter =
        projectedBounds.getCenter(new THREE.Vector3());

    // Apply the screen position offset (see MODEL_SCREEN_OFFSET)
    const activeOffset = isolatedView
        ? getSeparateOffsetFor(currentOrganelleKey)
        : MODEL_SCREEN_OFFSET;

    projectedCenter.x -= activeOffset.x;
    projectedCenter.y -= activeOffset.y;

    const worldCenter =
        bounds.getCenter(new THREE.Vector3());
    const viewDirection =
        camera.getWorldDirection(new THREE.Vector3());
    const depth =
        Math.max(
            viewDirection.dot(worldCenter.sub(camera.position)),
            camera.near
        );
    const verticalHalfExtent =
        depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const horizontalHalfExtent =
        verticalHalfExtent * camera.aspect;
    const cameraRight =
        new THREE.Vector3()
            .setFromMatrixColumn(camera.matrixWorld, 0)
            .normalize();
    const cameraUp =
        new THREE.Vector3()
            .setFromMatrixColumn(camera.matrixWorld, 1)
            .normalize();
    const offset =
        new THREE.Vector3()
            .addScaledVector(
                cameraRight,
                projectedCenter.x * horizontalHalfExtent
            )
            .addScaledVector(
                cameraUp,
                projectedCenter.y * verticalHalfExtent
            );

    camera.position.add(offset);
    controls.target.add(offset);
    snapControlsUpdate();
}

// ======================================================
// ZOOM BUTTONS
// ======================================================
const zoomInButton =
    document.getElementById("zoomIn");

const zoomOutButton =
    document.getElementById("zoomOut");

const resetViewButton =
    document.getElementById("resetView");

const panButton =
    document.getElementById("panModel");

const organelleButtons =
    document.querySelectorAll(
        ".organelleButton"
    );

if (panButton) {
    panButton.addEventListener("click", function () {
        const isPanMode = this.getAttribute("aria-pressed") !== "true";
        this.setAttribute("aria-pressed", String(isPanMode));
        this.classList.toggle("active", isPanMode);
        controls.mouseButtons.LEFT = isPanMode
            ? THREE.MOUSE.PAN
            : THREE.MOUSE.ROTATE;
        controls.touches.ONE = isPanMode
            ? THREE.TOUCH.PAN
            : THREE.TOUCH.ROTATE;
    });
}

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

    mitochondria: [
        "mitochondria",
        "mito002"
    ],

    nucleus: "nucleus",

    Nucleolus: "Nucleolus",

    peroxisome: "peroxisome",

    ribosomes: "ribosomes",

    endoplasmicReticulum: "ER",

    vacuole: "vacuole"
};

// ======================================================
// MATERIAL STATE
// ======================================================
function saveMaterialState(mesh) {

    if (!mesh.userData.originalMaterialState) {

        const materials =
            Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];

        mesh.userData.originalMaterialState =
            materials.map(mat => ({

                emissive:
                    mat.emissive
                        ? mat.emissive.clone()
                        : new THREE.Color(0x000000),

                emissiveIntensity:
                    mat.emissiveIntensity !== undefined
                        ? mat.emissiveIntensity
                        : 0
            }));
    }
}

// ======================================================
// HIGHLIGHT
// ======================================================
function applyHighlight(mesh) {

    saveMaterialState(mesh);

    const materials =
        Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

    materials.forEach(mat => {

        if (mat.emissive) {

            mat.emissive.set(
                0xEF4444
            );

            mat.emissiveIntensity =
                isMobile
                    ? 1.2
                    : 1.8;
        }
    });
}

// ======================================================
// RESTORE MATERIAL
// ======================================================
function restoreMaterial(mesh) {

    if (!mesh.userData.originalMaterialState) {
        return;
    }

    const materials =
        Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

    materials.forEach((mat, i) => {

        const state =
            mesh.userData.originalMaterialState[i];

        if (!state) return;

        if (mat.emissive) {
            mat.emissive.copy(
                state.emissive
            );
        }

        if (
            mat.emissiveIntensity !==
            undefined
        ) {

            mat.emissiveIntensity =
                state.emissiveIntensity;
        }
    });

    delete mesh.userData.originalMaterialState;
}

// ======================================================
// CLEAR EFFECTS
// ======================================================
function clearAllEffects() {

    if (!animalCell) return;

    animalCell.traverse(child => {

        if (!child.isMesh) return;

        child.visible = true;

        const materials =
            Array.isArray(child.material)
                ? child.material
                : [child.material];

        materials.forEach(mat => {

            if (mat.emissive) {

                mat.emissive.setHex(
                    0x000000
                );

                mat.emissiveIntensity = 0;
            }
        });
    });
}

// ======================================================
// RESET VIEW
// ======================================================
function resetView() {

    if (!animalCell) return;

    isolatedView = false;

    animalCell.position.copy(
        originalAnimalPosition
    );

    animalCell.rotation.x =
        MODEL_ROTATION.x;

    animalCell.rotation.y =
        MODEL_ROTATION.y;

    animalCell.rotation.z =
        MODEL_ROTATION.z;

    centerAnimalCell();
    animalCell.updateMatrixWorld(true);

    clearAllEffects();

    camera.position.set(
        0,
        0,
        originalMaxDimension * WHOLE_CAMERA_DISTANCE
    );

    controls.target.set(
        0,
        0,
        0
    );

    controls.minDistance =
        originalMaxDimension * 0.5;

    controls.maxDistance =
        originalMaxDimension * 4.5;

    snapControlsUpdate();
    centerModelInCanvas();

    organelleButtons.forEach(button => {
        button.classList.remove("active");
    });

    if (
        window.resetOrganelleInformation
    ) {

        window.resetOrganelleInformation();
    }
}

// ======================================================
// ZOOM BUTTONS
// ======================================================
if (zoomInButton) {

    zoomInButton.addEventListener(
        "click",
        function () {

            camera.position.multiplyScalar(
                0.8
            );

            controls.update();
        }
    );
}

if (zoomOutButton) {

    zoomOutButton.addEventListener(
        "click",
        function () {

            camera.position.multiplyScalar(
                1.25
            );

            controls.update();
        }
    );
}

if (resetViewButton) {

    resetViewButton.addEventListener(
        "click",
        function () {

            resetView();
        }
    );
}

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

const dracoLoader =
    new DRACOLoader();

dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
);

loader.setDRACOLoader(
    dracoLoader
);

loader.load(

    MODEL_PATH,

    function(gltf) {

        animalCell = gltf.scene;

        scene.add(animalCell);

        const box =
            new THREE.Box3()
                .setFromObject(animalCell);

        const center =
            box.getCenter(
                new THREE.Vector3()
            );

        const size =
            box.getSize(
                new THREE.Vector3()
            );

        const maxDimension =
            Math.max(
                size.x,
                size.y,
                size.z
            );

        originalMaxDimension =
            maxDimension;

        animalCell.position.sub(
            center
        );

        animalCell.rotation.x =
            MODEL_ROTATION.x;

        animalCell.rotation.y =
            MODEL_ROTATION.y;

        animalCell.rotation.z =
            MODEL_ROTATION.z;

        centerAnimalCell();
        originalAnimalPosition =
            animalCell.position.clone();

        animalCell.updateMatrixWorld(
            true
        );

        camera.position.set(
            0,
            0,
            maxDimension * WHOLE_CAMERA_DISTANCE
        );

        camera.near =
            maxDimension / 1000;

        camera.far =
            maxDimension * 100;

        camera.updateProjectionMatrix();

        controls.target.set(
            0,
            0,
            0
        );

        controls.minDistance =
            maxDimension * 0.5;

        controls.maxDistance =
            maxDimension * 4.5;

        controls.update();
        centerModelInCanvas();

        // ==================================================
        // PREPARE MATERIALS
        // ==================================================
        animalCell.traverse(child => {

            if (!child.isMesh) return;

            child.frustumCulled = true;

            const materials =
                Array.isArray(child.material)
                    ? child.material
                    : [child.material];

            materials.forEach(mat => {

                if (mat.emissive) {

                    mat.emissive.setHex(
                        0x000000
                    );

                    mat.emissiveIntensity =
                        0;
                }
            });
        });

        // ==================================================
        // MERGE MANY SMALL MESHES (fewer draw calls)
        // ==================================================
        ["ribosomes", "ribosomesER", "cytoskeleton"].forEach(mergeGroupMeshes);

        // ==================================================
        // MOBILE ONLY: replace expensive "glass" (transmission)
        // with plain transparency
        // ==================================================
        if (isMobile) {
            animalCell.traverse(child => {
                if (!child.isMesh) return;

                const mats = Array.isArray(child.material)
                    ? child.material
                    : [child.material];

                mats.forEach(m => {
                    if (m.transmission > 0) {
                        m.transmission = 0;
                        m.transparent = true;
                        m.opacity = GLASS_OPACITY;
                        m.depthWrite = false;
                        m.needsUpdate = true;
                    }
                });
            });
        }

        console.log(
            "Animal Cell Loaded"
        );

        if (loadingPercentage) {
            loadingPercentage.textContent = "100%";
        }
        if (loadingProgress) {
            loadingProgress.style.width = "100%";
        }

        window.setTimeout(() => {
            document
                .querySelector(".parent")
                ?.classList.add("loaded");

            viewer.classList.remove(
                "loading"
            );

            modelLoading?.classList.add(
                "hidden"
            );

            if (zoomControls) {
                zoomControls.style.display =
                    "flex";
            }

            if (infoLoading) {
                infoLoading.style.display =
                    "none";
            }

            if (organelleInfo) {
                organelleInfo.classList.add(
                    "loaded"
                );
            }
        }, 180);
    },

    function(xhr) {

        let percentage = 0;

        if (
            xhr.total &&
            xhr.total > 0
        ) {

            percentage =
                (xhr.loaded / xhr.total) *
                100;

        } else if (xhr.loaded > 0) {

            const estimatedTotal =
                35 * 1024 * 1024;

            percentage =
                Math.min(
                    (xhr.loaded /
                        estimatedTotal) *
                        100,
                    90
                );
        }

        const formattedPercentage =
            percentage.toFixed(0);

        console.log(
            "Loading:",
            formattedPercentage + "%"
        );

        if (loadingPercentage) {

            loadingPercentage.textContent =
                formattedPercentage + "%";
        }

        if (loadingProgress) {

            loadingProgress.style.width =
                formattedPercentage + "%";
        }
    },

    function(error) {

        console.error(
            "Error loading Animal Cell:",
            error
        );

        if (modelLoading) {

            modelLoading.innerHTML = `
                <div class="loadingSpinner"
                     style="animation-play-state: paused;">
                </div>

                <p>Failed to load Animal Cell.</p>

                <span>
                    Please refresh the page.
                </span>
            `;
        }

        if (infoLoading) {

            infoLoading.innerHTML =
                `<p>Unable to load information.</p>`;
        }
    }
);

// ======================================================
// CHECK MESH OWNERSHIP
// ======================================================
function meshBelongsToOrganelles(
    mesh,
    organelleNames
) {

    let currentObject = mesh;

    while (currentObject) {

        if (
            organelleNames.includes(
                currentObject.name
            )
        ) {

            return true;
        }

        currentObject =
            currentObject.parent;
    }

    return false;
}

// ======================================================
// MERGE MANY SMALL MESHES INTO FEW (fewer draw calls)
// ======================================================
function mergeGroupMeshes(groupName) {
    if (!animalCell) return;

    animalCell.updateMatrixWorld(true);
    const rootInverse = animalCell.matrixWorld.clone().invert();

    // Collect the group's meshes, bucketed by material
    const buckets = new Map();
    animalCell.traverse(child => {
        if (!child.isMesh || Array.isArray(child.material)) return;
        if (!meshBelongsToOrganelles(child, [groupName])) return;

        if (!buckets.has(child.material)) buckets.set(child.material, []);
        buckets.get(child.material).push(child);
    });

    buckets.forEach((meshes, material) => {
        if (meshes.length < 2) return;

        const geometries = meshes.map(m => {
            const g = m.geometry.clone();
            g.applyMatrix4(rootInverse.clone().multiply(m.matrixWorld));
            return g;
        });

        const merged = mergeGeometries(geometries, false);
        geometries.forEach(g => g.dispose());

        if (!merged) {
            console.warn("Could not merge group:", groupName);
            return;
        }

        const mergedMesh = new THREE.Mesh(merged, material);
        mergedMesh.name = groupName;
        animalCell.add(mergedMesh);

        meshes.forEach(m => m.parent && m.parent.remove(m));
    });
}

// ======================================================
// SEPARATE MODE
// ======================================================
function showOnlyOrganelles(
    organelleNames,
    organelleKey
) {

    if (!animalCell) return;

    isolatedView = true;
    currentOrganelleKey = organelleKey;

    const rotation =
        getRotationFor(
            organelleKey
        );

    animalCell.position.copy(
        originalAnimalPosition
    );

    animalCell.rotation.x =
        rotation.x;

    animalCell.rotation.y =
        rotation.y;

    animalCell.rotation.z =
        rotation.z;

    animalCell.updateMatrixWorld(
        true
    );

    clearAllEffects();

    animalCell.traverse(child => {

        if (!child.isMesh) return;

        child.visible =
            meshBelongsToOrganelles(
                child,
                organelleNames
            );
    });

    animalCell.updateMatrixWorld(
        true
    );

    const selectedBox =
        new THREE.Box3();

    animalCell.traverse(child => {

        if (
            child.isMesh &&
            child.visible
        ) {

            selectedBox.expandByObject(
                child
            );
        }
    });

    if (selectedBox.isEmpty()) {

        console.warn(
            "Selected organelle was not found:",
            organelleNames
        );

        return;
    }

    const selectedCenter =
        selectedBox.getCenter(
            new THREE.Vector3()
        );

    animalCell.position.x -=
        selectedCenter.x;

    animalCell.position.y -=
        selectedCenter.y;

    animalCell.position.z -=
        selectedCenter.z;

    animalCell.updateMatrixWorld(
        true
    );

    const centeredBox =
        new THREE.Box3();

    animalCell.traverse(child => {

        if (
            child.isMesh &&
            child.visible
        ) {

            centeredBox.expandByObject(
                child
            );
        }
    });

    const selectedSize =
        centeredBox.getSize(
            new THREE.Vector3()
        );

    const maxDimension =
        Math.max(
            selectedSize.x,
            selectedSize.y,
            selectedSize.z
        );

    // The organelle is now centered at the world origin.
    // Remember that point in the model's local space for auto-rotate.
    animalCell.updateMatrixWorld(true);
    isolatedPivotLocal.copy(
        animalCell.worldToLocal(new THREE.Vector3(0, 0, 0))
    );

    let cameraDistance =
        maxDimension * (ORGANELLE_SEPARATE_ZOOM[organelleKey] || DEFAULT_SEPARATE_ZOOM);

    if (cameraDistance < 0.5) {
        cameraDistance = 0.5;
    }

    camera.position.set(
        0,
        0,
        cameraDistance
    );

    camera.near =
        Math.max(
            maxDimension / 1000,
            0.001
        );

    camera.far =
        Math.max(
            maxDimension * 100,
            100
        );

    camera.updateProjectionMatrix();

    controls.target.set(
        0,
        0,
        0
    );

    controls.minDistance =
        maxDimension * 0.5;

    controls.maxDistance =
        maxDimension * 4.5;

    snapControlsUpdate();
    centerModelInCanvas();
}

// ======================================================
// WHOLE MODE
// ======================================================
function highlightOrganelleWholeMode(
    organelleNames,
    organelleKey
) {

    if (!animalCell) return;

    isolatedView = false;

    clearAllEffects();

    animalCell.traverse(child => {

        if (!child.isMesh) return;

        child.visible = true;

        if (
            meshBelongsToOrganelles(
                child,
                organelleNames
            )
        ) {

            applyHighlight(child);
        }
    });
}

// ======================================================
// ORGANELLE NAVIGATION
// ======================================================
organelleButtons.forEach(button => {

    button.addEventListener(
        "click",
        function() {

            const organelle =
                this.dataset.organelle;

            organelleButtons.forEach(btn => {
                btn.classList.remove(
                    "active"
                );
            });

            this.classList.add(
                "active"
            );

            let targetOrganelles;

            if (
                organelle ===
                "mitochondria"
            ) {

                if (
                    currentMode ===
                    "separate"
                ) {

                    targetOrganelles = [
                        "mitochondria"
                    ];

                } else {

                    targetOrganelles = [
                        "mitochondria",
                        "mito002"
                    ];
                }

            } else if (
                organelle ===
                "endoplasmicReticulum"
            ) {

                targetOrganelles = [
                    "ER",
                    "ribosomesER"
                ];

            } else {

                const mappedName =
                    meshNameMap[
                        organelle
                    ];

                targetOrganelles =
                    Array.isArray(
                        mappedName
                    )
                        ? mappedName
                        : [
                            mappedName ||
                            organelle
                        ];
            }

            if (
                currentMode ===
                "separate"
            ) {

                showOnlyOrganelles(
                    targetOrganelles,
                    organelle
                );

            } else {

                highlightOrganelleWholeMode(
                    targetOrganelles,
                    organelle
                );
            }

            if (
                window.updateOrganelleInformation
            ) {

                window.updateOrganelleInformation(
                    organelle
                );
            }
        }
    );
});

// ======================================================
// ADAPTIVE MOBILE QUALITY
// Watches live FPS and nudges DPR up/down within the
// safe range (1.0 – 1.5) so the model stays as sharp
// as the device can handle without dropping frames.
// Only active on mobile and only when NOT dragging
// (drag already uses fixed DPR 1.0 via touch events).
// ======================================================
let frameCounter = 0;
let lastPerformanceCheck = performance.now();

function checkPerformance() {

    if (!isMobile) return;

    const now = performance.now();
    const elapsed = now - lastPerformanceCheck;

    if (elapsed < 2000) return;

    const fps = (frameCounter * 1000) / elapsed;
    frameCounter = 0;
    lastPerformanceCheck = now;

    // Don't adjust while the finger is down — touch events
    // already handle DPR during drag.
    if (renderer.getPixelRatio() === 1.0) return;

    let newPixelRatio = currentPixelRatio;

    if (fps < 28) {
        // Struggling — step down but never below 1.0
        newPixelRatio = Math.max(1.0, currentPixelRatio - 0.25);
    } else if (fps > 50 && currentPixelRatio < BASE_PIXEL_RATIO) {
        // Comfortable — step back up toward base
        newPixelRatio = Math.min(BASE_PIXEL_RATIO, currentPixelRatio + 0.25);
    }

    if (newPixelRatio !== currentPixelRatio) {
        currentPixelRatio = newPixelRatio;
        renderer.setPixelRatio(currentPixelRatio);
        renderer.setSize(viewer.clientWidth, viewer.clientHeight, false);
        console.log("Mobile quality adjusted:", currentPixelRatio, "FPS:", fps.toFixed(1));
    }
}

// ======================================================
// ANIMATION LOOP
// ======================================================
let previousAnimationTime = 0;

function animate() {

    requestAnimationFrame(
        animate
    );

    const now = performance.now();
    const frameScale = previousAnimationTime === 0
        ? 0
        : Math.min((now - previousAnimationTime) / (1000 / 60), 2);
    previousAnimationTime = now;

    frameCounter++;

    checkPerformance();

    if (
        window.modelRotationState &&
        window.modelRotationState
            .isAutoRotating()
    ) {

        if (animalCell) {

            const rotationStep =
                window.modelRotationState
                    .getSpeed() * frameScale;

            if (isolatedView) {
                // Separate mode: spin the organelle in place
                rotateAroundIsolatedPivot(rotationStep);
            } else {
                animalCell.rotation.y += rotationStep;
            }
        }
    }

    controls.update();

    renderer.render(
        scene,
        camera
    );
}

animate();

// ======================================================
// RESIZE
// ======================================================
let resizeTimer = null;

function updateViewerSize() {

    const width =
        viewer.clientWidth;

    const height =
        viewer.clientHeight;

    if (
        width <= 0 ||
        height <= 0
    ) {

        return;
    }

    camera.aspect =
        width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(
        width,
        height,
        false
    );

    centerModelInCanvas();
}

if (typeof ResizeObserver !== "undefined") {

    const resizeObserver =
        new ResizeObserver(() => {

            clearTimeout(
                resizeTimer
            );

            resizeTimer =
                setTimeout(() => {

                    updateViewerSize();

                }, 250);
        });

    resizeObserver.observe(
        viewer
    );
}

window.addEventListener(
    "resize",
    updateViewerSize
);