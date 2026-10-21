/* =====================================================
   ECOLEARN — ADMIN DASHBOARD LOGIC
   Implements the "Administration Management" branch of the
   system functional diagram:
     - View Student Information
     - View Individual Student Progress / Quiz Performance
     - View Overall Statistics
     - Manage Student Accounts
     - Archive Inactive Students
     - Teachers (main admins only): add Zoology / Botany teachers, assign
       students. A teacher sees only the students who joined with their own
       codes; needs supabase-teachers.sql
     - Section Codes (generate / regenerate / disable / expire / delete
       the codes students paste on login.html to join a section; needs
       supabase-section-codes.sql)

   DATA (unchanged from the previous version)
   - Students come from `profiles` (role = 'student'). Needs the
     "Admins can read all profiles" RLS policy.
   - Quiz scores come from `quiz_attempts` (user_id, lesson_id,
     score, taken_at). Needs "Admins can read all quiz_attempts".
   - "Last active" / online dot come from profiles.last_seen_at,
     written by the heartbeat in js/auth.js.
   - Archive / Manage write to profiles.archived / profiles.status /
     full_name / email through persistProfileUpdate(). Needs the
     admin UPDATE policy + grant (persist-archive-status.sql).
   - Lesson reading progress comes from `lesson_progress` (user_id,
     lesson_key, sections_done, total_sections, completed_at,
     updated_at), written by js/lessonInteractions.js. Needs
     supabase-lesson-progress.sql, including its admin read policy.

   UI (new)
   - One view at a time (#overview / #students / #archived), so the
     browser Back button and deep links work.
   - Clicking a student opens a drawer (quiz results + account)
     instead of three separate modals and four buttons per row.
   - Everything typed by students (names, emails) is escaped before
     it goes into innerHTML.
===================================================== */

const MODULE_NAMES = [
    'Animal Cell vs Plant Cell', 'Mitosis of Plant and Animal Cells',
    'Cell Membrane and Transport', 'Cell Respiration', 'Photosynthesis'
];

// Same lesson_id -> display name mapping dashboard.html uses
// (LESSON_IDS there, inverted here). Key order = quiz order.
const LESSON_NAMES = {
    'e43f6bee-bcff-4692-b5e2-396b4176eacd': 'Animal Cell vs Plant Cell',
    'fc3f6b43-fb9d-420d-9060-9529ba395621': 'Mitosis of Plant and Animal Cells',
    '46254ff2-c787-4792-94db-5d33181f6b55': 'Cell Membrane and Transport',
    '1b15a414-7e6c-4992-b17c-1c924745366d': 'Cell Respiration',
    '81ece535-7d0b-47e9-a95a-ed8e0f25cc76': 'Photosynthesis',
};
const QUIZ_ORDER = Object.keys(LESSON_NAMES);

// Lesson pages, in study order. lesson_key is the page's file name in lower
// case, the same key js/lessonInteractions.js saves reading progress under.
const LESSON_PAGES = [
    { key: 'lessonmoduleone.html',              name: 'Animal Cell vs Plant Cell' },
    { key: 'lessonmodulemitosis.html',          name: 'Mitosis of Plant and Animal Cells' },
    { key: 'lesson-cell-membrane.html',         name: 'Cell Membrane and Transport' },
    { key: 'lesson-cell-differentiation.html',  name: 'Cell Differentiation and Specialization' },
    { key: 'lesson-photosynthesis.html',        name: 'Photosynthesis' }
];

const PASS_MARK = 75;                        // quiz cards say "75% to pass"
const STALE_AFTER_MINUTES = 7 * 24 * 60;     // "needs attention" after a week away
const OFFLINE_AFTER_MS = 2 * 60 * 1000;      // heartbeats fire every 60s (auth.js)
const REFRESH_EVERY_MS = 30 * 1000;

/* ===================== DATA LAYER ===================== */

// Set when a quiz_attempts query fails, so the UI can tell
// "query failed" apart from "this student has no attempts".
let QUIZ_LOAD_ERROR = null;
let STUDENTS_LOAD_ERROR = null;
let LESSON_LOAD_ERROR = null;
let LESSON_ROWS_TOTAL = 0;   // lesson_progress rows this admin can see, for all students

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

async function fetchLessonProgressByUser() {
    const { data, error } = await ecoAuth.client
        .from('lesson_progress')
        .select('user_id, lesson_key, sections_read, sections_done, total_sections, completed_at, updated_at');

    if (error) {
        console.error('Failed to load lesson progress from Supabase:', error.message);
        LESSON_LOAD_ERROR = error.message;
        return {};
    }
    LESSON_LOAD_ERROR = null;
    LESSON_ROWS_TOTAL = (data || []).length;

    const byUser = {};
    (data || []).forEach(row => {
        if (!byUser[row.user_id]) byUser[row.user_id] = {};
        byUser[row.user_id][row.lesson_key] = row;
    });
    return byUser;
}

// One entry per lesson page, in study order, for one student.
function summarizeLessons(rows) {
    return LESSON_PAGES.map(page => {
        const row = (rows || {})[page.key];
        const total = row ? Number(row.total_sections || 0) : 0;
        const arrayReadCount = Array.isArray(row?.sections_read) ? row.sections_read.length : 0;
        const rawDone = Number(row?.sections_done ?? 0) || 0;
        const read = row ? Math.min(Math.max(rawDone, arrayReadCount), total || Infinity) : 0;
        const complete = Boolean(row && row.completed_at);
        const percent = complete ? 100 : total ? Math.round((read / total) * 100) : 0;
        return {
            key: page.key,
            name: page.name,
            read: complete ? total : read,
            total,
            complete,
            started: complete || read > 0,
            percent,
            date: row && row.updated_at ? row.updated_at.slice(0, 10) : '—',
            completedDate: row && row.completed_at ? row.completed_at.slice(0, 10) : '—'
        };
    });
}

// One row per lesson: best score, attempt count, latest attempt date.
function summarizeQuizzes(attempts) {
    const byLesson = {};
    attempts.forEach(a => {
        const pct = Math.round((a.score / 10) * 100);
        const existing = byLesson[a.lesson_id];
        if (!existing) {
            byLesson[a.lesson_id] = { score: pct, attempts: 1, date: a.taken_at || null };
        } else {
            existing.attempts += 1;
            if (pct > existing.score) existing.score = pct;
            if (a.taken_at && (!existing.date || a.taken_at > existing.date)) {
                existing.date = a.taken_at;
            }
        }
    });
    return Object.entries(byLesson).map(([lessonId, info]) => ({
        lessonId,
        name: LESSON_NAMES[lessonId] || 'Quiz',
        score: info.score,
        attempts: info.attempts,
        retakes: info.attempts - 1,
        date: info.date ? info.date.slice(0, 10) : '—'
    }));
}

// Turns profiles.last_seen_at into display text + an online flag.
// Null (no heartbeat ever) reads as "Not yet active", not a fake date.
function formatLastSeen(lastSeenAt) {
    if (!lastSeenAt) return { text: 'Not yet active', online: false, minutesAgo: Infinity };
    const ms = Date.now() - new Date(lastSeenAt).getTime();
    const minutesAgo = Math.max(0, Math.floor(ms / 60000));
    if (ms <= OFFLINE_AFTER_MS) return { text: 'Active now', online: true, minutesAgo };
    if (minutesAgo < 60) return { text: `Active ${minutesAgo}m ago`, online: false, minutesAgo };
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return { text: `Active ${hoursAgo}h ago`, online: false, minutesAgo };
    const days = Math.floor(hoursAgo / 24);
    return { text: `Active ${days}d ago`, online: false, minutesAgo };
}

async function fetchStudents() {
    STUDENTS_LOAD_ERROR = null;
    if (!window.ecoAuth) {
        STUDENTS_LOAD_ERROR = 'The sign-in service did not load.';
        return [];
    }

    // Oldest first, so "No." is the enrolment order and never changes when
    // someone new signs up (it used to be a position in a newest-first list).
    let { data, error } = await ecoAuth.client
        .from('profiles')
        .select('id, full_name, email, avatar_url, section, teacher_id, role, created_at, last_seen_at, archived, status')
        .eq('role', 'student')
        .order('created_at', { ascending: true });

    // Keep the roster usable before the avatar_url migration is applied.
    if (error && /avatar_url|column/i.test(error.message || '')) {
        const fallback = await ecoAuth.client
            .from('profiles')
            .select('id, full_name, email, section, role, created_at, last_seen_at, archived, status')
            .eq('role', 'student')
            .order('created_at', { ascending: true });
        data = (fallback.data || []).map(row => ({ ...row, avatar_url: '' }));
        error = fallback.error;
    }

    if (error) {
        console.error('Failed to load students from Supabase:', error.message);
        STUDENTS_LOAD_ERROR = error.message;
        return [];
    }

    const [attemptsByUser, progressByUser] = await Promise.all([
        fetchQuizAttemptsByUser(),
        fetchLessonProgressByUser()
    ]);

    return (data || []).map((row, idx) => {
        const attempts = attemptsByUser[row.id] || [];
        const quizzes = summarizeQuizzes(attempts);
        const lessons = summarizeLessons(progressByUser[row.id]);
        const avgScore = quizzes.length
            ? Math.round(quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length)
            : null;
        const presence = formatLastSeen(row.last_seen_at);

        return {
            id: row.id,
            catalogNo: String(idx + 1).padStart(3, '0'),
            name: cleanText(row.full_name) || row.email || 'Unnamed student',
            email: row.email || '—',
            avatarUrl: cleanText(row.avatar_url),
            section: row.section || 'Unassigned',
            teacherId: row.teacher_id || null,
            joined: row.created_at ? row.created_at.slice(0, 10) : '—',
            lastActive: presence.text,
            lastActiveMinutesAgo: presence.minutesAgo,
            isOnline: presence.online,
            lessons,
            modulesCompleted: lessons.filter(l => l.complete).length,
            moduleProgress: lessons.map(l => ({ name: l.name, percent: l.percent })),
            quizzes,
            avgScore,
            status: row.status || 'active',
            archived: !!row.archived
        };
    });
}

