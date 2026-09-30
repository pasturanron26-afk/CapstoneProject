/* =====================================================
   ECOLEARN — ADMIN DASHBOARD LOGIC
   Implements the "Administration Management" branch of the
   system functional diagram:
     - View Student Information
     - View Individual Student Progress
     - View Student Quiz Performance
     - View Overall Statistics
     - Manage Student Accounts
     - Archive Inactive Students

   NOTE ON DATA: student records now come from a real query
   against the `profiles` table (role = 'student'), populated
   by newly signed-up accounts via the on_auth_user_created
   trigger. This requires the "Admins can read all profiles"
   RLS policy (see add-section-column.sql) to already be
   applied — without it, this query silently returns 0 rows
   for anyone other than the admin's own profile.

   Quiz scores now come from a real query against the
   `quiz_attempts` table (same table quiz-animal-plant.html
   and dashboard.html write to / read from). This requires an
   "Admins can read all quiz_attempts" RLS policy — without it
   this query silently returns 0 rows, exactly like the profiles
   issue above, so every student will keep showing "No quiz
   attempts recorded yet." until that policy is applied.

   Module/lesson *progress* is still NOT wired up — there is no
   `lesson_progress` schema yet, so every real student still
   shows 0 modules completed until that's built.

   Archive/Manage actions now persist to Supabase (profiles.archived
   / profiles.status), via persistProfileUpdate(). This requires
   an "Admins can update any profile" RLS policy (see
   persist-archive-status.sql) — without it every archive/restore/
   manage save fails with a visible alert (it no longer fails
   silently the way the old local-only version did).

   "Last active" / online-offline status comes from
   profiles.last_seen_at, updated by a heartbeat in js/auth.js
   (see add-last-seen-heartbeat.sql) — not from quiz activity.

   NOTE ON NAVIGATION: Overview / Students / Archived are no
   longer separate hidden panels — all three stay on the page
   and the sidebar links smooth-scroll to them (see
   setActiveView + the IntersectionObserver scroll-spy below).
===================================================== */

const MODULE_NAMES = [
    'Cell Structure Basics', 'Cell Functions', 'Plant vs Animal Cells',
    'DNA and Genetic Code', 'Cell Division', 'Cellular Energy',
    'Transport Systems', 'Tissue Organization', 'Special Cells',
    'Microscopy', 'Lab Review', 'Final Assessment'
];

// Same lesson_id -> display name mapping dashboard.html uses
// (LESSON_IDS there, inverted here) so admin sees real quiz names
// instead of made-up ones.
const LESSON_NAMES = {
    'e43f6bee-bcff-4692-b5e2-396b4176eacd': 'Animal Cell vs Plant Cell',
    'fc3f6b43-fb9d-420d-9060-9529ba395621': 'Mitosis of Plant and Animal Cells',
    '46254ff2-c787-4792-94db-5d33181f6b55': 'Cell Membrane and Transport',
    '1b15a414-7e6c-4992-b17c-1c924745366d': 'Cell Respiration',
    '81ece535-7d0b-47e9-a95a-ed8e0f25cc76': 'Photosynthesis',
    '26dc1e4f-4a8b-45fc-8e12-ab7fd326eea1': 'Cell Cycle and Cancer',
    '5149863c-8971-49ef-afa2-085cec2f3d1e': 'Cell Differentiation and Specialization',
    '5347853d-6f4b-43b2-b7b6-9e941fe6ebe9': 'Cell Signaling and Communication',
};

// Fetch every quiz_attempts row (all students) and group by user_id.
// Requires the "Admins can read all quiz_attempts" RLS policy — see
// grant-admin-quiz-attempts.sql.
// Set when fetchQuizAttemptsByUser hits a real Supabase error (bad
// column, RLS block that returns an error, etc.) so the UI can tell
// "query failed" apart from "this student truly has no attempts".
let QUIZ_LOAD_ERROR = null;

