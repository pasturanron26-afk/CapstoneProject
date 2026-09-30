// ======================================================
// VIEWER CHROME — non-3D UI polish for AnimalCell.html / PlantCell.html
//
// Load AFTER organelleInfo.js and tredii.js:
//   <script type="module" src="js/viewerChrome.js"></script>
//
// What it does (all without touching the 3D code):
//  1. Groups the organelle buttons by category and colour-codes them
//  2. Keeps aria-pressed in sync with the .active class
//  3. Adds a one-line summary + category chip to the info panel
//  4. Adds a floating "selected" caption on the stage
//  5. Shows a first-visit "how to move the model" hint
// ======================================================

import { META, CATEGORIES, CATEGORY_ORDER, catOf, summaryOf, labelOfCat } from "./organelleMeta.js";

const parent   = document.querySelector(".parent");
const stage    = document.querySelector(".div1");
const list     = document.querySelector(".organelleList");
const buttons  = [...document.querySelectorAll(".organelleButton")];
const infoRow  = document.querySelector(".infoTitleRow");
const infoBody = document.getElementById("infoDefinition");

// ------------------------------------------------------
// helper: run once the GLB has finished loading
// (tredii.js adds .loaded to .parent at that moment)
// ------------------------------------------------------
export function whenModelLoaded(cb) {
    if (!parent) return;
    if (parent.classList.contains("loaded")) { cb(); return; }
    const mo = new MutationObserver(() => {
        if (parent.classList.contains("loaded")) { mo.disconnect(); cb(); }
    });
    mo.observe(parent, { attributes: true, attributeFilter: ["class"] });
}

// ------------------------------------------------------
// 1. GROUP + COLOUR-CODE THE RAIL
// Buttons are MOVED, not cloned, so the click handlers that
// tredii.js already attached keep working.
// ------------------------------------------------------
function groupRail() {
    if (!list || !buttons.length) return;

    const buckets = new Map(CATEGORY_ORDER.map(c => [c, []]));
    const other = [];
    buttons.forEach(btn => {
        const cat = catOf(btn.dataset.organelle);
        if (cat) { btn.dataset.cat = cat; buckets.get(cat).push(btn); }
        else other.push(btn);
        btn.setAttribute("aria-pressed", "false");
    });

    list.textContent = "";
    let n = 0;
    const addGroup = (title, items) => {
        if (!items.length) return;
        const id = `railGroup${n++}`;
        const group = document.createElement("div");
        group.className = "railGroup";
        group.setAttribute("role", "group");
        group.setAttribute("aria-labelledby", id);
        const h = document.createElement("h4");
        h.id = id;
        h.className = "railGroupTitle";
        h.textContent = title;
        group.append(h, ...items);
        list.append(group);
    };
    CATEGORY_ORDER.forEach(c => addGroup(CATEGORIES[c].label, buckets.get(c)));
    addGroup("Other", other);
}

// ------------------------------------------------------
// 2. aria-pressed follows .active
// ------------------------------------------------------
// Phone layout: the chip row scrolls sideways, so bring the selected chip to the middle
function centerActiveChip() {
    if (!list || list.scrollWidth <= list.clientWidth + 1) return;   // desktop rail is vertical
    const active = buttons.find(b => b.classList.contains("active"));
    if (!active) return;
    const a = active.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    list.scrollBy({ left: a.left - l.left - (l.width - a.width) / 2, behavior: "smooth" });
}

function syncPressed() {
    const sync = () => {
        buttons.forEach(b =>
            b.setAttribute("aria-pressed", String(b.classList.contains("active"))));
        centerActiveChip();
    };
    const mo = new MutationObserver(sync);
    buttons.forEach(b => mo.observe(b, { attributes: true, attributeFilter: ["class"] }));
}

// ------------------------------------------------------
// 3. INFO PANEL: category chip + one-line summary
// ------------------------------------------------------
function clearPanelExtras() {
    document.querySelectorAll(".infoMeta, .infoLead").forEach(el => el.remove());
}

function decoratePanel(key) {
    clearPanelExtras();
    const cat = catOf(key);
    if (!cat || !infoRow || !infoBody) return;

    const chips = document.createElement("div");
    chips.className = "infoMeta";
    chips.innerHTML = `<span class="catChip" data-cat="${cat}">${labelOfCat(cat)}</span>`;
    infoRow.after(chips);

    const lead = document.createElement("p");
    lead.className = "infoLead";
    lead.textContent = summaryOf(key);
    infoBody.before(lead);
}

// ------------------------------------------------------
// 4. STAGE CAPTION (floating "you are looking at…" card)
// ------------------------------------------------------
let caption = null;
function buildCaption() {
    if (!stage) return;
    caption = document.createElement("div");
    caption.className = "stageCaption";
    caption.setAttribute("role", "status");     // announced by screen readers
    caption.hidden = true;
    caption.innerHTML = `
        <span class="stageCaptionText">
            <strong class="stageCaptionName"></strong>
            <span class="stageCaptionCat"></span>
        </span>
        <button type="button" class="stageCaptionClose" aria-label="Back to the whole cell">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>`;
    stage.append(caption);
    caption.querySelector(".stageCaptionClose")
        .addEventListener("click", () => document.getElementById("resetView")?.click());
}

function showCaption(key) {
    if (!caption) return;
    const btn = buttons.find(b => b.dataset.organelle === key);
    const cat = catOf(key);
    caption.dataset.cat = cat ?? "";
    caption.querySelector(".stageCaptionName").textContent = btn ? btn.textContent.trim() : key;
    caption.querySelector(".stageCaptionCat").textContent  = cat ? labelOfCat(cat) : "";
    caption.hidden = false;
}
function hideCaption() { if (caption) caption.hidden = true; }

// ------------------------------------------------------
// 5. FIRST-VISIT HINT
// ------------------------------------------------------
function showHint() {
    if (!stage) return;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const hint = document.createElement("div");
    hint.className = "viewerHint";
    hint.setAttribute("aria-hidden", "true");     // the organelle list is the accessible route
    hint.textContent = touch
        ? "Drag to rotate · Pinch to zoom · Two fingers to move"
        : "Drag to rotate · Scroll to zoom · Right-drag to move";
    stage.append(hint);

    const dismiss = () => {
        hint.classList.add("is-gone");
        setTimeout(() => hint.remove(), 400);
        stage.removeEventListener("pointerdown", dismiss);
    };
    stage.addEventListener("pointerdown", dismiss, { once: true });
    setTimeout(dismiss, 9000);
}

// ------------------------------------------------------
// WIRING
// Wrap the two globals organelleInfo.js exposes so we can
// decorate after each update without editing that file.
// ------------------------------------------------------
function wrapInfoHooks() {
    const origUpdate = window.updateOrganelleInformation;
    const origReset  = window.resetOrganelleInformation;

    if (typeof origUpdate === "function") {
        window.updateOrganelleInformation = (key) => {
            origUpdate(key);
            decoratePanel(key);
            showCaption(key);
        };
    }
    if (typeof origReset === "function") {
        window.resetOrganelleInformation = () => {
            origReset();
            clearPanelExtras();
            hideCaption();
        };
    }
}

groupRail();
syncPressed();
buildCaption();
wrapInfoHooks();
whenModelLoaded(showHint);