/* ===================== WHO IS SIGNED IN + TEACHERS ===================== */

// Until supabase-teachers.sql has run, every admin behaves like a main admin
// (the old behaviour), so nothing breaks before the migration.
const ME = { id: null, ready: false, isMain: true, subject: '' };
const SUBJECT_LABEL = { zoology: 'Zoology', botany: 'Botany' };
const canManageTeachers = () => ME.ready && ME.isMain;

let TEACHERS = [];
let TEACHERS_LOAD_ERROR = null;

async function fetchTeachers() {
    if (!canManageTeachers()) return [];
    const { data, error } = await ecoAuth.client
        .from('profiles')
        .select('id, full_name, email, subject, is_main_admin')
        .eq('role', 'admin')
        .order('full_name', { ascending: true });

    if (error) {
        console.error('Failed to load teachers from Supabase:', error.message);
        TEACHERS_LOAD_ERROR = `Couldn't load teachers: ${error.message}`;
        return null;
    }
    TEACHERS_LOAD_ERROR = null;
    return (data || []).map(r => ({
        id: r.id,
        name: cleanText(r.full_name) || r.email || 'Unnamed',
        email: r.email || '',
        subject: r.subject || '',
        isMain: !!r.is_main_admin
    }));
}

// "Zoology · Maria Santos" for a teacher id (main admins only see other teachers).
function teacherLabel(id) {
    const t = id && TEACHERS.find(x => x.id === id);
    return t ? `${SUBJECT_LABEL[t.subject] || 'Main admin'} · ${t.name}` : '';
}

/* ===================== SECTION CODES: DATA ===================== */

let CODES = [];
let CODES_LOAD_ERROR = null;

function toCode(row) {
    return {
        id: row.id,
        code: row.code,
        section: row.section,
        active: !!row.is_active,
        expiresAt: row.expires_at || null,
        createdAt: row.created_at || null,
        teacherId: row.teacher_id || null,
        uses: Number(row.section_code_redemptions?.[0]?.count || 0)
    };
}

// 'active' | 'expired' | 'disabled'. Worked out at render time so a code
// flips to Expired on screen without a reload.
function codeStatus(c) {
    if (!c.active) return 'disabled';
    if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return 'expired';
    return 'active';
}

async function fetchSectionCodes() {
    const base = 'id, code, section, is_active, expires_at, created_at';
    const query = (cols) => ecoAuth.client
        .from('section_codes')
        .select(`${cols}, section_code_redemptions(count)`)
        .order('created_at', { ascending: false });

    let { data, error } = await query(`${base}, teacher_id`);
    // Before supabase-teachers.sql has run there is no teacher_id column.
    if (error && /teacher_id/i.test(error.message || '')) ({ data, error } = await query(base));

    if (error) {
        console.error('Failed to load section codes from Supabase:', error.message);
        CODES_LOAD_ERROR = /section_codes|schema cache|does not exist/i.test(error.message || '')
            ? 'Section codes are not set up yet. Run supabase-section-codes.sql in the Supabase SQL editor, then refresh.'
            : `Couldn't load section codes: ${error.message}`;
        return null;
    }
    CODES_LOAD_ERROR = null;
    return (data || []).map(toCode);
}

/* ===================== STATE ===================== */

let STUDENTS = [];

const state = {
    view: 'overview',
    section: 'all',
    filter: 'all',
    search: '',
    sort: { key: 'name', dir: 'asc' },
    loading: true,          // first fetch not finished
    loaded: false,          // at least one successful fetch
    loadError: null,
    refreshing: false,
    updatedAt: null,
    adminName: '',
    adminFirstName: ''
};

const drawer = { id: null, tab: 'quiz', opener: null };

const VIEWS = {
    overview: { title: 'Overview' },
    students: { title: 'Students' },
    codes: { title: 'Section codes' },
    teachers: { title: 'Teachers' },
    archived: { title: 'Archived students' }
};

// Filter chips on the Students view. Counts are computed per section.
function needsAttention(s) {
    return !s.archived && (
        s.status === 'inactive' ||
        !Number.isFinite(s.lastActiveMinutesAgo) ||
        s.lastActiveMinutesAgo >= STALE_AFTER_MINUTES
    );
}
const FILTERS = [
    { id: 'all',       label: 'All',             test: () => true },
    { id: 'online',    label: 'Online now',      test: s => s.isOnline },
    { id: 'attention', label: 'Needs attention', test: needsAttention }
];

/* ===================== HELPERS ===================== */

const el = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Every student-typed string that reaches innerHTML goes through this.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Drops the U+FFFD "replacement character" that a badly-encoded save leaves behind.
function cleanText(value) {
    return String(value ?? '').replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim();
}

function initialsOf(name) {
    const parts = cleanText(name).split(' ').filter(Boolean);
    if (!parts.length) return '?';
    const first = Array.from(parts[0])[0];
    const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
    return (first + last).toUpperCase();
}

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
}

function findStudent(id) {
    return STUDENTS.find(s => s.id === id);
}

function scopedStudents() {
    return state.section === 'all'
        ? STUDENTS
        : STUDENTS.filter(s => s.section === state.section);
}
const rosterStudents = () => scopedStudents().filter(s => !s.archived);
const archivedStudents = () => scopedStudents().filter(s => s.archived);

function cmpNum(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// Sorting for the roster. Missing scores always sort last, whatever the direction.
function sortStudents(list) {
    const { key, dir } = state.sort;
    const f = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        switch (key) {
            case 'section':
                return f * a.section.localeCompare(b.section, undefined, { numeric: true }) || byName(a, b);
            case 'quizzes':
                return f * cmpNum(a.quizzes.length, b.quizzes.length) || byName(a, b);
            case 'avg': {
                const an = a.avgScore === null, bn = b.avgScore === null;
                if (an || bn) return an && bn ? byName(a, b) : (an ? 1 : -1);
                return f * cmpNum(a.avgScore, b.avgScore) || byName(a, b);
            }
            case 'last':
                return f * cmpNum(a.lastActiveMinutesAgo, b.lastActiveMinutesAgo) || byName(a, b);
            default:
                return f * byName(a, b);
        }
    });
}

/* ----- small HTML builders (all inputs escaped) ----- */

function presenceHTML(s) {
    if (s.isOnline) {
        return '<span class="presence is-online"><span class="dot" aria-hidden="true"></span>Online now</span>';
    }
    const never = !Number.isFinite(s.lastActiveMinutesAgo);
    return `<span class="presence${never ? ' is-never' : ''}"><span class="dot" aria-hidden="true"></span>${escapeHtml(s.lastActive)}</span>`;
}

function sectionTagHTML(s) {
    return s.section === 'Unassigned'
        ? '<span class="unassigned">Unassigned</span>'
        : `<span class="tag">${escapeHtml(s.section)}</span>`;
}

function tallyHTML(taken) {
    const total = QUIZ_ORDER.length;
    let boxes = '';
    for (let i = 0; i < total; i++) boxes += `<i class="${i < taken ? 'on' : ''}"></i>`;
    return `<span class="tally" aria-hidden="true">${boxes}</span>`;
}

function quizzesCellHTML(s) {
    const n = Math.min(s.quizzes.length, QUIZ_ORDER.length);
    return `<span class="quizzes">${tallyHTML(n)}<span class="quizzes-text">${n} of ${QUIZ_ORDER.length}</span></span>`;
}

function scoreCellHTML(s) {
    if (s.avgScore === null) return '<span class="muted">No score yet</span>';
    const tone = s.avgScore >= PASS_MARK ? 'is-pass' : 'is-below';
    return `<span class="score"><span class="meter ${tone}" aria-hidden="true"><span style="width:${s.avgScore}%"></span></span><span class="score-num">${s.avgScore}%</span></span>`;
}

function avatarContentHTML(s) {
    const fallback = escapeHtml(initialsOf(s.name));
    return s.avatarUrl
        ? `<img src="${escapeHtml(s.avatarUrl)}" alt="" loading="lazy" onerror="this.hidden=true"><span class="avatar-initial">${fallback}</span>`
        : `<span class="avatar-initial">${fallback}</span>`;
}

function avatarHTML(s, large = false) {
    return `<span class="avatar${large ? ' avatar-lg' : ''}" aria-hidden="true">${avatarContentHTML(s)}</span>`;
}

function personRowHTML(s, subHTML, trailingHTML = '') {
    return `<li><button type="button" class="person" data-open="${escapeHtml(s.id)}" data-role="person">
        ${avatarHTML(s)}
        <span class="person-text">
            <span class="person-name">${escapeHtml(s.name)}</span>
            <span class="person-sub">${subHTML}</span>
        </span>
        ${trailingHTML}
    </button></li>`;
}