async function fetchQuizAttemptsByUser() {
    const { data, error } = await ecoAuth.client
        .from('quiz_attempts')
        .select('user_id, lesson_id, score, taken_at')
        .order('taken_at', { ascending: true });

    if (error) {
        console.error('Failed to load quiz attempts from Supabase:', error.message);
        QUIZ_LOAD_ERROR = error.message;
        return {};
    }

    QUIZ_LOAD_ERROR = null;
    const byUser = {};
    (data || []).forEach(row => {
        if (!byUser[row.user_id]) byUser[row.user_id] = [];
        byUser[row.user_id].push(row);
    });
    return byUser;
}

// Collapse one student's raw attempts into one row per lesson:
// best score, retake count, and most recent attempt date (taken_at).
function summarizeQuizzes(attempts) {
    const byLesson = {};
    attempts.forEach(a => {
        const pct = Math.round((a.score / 10) * 100);
        const existing = byLesson[a.lesson_id];
        if (!existing) {
            byLesson[a.lesson_id] = { score: pct, retakes: 0, date: a.taken_at || null };
        } else {
            existing.retakes += 1;
            if (pct > existing.score) existing.score = pct;
            if (a.taken_at && (!existing.date || a.taken_at > existing.date)) {
                existing.date = a.taken_at;
            }
        }
    });

    return Object.entries(byLesson).map(([lessonId, info]) => ({
        name: LESSON_NAMES[lessonId] || 'Quiz',
        score: info.score,
        retakes: info.retakes,
        date: info.date ? info.date.slice(0, 10) : '—'
    }));
}

// How long with no heartbeat before we call a student "offline".
// Heartbeats fire every 60s (see js/auth.js), so this gives some
// slack for network hiccups before flipping the dot to gray.
const OFFLINE_AFTER_MS = 2 * 60 * 1000;

// Turns a profiles.last_seen_at timestamp into display text + an
// online flag. Null (no heartbeat ever recorded — e.g. an account
// backfilled before this feature existed, or one that's never
// loaded a page since) reads as "Not yet active", not a fake date.
function formatLastSeen(lastSeenAt) {
    if (!lastSeenAt) return { text: 'Not yet active', online: false, minutesAgo: Infinity };

    const ms = Date.now() - new Date(lastSeenAt).getTime();
    const minutesAgo = Math.max(0, Math.floor(ms / 60000));

    if (ms <= OFFLINE_AFTER_MS) return { text: 'Active now', online: true, minutesAgo };
    if (minutesAgo < 60) return { text: `Active ${minutesAgo}m ago`, online: false, minutesAgo };

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return { text: `Active ${hoursAgo}h ago`, online: false, minutesAgo };

    const daysAgoVal = Math.floor(hoursAgo / 24);
    return { text: `Active ${daysAgoVal}d ago`, online: false, minutesAgo };
}

let STUDENT_LOAD_ERROR = null;

async function fetchStudents() {
    if (!window.ecoAuth) return [];

    const { data, error } = await ecoAuth.client
        .from('profiles')
        .select('id, full_name, email, section, role, created_at, last_seen_at, archived, status')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to load students from Supabase:', error.message);
        STUDENT_LOAD_ERROR = error.message;
        return [];
    }
    STUDENT_LOAD_ERROR = null;

    const attemptsByUser = await fetchQuizAttemptsByUser();

    return (data || []).map((row, idx) => {
        const joined = row.created_at ? row.created_at.slice(0, 10) : '—';
        const attempts = attemptsByUser[row.id] || [];
        const quizzes = summarizeQuizzes(attempts);
        const avgScore = quizzes.length
            ? Math.round(quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length)
            : null;

        const presence = formatLastSeen(row.last_seen_at);

        return {
            id: row.id,
            catalogNo: String(idx + 1).padStart(3, '0'),
            name: row.full_name || row.email || 'Unnamed student',
            email: row.email || '—',
            section: row.section || 'Unassigned',
            joined,
            lastActive: presence.text,
            lastActiveDaysAgo: presence.minutesAgo === Infinity ? Infinity : Math.floor(presence.minutesAgo / 1440),
            lastActiveMinutesAgo: presence.minutesAgo,
            isOnline: presence.online,
            modulesCompleted: 0,
            moduleProgress: MODULE_NAMES.map(name => ({ name, percent: 0 })),
            quizzes,
            avgScore,
            status: row.status || 'active',
            archived: !!row.archived
        };
    });
}

