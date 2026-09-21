// ============================================================
// BioLearn Dashboard — Real Progress Script
// Drop this as a <script> block inside dashboard.html,
// AFTER the existing DOMContentLoaded block that loads
// the student name/email. It uses window.ecoAuth.client.
// ============================================================
//
// HOW IT WORKS:
// 1. After lessons 02–08 are seeded, run:
//    SELECT id, module_number, title FROM lessons ORDER BY module_number;
//    and paste the UUIDs into LESSON_IDS below.
//
// 2. For each lesson, this script fetches the student's BEST
//    quiz score (highest score / 10 * 100). If no attempt, 0%.
//
// 3. Overall progress = average of all 8 lesson best scores.
//
// 4. Goal list groups = average of lessons in each group.
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  // ── LESSON UUID MAP ──────────────────────────────────────
  // After seeding, run the SQL above and fill in the UUIDs.
  // Module 01 is already known. Replace PENDING with real UUIDs
  // once you run seed_lessons_02_08.sql and query the table.
  const LESSON_IDS = {
    1: 'e43f6bee-bcff-4692-b5e2-396b4176eacd', // Animal Cell vs Plant Cell
    2: 'fc3f6b43-fb9d-420d-9060-9529ba395621', // Mitosis of Plant and Animal Cells
    3: '46254ff2-c787-4792-94db-5d33181f6b55', // Cell Membrane and Transport
    4: '1b15a414-7e6c-4992-b17c-1c924745366d', // Cell Respiration
    5: '81ece535-7d0b-47e9-a95a-ed8e0f25cc76', // Photosynthesis
    6: '26dc1e4f-4a8b-45fc-8e12-ab7fd326eea1', // Cell Cycle and Cancer
    7: '5149863c-8971-49ef-afa2-085cec2f3d1e', // Cell Differentiation and Specialization
    8: '5347853d-6f4b-43b2-b7b6-9e941fe6ebe9', // Cell Signaling and Communication
  };

  // ── GOAL LIST GROUPS ─────────────────────────────────────
  // Each group = average best score of its lesson modules.
  const GOAL_GROUPS = [
    { label: 'Cell Structure',                  modules: [1] },
    { label: 'Cell Division & Cycle',           modules: [2, 6] },
    { label: 'Cell Energy',                     modules: [4, 5] },
    { label: 'Cell Processes & Communication',  modules: [3, 7, 8] },
  ];

  const client = window.ecoAuth?.client;
  if (!client) return;

  // ── GET CURRENT USER ─────────────────────────────────────
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  // ── FETCH ALL QUIZ ATTEMPTS FOR THIS USER ────────────────
  const { data: attempts, error } = await client
    .from('quiz_attempts')
    .select('lesson_id, score')
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to load quiz attempts:', error);
    return;
  }

  // ── COMPUTE BEST SCORE PER LESSON ────────────────────────
  // Best score = highest score out of 10, converted to %
  const bestScores = {}; // { lesson_id: percentage }

  (attempts || []).forEach(attempt => {
    const pct = Math.round((attempt.score / 10) * 100);
    if (!bestScores[attempt.lesson_id] || pct > bestScores[attempt.lesson_id]) {
      bestScores[attempt.lesson_id] = pct;
    }
  });

  // Helper: get best score for a module number (0 if no attempt)
  function getBest(moduleNum) {
    const id = LESSON_IDS[moduleNum];
    if (!id || id.startsWith('PENDING')) return 0;
    return bestScores[id] ?? 0;
  }

  // ── OVERALL PROGRESS = avg of all 8 lesson best scores ───
  const allScores = [1,2,3,4,5,6,7,8].map(getBest);
  const overallPct = Math.round(allScores.reduce((a,b) => a+b, 0) / 8);

  // ── UPDATE PROGRESS STAT CARD ────────────────────────────
  const progressCard = document.querySelector('.stat-card:not(.folder-card)');
  if (progressCard) {
    const valueEl = progressCard.querySelector('.value');
    const metaEl  = progressCard.querySelector('.meta');
    if (valueEl) valueEl.textContent = `${overallPct}%`;
    if (metaEl) {
      metaEl.textContent =
        overallPct === 0   ? 'No quizzes taken yet' :
        overallPct >= 80   ? 'Excellent progress!'  :
        overallPct >= 50   ? 'On target'            :
                             'Keep going!';
    }
  }

  // ── UPDATE OVERALL COMPLETION RING ───────────────────────
  const ringSpan = document.querySelector('.progress-ring span');
  if (ringSpan) ringSpan.textContent = `${overallPct}%`;

  // Update the ring's conic-gradient if your CSS uses a CSS var
  // (if your ring is CSS-drawn, update the custom property)
  const ringEl = document.querySelector('.progress-ring');
  if (ringEl) {
    ringEl.style.setProperty('--progress', `${overallPct}%`);
    // Also update background directly in case CSS uses background shorthand
    ringEl.style.background =
      `conic-gradient(var(--canopy, #40916C) ${overallPct}%, var(--parchment, #e8e0d0) ${overallPct}%)`;
  }

  // ── UPDATE GOAL LIST ─────────────────────────────────────
  const goalItems = document.querySelectorAll('.goal-item');

  GOAL_GROUPS.forEach((group, i) => {
    const groupScores = group.modules.map(getBest);
    const groupAvg = Math.round(
      groupScores.reduce((a,b) => a+b, 0) / groupScores.length
    );

    const item = goalItems[i];
    if (!item) return;

    // Update label
    const labelEl = item.querySelector('.label-row');
    if (labelEl) {
      // Keep the dot span, replace text
      const dot = labelEl.querySelector('.dot');
      labelEl.innerHTML = '';
      if (dot) labelEl.appendChild(dot);
      labelEl.appendChild(document.createTextNode(` ${group.label}`));
    }

    // Update score
    const scoreEl = item.querySelector('.score');
    if (scoreEl) scoreEl.textContent = `${groupAvg}%`;
  });

  // ── UPDATE QUIZZES STAT CARD META (best score) ───────────
  const quizzesCard = document.querySelector('.stat-card.folder-card[data-folder="quizzes"]');
  if (quizzesCard) {
    const metaEl = quizzesCard.querySelector('.meta');
    if (metaEl) {
      const allBest = Object.values(bestScores);
      if (allBest.length === 0) {
        metaEl.textContent = 'No quizzes taken yet';
      } else {
        const best = Math.max(...allBest);
        metaEl.textContent = `Best score: ${best}%`;
      }
    }
  }

});