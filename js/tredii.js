import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

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

// ======================================================
// ZOOM BUTTONS
// ======================================================
const zoomInButton =
    document.getElementById("zoomIn");

const zoomOutButton =
    document.getElementById("zoomOut");

const resetViewButton =
    document.getElementById("resetView");

const organelleButtons =
    document.querySelectorAll(
        ".organelleButton"
    );

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

    animalCell.position.copy(
        originalAnimalPosition
    );

    animalCell.rotation.x =
        MODEL_ROTATION.x;

    animalCell.rotation.y =
        MODEL_ROTATION.y;

    animalCell.rotation.z =
        MODEL_ROTATION.z;

    animalCell.updateMatrixWorld(true);

    clearAllEffects();

    camera.position.set(
        0,
        0,
        originalMaxDimension * 2.2
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
const modeDropdownItems =
    document.querySelectorAll(
        ".dropdown-item[data-mode]"
    );

const modeButtonLabel =
    document.getElementById(
        "modeButtonLabel"
    );

modeDropdownItems.forEach(item => {

    item.addEventListener(
        "click",
        function(e) {

            e.preventDefault();

            const newMode =
                this.dataset.mode;

            modeDropdownItems.forEach(i => {
                i.classList.remove("active");
            });

            this.classList.add("active");

            if (modeButtonLabel) {

                modeButtonLabel.textContent =
                    `Mode: ${
                        newMode
                            .charAt(0)
                            .toUpperCase() +
                        newMode.slice(1)
                    }`;
            }

            if (newMode !== currentMode) {

                currentMode = newMode;

                resetView();
            }
        }
    );
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

    "./threeDyModels/ANIMALCELL.glb",

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

        originalAnimalPosition =
            animalCell.position.clone();

        animalCell.rotation.x =
            MODEL_ROTATION.x;

        animalCell.rotation.y =
            MODEL_ROTATION.y;

        animalCell.rotation.z =
            MODEL_ROTATION.z;

        animalCell.updateMatrixWorld(
            true
        );

        camera.position.set(
            0,
            0,
            maxDimension * 2.2
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

        // ==================================================
        // PREPARE MATERIALS
        // ==================================================
        animalCell.traverse(child => {

            if (!child.isMesh) return;

            console.log(
                "Animal Cell Object:",
                child.name
            );

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

        console.log(
            "Animal Cell Loaded"
        );

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
// SEPARATE MODE
// ======================================================
function showOnlyOrganelles(
    organelleNames,
    organelleKey
) {

    if (!animalCell) return;

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

    let cameraDistance =
        maxDimension * 2.6;

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
}

// ======================================================
// WHOLE MODE
// ======================================================
function highlightOrganelleWholeMode(
    organelleNames,
    organelleKey
) {

    if (!animalCell) return;

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
function animate() {

    requestAnimationFrame(
        animate
    );

    frameCounter++;

    checkPerformance();

    if (
        window.modelRotationState &&
        window.modelRotationState
            .isAutoRotating()
    ) {

        if (animalCell) {

            animalCell.rotation.y +=
                window.modelRotationState
                    .getSpeed();
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