let STUDENTS = [];
let currentFilter = { search: '', status: 'all', section: 'all' };

/* ===================== HELPERS ===================== */

// Names/emails come from user-editable profile rows and are injected via
// innerHTML below, so every interpolated value goes through esc().
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initialsOf = (name) => (name || '?').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
const scoreClass = (pct) => pct >= 85 ? 'good' : (pct >= 70 ? 'ok' : 'low');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function showToast(message, { actionLabel, onAction, error = false } = {}) {
    const region = document.getElementById('toastRegion');
    const toast = document.createElement('div');
    toast.className = 'ad-toast' + (error ? ' is-error' : '');
    toast.setAttribute('role', error ? 'alert' : 'status');
    toast.innerHTML = `<span>${esc(message)}</span>`;
    const remove = () => toast.remove();
    if (actionLabel) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = actionLabel;
        btn.addEventListener('click', () => { remove(); onAction && onAction(); });
        toast.appendChild(btn);
    }
    region.appendChild(toast);
    setTimeout(remove, error ? 8000 : 7000);
}

function getSectionStudents() {
    return currentFilter.section === 'all' ? STUDENTS : STUDENTS.filter(s => s.section === currentFilter.section);
}

function updateSectionSubtitle() {
    const subtitle = document.getElementById('sectionSubtitle');
    if (!subtitle) return;
    subtitle.textContent = currentFilter.section === 'all'
        ? 'Records for every student enrolled in the biology course.'
        : `Records for Section ${currentFilter.section} of the biology course.`;
}

/* ===================== RENDER: OVERVIEW ===================== */

// Buckets for the "last active" spectrum. Order = left to right on the bar.
const PULSE_BUCKETS = [
    { key: 'online',  label: 'Online now',        color: '#1E7245', test: s => s.isOnline },
    { key: 'today',   label: 'Today',             color: '#52B788', test: s => !s.isOnline && s.lastActiveMinutesAgo < 1440 },
    { key: 'week',    label: 'This week',         color: '#A9D9BE', test: s => s.lastActiveMinutesAgo >= 1440 && s.lastActiveMinutesAgo < 10080 },
    { key: 'dormant', label: '7+ days ago',       color: '#E0B75A', test: s => Number.isFinite(s.lastActiveMinutesAgo) && s.lastActiveMinutesAgo >= 10080 },
    { key: 'never',   label: 'Not yet active',    color: '#C4D2C9', test: s => !Number.isFinite(s.lastActiveMinutesAgo) }
];
let pulseAnimated = false;

function renderPulse(list) {
    const bar = document.getElementById('pulseBar');
    const legend = document.getElementById('pulseLegend');
    const note = document.getElementById('pulseNote');
    const counts = PULSE_BUCKETS.map(b => ({ ...b, n: list.filter(b.test).length }));

    bar.innerHTML = counts.filter(c => c.n).map(c =>
        `<i style="flex:${c.n};background:${c.color}" title="${esc(c.label)}: ${c.n}"></i>`).join('');
    bar.classList.toggle('is-first', !pulseAnimated && list.length > 0);
    if (list.length) pulseAnimated = true;
    bar.setAttribute('aria-label', list.length
        ? 'Last active: ' + counts.map(c => `${c.n} ${c.label.toLowerCase()}`).join(', ')
        : 'No students to show');

    legend.innerHTML = counts.map(c =>
        `<li><span class="ad-swatch" style="background:${c.color}"></span>${esc(c.label)} <b>${c.n}</b></li>`).join('');

    const dormant = counts.find(c => c.key === 'dormant').n + counts.find(c => c.key === 'never').n;
    note.textContent = dormant ? `${dormant} student${dormant === 1 ? '' : 's'} not active in the past week` : '';
}