const emptyLine = (text) => `<li class="empty-line">${escapeHtml(text)}</li>`;
const skeletonLines = (n) => Array.from({ length: n }, () =>
    '<li class="skeleton-line" aria-hidden="true"><span class="skeleton"></span></li>').join('');

/* ===================== RENDER: CHROME ===================== */

function renderUpdated() {
    const node = el('updatedAt');
    if (!node) return;
    if (!state.updatedAt) { node.textContent = state.loading ? 'Loading…' : 'Not updated'; return; }
    const secs = Math.floor((Date.now() - state.updatedAt) / 1000);
    node.textContent = secs < 10 ? 'Updated just now'
        : secs < 60 ? `Updated ${secs}s ago`
        : `Updated ${Math.floor(secs / 60)} min ago`;
}

function setNavCount(id, n) {
    const node = el(id);
    if (!node) return;
    node.textContent = n;
    node.hidden = !state.loaded;
}

function renderNavCounts() {
    setNavCount('navCountStudents', rosterStudents().length);
    setNavCount('navCountArchived', archivedStudents().length);
}

function knownSections() {
    const set = new Set(['1-A', '1-B']);
    STUDENTS.forEach(s => {
        if (s.section && s.section !== 'Unassigned' && s.section !== '1-C') set.add(s.section);
    });
    const list = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (STUDENTS.some(s => s.section === 'Unassigned')) list.push('Unassigned');
    return list;
}

function renderSectionFilter() {
    const host = el('sectionFilter');
    const sections = ['all', ...knownSections()];
    if (!sections.includes(state.section)) state.section = 'all';

    // Rebuild only when the list of sections changes, so keyboard focus survives refreshes.
    const signature = sections.join('|');
    if (host.dataset.sig !== signature) {
        host.dataset.sig = signature;
        host.innerHTML = sections.map(v => {
            const label = v === 'all' ? 'All sections' : (v === 'Unassigned' ? 'Unassigned' : `Section ${v}`);
            return `<button type="button" class="chip" data-section="${escapeHtml(v)}">${escapeHtml(label)}</button>`;
        }).join('');
    }
    $$('.chip', host).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.section === state.section)));
}

function renderSubtitle() {
    const p = el('viewSubtitle');
    if (state.view === 'overview') {
        if (state.loading) { p.textContent = 'Loading class records…'; return; }
        if (!state.loaded) { p.textContent = 'Student records are unavailable right now.'; return; }
        const roster = rosterStudents();
        const online = roster.filter(s => s.isOnline).length;
        let scope;
        if (state.section === 'all') scope = `${plural(roster.length, 'student', 'students')} enrolled`;
        else if (state.section === 'Unassigned') scope = `${plural(roster.length, 'student', 'students')} without a section`;
        else scope = `${plural(roster.length, 'student', 'students')} in section ${state.section}`;
        const who = state.adminFirstName ? `, ${state.adminFirstName}` : '';
        p.textContent = `${greeting()}${who}. ${scope}${online ? `, ${online} online now` : ''}.`;
    } else if (state.view === 'students') {
        p.textContent = (ME.ready && !ME.isMain)
            ? 'Students who joined with your section codes. Select a student to see quiz results or manage their account.'
            : 'Everyone enrolled in the biology course. Select a student to see quiz results or manage their account.';
    } else if (state.view === 'codes') {
        p.textContent = (ME.ready && !ME.isMain)
            ? 'Make a code for a section and give it to your students. Everyone who joins with it becomes your student.'
            : 'Give each section its own code. Students paste it on the login page the first time they sign in and join that section automatically.';
    } else if (state.view === 'teachers') {
        p.textContent = 'Add Zoology and Botany teachers. Each teacher sees only the students who join with their own codes.';
    } else {
        p.textContent = 'Students set aside after prolonged inactivity. Restore an account to bring the student back.';
    }
}

function renderLoadError() {
    const box = el('loadError');
    let message = '';
    if (state.loadError && !state.loaded) {
        message = `Couldn't load students: ${state.loadError}. Check your connection, then try again.`;
    } else if (QUIZ_LOAD_ERROR) {
        message = `Students loaded, but quiz scores didn't: ${QUIZ_LOAD_ERROR}.`;
    }
    box.hidden = !message;
    el('loadErrorText').textContent = message;
}

/* ===================== RENDER: OVERVIEW ===================== */

function renderOverview() {
    const roster = rosterStudents();
    const ready = state.loaded;

    const online = roster.filter(s => s.isOnline).length;
    const activeWeek = roster.filter(s =>
        Number.isFinite(s.lastActiveMinutesAgo) && s.lastActiveMinutesAgo < STALE_AFTER_MINUTES).length;
    const scored = roster.filter(s => s.avgScore !== null);
    const avg = scored.length
        ? Math.round(scored.reduce((sum, s) => sum + s.avgScore, 0) / scored.length)
        : null;

    el('statTotalStudents').textContent = ready ? roster.length : '–';
    el('statTotalMeta').textContent = ready ? (online ? `${online} online now` : 'None online right now') : '\u00a0';
    el('statActiveWeek').textContent = ready ? activeWeek : '–';
    el('statActiveMeta').textContent = ready ? `of ${roster.length} enrolled` : '\u00a0';
    el('statAvgScore').textContent = ready && avg !== null ? `${avg}%` : '–';
    el('statAvgMeta').textContent = !ready ? '\u00a0'
        : avg === null ? 'No quiz results yet'
        : `From ${plural(scored.length, 'student', 'students')}. Pass mark is ${PASS_MARK}%.`;
    el('statArchived').textContent = ready ? archivedStudents().length : '–';

    // Recent activity
    const feed = el('activityFeed');
    if (state.loading) {
        feed.innerHTML = skeletonLines(4);
    } else if (!roster.length) {
        feed.innerHTML = emptyLine('No students yet. New sign-ups will appear here.');
    } else {
        feed.innerHTML = [...roster]
            .sort((a, b) => cmpNum(a.lastActiveMinutesAgo, b.lastActiveMinutesAgo) || byName(a, b))
            .slice(0, 6)
            .map(s => personRowHTML(s, presenceHTML(s), sectionTagHTML(s)))
            .join('');
    }

    // Needs attention
    const attention = roster
        .filter(needsAttention)
        .sort((a, b) => cmpNum(b.lastActiveMinutesAgo, a.lastActiveMinutesAgo) || byName(a, b));
    const list = el('attentionList');
    const more = el('attentionMore');
    if (state.loading) {
        list.innerHTML = skeletonLines(3);
        more.hidden = true;
    } else if (!attention.length) {
        list.innerHTML = emptyLine('Everyone has been active in the past week.');
        more.hidden = true;
    } else {
        list.innerHTML = attention.slice(0, 5).map(s => {
            let reason;
            if (s.status === 'inactive') reason = 'Marked inactive';
            else if (!Number.isFinite(s.lastActiveMinutesAgo)) reason = "Hasn't been active yet";
            else reason = `Last seen ${plural(Math.floor(s.lastActiveMinutesAgo / 1440), 'day', 'days')} ago`;
            return personRowHTML(s, escapeHtml(reason), '<i class="bi bi-chevron-right chev" aria-hidden="true"></i>');
        }).join('');
        more.hidden = attention.length <= 5;
        more.textContent = `View all ${attention.length}`;
    }

    // Top performers
    const top = el('topPerformersList');
    const ranked = [...scored].sort((a, b) => cmpNum(b.avgScore, a.avgScore) || byName(a, b)).slice(0, 5);
    if (state.loading) {
        top.innerHTML = skeletonLines(3);
    } else if (!ranked.length) {
        top.innerHTML = emptyLine('Scores appear after students finish a quiz.');
    } else {
        top.innerHTML = ranked.map((s, i) => {
            const tone = s.avgScore >= PASS_MARK ? 'is-pass' : 'is-below';
            return `<li class="rank-item">
                <span class="rank-no">${i + 1}</span>
                <button type="button" class="rank-name" data-open="${escapeHtml(s.id)}" data-role="rank">${escapeHtml(s.name)}</button>
                <span class="meter ${tone}" aria-hidden="true"><span style="width:${s.avgScore}%"></span></span>
                <span class="rank-score">${s.avgScore}%</span>
            </li>`;
        }).join('');
    }
}

/* ===================== RENDER: STUDENT TABLE ===================== */

