// ======================================================
// ORGANELLE META — shared by viewerChrome.js, viewerPicking.js
// and (optionally) tredii.js / plantTredii.js.
//
// One place that says: which group does each organelle belong
// to, what colour represents that group, and what is the
// one-sentence answer to "what does it do?".
//
// Keys match the data-organelle values already used in
// AnimalCell.html and PlantCell.html (including the existing
// spellings such as "chloroplas" and "GolgiApparatus").
//
// The one-liners are a starting draft. Have your instructor
// confirm the wording before it ships.
// ======================================================

export const CATEGORIES = {
    structure: { label: "Structure & support", hex: 0x1d5fa8, css: "#1D5FA8" },
    genetic:   { label: "Control center",      hex: 0x6d3fb0, css: "#6D3FB0" },
    protein:   { label: "Protein & transport", hex: 0xb0326e, css: "#B0326E" },
    energy:    { label: "Energy",              hex: 0x8a5a00, css: "#8A5A00" },
    storage:   { label: "Storage & cleanup",   hex: 0x0f766e, css: "#0F766E" }
};

// Display order in the organelle rail
export const CATEGORY_ORDER = ["structure", "genetic", "protein", "energy", "storage"];

export const META = {
    // ---- shared / animal ----
    cellMem:              { cat: "structure", summary: "The flexible boundary that controls what enters and leaves the cell." },
    cytoplasm:            { cat: "structure", summary: "The jelly-like fluid where organelles sit and many reactions happen." },
    cytoskeleton:         { cat: "structure", summary: "A protein scaffold that shapes the cell and moves things around inside it." },
    centriole:            { cat: "structure", summary: "Barrel-shaped structures that organize the spindle fibers during cell division." },
    nucleus:              { cat: "genetic",   summary: "Holds the DNA and controls which genes are switched on." },
    Nucleolus:            { cat: "genetic",   summary: "Builds ribosome parts inside the nucleus." },
    ribosomes:            { cat: "protein",   summary: "Read messenger RNA to build proteins." },
    endoplasmicReticulum: { cat: "protein",   summary: "A membrane network that helps make proteins and lipids and sends them onward." },
    golgiApparatus:       { cat: "protein",   summary: "Sorts, modifies, and packages proteins and lipids for delivery." },
    mitochondria:         { cat: "energy",    summary: "Turns nutrients and oxygen into ATP, the energy the cell can spend." },
    lysosome:             { cat: "storage",   summary: "Sacs of digestive enzymes that break down waste and worn-out parts." },
    peroxisome:           { cat: "storage",   summary: "Breaks down fatty acids and neutralizes hydrogen peroxide." },
    vacuole:              { cat: "storage",   summary: "Stores water, nutrients, and waste." },

    // ---- plant-only spellings (PlantCell.html) ----
    cellwall:             { cat: "structure", summary: "A rigid outer layer that supports and protects the cell." },
    cellmem:              { cat: "structure", summary: "The flexible boundary that controls what enters and leaves the cell." },
    nucleolus:            { cat: "genetic",   summary: "Builds ribosome parts inside the nucleus." },
    GolgiApparatus:       { cat: "protein",   summary: "Sorts, modifies, and packages proteins and lipids for delivery." },
    chloroplas:           { cat: "energy",    summary: "Captures light energy and uses it to make sugar (photosynthesis)." }
};

export function catOf(key)     { return META[key]?.cat ?? null; }
export function summaryOf(key) { return META[key]?.summary ?? ""; }
export function labelOfCat(c)  { return CATEGORIES[c]?.label ?? ""; }
export function hexOfKey(key)  { return CATEGORIES[catOf(key)]?.hex ?? 0x1e7245; }