function renderOverview() {
    const scoped = getSectionStudents();
    const live = scoped.filter(s => !s.archived);
    const active = live.filter(s => s.status === 'active');
    const inactive = live.filter(s => s.status === 'inactive');
    const archived = scoped.filter(s => s.archived);
    const scored = scoped.filter(s => s.avgScore !== null);
    const avgOverall = scored.length ? Math.round(scored.reduce((sum, s) => sum + s.avgScore, 0) / scored.length) : 0;

    document.getElementById('statTotalStudents').textContent = live.length;
    document.getElementById('statActiveStudents').textContent = active.length;
    document.getElementById('statAvgScore').textContent = scored.length ? `${avgOverall}%` : '—';
    document.getElementById('statArchived').textContent = archived.length;
    document.getElementById('statInactiveMeta').textContent = `${inactive.length} marked inactive`;
    document.getElementById('navStudentCount').textContent = live.length;
    document.getElementById('navArchivedCount').textContent = archived.length;

    renderPulse(live);

    const top = live.filter(s => s.avgScore !== null).sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
    document.getElementById('topPerformersList').innerHTML = top.length
        ? top.map((s, i) => `
            <li>
                <span class="ad-pos">${i + 1}</span>
                <span class="ad-name">${esc(s.name)}</span>
                <span class="ad-pct">${s.avgScore}%</span>
                <div class="ad-bar" aria-hidden="true"><span style="width:${s.avgScore}%"></span></div>
            </li>`).join('')
        : '<li class="ad-empty-note" style="display:block;border:0">No quiz attempts yet. Scores appear here once students take a quiz.</li>';

    const recent = [...live].sort((a, b) => a.lastActiveMinutesAgo - b.lastActiveMinutesAgo).slice(0, 6);
    document.getElementById('activityFeed').innerHTML = recent.length
        ? recent.map(s => `
            <li>
                <span class="ad-avatar ${s.isOnline ? 'is-online' : ''}" aria-hidden="true">${esc(initialsOf(s.name))}</span>
                <div class="ad-who">
                    <span class="ad-name">${esc(s.name)}</span>
                    <span class="ad-meta">${esc(s.lastActive)}</span>
                </div>
                ${s.isOnline ? '<span class="ad-online-tag">Online</span>' : ''}
            </li>`).join('')
        : '<li class="ad-empty-note" style="display:block;border:0">No students yet.</li>';
}

/* ===================== RENDER: TABLES ===================== */

function studentCell(s) {
    return `
        <div class="ad-student">
            <span class="ad-avatar ${s.isOnline ? 'is-online' : ''}" aria-hidden="true">${esc(initialsOf(s.name))}</span>
            <div>
                <span class="ad-name">${esc(s.name)}</span>
                <span class="ad-email">${esc(s.email)}</span>
            </div>
        </div>`;
}

const sectionTag = (s) => s.section === 'Unassigned'
    ? '<span class="ad-tag is-none">Unassigned</span>'
    : `<span class="ad-tag">${esc(s.section)}</span>`;
const scoreCell = (s) => s.avgScore !== null
    ? `<span class="ad-score ${scoreClass(s.avgScore)}">${s.avgScore}%</span>` : '<span class="ad-dim">—</span>';
const modulesCell = (s) => `<div class="ad-mod"><span>${s.modulesCompleted}/12</span><div class="ad-bar" aria-hidden="true"><span style="width:${(s.modulesCompleted / 12) * 100}%"></span></div></div>`;

function emptyRow(cols, html) {
    return `<tr><td colspan="${cols}" class="ad-empty">${html}</td></tr>`;
}

function getFilteredStudents() {
    return getSectionStudents().filter(s => {
        if (s.archived) return false;
        const q = currentFilter.search;
        const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
        const matchesStatus = currentFilter.status === 'all' || s.status === currentFilter.status;
        return matchesSearch && matchesStatus;
    });
}