function getVisibleStudents() {
    const q = state.search;
    const { test } = FILTERS.find(f => f.id === state.filter) || FILTERS[0];
    return sortStudents(rosterStudents().filter(s =>
        test(s) && (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    ));
}

function renderStatusFilter() {
    const host = el('statusFilter');
    if (!host.children.length) {
        host.innerHTML = FILTERS.map(f =>
            `<button type="button" class="chip" data-filter="${f.id}">${f.label}<span class="chip-count" data-count="${f.id}"></span></button>`
        ).join('');
    }
    const roster = rosterStudents();
    FILTERS.forEach(f => {
        const b = host.querySelector(`[data-filter="${f.id}"]`);
        b.setAttribute('aria-pressed', String(state.filter === f.id));
        b.querySelector('.chip-count').textContent = state.loaded ? roster.filter(f.test).length : '';
    });
}

function studentRowHTML(s) {
    const id = escapeHtml(s.id);
    const name = escapeHtml(s.name);
    const email = s.email === '—' ? '<span class="muted">No email</span>' : escapeHtml(s.email);
    return `<tr data-id="${id}">
        <td class="cell-no" data-label="No.">${escapeHtml(s.catalogNo)}</td>
        <td class="cell-student" data-label="Student">
            <div class="student-cell">
                ${avatarHTML(s)}
                <span class="student-text">
                    <button type="button" class="student-link" data-open="${id}" data-role="name">${name}</button>
                    <span class="student-email">${email}</span>
                </span>
            </div>
        </td>
        <td data-label="Section">${sectionTagHTML(s)}</td>
        <td data-label="Quizzes taken">${quizzesCellHTML(s)}</td>
        <td data-label="Avg. score">${scoreCellHTML(s)}</td>
        <td data-label="Last active">${presenceHTML(s)}${s.status === 'inactive' ? ' <span class="tag tag-warn">Inactive</span>' : ''}</td>
        <td class="cell-open">
            <button type="button" class="icon-btn" data-open="${id}" data-role="chevron" aria-label="Open ${name}">
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
        </td>
    </tr>`;
}

const skeletonRows = (n, cols) => Array.from({ length: n }, () =>
    `<tr class="skeleton-row" aria-hidden="true"><td colspan="${cols}"><span class="skeleton"></span></td></tr>`).join('');

// Rebuilding tbody drops keyboard focus; put it back on the same control.
function withFocusKept(tbody, build) {
    const active = document.activeElement;
    let keep = null;
    if (active && tbody.contains(active)) {
        keep = { key: active.dataset.open || active.dataset.id, role: active.dataset.role };
    }
    build();
    if (keep && keep.key) {
        const sel = `[data-role="${keep.role}"]`;
        const target = $$(sel, tbody).find(n => (n.dataset.open || n.dataset.id) === keep.key);
        if (target) target.focus({ preventScroll: true });
    }
}

function renderStudentTable() {
    const tbody = el('studentTableBody');
    const roster = rosterStudents();
    const rows = getVisibleStudents();
    const filtering = state.search || state.filter !== 'all';

    renderStatusFilter();

    el('studentCount').textContent = !state.loaded ? ''
        : filtering ? `Showing ${rows.length} of ${plural(roster.length, 'student', 'students')}`
        : plural(roster.length, 'student', 'students');

    const note = el('searchNote');
    note.hidden = !state.search;
    if (state.search) {
        el('searchNoteText').textContent = `Results for "${el('topbarSearch').value.trim()}"`;
    }

    el('sortSelect').value = state.sort.key;

    // Sort indicators
    $$('#studentTable thead th').forEach(th => {
        const b = th.querySelector('.th-sort');
        if (!b) return;
        th.setAttribute('aria-sort', b.dataset.sort === state.sort.key
            ? (state.sort.dir === 'asc' ? 'ascending' : 'descending')
            : 'none');
    });

    withFocusKept(tbody, () => {
        if (state.loading) {
            tbody.innerHTML = skeletonRows(6, 7);
        } else if (!state.loaded) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Student records are unavailable right now.</td></tr>';
        } else if (!rows.length) {
            tbody.innerHTML = filtering
                ? `<tr><td colspan="7" class="empty-cell"><strong>No students match.</strong> Try a different search or filter.<br><button type="button" class="btn btn-quiet" data-action="clear-filters">Clear search and filters</button></td></tr>`
                : `<tr><td colspan="7" class="empty-cell"><strong>No students in this section yet.</strong> New sign-ups appear here automatically.</td></tr>`;
        } else {
            tbody.innerHTML = rows.map(studentRowHTML).join('');
        }
    });
}

/* ===================== RENDER: ARCHIVED TABLE ===================== */

function renderArchivedTable() {
    const tbody = el('archivedTableBody');
    const rows = archivedStudents().sort(byName);

    el('archivedCount').textContent = state.loaded ? `${rows.length} archived` : '';

    withFocusKept(tbody, () => {
        if (state.loading) {
            tbody.innerHTML = skeletonRows(3, 7);
        } else if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell"><strong>No archived students.</strong> Students you archive appear here and can be restored any time.</td></tr>';
        } else {
            tbody.innerHTML = rows.map(s => {
                const id = escapeHtml(s.id);
                const name = escapeHtml(s.name);
                const email = s.email === '—' ? '<span class="muted">No email</span>' : escapeHtml(s.email);
                return `<tr data-id="${id}">
                    <td class="cell-no" data-label="No.">${escapeHtml(s.catalogNo)}</td>
                    <td class="cell-student" data-label="Student">
                        <div class="student-cell">
                            ${avatarHTML(s)}
                            <span class="student-text">
                                <button type="button" class="student-link" data-open="${id}" data-role="name">${name}</button>
                                <span class="student-email">${email}</span>
                            </span>
                        </div>
                    </td>
                    <td data-label="Section">${sectionTagHTML(s)}</td>
                    <td data-label="Quizzes taken">${quizzesCellHTML(s)}</td>
                    <td data-label="Avg. score">${scoreCellHTML(s)}</td>
                    <td data-label="Last active">${presenceHTML(s)}</td>
                    <td class="cell-restore">
                        <button type="button" class="btn btn-quiet btn-sm" data-action="restore" data-id="${id}" data-role="restore" aria-label="Restore ${name}">Restore</button>
                    </td>
                </tr>`;
            }).join('');
        }
    });
}

function renderAll() {
    renderNavCounts();
    renderSectionFilter();
    renderSubtitle();
    renderLoadError();
    renderOverview();
    renderStudentTable();
    renderArchivedTable();
    renderCodes();
    renderTeachers();
    renderUpdated();
}

/* ===================== RENDER: SECTION CODES ===================== */

const codeSections = () => knownSections().filter(v => v !== 'Unassigned');

