// ============================================================
// BioLearn — Quiz Logic (quiz.js)
// Handles: fetch 10 random questions, render quiz, save attempt
// ============================================================
// Assumes: supabase client is already initialized as `supabase`
// and the lesson id is known (hardcoded below for the test lesson,
// replace with a dynamic value later when routing is set up)
// ============================================================

// ------------------------------------------------------------
// CONFIG — swap LESSON_ID after seeding your lessons table
// ------------------------------------------------------------
const LESSON_ID = 'e43f6bee-bcff-4692-b5e2-396b4176eacd'; // from lessons table
const QUESTIONS_PER_SESSION = 10;

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
let sessionQuestions = [];   // the 10 fetched question objects
let currentIndex = 0;
let selectedChoiceId = null;
let answers = [];            // { question_id, selected_choice_id, is_correct }
let attemptId = null;        // uuid of the current quiz_attempt row

// ------------------------------------------------------------
// STEP 1: Fetch all question IDs for the lesson,
//         shuffle, pick 10, then fetch full question+choices data
// ------------------------------------------------------------
async function loadQuiz() {
  // 1a. Get all question ids for this lesson
  const { data: allQuestions, error: qErr } = await supabase
    .from('questions')
    .select('id')
    .eq('lesson_id', LESSON_ID);

  if (qErr || !allQuestions.length) {
    console.error('Failed to load questions:', qErr);
    return;
  }

  // 1b. Shuffle and pick 10
  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, QUESTIONS_PER_SESSION);
  const pickedIds = picked.map(q => q.id);

  // 1c. Fetch full question text + choices for the 10 picked
  const { data: questions, error: fullErr } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      choices (
        id,
        choice_text,
        is_correct
      )
    `)
    .in('id', pickedIds);

  if (fullErr || !questions.length) {
    console.error('Failed to load question details:', fullErr);
    return;
  }

  // Shuffle choices per question so correct answer isn't always first
  sessionQuestions = questions.map(q => ({
    ...q,
    choices: q.choices.sort(() => Math.random() - 0.5)
  }));

  currentIndex = 0;
  selectedChoiceId = null;
  answers = [];
  attemptId = null;

  renderQuestion();
}

// ------------------------------------------------------------
// STEP 2: Render the current question card
// ------------------------------------------------------------
function renderQuestion() {
  const q = sessionQuestions[currentIndex];

  // Update progress label
  document.querySelector('.quiz-progress').textContent =
    `QUESTION ${currentIndex + 1} OF ${QUESTIONS_PER_SESSION}`;

  // Update progress bar
  const pct = ((currentIndex) / QUESTIONS_PER_SESSION) * 100;
  document.querySelector('.progress-bar-fill').style.width = `${pct}%`;

  // Update question text
  document.querySelector('.quiz-question-text').textContent = q.question_text;

  // Render choices
  const choicesContainer = document.querySelector('.quiz-choices');
  choicesContainer.innerHTML = '';
  selectedChoiceId = null;

  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.choice_text;
    btn.dataset.choiceId = choice.id;
    btn.dataset.isCorrect = choice.is_correct;

    btn.addEventListener('click', () => handleChoiceSelect(btn, q.choices));
    choicesContainer.appendChild(btn);
  });

  // Next button state
  const nextBtn = document.querySelector('.quiz-next-btn');
  nextBtn.disabled = true;
  nextBtn.textContent =
    currentIndex === QUESTIONS_PER_SESSION - 1 ? 'Submit →' : 'Next →';
}

// ------------------------------------------------------------
// STEP 3: Handle choice selection
// ------------------------------------------------------------
function handleChoiceSelect(selectedBtn, choices) {
  // Clear previous selection
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.classList.remove('selected');
  });

  selectedBtn.classList.add('selected');
  selectedChoiceId = selectedBtn.dataset.choiceId;

  // Enable next/submit button
  document.querySelector('.quiz-next-btn').disabled = false;
}

// ------------------------------------------------------------
// STEP 4: Next button — record answer, advance or submit
// ------------------------------------------------------------
document.querySelector('.quiz-next-btn').addEventListener('click', async () => {
  if (!selectedChoiceId) return;

  const q = sessionQuestions[currentIndex];
  const selectedChoice = q.choices.find(c => c.id === selectedChoiceId);

  // Record this answer
  answers.push({
    question_id: q.id,
    selected_choice_id: selectedChoiceId,
    is_correct: selectedChoice.is_correct
  });

  if (currentIndex < QUESTIONS_PER_SESSION - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    await submitQuiz();
  }
});

// ------------------------------------------------------------
// STEP 5: Submit — save attempt + details to Supabase
// ------------------------------------------------------------
async function submitQuiz() {
  const score = answers.filter(a => a.is_correct).length;

  // 5a. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('No authenticated user found.');
    return;
  }

  // 5b. Insert quiz_attempt row
  const { data: attempt, error: attemptErr } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      lesson_id: LESSON_ID,
      score: score
    })
    .select()
    .single();

  if (attemptErr || !attempt) {
    console.error('Failed to save attempt:', attemptErr);
    return;
  }

  attemptId = attempt.id;

  // 5c. Insert one row per question into quiz_attempt_details
  const details = answers.map(a => ({
    attempt_id: attemptId,
    question_id: a.question_id,
    selected_choice_id: a.selected_choice_id,
    is_correct: a.is_correct
  }));

  const { error: detailsErr } = await supabase
    .from('quiz_attempt_details')
    .insert(details);

  if (detailsErr) {
    console.error('Failed to save attempt details:', detailsErr);
    return;
  }

  // 5d. Show results
  showResults(score);
}

// ------------------------------------------------------------
// STEP 6: Results screen
// ------------------------------------------------------------
function showResults(score) {
  document.querySelector('.quiz-card').innerHTML = `
    <div class="quiz-results">
      <p class="quiz-progress">QUIZ COMPLETE</p>
      <h2 class="quiz-score">${score} / ${QUESTIONS_PER_SESSION}</h2>
      <p class="quiz-score-label">${getScoreLabel(score)}</p>
      <button class="quiz-next-btn" onclick="loadQuiz()">Try Again →</button>
    </div>
  `;

  // Re-attach next btn listener won't work after innerHTML swap,
  // so the onclick above calls loadQuiz() directly.
}

function getScoreLabel(score) {
  if (score === 10) return '🎉 Perfect score! Cell Division unlocked.';
  if (score >= 7)  return 'Great job! Keep reviewing to get a perfect score.';
  if (score >= 5)  return 'Good effort. Review the lesson and try again.';
  return 'Keep studying — you\'ve got this!';
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for auth session before fetching questions
  const client = window.ecoAuth?.client;
  if (client) {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      loadingPanel.querySelector('p').textContent = 'Please log in to take the quiz.';
      return;
    }
  }
  loadQuiz();
});