function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    const rows = getFilteredStudents();
    document.getElementById('studentCountBadge').textContent = `${rows.length} student${rows.length === 1 ? '' : 's'}`;

    if (STUDENT_LOAD_ERROR) {
        tbody.innerHTML = emptyRow(8, `<p>Couldn't load students. Check your connection, then try again.</p><button class="ad-btn" type="button" data-action="retry">Try again</button>`);
        return;
    }
    if (!rows.length) {
        const filtered = currentFilter.search || currentFilter.status !== 'all';
        tbody.innerHTML = emptyRow(8, filtered
            ? `<p>No students match these filters.</p><button class="ad-btn" type="button" data-action="clear-filters">Clear filters</button>`
            : `<p>No students yet. Accounts appear here as soon as students sign up.</p>`);
        return;
    }

    tbody.innerHTML = rows.map(s => `
        <tr>
            <td>${studentCell(s)}</td>
            <td>${sectionTag(s)}</td>
            <td class="ad-dim">${esc(s.joined)}</td>
            <td>${modulesCell(s)}</td>
            <td>${scoreCell(s)}</td>
            <td><span class="ad-badge ${esc(s.status)}">${esc(s.status)}</span></td>
            <td><span class="ad-presence ${s.isOnline ? 'is-online' : ''}">${esc(s.lastActive)}</span></td>
            <td>
                <div class="ad-actions">
                    <button class="ad-btn" type="button" data-action="progress" data-id="${esc(s.id)}">Progress</button>
                    <button class="ad-btn" type="button" data-action="quiz" data-id="${esc(s.id)}">Quiz</button>
                    <button class="ad-btn" type="button" data-action="manage" data-id="${esc(s.id)}">Manage</button>
                    <button class="ad-btn ad-btn-danger is-icon" type="button" data-action="archive" data-id="${esc(s.id)}" aria-label="Archive ${esc(s.name)}" title="Archive"><i class="bi bi-archive" aria-hidden="true"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

function renderArchivedTable() {
    const tbody = document.getElementById('archivedTableBody');
    const rows = getSectionStudents().filter(s => s.archived);
    document.getElementById('archivedCountBadge').textContent = `${rows.length} archived`;

    if (!rows.length) {
        tbody.innerHTML = emptyRow(6, '<p>No archived accounts. Students you archive show up here and can be restored any time.</p>');
        return;
    }
    tbody.innerHTML = rows.map(s => `
        <tr>
            <td>${studentCell(s)}</td>
            <td>${sectionTag(s)}</td>
            <td class="ad-dim">${esc(s.lastActive)}</td>
            <td>${modulesCell(s)}</td>
            <td>${scoreCell(s)}</td>
            <td><div class="ad-actions"><button class="ad-btn" type="button" data-action="restore" data-id="${esc(s.id)}">Restore</button></div></td>
        </tr>`).join('');
}

function renderAll() {
    renderOverview();
    renderStudentTable();
    renderArchivedTable();
}

/* ===================== NAVIGATION (scroll + scroll-spy) ===================== */

function markActive(view) {
    document.querySelectorAll('.sidebar-bg .nav-link[data-view]').forEach(el => {
        const on = el.dataset.view === view;
        el.classList.toggle('active', on);
        if (on) el.setAttribute('aria-current', 'location'); else el.removeAttribute('aria-current');
    });
}

function setActiveView(view) {
    const section = document.querySelector(`.ad-view[data-view="${view}"]`);
    if (section) section.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    markActive(view);
}

// Highlights the last section whose top has passed the sticky topbar; at the
// very bottom of the page it always picks the last section, so a short
// Archived list can still become "active".
function setupScrollSpy() {
    const sections = Array.from(document.querySelectorAll('.ad-view'));
    let ticking = false;
    const update = () => {
        ticking = false;
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        let current = sections[0];
        sections.forEach(sec => { if (sec.getBoundingClientRect().top <= 140) current = sec; });
        if (atBottom) current = sections[sections.length - 1];
        markActive(current.dataset.view);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

/* ===================== MODALS ===================== */

let lastFocused = null;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

function openModal(id) {
    const modal = document.getElementById(id);
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    const first = modal.querySelector('.ad-dialog-body input:not([type="hidden"]), .ad-dialog-head button');
    first?.focus();
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

// Keep Tab inside the open dialog.
function trapFocus(e) {
    const modal = document.querySelector('.ad-modal.is-open');
    if (!modal || e.key !== 'Tab') return;
    const items = Array.from(modal.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function openProgressModal(student) {
    document.getElementById('progressModalName').textContent = student.name;
    const none = student.moduleProgress.every(m => m.percent === 0);
    document.getElementById('progressModalMeta').textContent =
        `${student.modulesCompleted} of 12 modules completed · Joined ${student.joined}` + (none ? ' · No module progress recorded yet' : '');
    document.getElementById('progressModuleList').innerHTML = student.moduleProgress.map(m => `
        <div class="ad-prog">
            <div class="ad-prog-label"><span>${esc(m.name)}</span><span>${m.percent}%</span></div>
            <div class="ad-bar" aria-hidden="true"><span style="width:${m.percent}%"></span></div>
        </div>`).join('');
    openModal('progressModal');
}

function openQuizModal(student) {
    document.getElementById('quizModalName').textContent = student.name;
    document.getElementById('quizModalMeta').textContent = student.avgScore !== null
        ? `Average score ${student.avgScore}% across ${student.quizzes.length} quiz${student.quizzes.length === 1 ? '' : 'zes'}`
        : (QUIZ_LOAD_ERROR ? `Couldn't load quiz data: ${QUIZ_LOAD_ERROR}` : 'No quiz attempts recorded yet.');

    const body = document.getElementById('quizModalTableBody');
    body.innerHTML = student.quizzes.length
        ? student.quizzes.map(q => `
            <tr>
                <td>${esc(q.name)}</td>
                <td><span class="ad-score ${scoreClass(q.score)}">${q.score}%</span></td>
                <td>${q.retakes}</td>
                <td class="ad-dim">${esc(q.date)}</td>
            </tr>`).join('')
        : emptyRow(4, QUIZ_LOAD_ERROR ? `Couldn't load quiz data — ${esc(QUIZ_LOAD_ERROR)}` : 'No quiz attempts yet.');
    openModal('quizModal');
}