function formatDay(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// <input type="date"> value (YYYY-MM-DD) in the admin's own time zone.
function toDateInputValue(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A code that "expires on the 30th" works through the end of the 30th.
function endOfDayISO(dateValue) {
    const [y, m, d] = dateValue.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

const visibleCodes = () => state.section === 'all'
    ? CODES
    : CODES.filter(c => c.section === state.section);

function renderCodeForm() {
    const select = el('codeSection');
    const sections = codeSections();
    const signature = sections.join('|');
    if (select.dataset.sig === signature) return;       // keep focus / selection between refreshes

    const keep = select.value;
    select.dataset.sig = signature;
    select.innerHTML = '<option value="" disabled selected>Choose a section</option>' +
        sections.map(v => `<option value="${escapeHtml(v)}">Section ${escapeHtml(v)}</option>`).join('');
    select.value = sections.includes(keep) ? keep : '';
}

function codeRowHTML(c) {
    const id = escapeHtml(c.id);
    const code = escapeHtml(c.code);
    const status = codeStatus(c);
    const owner = canManageTeachers() ? teacherLabel(c.teacherId) : '';
    const statusTag = {
        active: '<span class="tag tag-ok">Active</span>',
        expired: '<span class="tag tag-warn">Expired</span>',
        disabled: '<span class="tag tag-muted">Disabled</span>'
    }[status];
    const action = (name, icon, label, extra = '') =>
        `<button type="button" class="icon-btn icon-btn-sm${extra}" data-code-action="${name}" data-id="${id}" data-role="${name}" aria-label="${label} ${code}" title="${label}"><i class="bi ${icon}" aria-hidden="true"></i></button>`;

    return `<tr data-id="${id}" class="code-row${status === 'active' ? '' : ' is-off'}">
        <td class="cell-code" data-label="Code">
            <span class="code-chip">${code}</span>
            ${action('copy', 'bi-clipboard', 'Copy code')}
        </td>
        <td data-label="Section"><span class="tag">${escapeHtml(c.section)}</span>${owner ? `<span class="code-owner">${escapeHtml(owner)}</span>` : ''}</td>
        <td data-label="Created">${escapeHtml(formatDay(c.createdAt))}</td>
        <td data-label="Expires">${c.expiresAt ? escapeHtml(formatDay(c.expiresAt)) : '<span class="muted">Never</span>'}</td>
        <td data-label="Status">${statusTag}</td>
        <td data-label="Used by" class="cell-used">${plural(c.uses, 'student', 'students')}</td>
        <td class="cell-actions" data-label="Actions">
            ${action('regenerate', 'bi-arrow-repeat', 'Regenerate')}
            ${action('toggle', c.active ? 'bi-slash-circle' : 'bi-check-circle', c.active ? 'Disable' : 'Enable')}
            ${action('expiry', 'bi-calendar-event', 'Set expiry for')}
            ${action('delete', 'bi-trash', 'Delete', ' icon-btn-danger')}
        </td>
    </tr>`;
}

function renderCodes() {
    renderCodeForm();

    const rows = visibleCodes();
    const active = CODES.filter(c => codeStatus(c) === 'active').length;
    const filtered = state.section !== 'all';

    el('codeCount').textContent = (!state.loaded || (CODES_LOAD_ERROR && !CODES.length)) ? ''
        : `${plural(rows.length, 'code', 'codes')}${filtered ? ` for section ${state.section}` : ''}, ${active} active`;

    el('codesError').hidden = !CODES_LOAD_ERROR;
    el('codesErrorText').textContent = CODES_LOAD_ERROR || '';

    const tbody = el('codesTableBody');
    withFocusKept(tbody, () => {
        if (state.loading) {
            tbody.innerHTML = skeletonRows(3, 7);
        } else if (CODES_LOAD_ERROR && !CODES.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Section codes are unavailable right now.</td></tr>';
        } else if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-cell"><strong>${filtered ? 'No codes for this section yet.' : 'No codes yet.'}</strong> Choose a section above and generate its code.</td></tr>`;
        } else {
            tbody.innerHTML = rows.map(codeRowHTML).join('');
        }
    });
}

/* ===================== NAVIGATION ===================== */

function routeFromHash() {
    const h = location.hash.replace('#', '');
    if (h === 'teachers' && !canManageTeachers()) return 'overview';
    return VIEWS[h] ? h : 'overview';
}

function showView(view, { focus = false } = {}) {
    state.view = view;
    $$('.admin-view').forEach(s => s.classList.toggle('is-active', s.dataset.view === view));
    $$('.sidebar-bg .nav-link[data-view]').forEach(a => {
        const on = a.dataset.view === view;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    el('viewTitle').textContent = VIEWS[view].title;
    document.title = `${VIEWS[view].title} · EcoLearn Admin`;
    renderSubtitle();
    window.scrollTo({ top: 0 });
    if (focus) el('viewTitle').focus({ preventScroll: true });
}

function navigate(view) {
    if (routeFromHash() === view && state.view === view) return;
    if (location.hash.replace('#', '') === view) showView(view, { focus: true });
    else location.hash = view;          // hashchange -> showView
}

/* ===================== TOASTS ===================== */

function toast(message, { tone = 'info', actionLabel = '', onAction = null, timeout = 6000 } = {}) {
    const host = el('toasts');
    while (host.children.length >= 3) host.firstElementChild.remove();

    const node = document.createElement('div');
    node.className = `toast toast-${tone}`;
    const text = document.createElement('p');
    text.textContent = message;
    node.append(text);

    let timer = null;
    const dismiss = () => {
        clearTimeout(timer);
        node.classList.add('is-leaving');
        setTimeout(() => node.remove(), 180);
    };

    if (actionLabel) {
        const act = document.createElement('button');
        act.type = 'button';
        act.className = 'toast-action';
        act.textContent = actionLabel;
        act.addEventListener('click', () => { dismiss(); if (onAction) onAction(); });
        node.append(act);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
    close.addEventListener('click', dismiss);
    node.append(close);

    host.append(node);
    timer = setTimeout(dismiss, timeout);
}

/* ===================== ACTIONS (persist first, then update the UI) ===================== */

async function persistProfileUpdate(id, patch) {
    const { error } = await ecoAuth.client
        .from('profiles')
        .update(patch)
        .eq('id', id);

    if (error) {
        console.error('Failed to save change to Supabase:', error.message);
        toast(`Couldn't save that change. ${error.message}`, { tone: 'error', timeout: 10000 });
        return false;
    }
    return true;
}

async function withBusy(button, task) {
    if (!button) return task();
    const label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try { return await task(); }
    finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = label;
    }
}

// After a row disappears (archive / restore) keyboard focus would fall back to <body>.
function ensureFocus() {
    if (!document.activeElement || document.activeElement === document.body) {
        el('viewTitle').focus({ preventScroll: true });
    }
}

async function archiveStudent(id) {
    const s = findStudent(id);
    if (!s || s.archived) return;
    const ok = await persistProfileUpdate(id, { archived: true });
    if (!ok) return;
    s.archived = true;
    closeDrawer();
    renderAll();
    ensureFocus();
    toast(`${s.name} was archived.`, {
        actionLabel: 'Undo',
        timeout: 8000,
        onAction: () => restoreStudent(id)
    });
}

async function restoreStudent(id) {
    const s = findStudent(id);
    if (!s || !s.archived) return;
    const ok = await persistProfileUpdate(id, { archived: false });
    if (!ok) return;
    s.archived = false;
    closeDrawer();
    renderAll();
    ensureFocus();
    toast(`${s.name} was restored.`);
}

function setFieldError(inputId, errorId, invalid) {
    const input = el(inputId);
    el(errorId).hidden = !invalid;
    if (invalid) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', errorId);
    } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
    }
}

async function saveAccount(event) {
    event.preventDefault();
    const id = el('accountId').value;
    const s = findStudent(id);
    if (!s) return;

    const name = cleanText(el('accountName').value);
    const email = el('accountEmail').value.trim();
    const status = el('accountStatus').value;
    const section = el('accountSection').value;      // '' = Unassigned (student joins again with a code)
    const teacher = canManageTeachers() ? el('accountTeacher').value : null;   // '' = no teacher; null = not editable here

    const nameBad = !name;
    const emailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setFieldError('accountName', 'accountNameError', nameBad);
    setFieldError('accountEmail', 'accountEmailError', emailBad);
    if (nameBad) { el('accountName').focus(); return; }
    if (emailBad) { el('accountEmail').focus(); return; }

    const saveBtn = el('accountSave');
    const ok = await withBusy(saveBtn, async () => {
        saveBtn.textContent = 'Saving…';
        const patch = { full_name: name, email, status, section: section || null };
        if (teacher !== null) patch.teacher_id = teacher || null;
        return persistProfileUpdate(id, patch);
    });
    if (!ok) return;

    const fresh = findStudent(id) || s;
    Object.assign(fresh, { name, email, status, section: section || 'Unassigned' });
    if (teacher !== null) fresh.teacherId = teacher || null;
    renderAll();
    renderDrawer(fresh, { keepTab: true });
    toast(`Saved changes for ${name}.`);
}

/* ===================== TEACHERS: RENDER + ACTIONS ===================== */

function teacherRowHTML(t) {
    const id = escapeHtml(t.id);
    const mine = t.id === ME.id;
    const students = STUDENTS.filter(x => x.teacherId === t.id && !x.archived).length;
    const codes = CODES.filter(c => c.teacherId === t.id && codeStatus(c) === 'active').length;
    const action = (name, icon, label, extra = '') =>
        `<button type="button" class="icon-btn icon-btn-sm${extra}" data-teacher-action="${name}" data-id="${id}" data-role="${name}" aria-label="${label} ${escapeHtml(t.name)}" title="${label}"><i class="bi ${icon}" aria-hidden="true"></i></button>`;

    return `<tr data-id="${id}">
        <td class="cell-student" data-label="Teacher">
            <span class="student-text">
                <span class="teacher-name">${escapeHtml(t.name)}${mine ? ' <span class="muted">(you)</span>' : ''}</span>
                <span class="student-email">${escapeHtml(t.email || '—')}</span>
            </span>
        </td>
        <td data-label="Subject">${t.subject ? `<span class="tag">${escapeHtml(SUBJECT_LABEL[t.subject] || t.subject)}</span>` : '<span class="muted">—</span>'}</td>
        <td data-label="Access">${t.isMain ? '<span class="tag tag-ok">Main admin</span>' : '<span class="tag">Teacher</span>'}</td>
        <td data-label="Students" class="cell-used">${students}</td>
        <td data-label="Active codes" class="cell-used">${codes}</td>
        <td class="cell-actions" data-label="Actions">
            ${action('edit', 'bi-pencil', 'Edit')}
            ${action('assign', 'bi-person-plus', 'Assign students to')}
            ${mine ? '' : action('remove', 'bi-person-dash', 'Remove teacher access for', ' icon-btn-danger')}
        </td>
    </tr>`;
}

function renderTeachers() {
    if (!canManageTeachers()) return;
    el('teachersError').hidden = !TEACHERS_LOAD_ERROR;
    el('teachersErrorText').textContent = TEACHERS_LOAD_ERROR || '';
    el('teacherCount').textContent = state.loaded ? plural(TEACHERS.length, 'person', 'people') + ' with admin access' : '';

    const rows = [...TEACHERS].sort((a, b) => (b.isMain - a.isMain) || a.name.localeCompare(b.name));
    const body = el('teachersTableBody');
    withFocusKept(body, () => {
        if (state.loading) body.innerHTML = skeletonRows(2, 6);
        else if (TEACHERS_LOAD_ERROR && !TEACHERS.length) body.innerHTML = '<tr><td colspan="6" class="empty-cell">Teachers are unavailable right now.</td></tr>';
        else if (!rows.length) body.innerHTML = '<tr><td colspan="6" class="empty-cell"><strong>No teachers yet.</strong> Add one above.</td></tr>';
        else body.innerHTML = rows.map(teacherRowHTML).join('');
    });
}

function fillTeacherForm(t) {
    el('teacherEmail').value = t.email || '';
    el('teacherSubject').value = t.subject || '';
    el('teacherMain').checked = t.isMain;
    ['teacherEmail', 'teacherSubject'].forEach(id => setFieldError(id, id + 'Error', false));
    el('teacherForm').scrollIntoView({ block: 'center', behavior: 'smooth' });
    el('teacherSubject').focus({ preventScroll: true });
}

async function saveTeacher(event) {
    event.preventDefault();
    const email = el('teacherEmail').value.trim();
    const subject = el('teacherSubject').value;
    const main = el('teacherMain').checked;

    const emailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const subjectBad = !subject && !main;
    setFieldError('teacherEmail', 'teacherEmailError', emailBad);
    setFieldError('teacherSubject', 'teacherSubjectError', subjectBad);
    if (emailBad) { el('teacherEmail').focus(); return; }
    if (subjectBad) { el('teacherSubject').focus(); return; }

    const btn = el('teacherSaveBtn');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const { data, error } = await ecoAuth.client.rpc('main_admin_set_teacher', {
        p_email: email,
        p_subject: subject || null,
        p_main: main
    });
    btn.disabled = false;
    btn.innerHTML = label;

    if (error || !data) {
        console.error('Failed to save a teacher:', error && error.message);
        toast(`Couldn't save the teacher. ${error ? error.message : 'Please try again.'}`, { tone: 'error', timeout: 10000 });
        return;
    }

    el('teacherForm').reset();
    const name = cleanText(data.full_name) || data.email;
    toast(`${name} is now ${main ? 'a main admin' : `a ${SUBJECT_LABEL[subject]} teacher`}.`);
    await refreshData();
}

async function removeTeacher(t, button) {
    const n = STUDENTS.filter(x => x.teacherId === t.id).length;
    const ok = window.confirm(
        `Remove ${t.name}'s teacher access?\n\n` +
        `Their ${plural(n, 'student', 'students')} will have no teacher until you assign them again, ` +
        `and their active codes will be switched off. Nothing is deleted.`);
    if (!ok) return;

    button.disabled = true;
    const { data, error } = await ecoAuth.client.rpc('main_admin_remove_teacher', { p_id: t.id });
    button.disabled = false;

    if (error) {
        console.error('Failed to remove a teacher:', error.message);
        toast(`Couldn't remove the teacher. ${error.message}`, { tone: 'error', timeout: 10000 });
        return;
    }
    toast(`${t.name} is no longer a teacher. ${plural(data?.students_unassigned || 0, 'student', 'students')} released, ${plural(data?.codes_disabled || 0, 'code', 'codes')} switched off.`, { timeout: 9000 });
    await refreshData();
}

/* Assign students dialog */
const assignState = { teacher: null };
const unownedStudents = (section) => STUDENTS.filter(s => !s.teacherId && (!section || s.section === section));

function updateAssignHelp() {
    const n = unownedStudents(el('assignSection').value).length;
    el('assignHelp').textContent = n
        ? `${plural(n, 'student', 'students')} without a teacher will be assigned.`
        : 'No students without a teacher here.';
    el('assignSave').disabled = !n;
}

function openAssignDialog(t) {
    assignState.teacher = t;
    el('assignText').textContent = `Give students who don't have a teacher yet to ${t.name}. Students who joined with a code already belong to the teacher who made it.`;
    el('assignSection').innerHTML = '<option value="">All sections</option>' +
        codeSections().map(v => `<option value="${escapeHtml(v)}">Section ${escapeHtml(v)}</option>`).join('');
    updateAssignHelp();
    const dlg = el('assignDialog');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    el('assignSection').focus();
}

function closeAssignDialog() {
    const dlg = el('assignDialog');
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
    assignState.teacher = null;
}

async function saveAssign(event) {
    event.preventDefault();
    const t = assignState.teacher;
    if (!t) return;
    const section = el('assignSection').value;

    const btn = el('assignSave');
    btn.disabled = true;
    const { data, error } = await ecoAuth.client.rpc('main_admin_assign_students', {
        p_teacher: t.id,
        p_section: section || null
    });
    btn.disabled = false;

    if (error) {
        console.error('Failed to assign students:', error.message);
        toast(`Couldn't assign students. ${error.message}`, { tone: 'error', timeout: 10000 });
        return;
    }
    closeAssignDialog();
    toast(`${plural(Number(data) || 0, 'student', 'students')} assigned to ${t.name}.`);
    await refreshData();
}

function handleTeacherAction(button) {
    const t = TEACHERS.find(x => x.id === button.dataset.id);
    if (!t) return;
    switch (button.dataset.teacherAction) {
        case 'edit':   fillTeacherForm(t); break;
        case 'assign': openAssignDialog(t); break;
        case 'remove': removeTeacher(t, button); break;
    }
}

/* ===================== SECTION CODES: ACTIONS ===================== */

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // Fallback for http pages / older browsers.
        const box = document.createElement('textarea');
        box.value = text;
        box.setAttribute('readonly', '');
        box.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.append(box);
        box.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        box.remove();
        return ok;
    }
}

