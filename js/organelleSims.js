/* EcoLearn organelle simulators.
   Finds every .organelle-section on the page, matches its .organelle-name,
   and adds a 2D step-by-step simulator under the 3D model. */
(function () {
'use strict';

/* ---------- helpers ---------- */
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const K = (a, t) => { const i = Math.min(Math.floor(t), a.length - 2); return a[i] + (a[i + 1] - a[i]) * (t - i); };
const n = v => (+v).toFixed(1);
const C = (x, y, r, f, s, o = 1) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${f}"${s ? ` stroke="${s}" stroke-width="2"` : ''} opacity="${n(o)}"/>`;
const E = (x, y, rx, ry, f, s, w = 3, o = 1) => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}"${s ? ` stroke="${s}" stroke-width="${w}"` : ''} opacity="${n(o)}"/>`;
const R = (x, y, w, h, f, s, rx = 0, o = 1) => `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(w, 0))}" height="${n(Math.max(h, 0))}" rx="${n(rx)}" fill="${f}"${s ? ` stroke="${s}" stroke-width="2"` : ''} opacity="${n(o)}"/>`;
const L = (x1, y1, x2, y2, s, w = 2, o = 1, ex = '') => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${s}" stroke-width="${w}" stroke-linecap="round" opacity="${n(o)}" ${ex}/>`;
const P = (d, f, s, w = 2, o = 1, ex = '') => `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" opacity="${n(o)}" ${ex}/>`;
const T = (x, y, txt, o = 1, s = 11, f = '#17302a') => `<text x="${n(x)}" y="${n(y)}" font-size="${s}" fill="${f}" text-anchor="middle" opacity="${n(o)}">${txt}</text>`;
const AR = (x1, y1, x2, y2, c, o = 1) => {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 8;
    const p = [[x2, y2], [x2 - h * Math.cos(a - .45), y2 - h * Math.sin(a - .45)], [x2 - h * Math.cos(a + .45), y2 - h * Math.sin(a + .45)]];
    return L(x1, y1, x2, y2, c, 3, o) + `<polygon points="${p.map(q => n(q[0]) + ',' + n(q[1])).join(' ')}" fill="${c}" opacity="${n(o)}"/>`;
};
const ribo = (x, y, o = 1) => E(x, y + 11, 22, 12, '#4a8bab', '#2b5f7a', 2, o) + E(x, y - 12, 16, 10, '#7fb7d6', '#2b5f7a', 2, o);

const SIMS = {};

/* ---------- NUCLEUS ---------- */
SIMS.nucleus = {
    title: 'Nucleus: how a gene becomes a protein',
    lead: 'Drag the slider to follow one gene from the DNA inside the nucleus to a protein built in the cytoplasm.',
    legend: [['#8b2e6e', 'DNA'], ['#d9822b', 'mRNA'], ['#a8730f', 'Nuclear envelope'], ['#4a8bab', 'Ribosome']],
    steps: [
        ['DNA stores the code', 'DNA stays protected inside the nucleus. The nucleolus (dark spot) builds ribosome parts.'],
        ['Transcription', 'An enzyme copies one gene of DNA into a messenger RNA (mRNA) strand.'],
        ['mRNA leaves', 'The mRNA slips out through a nuclear pore into the cytoplasm.'],
        ['Protein is built', 'A ribosome reads the mRNA and links amino acids into a protein.']
    ],
    draw(t) {
        let o = E(140, 130, 100, 100, '#fbefd0', '#a8730f', 5) + E(140, 130, 90, 90, 'none', '#d4a84b', 1.5, .8);
        o += L(240, 116, 240, 144, '#f1f7f3', 9) + L(234, 116, 246, 116, '#a8730f', 3) + L(234, 144, 246, 144, '#a8730f', 3);
        o += C(100, 168, 15, '#8a5a0a') + T(100, 192, 'Nucleolus', 1, 9);
        o += P('M60 108 q12 -16 24 0 t24 0 t24 0 t24 0 t24 0 t24 0', 'none', '#8b2e6e', 3) + T(130, 88, 'DNA', 1, 11);
        const mo = ss(0, .7, t), g = ss(0, 1, t), mx = K([110, 110, 225, 330], t), my = K([128, 128, 130, 130], t);
        o += `<path d="M${n(mx - 30)} ${n(my)} q7 -9 15 0 t15 0 t15 0 t15 0" fill="none" stroke="#d9822b" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${n(75 * g)} 300" opacity="${n(mo)}"/>`;
        o += T(mx, my - 16, 'mRNA', mo, 10, '#b5651a');
        o += T(240, 98, 'Nuclear pore', ss(1.5, 2, t) * (1 - ss(2.4, 2.8, t)), 9);
        const ro = ss(2.4, 3, t), cnt = ss(2.5, 3, t) * 6;
        o += ribo(330, 140, ro) + T(330, 190, 'Ribosome', ro, 10);
        for (let k = 0; k < 6; k++) o += C(326 + (k % 2) * 8, 100 - k * 9, 4.5, '#2f8f5a', '#1f4d3a', cl(cnt - k));
        return o;
    }
};

/* ---------- MITOCHONDRIA ---------- */
SIMS.mitochondria = {
    title: 'Mitochondria: making ATP',
    lead: 'Follow fuel molecules into the mitochondrion and see how the cell’s energy currency, ATP, is produced.',
    legend: [['#d9822b', 'Fuel (pyruvate)'], ['#8c9a93', 'CO₂'], ['#4a8bab', 'H⁺ ions'], ['#f2c230', 'ATP']],
    steps: [
        ['Fuel arrives', 'Pyruvate from the breakdown of glucose enters the mitochondrion.'],
        ['Krebs cycle', 'In the matrix, the Krebs cycle strips energy from the fuel and releases CO₂.'],
        ['Electron transport', 'On the folded inner membrane (cristae), H⁺ ions are pumped into the space between the membranes.'],
        ['ATP is made', 'H⁺ ions rush back through ATP synthase, which produces large amounts of ATP.']
    ],
    draw(t) {
        let o = E(200, 130, 150, 82, '#f7d2c4', '#b5532f', 4) + E(200, 130, 136, 68, '#fbe3d8', '#8b2e2e', 2.5);
        [120, 200, 280].forEach(x => { o += R(x - 7, 62, 14, 50, '#e9a98f', '#8b2e2e', 7); });
        [160, 240].forEach(x => { o += R(x - 7, 148, 14, 50, '#e9a98f', '#8b2e2e', 7); });
        o += T(200, 134, 'Matrix', .8, 9);
        const fo = 1 - ss(1, 1.6, t);
        for (let j = 0; j < 3; j++) o += C(K([20, 120, 170, 170], t) + j * 10, 100 + j * 16, 6, '#d9822b', '#946b14', fo);
        const kg = ss(.5, 1.2, t) * (1 - ss(1.9, 2.4, t));
        o += `<circle cx="200" cy="130" r="14" fill="none" stroke="#d9822b" stroke-width="3" stroke-dasharray="8 5" stroke-dashoffset="${n(-t * 40)}" opacity="${n(kg)}"/>`;
        const co = ss(1, 1.3, t) * (1 - ss(1.9, 2.3, t)), cy = 125 - 95 * ss(1, 2, t);
        [180, 215].forEach(x => { o += C(x, cy, 6, '#8c9a93', '#5b6b63', co) + T(x, cy - 9, 'CO₂', co, 8); });
        const hy = 130 - 72 * ss(1.7, 2.4, t) + 72 * ss(2.5, 3, t), ho = ss(1.6, 1.9, t);
        [150, 170, 230].forEach(x => { o += C(x, hy, 5, '#4a8bab', '#2b5f7a', ho); });
        o += T(160, hy - 9, 'H⁺', ho, 8);
        const so = ss(1.7, 2.2, t);
        o += C(255, 122, 7, '#1f6f8b', '#144a5e', so) + L(255, 129, 255, 148, '#1f6f8b', 4, so);
        const ao = ss(2.3, 2.6, t);
        for (let j = 0; j < 3; j++) { const x = 255 + 120 * ss(2.4, 3, t), y = 130 + (j - 1) * 18; o += C(x, y, 9, '#f2c230', '#946b14', ao) + T(x, y + 3, 'ATP', ao, 7); }
        return o;
    }
};

/* ---------- RIBOSOMES ---------- */
SIMS.ribosomes = {
    title: 'Ribosomes: building a protein',
    lead: 'Watch a ribosome read an mRNA strand and link amino acids into a chain.',
    legend: [['#4a8bab', 'Ribosome'], ['#d9822b', 'mRNA codons'], ['#8b2e6e', 'tRNA'], ['#2f8f5a', 'Amino-acid chain']],
    steps: [
        ['mRNA binds', 'The ribosome attaches to the mRNA at the start codon.'],
        ['tRNA delivers', 'A tRNA matches its anticodon to a codon and delivers one amino acid.'],
        ['Chain grows', 'The ribosome slides along the mRNA, adding one amino acid per codon.'],
        ['Protein released', 'At the stop codon the finished chain is released and folds into a protein.']
    ],
    draw(t) {
        let o = '';
        for (let k = 0; k < 11; k++) o += R(24 + k * 34, 166, 28, 10, k % 2 ? '#f0b46c' : '#d9822b', '#946b14', 3);
        o += T(14, 160, '5′', 1, 10) + T(386, 160, '3′', 1, 10);
        const rx = K([70, 120, 190, 280], t), cn = K([0, 1, 5, 8], t), rel = 1 - ss(2.6, 2.95, t);
        for (let k = 0; k < 8; k++) o += C(rx - 7 + (k % 2) * 7, 118 - k * 10, 5, k % 2 ? '#2f8f5a' : '#58b37f', '#1f4d3a', cl(cn - k) * rel);
        o += ribo(rx, 157, 1);
        if (t > .3 && t < 2.7) {
            const c = (((t - .3) % 1) + 1) % 1, p = ss(0, .6, c), tx = rx + 10 + (1 - p) * 70, op = 1 - ss(.75, 1, c);
            o += L(tx, 190, tx, 208, '#8b2e6e', 3, op) + C(tx, 215, 6, '#e0b030', '#946b14', op);
        }
        const po = ss(2.5, 3, t);
        o += C(rx + 50, 70, 16, '#2f8f5a', '#1f4d3a', po) + C(rx + 44, 64, 5, '#58b37f', null, po) + C(rx + 58, 76, 5, '#58b37f', null, po) + T(rx + 50, 46, 'Protein', po, 10);
        return o;
    }
};

/* ---------- GOLGI ---------- */
SIMS.golgi = {
    title: 'Golgi apparatus: the cell’s post office',
    lead: 'Follow one protein from the ER through the Golgi stack until it ships out of the cell.',
    legend: [['#7fb7d6', 'Vesicle from ER'], ['#d9822b', 'Modified protein'], ['#8b2e6e', 'Sugar tags'], ['#b5702f', 'Golgi cisternae']],
    steps: [
        ['Vesicle arrives', 'A transport vesicle carrying new protein buds off the ER and travels to the Golgi.'],
        ['Fuses at cis face', 'The vesicle fuses with the cis (receiving) side of the stack.'],
        ['Modified', 'Enzymes in each cisterna modify the protein, for example adding sugar chains.'],
        ['Sorted & packed', 'At the trans face the finished protein is sorted and packed into a new vesicle.'],
        ['Shipped', 'The secretory vesicle moves to the cell membrane and releases its cargo.']
    ],
    draw(t) {
        let o = P('M10 30 q20 -14 40 0 t40 0', 'none', '#4a7fa8', 6) + T(50, 58, 'ER', 1, 10);
        [70, 105, 140, 175].forEach(y => { o += P(`M120 ${y} Q200 ${y - 26} 280 ${y} Q200 ${y - 8} 120 ${y}Z`, '#f5c9a0', '#b5702f', 3); });
        o += T(100, 60, 'cis', 1, 11) + T(100, 164, 'trans', 1, 11);
        o += L(360, 20, 360, 240, '#946b14', 6) + T(360, 254, 'Membrane', 1, 9);
        const r1 = 10 * (1 - ss(.9, 1.3, t));
        o += C(60 + 140 * ss(0, 1, t), 40 + 14 * ss(0, 1, t), r1, '#7fb7d6', '#4a8bab');
        const co = ss(1, 1.3, t) * (1 - ss(3, 3.3, t)), cy = 54 + 105 * ss(1.2, 2.8, t), c = ss(1.4, 2.6, t);
        o += C(200, cy, 7, '#7fb7d6', '#4a8bab', co * (1 - c)) + C(200, cy, 7, '#d9822b', '#946b14', co * c);
        [[-10, -6], [10, -4], [0, 9]].forEach(d => { o += C(200 + d[0], cy + d[1], 2.5, '#8b2e6e', null, co * c); });
        const r2 = 11 * ss(3, 3.5, t), px = 200 + 140 * ss(3.5, 4, t);
        o += C(px, 171, r2, '#d9822b', '#946b14') + C(px, 171, r2 * .3, '#8b2e6e', null);
        const ro = ss(3.8, 4, t);
        [[368, 160], [376, 172], [368, 184]].forEach(d => { o += C(d[0], d[1], 3, '#d9822b', null, ro); });
        return o;
    }
};

/* ---------- ENDOPLASMIC RETICULUM ---------- */
SIMS.er = {
    title: 'Endoplasmic reticulum: rough and smooth',
    lead: 'See how the rough ER processes proteins and how the smooth ER makes lipids.',
    legend: [['#1f4d3a', 'Ribosomes'], ['#2f8f5a', 'New protein'], ['#8b2e6e', 'Folded protein + sugar'], ['#d9822b', 'Lipids']],
    steps: [
        ['Protein enters', 'A ribosome on the rough ER pushes a new protein into the ER lumen.'],
        ['Folding', 'Inside the lumen the protein folds and gets sugar groups attached.'],
        ['Vesicle buds', 'The finished protein is packed into a vesicle that heads to the Golgi.'],
        ['Smooth ER works', 'The smooth ER (no ribosomes) makes lipids and breaks down toxins.']
    ],
    draw(t) {
        let o = E(0, 130, 62, 110, '#fbefd0', '#a8730f', 3);
        const gl = ss(2.4, 3, t);
        [51, 91].forEach(y => { o += P(`M228 ${y} q40 -26 80 0 t80 0`, 'none', '#f3a64a', 20, .35 * gl); });
        [131, 171].forEach(y => { o += P(`M228 ${y} q40 26 80 0 t80 0`, 'none', '#f3a64a', 20, .35 * gl); });
        [51, 91].forEach(y => { o += P(`M228 ${y} q40 -26 80 0 t80 0`, 'none', '#b58a1f', 15) + P(`M228 ${y} q40 -26 80 0 t80 0`, 'none', '#f0d98a', 10); });
        [131, 171].forEach(y => { o += P(`M228 ${y} q40 26 80 0 t80 0`, 'none', '#b58a1f', 15) + P(`M228 ${y} q40 26 80 0 t80 0`, 'none', '#f0d98a', 10); });
        [40, 80, 120, 160].forEach(y => {
            o += R(78, y, 152, 22, '#cfe0f0', '#4a7fa8', 11);
            for (let x = 95; x < 220; x += 20) o += C(x, y - 2, 3.2, '#1f4d3a') + C(x, y + 24, 3.2, '#1f4d3a');
        });
        const bo = 1 - ss(1.95, 2.15, t), c = ss(1, 1.8, t);
        const bx = 140 + 80 * ss(.9, 2, t), by = 24 + 27 * ss(0, .9, t);
        o += C(bx, by, 6, '#2f8f5a', '#1f4d3a', bo * (1 - c)) + C(bx, by, 6, '#8b2e6e', '#5a1b46', bo * c);
        [[-8, -5], [8, 4]].forEach(d => { o += C(bx + d[0], by + d[1], 2.2, '#f0b46c', null, bo * c); });
        const vr = 9 * ss(1.9, 2.3, t), vx = 232 + 90 * ss(2.3, 3, t), vy = 51 - 30 * ss(2.3, 3, t);
        o += C(vx, vy, vr, '#c9a2d6', '#8b2e6e') + T(330, 12, 'to Golgi →', ss(2.4, 3, t), 9);
        [[268, 38], [348, 64], [268, 144], [348, 118]].forEach((d, k) => { o += C(d[0] + 14 * ss(2.5, 3, t) * (k % 2 ? -1 : 1), d[1], 4, '#d9822b', '#946b14', gl); });
        o += T(150, 212, 'Rough ER', 1, 10) + T(320, 212, 'Smooth ER', 1, 10);
        return o;
    }
};

/* ---------- CELL MEMBRANE ---------- */
SIMS.membrane = {
    title: 'Cell membrane: a selective gate',
    lead: 'Watch what can cross the membrane, what needs a protein, and what is kept out.',
    legend: [['#e0a84f', 'Phospholipids'], ['#8b2e6e', 'Channel protein'], ['#1f6f8b', 'Pump protein'], ['#d9822b', 'Small non-polar molecule']],
    steps: [
        ['Diffusion', 'Small non-polar molecules, such as oxygen, slip straight through the lipid bilayer.'],
        ['Channels', 'Water and ions pass through channel proteins, moving from high to low concentration.'],
        ['Pumps', 'Pump proteins use ATP to push ions against the gradient, out of the cell.'],
        ['Blocked', 'Large molecules cannot cross the bilayer. They need vesicles or special transporters.']
    ],
    draw(t) {
        let o = R(0, 0, 400, 112, '#e8f1f6') + R(0, 148, 400, 112, '#f1e9d4') + T(60, 18, 'Outside the cell', 1, 10) + T(60, 250, 'Inside the cell', 1, 10);
        for (let x = 10; x <= 390; x += 20) {
            if (Math.abs(x - 150) < 26 || Math.abs(x - 260) < 28) continue;
            o += C(x, 112, 8, '#e0a84f', '#946b14') + C(x, 148, 8, '#e0a84f', '#946b14');
            [-3, 3].forEach(d => { o += L(x + d, 120, x + d, 130, '#946b14', 2) + L(x + d, 140, x + d, 130, '#946b14', 2); });
        }
        o += R(128, 100, 44, 60, '#8b2e6e', '#5a1b46', 8) + R(145, 100, 10, 30, '#e8f1f6') + R(145, 130, 10, 30, '#f1e9d4');
        o += R(238, 100, 44, 60, '#1f6f8b', '#144a5e', 8) + R(252, 100, 16, 24, '#e8f1f6');
        const a = 1 - ss(1.05, 1.4, t);
        [60, 90, 112].forEach((x, j) => { o += C(x, 30 + 190 * ss(j * .05, 1 + j * .05, t), 5, '#d9822b', '#946b14', a); });
        const b = ss(.6, 1, t) * (1 - ss(1.6, 2, t));
        for (let j = 0; j < 3; j++) o += C(150, 30 + 190 * ss(.7 + .05 * j, 1.5 + .05 * j, t), j === 1 ? 5.5 : 4.5, j === 1 ? '#8b2e6e' : '#4a8bab', null, b);
        const c = ss(1.6, 2, t) * (1 - ss(2.6, 3, t));
        for (let j = 0; j < 2; j++) o += C(246 + j * 22, 225 - 185 * ss(1.8 + .05 * j, 2.5 + .05 * j, t), 5, '#2f8f5a', '#1f4d3a', c);
        o += C(260, 190, 8, '#f2c230', '#946b14', c) + T(260, 193, 'ATP', c, 7);
        const d = ss(2.6, 3, t);
        o += C(335, 30 + 60 * ss(2.4, 3, t), 14, '#8c9a93', '#5b6b63', d) + T(335, 82, '✕', d, 16, '#c0392b');
        return o;
    }
};

/* ---------- VACUOLE ---------- */
SIMS.vacuole = {
    title: 'Vacuole: water storage and turgor pressure',
    lead: 'See how a plant cell’s central vacuole fills with water and keeps the cell firm.',
    legend: [['#a8d4e3', 'Vacuole (water)'], ['#cfe6d6', 'Cytoplasm'], ['#8b6b3e', 'Cell wall'], ['#c0392b', 'Turgor pressure']],
    steps: [
        ['Low water', 'With little water, the vacuole shrinks and the cell wilts away from its wall.'],
        ['Water enters', 'Water moves into the vacuole by osmosis across the tonoplast membrane.'],
        ['Turgor pressure', 'The swollen vacuole pushes against the rigid cell wall. The cell becomes firm.'],
        ['Storage', 'The vacuole also stores sugars, pigments and waste, and keeps them away from the rest of the cell.']
    ],
    draw(t) {
        const ins = K([30, 12, 0, 0], t), vw = K([90, 150, 210, 210], t), vh = K([54, 96, 150, 150], t);
        let o = R(48, 24, 304, 212, '#8b6b3e', null, 18) + R(58 + ins, 34 + ins, 284 - 2 * ins, 192 - 2 * ins, '#cfe6d6', '#1f4d3a', 12);
        o += R(200 - vw / 2, 130 - vh / 2, vw, vh, '#a8d4e3', '#4a8bab', 34);
        o += T(200, 16, ['Wilted', 'Filling with water', 'Firm (turgid)', 'Firm (turgid)'][Math.round(t)], 1, 12);
        const wo = ss(0, .3, t) * (1 - ss(1.6, 2, t));
        [85, 130, 175].forEach((y, j) => { o += C(14 + 150 * ss(.3 + .1 * j, 1.7 + .1 * j, t), y, 6, '#4a8bab', '#2b5f7a', wo); });
        o += T(30, 66, 'H₂O', wo, 9);
        const ao = ss(1.7, 2.2, t), rx = 200 + vw / 2, ry = 130 + vh / 2;
        o += AR(rx + 2, 130, 338, 130, '#c0392b', ao) + AR(398 - rx, 130, 62, 130, '#c0392b', ao) + AR(200, 128 - vh / 2, 200, 40, '#c0392b', ao) + AR(200, ry + 2, 200, 222, '#c0392b', ao);
        const so = ss(2.4, 3, t);
        o += C(165, 112, 5, '#d9822b', null, so) + C(185, 150, 4, '#d9822b', null, so) + C(235, 116, 5, '#7d8a84', null, so) + C(225, 148, 4, '#7d8a84', null, so) + C(200, 160, 5, '#8b2e6e', null, so);
        o += T(200, 134, 'sugars · pigments · waste', so, 9);
        return o;
    }
};

/* ---------- CYTOSKELETON ---------- */
SIMS.cytoskeleton = {
    title: 'Cytoskeleton: tracks, ropes and muscles',
    lead: 'Each of the three filament types does a different job. Drag the slider to switch between them.',
    legend: [['#4a8bab', 'Microtubules'], ['#946b14', 'Intermediate filaments'], ['#2f8f5a', 'Actin (microfilaments)'], ['#8b2e6e', 'Myosin / cargo']],
    steps: [
        ['Microtubules', 'Hollow tubes act as transport tracks. Motor proteins such as kinesin walk along them carrying vesicles.'],
        ['Intermediate filaments', 'Rope-like fibers give tensile strength and anchor the nucleus, so the cell resists stretching.'],
        ['Microfilaments', 'Thin actin filaments slide past myosin to produce contraction and cell movement.']
    ],
    draw(t) {
        const op = i => cl(1.5 - Math.abs(t - i) * 2), o0 = op(0), o1 = op(1), o2 = op(2);
        let o = E(200, 130, 175, 108, '#f5e3b4', '#946b14', 4);
        [[330, 70], [340, 190], [65, 80], [70, 190]].forEach(p => { o += L(200, 130, p[0], p[1], '#4a8bab', 9, o0) + L(200, 130, p[0], p[1], '#d6ebf5', 4, o0); });
        o += E(200, 130, 34, 34, '#e3b84f', '#a8730f', 3, 1 - o2);
        const p = (t * 1.3) % 1, mx = 200 + 130 * p, my = 130 - 60 * p;
        o += C(mx, my - 14, 8, '#8b2e6e', '#5a1b46', o0) + L(mx, my - 6, mx - 5, my, '#17302a', 2, o0) + L(mx, my - 6, mx + 5, my, '#17302a', 2, o0);
        o += T(300, 38, 'Kinesin carries a vesicle', o0, 10);
        for (let a = 0; a < 8; a++) {
            const c = Math.cos(a * Math.PI / 4), s = Math.sin(a * Math.PI / 4);
            o += L(200 + 36 * c, 130 + 36 * s, 200 + 168 * c, 130 + 102 * s, '#946b14', 4, o1, 'stroke-dasharray="7 3"');
        }
        o += AR(372, 130, 396, 130, '#c0392b', o1) + AR(28, 130, 4, 130, '#c0392b', o1) + T(200, 252, 'Ropes spread out the tension', o1, 10);
        const c = ss(1.2, 2, t), xl = 60 + 55 * c, xr = 340 - 55 * c;
        o += L(150, 130, 250, 130, '#8b2e6e', 9, o2);
        for (let x = 158; x < 250; x += 12) o += L(x, 130, x, 120, '#8b2e6e', 2, o2) + L(x + 6, 130, x + 6, 140, '#8b2e6e', 2, o2);
        [105, 155].forEach(y => { o += L(xl, y, xl + 140, y, '#2f8f5a', 3, o2); });
        [115, 145].forEach(y => { o += L(xr - 140, y, xr, y, '#2f8f5a', 3, o2); });
        o += L(xl, 90, xl, 170, '#17302a', 5, o2) + L(xr, 90, xr, 170, '#17302a', 5, o2);
        o += T(200, 252, 'Actin slides over myosin: the cell contracts', o2, 10);
        return o;
    }
};

/* ---------- PEROXISOME ---------- */
SIMS.peroxisome = {
    title: 'Peroxisome: detoxifying hydrogen peroxide',
    lead: 'See how a peroxisome breaks down fatty acids and neutralizes the toxic by-product.',
    legend: [['#d9822b', 'Fatty acid'], ['#c0392b', 'H₂O₂ (toxic)'], ['#8b2e6e', 'Catalase'], ['#4a8bab', 'Water']],
    steps: [
        ['Fatty acid enters', 'A long fatty-acid chain is taken into the peroxisome.'],
        ['Oxidation', 'Oxidase enzymes shorten the chain. This reaction makes toxic hydrogen peroxide (H₂O₂).'],
        ['Catalase acts', 'The enzyme catalase grabs the H₂O₂ and breaks it apart.'],
        ['Safe products', 'Harmless water and oxygen leave the peroxisome.']
    ],
    draw(t) {
        let o = E(200, 130, 100, 92, '#eef4dc', '#5f7a2b', 4);
        const g = ss(1.5, 2.2, t) * (1 - ss(2.8, 3, t));
        o += C(200, 108, 17 + 4 * g, '#8b2e6e', '#5a1b46') + T(200, 111, 'catalase', 1, 8, '#fff');
        const fx = K([10, 120, 120, 120], t), fo = 1 - ss(1.2, 1.8, t);
        let pts = '';
        for (let k = 0; k < 6; k++) pts += n(fx + k * 18) + ',' + (150 + (k % 2 ? -8 : 8)) + ' ';
        o += `<polyline points="${pts}" fill="none" stroke="#d9822b" stroke-width="4" stroke-linejoin="round" opacity="${n(fo)}"/>`;
        const po = ss(1.2, 1.8, t);
        o += C(150, 172, 4, '#d9822b', null, po) + C(185, 178, 4, '#d9822b', null, po) + C(225, 172, 4, '#d9822b', null, po);
        const ho = ss(.9, 1.3, t) * (1 - ss(2.2, 2.6, t)), hp = ss(1.5, 2.2, t);
        [150, 250].forEach(bx => { const x = bx + (200 - bx) * hp, y = 150 + (112 - 150) * hp; o += C(x, y, 7, '#c0392b', '#7b241c', ho) + T(x, y + 17, 'H₂O₂', ho, 8); });
        const xo = ss(2.1, 2.5, t), xp = ss(2.3, 3, t);
        [[-95, 100, '#4a8bab', 'H₂O'], [95, 100, '#4a8bab', 'H₂O'], [0, -98, '#9aa5a0', 'O₂']].forEach(d => {
            const x = 200 + d[0] * xp, y = 110 + d[1] * xp;
            o += C(x, y, 6, d[2], '#2b5f7a', xo) + T(x, y - 10, d[3], xo, 9);
        });
        return o;
    }
};

/* ---------- LYSOSOME ---------- */
SIMS.lysosome = {
    title: 'Lysosome: the recycling center',
    lead: 'Follow engulfed material as a lysosome digests it and releases useful building blocks.',
    legend: [['#4a8bab', 'Vesicle'], ['#7d8a84', 'Engulfed material'], ['#a1355f', 'Digestive enzymes'], ['#2f8f5a', 'Recycled nutrients']],
    steps: [
        ['Material enters', 'The cell engulfs food or a worn-out organelle in a membrane vesicle.'],
        ['Fusion', 'The lysosome fuses with the vesicle and pours its enzymes inside.'],
        ['Digestion', 'Acidic enzymes (pH ≈ 5) break the material down into small molecules.'],
        ['Recycling', 'Amino acids, sugars and other building blocks are released for the cell to reuse.']
    ],
    draw(t) {
        const vx = K([60, 140, 208, 208], t), vo = 1 - ss(1.7, 2.2, t), lr = 55 + 9 * ss(1, 2, t) * (1 - ss(2.6, 3, t));
        let o = E(280, 130, lr, lr, '#f3d6e0', '#a1355f', 4) + T(280, 214, 'Acidic inside (pH ≈ 5)', 1, 10);
        const en = ss(1.1, 1.6, t);
        [[-25, -30], [30, -28], [-35, 10], [35, 15], [0, 38], [8, -48]].forEach(d => { o += C(280 + d[0], 130 + d[1], 4, '#a1355f', null, en); });
        o += E(vx, 130, 32, 32, '#d6e8f2', '#4a8bab', 3, vo);
        const cx = K([60, 140, 255, 255], t), sc = 1 - ss(1.6, 2.7, t);
        if (sc > .05) o += R(cx - 15 * sc, 130 - 8 * sc, 30 * sc, 16 * sc, '#7d8a84', '#5b6b63', 8 * sc);
        o += T(60, 186, 'Engulfed material', 1 - ss(.8, 1.2, t), 10);
        const p = ss(2.2, 3, t), no = ss(2.1, 2.4, t);
        [[100, -70], [112, -20], [112, 40], [92, 82]].forEach(d => { o += C(280 + d[0] * p, 130 + d[1] * p, 4.5, '#2f8f5a', '#1f4d3a', no); });
        o += T(350, 236, 'amino acids · sugars', no, 9);
        return o;
    }
};

/* ---------- CENTRIOLE ---------- */
const cen = (x, y, a, s, o) => {
    let g = `<g transform="translate(${n(x)} ${n(y)}) rotate(${a}) scale(${n(Math.max(s, .01))})" opacity="${n(o)}"><rect x="-24" y="-9" width="48" height="18" rx="6" fill="#c9e4f0" stroke="#1f6f8b" stroke-width="2"/>`;
    for (let k = -16; k <= 16; k += 8) g += `<line x1="${k}" y1="-9" x2="${k}" y2="9" stroke="#1f6f8b" stroke-width="1.5"/>`;
    return g + '</g>';
};
const cpair = (x, s, o) => cen(x, 140, 0, s, o) + cen(x - 12, 107, 90, s, o);
SIMS.centriole = {
    title: 'Centrioles: organizing cell division',
    lead: 'See how centrioles duplicate and build the spindle that pulls chromosomes apart.',
    legend: [['#1f6f8b', 'Centrioles'], ['#4a8bab', 'Spindle microtubules'], ['#8b2e6e', 'Chromosomes']],
    steps: [
        ['Centriole pair', 'Two centrioles sit at right angles to each other inside the centrosome.'],
        ['Duplication', 'Before division the pair is copied, so the cell has two centrosomes.'],
        ['Move to poles', 'The two centrosomes move to opposite ends of the cell.'],
        ['Spindle forms', 'Microtubules grow out from the centrioles and attach to the chromosomes.']
    ],
    draw(t) {
        let o = E(200, 130, 185, 115, '#f5e3b4', '#946b14', 4);
        const ax = K([200, 185, 80, 80], t), bx = K([200, 215, 320, 320], t), bs = ss(.2, 1, t), so = ss(2.3, 3, t);
        const ch = [[175, 122], [192, 138], [208, 122], [225, 138]];
        ch.forEach(c => { o += L(ax, 125, c[0], c[1], '#4a8bab', 1.6, so) + L(bx, 125, c[0], c[1], '#4a8bab', 1.6, so); });
        ch.forEach(c => { o += L(c[0] - 5, c[1] - 8, c[0] + 5, c[1] + 8, '#8b2e6e', 4, so) + L(c[0] + 5, c[1] - 8, c[0] - 5, c[1] + 8, '#8b2e6e', 4, so); });
        o += cpair(ax, 1, 1) + cpair(bx, bs, bs);
        o += T(ax, 190, 'Centrosome', 1, 10) + T(bx, 190, 'Centrosome', bs, 10);
        return o;
    }
};

/* ---------- CELL WALL ---------- */
SIMS.cellwall = {
    title: 'Cell wall: layers of strength',
    lead: 'Watch a plant cell build its wall, layer by layer, and see how the wall holds back water pressure.',
    legend: [['#e6d3a8', 'Primary wall (cellulose)'], ['#c49a5a', 'Secondary wall (lignin)'], ['#4a8bab', 'Microtubule guide'], ['#1f6f8b', 'Cellulose synthase']],
    steps: [
        ['Cellulose is made', 'Cellulose synthase enzymes in the membrane spin out cellulose fibers, guided by microtubules.'],
        ['Primary wall', 'Cellulose fibers criss-cross to form a flexible primary wall.'],
        ['Secondary wall', 'Some cells add a thick secondary wall stiffened with lignin.'],
        ['Resists pressure', 'The strong wall holds the cell in shape as water pressure pushes outward.']
    ],
    draw(t) {
        const m = 170, tp = K([0, 24, 24, 24], t), ts = K([0, 0, 34, 34], t);
        let o = R(0, 0, 400, m, '#f7f3e8') + R(0, m, 400, 90, '#cfe6d6') + L(0, m + 14, 400, m + 14, '#4a8bab', 3, .9, 'stroke-dasharray="2 5"');
        o += R(0, m - tp, 400, tp, '#e6d3a8') + R(0, m - tp - ts, 400, ts, '#c49a5a');
        if (tp > 3) for (let x = -10; x < 400; x += 22) o += L(x, m - tp + 2, x + 18, m - 2, '#8b6b3e', 2, .8) + L(x + 18, m - tp + 2, x, m - 2, '#8b6b3e', 2, .5);
        if (ts > 3) for (let y = m - tp - 5; y > m - tp - ts + 2; y -= 9) o += L(0, y, 400, y, '#7a5527', 2.5, .8);
        o += L(0, m, 400, m, '#946b14', 4);
        const eo = 1 - ss(1, 1.4, t), ex = 40 + 300 * ss(0, 1, t);
        o += L(30, m - 12, ex, m - 12, '#8b6b3e', 3, eo) + C(ex, m - 3, 8, '#1f6f8b', '#144a5e', eo) + T(ex, m - 24, 'Cellulose synthase', eo, 9);
        const po = ss(2.4, 3, t);
        [90, 200, 310].forEach(x => { o += AR(x, 222, x, m + 8, '#c0392b', po); });
        o += T(200, 250, 'Water pressure (turgor)', po, 10) + T(70, 14, 'Outside', 1, 10);
        return o;
    }
};

/* ---------- CHLOROPLAST ---------- */
SIMS.chloroplast = {
    title: 'Chloroplast: photosynthesis',
    lead: 'Follow light, water and CO₂ through the chloroplast until sugar comes out.',
    legend: [['#f2c230', 'Light / ATP'], ['#4a8bab', 'Water'], ['#8c9a93', 'O₂ and CO₂'], ['#d9822b', 'Glucose']],
    steps: [
        ['Light is captured', 'Chlorophyll in the thylakoid stacks (grana) absorbs sunlight.'],
        ['Water is split', 'Light energy splits water. Oxygen (O₂) is released as a by-product.'],
        ['Energy carriers', 'The light reactions make ATP and NADPH, which move into the stroma.'],
        ['Calvin cycle', 'In the stroma, the Calvin cycle uses ATP, NADPH and CO₂ to build glucose.']
    ],
    draw(t) {
        let o = E(210, 140, 160, 95, '#cfe6c4', '#2f6f4e', 5);
        const lit = 1 - ss(1.3, 1.8, t);
        [[110, 115], [170, 170], [310, 115]].forEach(g => { for (let i = 0; i < 4; i++) o += R(g[0] - 22, g[1] + i * 11, 44, 8, lit > .5 ? '#4fb06f' : '#2f8f5a', '#1f4d3a', 4); });
        o += C(20, 14, 14, '#f2c230', '#b58a1f');
        [0, 1, 2].forEach(j => { o += AR(26, 24, 92 + j * 18, 98, '#f2c230', lit); });
        const wo = ss(.8, 1.1, t) * (1 - ss(1.7, 2, t));
        [0, 1].forEach(j => { const y0 = 60 + j * 40; o += C(15 + 85 * ss(.9, 1.7, t), y0 + (115 - y0) * ss(.9, 1.7, t), 6, '#4a8bab', '#2b5f7a', wo); });
        o += T(20, 100, 'H₂O', wo, 9);
        const oo = ss(1.2, 1.5, t) * (1 - ss(2.2, 2.6, t));
        [0, 1].forEach(j => { const y = 100 - 90 * ss(1.3, 2.2, t); o += C(100 + j * 22, y, 6, '#c9d3ce', '#7d8a84', oo) + T(100 + j * 22, y - 9, 'O₂', oo, 8); });
        const ko = ss(1.7, 2, t) * (1 - ss(2.7, 3, t)), kp = ss(1.9, 2.7, t);
        o += C(175 + 70 * kp, 160 - 15 * kp, 8, '#f2c230', '#946b14', ko) + T(175 + 70 * kp, 163 - 15 * kp, 'ATP', ko, 7);
        o += C(185 + 60 * kp, 175 - 25 * kp, 8, '#c9a2d6', '#8b2e6e', ko) + T(185 + 60 * kp, 178 - 25 * kp, 'NADPH', ko, 6);
        const ro = ss(2.3, 2.8, t);
        o += `<circle cx="245" cy="140" r="22" fill="none" stroke="#d9822b" stroke-width="3" stroke-dasharray="8 5" stroke-dashoffset="${n(-t * 50)}" opacity="${n(ro)}"/>` + T(245, 143, 'Calvin', ro, 8);
        const co = ss(2.2, 2.5, t) * (1 - ss(2.9, 3, t)), cx = 395 - 125 * ss(2.3, 2.9, t);
        o += C(cx, 128, 5, '#8c9a93', '#5b6b63', co) + C(cx, 152, 5, '#8c9a93', '#5b6b63', co) + T(cx, 118, 'CO₂', co, 8);
        const go = ss(2.6, 2.8, t), gy = 162 + 55 * ss(2.7, 3, t);
        o += C(245, gy, 9, '#e0b030', '#946b14', go) + T(245, gy + 22, 'glucose', go, 9);
        return o;
    }
};

/* ---------- ENGINE ---------- */
let uid = 0;
function build(host, key) {
    const S = SIMS[key], id = 'osim' + (++uid), N = S.steps.length;
    host.className = 'osim';
    host.innerHTML =
        `<h3 class="osim-title">${S.title}</h3><p class="osim-lead">${S.lead}</p>` +
        `<label class="osim-label" for="${id}">Step of the process</label>` +
        `<div class="osim-track"><span>${S.steps[0][0]}</span><input id="${id}" type="range" min="0" max="${N - 1}" step="0.01" value="0"><span>${S.steps[N - 1][0]}</span></div>` +
        `<div class="osim-controls"><button class="osim-play" type="button"></button><div class="osim-chips" role="group" aria-label="Jump to step"></div></div>` +
        `<div class="osim-banner" aria-live="polite"></div>` +
        `<div class="osim-panel"><svg viewBox="0 0 400 260" role="img" aria-label="${S.title}"></svg></div>` +
        `<ul class="osim-legend">${S.legend.map(l => `<li><i style="background:${l[0]}"></i>${l[1]}</li>`).join('')}</ul>`;
    const rng = host.querySelector('input'), play = host.querySelector('.osim-play'), box = host.querySelector('.osim-chips');
    const svg = host.querySelector('svg'), banner = host.querySelector('.osim-banner');
    const chips = S.steps.map((s, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = s[0];
        b.addEventListener('click', () => { stop(); set(i); });
        box.appendChild(b);
        return b;
    });
    function set(t) {
        t = cl(t, 0, N - 1);
        rng.value = t;
        svg.innerHTML = S.draw(t);
        const i = Math.round(t);
        banner.innerHTML = '<strong>' + S.steps[i][0] + '.</strong> ' + S.steps[i][1];
        chips.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    }
    let raf = 0, last = 0, playing = false;
    const label = () => { play.innerHTML = playing ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Play'; };
    function tick(ts) {
        if (!last) last = ts;
        const dt = (ts - last) / 1000; last = ts;
        set(+rng.value + dt * 0.45);
        if (+rng.value >= N - 1) { stop(); return; }
        raf = requestAnimationFrame(tick);
    }
    function start() { if (+rng.value >= N - 1) set(0); playing = true; last = 0; label(); raf = requestAnimationFrame(tick); }
    function stop() { playing = false; cancelAnimationFrame(raf); label(); }
    play.addEventListener('click', () => (playing ? stop() : start()));
    rng.addEventListener('input', () => { stop(); set(+rng.value); });
    label(); set(0);
}

const MAP = {
    'nucleus': 'nucleus', 'mitochondria': 'mitochondria', 'ribosomes': 'ribosomes',
    'golgi apparatus': 'golgi', 'endoplasmic reticulum': 'er', 'cell membrane': 'membrane',
    'vacuole': 'vacuole', 'cytoskeleton': 'cytoskeleton', 'peroxisome': 'peroxisome',
    'lysosome': 'lysosome', 'centriole': 'centriole', 'cell wall': 'cellwall', 'chloroplast': 'chloroplast'
};

function init() {
    document.querySelectorAll('.organelle-section').forEach(sec => {
        const h = sec.querySelector('.organelle-name');
        const key = h && MAP[h.textContent.trim().toLowerCase()];
        if (!key || sec.querySelector('.osim')) return;
        const host = document.createElement('div');
        sec.appendChild(host);
        build(host, key);
    });
}

if (typeof window !== 'undefined') window.EcoOrganelleSims = SIMS;
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
})();