function openManageModal(student) {
    const sectionSel = document.getElementById('manageModalSection');
    const current = student.section === 'Unassigned' ? '' : student.section;
    if (current && !Array.from(sectionSel.options).some(o => o.value === current)) {
        sectionSel.add(new Option(current, current));
    }
    document.getElementById('manageModalId').value = student.id;
    document.getElementById('manageModalName').value = student.name;
    document.getElementById('manageModalEmail').value = student.email;
    document.getElementById('manageModalStatus').value = student.status;
    sectionSel.value = current;
    openModal('manageModal');
}

/* ===================== ACTIONS ===================== */

const findStudent = (id) => STUDENTS.find(s => s.id === id);

// Writes a partial change to this student's profiles row. Returns true on
// success; on failure local state is left untouched and the admin is told why.
async function persistProfileUpdate(id, patch) {
    const { error } = await ecoAuth.client.from('profiles').update(patch).eq('id', id);
    if (error) {
        console.error('Failed to save change to Supabase:', error.message);
        showToast(`Couldn't save that change: ${error.message}`, { error: true });
        return false;
    }
    return true;
}

async function archiveStudent(student) {
    if (!(await persistProfileUpdate(student.id, { archived: true }))) return;
    student.archived = true;
    renderAll();
    showToast(`${student.name} archived`, { actionLabel: 'Undo', onAction: () => restoreStudent(student, true) });
}

async function restoreStudent(student, quiet) {
    if (!(await persistProfileUpdate(student.id, { archived: false }))) return;
    student.archived = false;
    renderAll();
    if (!quiet) showToast(`${student.name} restored`);
}

function clearFilters() {
    currentFilter.search = '';
    currentFilter.status = 'all';
    document.getElementById('studentSearch').value = '';
    document.getElementById('topbarSearch').value = '';
    document.getElementById('statusFilter').value = 'all';
    renderStudentTable();
}

async function reloadStudents() {
    STUDENTS = await fetchStudents();
    renderAll();
}

function handleTableClick(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'retry') return reloadStudents();
    if (action === 'clear-filters') return clearFilters();

    const student = findStudent(id);
    if (!student) return;
    if (action === 'progress') openProgressModal(student);
    if (action === 'quiz') openQuizModal(student);
    if (action === 'manage') openManageModal(student);
    if (action === 'archive') archiveStudent(student);
    if (action === 'restore') restoreStudent(student);
}