async function copyCode(c) {
    const ok = await copyText(c.code);
    toast(ok ? `Copied ${c.code} (section ${c.section}).` : `Couldn't copy automatically. The code is ${c.code}.`,
        { tone: ok ? 'info' : 'error' });
}

async function generateCode(event) {
    event.preventDefault();
    const section = el('codeSection').value;
    const expiryValue = el('codeExpiry').value;

    const sectionBad = !section;
    const expiresAt = expiryValue ? endOfDayISO(expiryValue) : null;
    const expiryBad = !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
    setFieldError('codeSection', 'codeSectionError', sectionBad);
    setFieldError('codeExpiry', 'codeExpiryError', expiryBad);
    if (sectionBad) { el('codeSection').focus(); return; }
    if (expiryBad) { el('codeExpiry').focus(); return; }

    const btn = el('codeGenerateBtn');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Generating…';

    const { data, error } = await ecoAuth.client.rpc('admin_generate_section_code', {
        p_section: section,
        p_expires_at: expiresAt
    });

    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.innerHTML = label;

    if (error || !data) {
        console.error('Failed to generate a section code:', error && error.message);
        toast(`Couldn't create the code. ${error ? error.message : 'Please try again.'}`, { tone: 'error', timeout: 10000 });
        return;
    }

    const created = toCode(data);
    CODES = [created, ...CODES.filter(c => c.id !== created.id)];
    el('codeExpiry').value = '';
    renderCodes();
    toast(`Code ${created.code} created for section ${created.section}.`, {
        actionLabel: 'Copy',
        timeout: 12000,
        onAction: () => copyCode(created)
    });
}

async function regenerateCode(c, button) {
    const ok = window.confirm(
        `Regenerate the code for section ${c.section}?\n\n` +
        `The current code ${c.code} stops working right away. Students who already joined keep their section.`);
    if (!ok) return;

    button.disabled = true;
    const { data, error } = await ecoAuth.client.rpc('admin_regenerate_section_code', { p_id: c.id });
    button.disabled = false;

    if (error || !data) {
        console.error('Failed to regenerate a section code:', error && error.message);
        toast(`Couldn't regenerate the code. ${error ? error.message : 'Please try again.'}`, { tone: 'error', timeout: 10000 });
        return;
    }
    c.code = data.code;
    renderCodes();
    toast(`New code for section ${c.section}: ${c.code}`, {
        actionLabel: 'Copy',
        timeout: 12000,
        onAction: () => copyCode(c)
    });
}

// RLS can block a write without an error, so check that a row came back.
async function updateCodeRow(c, patch) {
    const { data, error } = await ecoAuth.client
        .from('section_codes')
        .update(patch)
        .eq('id', c.id)
        .select('id');

    if (error) {
        console.error('Failed to update a section code:', error.message);
        toast(`Couldn't save that change. ${error.message}`, { tone: 'error', timeout: 10000 });
        return false;
    }
    if (!data || !data.length) {
        toast("Couldn't save that change. The code may have been deleted, or you may not have permission.", { tone: 'error', timeout: 10000 });
        return false;
    }
    return true;
}

async function toggleCode(c, button) {
    button.disabled = true;
    const next = !c.active;
    const ok = await updateCodeRow(c, { is_active: next });
    button.disabled = false;
    if (!ok) return;
    c.active = next;
    renderCodes();
    toast(next ? `Code ${c.code} is on again.` : `Code ${c.code} is turned off. Students can't use it until you enable it.`);
}

async function deleteCode(c, button) {
    const ok = window.confirm(
        `Delete the code ${c.code} for section ${c.section}?\n\n` +
        `Students who already joined keep their section. Nobody can use this code again.`);
    if (!ok) return;

    button.disabled = true;
    const { data, error } = await ecoAuth.client
        .from('section_codes')
        .delete()
        .eq('id', c.id)
        .select('id');
    button.disabled = false;

    if (error || !data || !data.length) {
        console.error('Failed to delete a section code:', error && error.message);
        toast(`Couldn't delete the code. ${error ? error.message : 'You may not have permission.'}`, { tone: 'error', timeout: 10000 });
        return;
    }
    CODES = CODES.filter(x => x.id !== c.id);
    renderCodes();
    ensureFocus();
    toast(`Code ${c.code} was deleted.`);
}

/* Expiry dialog */
const expiry = { code: null };

function openExpiryDialog(c) {
    expiry.code = c;
    el('expiryText').textContent = `Code ${c.code} for section ${c.section}. After this day, students can no longer use it.`;
    const input = el('expiryDate');
    input.min = toDateInputValue(new Date().toISOString());
    input.value = c.expiresAt ? toDateInputValue(c.expiresAt) : '';
    setFieldError('expiryDate', 'expiryDateError', false);

    const dlg = el('expiryDialog');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    input.focus();
}

function closeExpiryDialog() {
    const dlg = el('expiryDialog');
    const id = expiry.code && expiry.code.id;
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
    expiry.code = null;
    // The table may have re-rendered while the dialog was open: refocus by id.
    const back = id && document.querySelector(`[data-code-action="expiry"][data-id="${CSS.escape(id)}"]`);
    if (back) back.focus({ preventScroll: true });
}

async function saveExpiry({ clear = false } = {}) {
    const c = expiry.code;
    if (!c) return;

    let expiresAt = null;
    if (!clear) {
        const value = el('expiryDate').value;
        expiresAt = value ? endOfDayISO(value) : null;
        const bad = !expiresAt || new Date(expiresAt).getTime() <= Date.now();
        setFieldError('expiryDate', 'expiryDateError', bad);
        if (bad) { el('expiryDate').focus(); return; }
    }

    const buttons = ['expirySave', 'expiryClear', 'expiryCancel'].map(el);
    buttons.forEach(b => { b.disabled = true; });
    const ok = await updateCodeRow(c, { expires_at: expiresAt });
    buttons.forEach(b => { b.disabled = false; });
    if (!ok) return;

    c.expiresAt = expiresAt;
    closeExpiryDialog();
    renderCodes();
    toast(expiresAt
        ? `Code ${c.code} works through ${formatDay(expiresAt)}.`
        : `Code ${c.code} no longer expires.`);
}

function handleCodeAction(button) {
    const c = CODES.find(x => x.id === button.dataset.id);
    if (!c) return;
    switch (button.dataset.codeAction) {
        case 'copy':       copyCode(c); break;
        case 'regenerate': regenerateCode(c, button); break;
        case 'toggle':     toggleCode(c, button); break;
        case 'expiry':     openExpiryDialog(c); break;
        case 'delete':     deleteCode(c, button); break;
    }
}

/* ===================== DRAWER ===================== */

function quizRowsHTML(s) {
    const known = QUIZ_ORDER.map(lessonId => {
        const q = s.quizzes.find(x => x.lessonId === lessonId);
        return { name: LESSON_NAMES[lessonId], q };
    });
    // Attempts against a lesson id this file doesn't know about: still show them.
    s.quizzes.filter(x => !LESSON_NAMES[x.lessonId]).forEach(x => known.push({ name: x.name, q: x }));

    return known.map(({ name, q }) => {
        if (!q) {
            return `<li class="quiz-row is-empty">
                <span class="quiz-main"><span class="quiz-name">${escapeHtml(name)}</span><span class="quiz-sub">Not taken yet</span></span>
            </li>`;
        }
        const passed = q.score >= PASS_MARK;
        return `<li class="quiz-row">
            <span class="quiz-main">
                <span class="quiz-name">${escapeHtml(name)}</span>
                <span class="quiz-sub">${plural(q.attempts, 'attempt', 'attempts')}, last on ${escapeHtml(q.date)}</span>
            </span>
            <span class="quiz-result">
                <span class="quiz-score">${q.score}%</span>
                <span class="meter ${passed ? 'is-pass' : 'is-below'}" aria-hidden="true"><span style="width:${q.score}%"></span></span>
                <span class="quiz-flag ${passed ? 'is-pass' : 'is-below'}">${passed ? 'Passed' : 'Below pass mark'}</span>
            </span>
        </li>`;
    }).join('');
}

function lessonRowsHTML(s) {
    return s.lessons.map(l => {
        if (!l.started) {
            return `<li class="quiz-row is-empty">
                <span class="quiz-main"><span class="quiz-name">${escapeHtml(l.name)}</span><span class="quiz-sub">Not started</span></span>
            </li>`;
        }
        const sub = l.complete
            ? `Finished on ${escapeHtml(l.completedDate)}`
            : `${l.read} of ${l.total} sections read, last on ${escapeHtml(l.date)}`;
        return `<li class="quiz-row">
            <span class="quiz-main">
                <span class="quiz-name">${escapeHtml(l.name)}</span>
                <span class="quiz-sub">${sub}</span>
            </span>
            <span class="quiz-result">
                <span class="quiz-score">${l.percent}%</span>
                <span class="meter ${l.complete ? 'is-pass' : ''}" aria-hidden="true"><span style="width:${l.percent}%"></span></span>
                <span class="quiz-flag ${l.complete ? 'is-pass' : 'is-progress'}">${l.complete ? 'Completed' : 'In progress'}</span>
            </span>
        </li>`;
    }).join('');
}

function renderDrawer(s, { keepTab = false } = {}) {
    el('drawerAvatar').innerHTML = avatarContentHTML(s);
    el('drawerName').textContent = s.name;
    el('drawerEmail').textContent = s.email === '—' ? 'No email on file' : s.email;

    const tags = [sectionTagHTML(s), `<span class="tag tag-plain">Joined ${escapeHtml(s.joined)}</span>`];
    if (s.status === 'inactive') tags.push('<span class="tag tag-warn">Inactive</span>');
    if (s.archived) tags.push('<span class="tag tag-muted">Archived</span>');
    el('drawerTags').innerHTML = tags.join('');

    el('drawerAvg').textContent = s.avgScore !== null ? `${s.avgScore}%` : '–';
    el('drawerQuizCount').textContent = `${Math.min(s.quizzes.length, QUIZ_ORDER.length)} of ${QUIZ_ORDER.length}`;
    el('drawerLast').textContent = s.isOnline ? 'Online now' : s.lastActive.replace(/^Active /, '');

    el('quizSummary').textContent = s.avgScore !== null
        ? `Average ${s.avgScore}% across ${plural(s.quizzes.length, 'quiz', 'quizzes')}. The pass mark is ${PASS_MARK}%.`
        : (QUIZ_LOAD_ERROR ? `Couldn't load quiz data: ${QUIZ_LOAD_ERROR}` : 'No quiz attempts yet.');
    el('quizList').innerHTML = quizRowsHTML(s);

    const lessonsDone = s.lessons.filter(l => l.complete).length;
    el('lessonSummary').textContent = LESSON_LOAD_ERROR
        ? `Couldn't load lesson progress: ${LESSON_LOAD_ERROR}`
        : (s.lessons.some(l => l.started)
            ? `${lessonsDone} of ${s.lessons.length} lessons completed. A lesson is complete when every section has been read.`
            : (LESSON_ROWS_TOTAL === 0
                ? 'No lesson progress is visible yet. If students have been reading, re-run supabase-lesson-progress.sql so admins are allowed to read it.'
                : 'No lessons started yet.'));
    el('lessonList').innerHTML = lessonRowsHTML(s);

    el('accountId').value = s.id;
    el('accountName').value = s.name;
    el('accountEmail').value = s.email === '—' ? '' : s.email;
    el('accountStatus').value = s.status;

    const sectionSelect = el('accountSection');
    const sectionOptions = codeSections();
    if (s.section !== 'Unassigned' && !sectionOptions.includes(s.section)) sectionOptions.push(s.section);
    sectionSelect.innerHTML = '<option value="">Unassigned</option>' +
        sectionOptions.map(v => `<option value="${escapeHtml(v)}">Section ${escapeHtml(v)}</option>`).join('');
    sectionSelect.value = s.section === 'Unassigned' ? '' : s.section;

    // Main admins can move a student to another teacher.
    el('accountTeacherField').hidden = !canManageTeachers();
    if (canManageTeachers()) {
        const teacherSelect = el('accountTeacher');
        teacherSelect.innerHTML = '<option value="">No teacher yet</option>' +
            TEACHERS.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${escapeHtml(SUBJECT_LABEL[t.subject] || 'Main admin')})</option>`).join('');
        teacherSelect.value = s.teacherId || '';
    }
    setFieldError('accountName', 'accountNameError', false);
    setFieldError('accountEmail', 'accountEmailError', false);

    const box = el('archiveBox');
    const btn = el('archiveBtn');
    if (s.archived) {
        el('archiveTitle').textContent = 'This student is archived';
        el('archiveText').textContent = "They're hidden from the roster. Restore the account to bring them back.";
        btn.textContent = 'Restore student';
        btn.className = 'btn btn-primary';
        btn.dataset.mode = 'restore';
    } else {
        el('archiveTitle').textContent = 'Archive this student';
        el('archiveText').textContent = 'Archiving removes them from the roster. Their records are kept and you can restore them any time.';
        btn.textContent = 'Archive student';
        btn.className = 'btn btn-danger-quiet';
        btn.dataset.mode = 'archive';
    }
    box.dataset.mode = btn.dataset.mode;

    if (!keepTab) setDrawerTab('quiz');
}

function setDrawerTab(tab) {
    drawer.tab = tab;
    $$('#studentDrawer .tab').forEach(t => {
        const on = t.dataset.tab === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
    });
    el('panelQuiz').hidden = tab !== 'quiz';
    el('panelAccount').hidden = tab !== 'account';
}

function setBackgroundInert(on) {
    ['adminMain'].forEach(id => { const n = el(id); if (n) n.inert = on; });
    const nav = document.querySelector('.sidebar-bg');
    if (nav) nav.inert = on;
}

function openDrawer(id, tab = 'quiz', opener = null) {
    const s = findStudent(id);
    if (!s) return;
    drawer.id = id;
    drawer.opener = opener || document.activeElement;
    renderDrawer(s);
    setDrawerTab(tab);

    const root = el('studentDrawer');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-drawer');
    setBackgroundInert(true);
    requestAnimationFrame(() => root.querySelector('.drawer-panel').focus({ preventScroll: true }));
}

function closeDrawer() {
    const root = el('studentDrawer');
    if (!root.classList.contains('is-open')) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-drawer');
    setBackgroundInert(false);

    // Return focus to whatever opened the drawer (or its replacement after a re-render).
    let target = drawer.opener && document.contains(drawer.opener) ? drawer.opener : null;
    if (!target && drawer.id) target = document.querySelector(`[data-open="${CSS.escape(drawer.id)}"]`);
    if (target) target.focus({ preventScroll: true });
    drawer.id = null;
    drawer.opener = null;
}

function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const panel = document.querySelector('.drawer-panel');
    const focusable = $$('button:not([disabled]), [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])', panel)
        .filter(n => !n.hidden && n.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
    }
}

/* ===================== DATA REFRESH ===================== */

async function refreshData({ manual = false } = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    const btn = el('refreshBtn');
    btn.classList.add('is-spinning');
    btn.setAttribute('aria-busy', 'true');

    const [next, nextCodes, nextTeachers] = await Promise.all([fetchStudents(), fetchSectionCodes(), fetchTeachers()]);
    if (nextCodes) CODES = nextCodes;
    if (nextTeachers) TEACHERS = nextTeachers;

    if (STUDENTS_LOAD_ERROR) {
        if (state.loaded) {
            // Keep showing the last good data instead of wiping the roster.
            if (manual) toast(`Couldn't refresh. ${STUDENTS_LOAD_ERROR}`, { tone: 'error', timeout: 8000 });
        } else {
            state.loadError = STUDENTS_LOAD_ERROR;
        }
    } else {
        STUDENTS = next;
        state.loaded = true;
        state.loadError = null;
        state.updatedAt = Date.now();
    }

    state.loading = false;
    state.refreshing = false;
    btn.classList.remove('is-spinning');
    btn.removeAttribute('aria-busy');
    renderAll();
}