async function handleManageFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('manageModalId').value;
    const student = findStudent(id);
    if (!student) return;

    const name = document.getElementById('manageModalName').value.trim() || student.name;
    const email = document.getElementById('manageModalEmail').value.trim() || student.email;
    const status = document.getElementById('manageModalStatus').value;
    const section = document.getElementById('manageModalSection').value;

    if (!(await persistProfileUpdate(id, { full_name: name, email, status, section: section || null }))) return;

    Object.assign(student, { name, email, status, section: section || 'Unassigned' });
    closeModal('manageModal');
    renderAll();
    showToast(`Saved changes to ${name}`);
}

async function handleManageDeactivate() {
    const student = findStudent(document.getElementById('manageModalId').value);
    if (!student) return;
    closeModal('manageModal');
    archiveStudent(student);
}

/* ===================== INIT ===================== */

const greetingForNow = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening'); };
const signature = (list) => JSON.stringify(list.map(s => [s.id, s.name, s.email, s.section, s.status, s.archived, s.lastActive, s.avgScore, s.quizzes.length]));

async function loadAdminIdentity() {
    try {
        const { data } = await ecoAuth.client.auth.getSession();
        const user = data?.session?.user;
        if (!user) return;
        let displayName = user.user_metadata?.full_name || user.email || 'Admin';
        try {
            const { data: prof } = await ecoAuth.client.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
            if (prof?.full_name) displayName = prof.full_name;
        } catch (e) { /* fall back to auth metadata */ }

        const first = displayName.includes('@') ? displayName.split('@')[0] : displayName.trim().split(/\s+/)[0];
        document.getElementById('adminName').textContent = first;
        const avatar = document.getElementById('topbarAvatar');
        avatar.textContent = initialsOf(displayName.includes('@') ? first : displayName);
        avatar.title = displayName;
    } catch (e) { /* keep default label */ }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('greeting').textContent = greetingForNow();

    if (window.ecoAuth) {
        await ecoAuth.requireAdmin();
        await loadAdminIdentity();
        document.getElementById('logoutButton')?.addEventListener('click', () => window.ecoAuth.signOut());
    }

    STUDENTS = await fetchStudents();
    updateSectionSubtitle();
    renderAll();
    setupScrollSpy();

    // Live presence: refresh every 30s, but skip when the tab is hidden and
    // only re-render when something visible changed (keeps keyboard focus).
    let lastSig = signature(STUDENTS);
    setInterval(async () => {
        if (document.hidden) return;
        const fresh = await fetchStudents();
        const sig = signature(fresh);
        if (sig === lastSig) return;
        lastSig = sig;
        STUDENTS = fresh;
        renderAll();
    }, 30000);

    const topbarSearch = document.getElementById('topbarSearch');
    const studentSearch = document.getElementById('studentSearch');
    const onSearch = (value, other) => {
        currentFilter.search = value.trim().toLowerCase();
        other.value = value;
        renderStudentTable();
    };
    topbarSearch.addEventListener('input', e => onSearch(e.target.value, studentSearch));
    studentSearch.addEventListener('input', e => onSearch(e.target.value, topbarSearch));
    topbarSearch.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setActiveView('students'); } });

    document.querySelectorAll('.sidebar-bg .nav-link[data-view]').forEach(link => {
        link.addEventListener('click', e => { e.preventDefault(); setActiveView(link.dataset.view); });
    });

    document.getElementById('studentTableBody').addEventListener('click', handleTableClick);
    document.getElementById('archivedTableBody').addEventListener('click', handleTableClick);

    document.getElementById('statusFilter').addEventListener('change', e => {
        currentFilter.status = e.target.value;
        renderStudentTable();
    });
    document.getElementById('sectionSelect').addEventListener('change', e => {
        currentFilter.section = e.target.value;
        updateSectionSubtitle();
        renderAll();
    });

    document.getElementById('manageForm').addEventListener('submit', handleManageFormSubmit);
    document.getElementById('manageDeactivateBtn').addEventListener('click', handleManageDeactivate);
    document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => closeModal(el.dataset.closeModal)));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.ad-modal.is-open').forEach(m => closeModal(m.id));
        trapFocus(e);
        // "/" jumps to search, unless already typing in a field
        if (e.key === '/' && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
            e.preventDefault();
            topbarSearch.focus();
        }
    });

    document.getElementById('goToStudentsBtn')?.addEventListener('click', e => { e.preventDefault(); setActiveView('students'); });
});