/* ===================== EVENTS ===================== */

function setSearch(value) {
    state.search = value.trim().toLowerCase();
    if (state.search && state.view !== 'students') navigate('students');
    renderStudentTable();
}

function clearFilters() {
    state.search = '';
    state.filter = 'all';
    el('topbarSearch').value = '';
    renderStudentTable();
}

function bindEvents() {
    document.addEventListener('click', (e) => {
        const t = e.target;

        const codeAction = t.closest('[data-code-action]');
        if (codeAction) { handleCodeAction(codeAction); return; }

        const teacherAction = t.closest('[data-teacher-action]');
        if (teacherAction) { handleTeacherAction(teacherAction); return; }

        const open = t.closest('[data-open]');
        if (open) { openDrawer(open.dataset.open, 'quiz', open); return; }

        const go = t.closest('[data-go]');
        if (go) { navigate(go.dataset.go); return; }

        const restore = t.closest('[data-action="restore"]');
        if (restore) { restoreStudent(restore.dataset.id); return; }

        if (t.closest('[data-action="clear-filters"]')) { clearFilters(); return; }

        const section = t.closest('[data-section]');
        if (section) {
            state.section = section.dataset.section;
            renderAll();
            return;
        }

        const filter = t.closest('[data-filter]');
        if (filter) {
            state.filter = filter.dataset.filter;
            renderStudentTable();
            return;
        }

        const sort = t.closest('.th-sort');
        if (sort) {
            const key = sort.dataset.sort;
            if (state.sort.key === key) {
                state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort = { key, dir: (key === 'quizzes' || key === 'avg') ? 'desc' : 'asc' };
            }
            renderStudentTable();
            return;
        }

        if (t.closest('[data-close-drawer]')) { closeDrawer(); return; }

        const tab = t.closest('#studentDrawer .tab');
        if (tab) { setDrawerTab(tab.dataset.tab); return; }

        // Whole-row click opens the drawer too (mouse convenience; the name button is the keyboard route)
        const row = t.closest('#studentTableBody tr[data-id], #archivedTableBody tr[data-id]');
        if (row && !t.closest('button, a, input, select')) {
            openDrawer(row.dataset.id, 'quiz', row.querySelector('[data-open]'));
        }
    });

    // Arrow keys move between the two tabs
    el('studentDrawer').querySelector('.tabs').addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = drawer.tab === 'quiz' ? 'account' : 'quiz';
        setDrawerTab(next);
        el(next === 'quiz' ? 'tabQuiz' : 'tabAccount').focus();
    });

    document.addEventListener('keydown', (e) => {
        const drawerOpen = el('studentDrawer').classList.contains('is-open');
        if (e.key === 'Escape' && drawerOpen) { closeDrawer(); return; }
        if (drawerOpen) { trapFocus(e); return; }

        // "/" jumps to search, like most admin tools
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            el('topbarSearch').focus();
        }
    });

    el('topbarSearch').addEventListener('input', (e) => setSearch(e.target.value));
    el('topbarSearch').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); navigate('students'); }
        if (e.key === 'Escape' && e.target.value) { e.target.value = ''; setSearch(''); }
    });
    el('clearSearch').addEventListener('click', () => { el('topbarSearch').value = ''; setSearch(''); });

    el('attentionMore').addEventListener('click', () => {
        state.filter = 'attention';
        renderStudentTable();
        navigate('students');
    });

    el('sortSelect').addEventListener('change', (e) => {
        const key = e.target.value;
        state.sort = { key, dir: (key === 'quizzes' || key === 'avg') ? 'desc' : 'asc' };
        renderStudentTable();
    });

    el('refreshBtn').addEventListener('click', () => refreshData({ manual: true }));
    el('loadErrorRetry').addEventListener('click', () => refreshData({ manual: true }));

    el('teacherForm').addEventListener('submit', saveTeacher);
    el('teacherSubject').addEventListener('change', () => setFieldError('teacherSubject', 'teacherSubjectError', false));
    el('teacherEmail').addEventListener('input', () => setFieldError('teacherEmail', 'teacherEmailError', false));
    el('teachersErrorRetry').addEventListener('click', () => refreshData({ manual: true }));
    el('assignForm').addEventListener('submit', saveAssign);
    el('assignCancel').addEventListener('click', closeAssignDialog);
    el('assignSection').addEventListener('change', updateAssignHelp);
    el('assignDialog').addEventListener('close', () => { assignState.teacher = null; });
    el('codeForm').addEventListener('submit', generateCode);
    el('codeSection').addEventListener('change', () => setFieldError('codeSection', 'codeSectionError', false));
    el('codeExpiry').addEventListener('input', () => setFieldError('codeExpiry', 'codeExpiryError', false));
    el('codesErrorRetry').addEventListener('click', () => refreshData({ manual: true }));
    el('expiryForm').addEventListener('submit', (e) => { e.preventDefault(); saveExpiry(); });
    el('expiryClear').addEventListener('click', () => saveExpiry({ clear: true }));
    el('expiryCancel').addEventListener('click', closeExpiryDialog);
    el('expiryDialog').addEventListener('close', () => { expiry.code = null; });          // Esc also closes it natively
    el('expiryDate').addEventListener('input', () => setFieldError('expiryDate', 'expiryDateError', false));

    el('accountForm').addEventListener('submit', saveAccount);
    el('accountName').addEventListener('input', () => setFieldError('accountName', 'accountNameError', false));
    el('accountEmail').addEventListener('input', () => setFieldError('accountEmail', 'accountEmailError', false));
    el('archiveBtn').addEventListener('click', (e) => {
        const id = el('accountId').value;
        const btn = e.currentTarget;
        withBusy(btn, () => btn.dataset.mode === 'restore' ? restoreStudent(id) : archiveStudent(id));
    });

    window.addEventListener('hashchange', () => showView(routeFromHash(), { focus: true }));

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.updatedAt && Date.now() - state.updatedAt > REFRESH_EVERY_MS) refreshData();
    });
}

/* ===================== INIT ===================== */

// Role badge in the top bar and the Teachers link (main admins only).
function applyRoleUI() {
    const subject = SUBJECT_LABEL[ME.subject] || '';
    const chip = el('roleChip');
    if (ME.ready) {
        chip.textContent = ME.isMain
            ? (subject ? `Main admin · ${subject}` : 'Main admin')
            : (subject ? `${subject} teacher` : 'Teacher');
        chip.hidden = false;
    } else {
        chip.hidden = true;
    }
    el('navTeachers').hidden = !canManageTeachers();
}

async function loadAdminIdentity() {
    try {
        const { data } = await ecoAuth.client.auth.getSession();
        const user = data?.session?.user;
        if (!user) return;

        // Prefer the profiles row (what the student list uses); auth metadata can hold an older,
        // differently-encoded copy of the name.
        let name = '';
        try {
            let { data: prof, error } = await ecoAuth.client
                .from('profiles').select('full_name, subject, is_main_admin').eq('id', user.id).maybeSingle();
            // Before supabase-teachers.sql runs these columns don't exist: keep the old behaviour.
            if (error) {
                ({ data: prof } = await ecoAuth.client
                    .from('profiles').select('full_name').eq('id', user.id).maybeSingle());
            } else if (prof) {
                ME.ready = true;
                ME.isMain = !!prof.is_main_admin;
                ME.subject = prof.subject || '';
            }
            name = cleanText(prof?.full_name);
        } catch (e) { /* fall through to metadata */ }
        ME.id = user.id;
        applyRoleUI();
        name = name || cleanText(user.user_metadata?.full_name) || user.email || 'Admin';

        state.adminName = name;
        state.adminFirstName = name.includes('@') ? '' : name.split(' ')[0];
        const avatar = el('topbarAvatar');
        avatar.textContent = initialsOf(name);
        avatar.title = name;
    } catch (e) { /* keep default label */ }
}

document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    showView(routeFromHash());
    renderAll();                                   // shows loading placeholders straight away

    if (window.ecoAuth) {
        await ecoAuth.requireAdmin();
        await loadAdminIdentity();
        showView(routeFromHash());                 // now that we know the role (e.g. #teachers)
        const logoutButton = el('logoutButton');
        if (logoutButton) logoutButton.addEventListener('click', () => window.ecoAuth.signOut());
    }

    await refreshData();

    // Keep online/offline dots and "Updated …" honest without a manual refresh.
    setInterval(() => { if (!document.hidden) refreshData(); }, REFRESH_EVERY_MS);
    setInterval(renderUpdated, 15000);
});