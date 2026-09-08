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

   NOTE ON DATA: student records, progress and quiz scores are
   demo/mock data generated below. The current `profiles` table
   only stores { id, role }, and its RLS policy only allows a
   user to read their own row — so there is no live source for
   a student roster yet. When a `profiles/lessons/quizzes`
   schema with an "admins can read all rows" policy exists,
   replace `buildMockStudents()` with a real
   `ecoAuth.client.from('profiles').select(...)` query and keep
   the rest of this file (rendering/filtering/modals) as-is.

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

const QUIZ_NAMES = [
    'Cell Basics', 'Organelles', 'Membranes', 'Energy',
    'Cell Cycle', 'Genetics', 'Lab Skills', 'Final Review'
];

const FIRST_NAMES = ['Maria', 'Jose', 'Angel', 'Carlo', 'Nica', 'Renz', 'Kyla', 'Miguel', 'Trisha', 'Paolo', 'Bea', 'Jerico', 'Angelica', 'Mark', 'Dyan', 'Ronan'];
const LAST_NAMES = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Villanueva', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Rivera', 'Aquino', 'Domingo', 'Salazar', 'Castro'];
const SECTIONS = ['1-A', '1-B', '1-C'];

function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

function buildMockStudents(count = 16) {
    const students = [];
    const today = new Date('2026-09-06');

    for (let i = 0; i < count; i++) {
        const rand = seededRandom(i * 97 + 13);
        const first = FIRST_NAMES[i % FIRST_NAMES.length];
        const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
        const fullName = `${first} ${last}`;
        const email = `${first.toLowerCase()}.${last.toLowerCase()}@parsu.edu.ph`;

        const joinedDaysAgo = Math.floor(rand() * 180) + 5;
        const joined = new Date(today);
        joined.setDate(joined.getDate() - joinedDaysAgo);

        const lastActiveDaysAgo = Math.floor(rand() * 60);
        const lastActive = new Date(today);
        lastActive.setDate(lastActive.getDate() - lastActiveDaysAgo);

        const modulesCompleted = Math.min(12, Math.floor(rand() * 13));
        const moduleProgress = MODULE_NAMES.map((name, idx) => ({
            name,
            percent: idx < modulesCompleted ? 100 : (idx === modulesCompleted ? Math.floor(rand() * 80) + 10 : 0)
        }));

        const quizAttempts = Math.floor(rand() * (QUIZ_NAMES.length + 1));
        const quizzes = QUIZ_NAMES.slice(0, quizAttempts).map((name, idx) => {
            const score = Math.floor(rand() * 41) + 60;
            const attemptDaysAgo = Math.floor(rand() * 150) + 1;
            const date = new Date(today);
            date.setDate(date.getDate() - attemptDaysAgo);
            return { name, score, date: date.toISOString().slice(0, 10), retakes: Math.floor(rand() * 3) };
        });
        const avgScore = quizzes.length
            ? Math.round(quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length)
            : null;

        const status = lastActiveDaysAgo > 30 ? 'inactive' : 'active';
        const section = SECTIONS[i % SECTIONS.length];

        students.push({
            id: `stu-${i + 1}`,
            catalogNo: String(i + 1).padStart(3, '0'),
            name: fullName,
            email,
            section,
            joined: joined.toISOString().slice(0, 10),
            lastActive: lastActive.toISOString().slice(0, 10),
            lastActiveDaysAgo,
            modulesCompleted,
            moduleProgress,
            quizzes,
            avgScore,
            status,
            archived: false
        });
    }
    return students;
}

let STUDENTS = buildMockStudents();
let currentFilter = { search: '', status: 'all', section: 'all' };

function getSectionStudents() {
    return currentFilter.section === 'all'
        ? STUDENTS
        : STUDENTS.filter(s => s.section === currentFilter.section);
}

function updateSectionSubtitle() {
    const subtitle = document.getElementById('sectionSubtitle');
    if (!subtitle) return;
    subtitle.textContent = currentFilter.section === 'all'
        ? 'Records for every student enrolled in the biology course.'
        : `Records for Section ${currentFilter.section} of the biology course.`;
}

/* ===================== RENDER: OVERVIEW STATS ===================== */

function renderOverview() {
    const scoped = getSectionStudents();
    const active = scoped.filter(s => !s.archived && s.status === 'active');
    const inactive = scoped.filter(s => !s.archived && s.status === 'inactive');
    const archived = scoped.filter(s => s.archived);
    const allScored = scoped.filter(s => s.avgScore !== null);
    const avgOverall = allScored.length
        ? Math.round(allScored.reduce((sum, s) => sum + s.avgScore, 0) / allScored.length)
        : 0;

    document.getElementById('statTotalStudents').textContent = scoped.filter(s => !s.archived).length;
    document.getElementById('statActiveStudents').textContent = active.length;
    document.getElementById('statAvgScore').textContent = `${avgOverall}%`;
    document.getElementById('statArchived').textContent = archived.length;
    document.getElementById('statInactiveMeta').textContent = `${inactive.length} flagged inactive`;

    // Top performers
    const topList = document.getElementById('topPerformersList');
    topList.innerHTML = '';
    [...scoped]
        .filter(s => !s.archived && s.avgScore !== null)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5)
        .forEach((s, idx) => {
            const li = document.createElement('div');
            li.className = 'goal-item';
            li.innerHTML = `
                <div class="label-row">
                    <span class="dot"></span>
                    <span>${idx + 1}. ${s.name}</span>
                </div>
                <span class="score">${s.avgScore}%</span>
            `;
            topList.appendChild(li);
        });
        if (!topList.children.length) {
            topList.innerHTML = '<p class="text-muted small mb-0">No quiz data yet.</p>';
        }

    // Recent activity feed
    const feed = document.getElementById('activityFeed');
    feed.innerHTML = '';
    [...scoped]
        .filter(s => !s.archived)
        .sort((a, b) => a.lastActiveDaysAgo - b.lastActiveDaysAgo)
        .slice(0, 6)
        .forEach(s => {
            const item = document.createElement('div');
            item.className = 'lesson-item';
            item.style.cursor = 'default';
            const when = s.lastActiveDaysAgo === 0 ? 'Today' : `${s.lastActiveDaysAgo}d ago`;
            item.innerHTML = `
                <div class="lesson-left">
                    <div class="lesson-icon"><i class="bi bi-person-check"></i></div>
                    <div>
                        <div class="lesson-name">${s.name}</div>
                        <div class="lesson-meta">Last active &middot; ${when}</div>
                    </div>
                </div>
                <span class="pill ${s.status === 'active' ? 'live' : 'todo'}">${s.status}</span>
            `;
            feed.appendChild(item);
        });
}

/* ===================== RENDER: STUDENT TABLE ===================== */

function getFilteredStudents() {
    return getSectionStudents().filter(s => {
        if (s.archived) return false;
        const matchesSearch = !currentFilter.search ||
            s.name.toLowerCase().includes(currentFilter.search) ||
            s.email.toLowerCase().includes(currentFilter.search);
        const matchesStatus = currentFilter.status === 'all' || s.status === currentFilter.status;
        return matchesSearch && matchesStatus;
    });
}

function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    const rows = getFilteredStudents();
    tbody.innerHTML = '';

    document.getElementById('studentCountBadge').textContent = `${rows.length} student${rows.length === 1 ? '' : 's'}`;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="admin-empty-row">No students match this filter.</td></tr>`;
        return;
    }

    rows.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="student-cell">
                    <span class="catalog-no">No. ${s.catalogNo}</span>
                    <div>
                        <div class="student-name">${s.name}</div>
                        <div class="student-email">${s.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="section-tag">${s.section}</span></td>
            <td>${s.joined}</td>
            <td>${s.modulesCompleted}/12</td>
            <td>${s.avgScore !== null ? s.avgScore + '%' : '&mdash;'}</td>
            <td><span class="status-badge ${s.status}">${s.status}</span></td>
            <td>${s.lastActiveDaysAgo === 0 ? 'Today' : s.lastActiveDaysAgo + 'd ago'}</td>
            <td class="admin-actions-cell">
                <button class="ledger-action" title="View progress" data-action="progress" data-id="${s.id}">Progress</button>
                <button class="ledger-action" title="Quiz performance" data-action="quiz" data-id="${s.id}">Quiz</button>
                <button class="ledger-action" title="Manage account" data-action="manage" data-id="${s.id}">Manage</button>
                <button class="ledger-action danger" title="Archive student" data-action="archive" data-id="${s.id}">Archive</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* ===================== RENDER: ARCHIVED TABLE ===================== */

function renderArchivedTable() {
    const tbody = document.getElementById('archivedTableBody');
    const rows = getSectionStudents().filter(s => s.archived);
    tbody.innerHTML = '';
    document.getElementById('archivedCountBadge').textContent = `${rows.length} archived`;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="admin-empty-row">No archived accounts.</td></tr>`;
        return;
    }

    rows.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="student-cell">
                    <span class="catalog-no">No. ${s.catalogNo}</span>
                    <div>
                        <div class="student-name">${s.name}</div>
                        <div class="student-email">${s.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="section-tag">${s.section}</span></td>
            <td>${s.lastActiveDaysAgo}d before archiving</td>
            <td>${s.modulesCompleted}/12</td>
            <td>${s.avgScore !== null ? s.avgScore + '%' : '&mdash;'}</td>
            <td class="admin-actions-cell">
                <button class="ledger-action" data-action="restore" data-id="${s.id}">Restore</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAll() {
    renderOverview();
    renderStudentTable();
    renderArchivedTable();
}

/* ===================== NAVIGATION (scroll, not show/hide) ===================== */

function setActiveView(view) {
    const section = document.querySelector(`.admin-view[data-view="${view}"]`);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.querySelectorAll('.sidebar-bg .nav-link[data-view]').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });
}

function setupScrollSpy() {
    const sections = Array.from(document.querySelectorAll('.admin-view'));
    const navLinksByView = {};
    document.querySelectorAll('.sidebar-bg .nav-link[data-view]').forEach(link => {
        navLinksByView[link.dataset.view] = link;
    });

    const scrollSpy = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const view = entry.target.dataset.view;
                Object.values(navLinksByView).forEach(l => l.classList.remove('active'));
                navLinksByView[view]?.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sections.forEach(section => scrollSpy.observe(section));
}

/* ===================== MODALS ===================== */

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
}

function openProgressModal(student) {
    document.getElementById('progressModalName').textContent = student.name;
    document.getElementById('progressModalMeta').textContent =
        `${student.modulesCompleted} of 12 modules completed \u00b7 Joined ${student.joined}`;

    const list = document.getElementById('progressModuleList');
    list.innerHTML = '';
    student.moduleProgress.forEach(m => {
        const row = document.createElement('div');
        row.className = 'progress-row';
        row.innerHTML = `
            <div class="progress-row-label">
                <span>${m.name}</span>
                <span>${m.percent}%</span>
            </div>
            <div class="lesson-progress"><span style="width:${m.percent}%"></span></div>
        `;
        list.appendChild(row);
    });
    openModal('progressModal');
}

function openQuizModal(student) {
    document.getElementById('quizModalName').textContent = student.name;
    document.getElementById('quizModalMeta').textContent = student.avgScore !== null
        ? `Average score: ${student.avgScore}% across ${student.quizzes.length} quiz${student.quizzes.length === 1 ? '' : 'zes'}`
        : 'No quiz attempts recorded yet.';

    const body = document.getElementById('quizModalTableBody');
    body.innerHTML = '';
    if (!student.quizzes.length) {
        body.innerHTML = `<tr><td colspan="4" class="admin-empty-row">No quiz attempts yet.</td></tr>`;
    } else {
        student.quizzes.forEach(q => {
            const tr = document.createElement('tr');
            const scoreClass = q.score >= 85 ? 'good' : (q.score >= 70 ? 'ok' : 'low');
            tr.innerHTML = `
                <td>${q.name}</td>
                <td><span class="score-pill ${scoreClass}">${q.score}%</span></td>
                <td>${q.retakes}</td>
                <td>${q.date}</td>
            `;
            body.appendChild(tr);
        });
    }
    openModal('quizModal');
}

function openManageModal(student) {
    document.getElementById('manageModalId').value = student.id;
    document.getElementById('manageModalName').value = student.name;
    document.getElementById('manageModalEmail').value = student.email;
    document.getElementById('manageModalStatus').value = student.status;
    openModal('manageModal');
}

/* ===================== ACTIONS ===================== */

function findStudent(id) {
    return STUDENTS.find(s => s.id === id);
}

function handleTableClick(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const student = findStudent(id);
    if (!student) return;

    if (action === 'progress') openProgressModal(student);
    if (action === 'quiz') openQuizModal(student);
    if (action === 'manage') openManageModal(student);
    if (action === 'archive') {
        student.archived = true;
        renderAll();
    }
    if (action === 'restore') {
        student.archived = false;
        renderAll();
    }
}

function handleManageFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('manageModalId').value;
    const student = findStudent(id);
    if (!student) return;

    student.name = document.getElementById('manageModalName').value.trim() || student.name;
    student.email = document.getElementById('manageModalEmail').value.trim() || student.email;
    student.status = document.getElementById('manageModalStatus').value;

    closeModal('manageModal');
    renderAll();
}

function handleManageDeactivate() {
    const id = document.getElementById('manageModalId').value;
    const student = findStudent(id);
    if (!student) return;
    student.archived = true;
    closeModal('manageModal');
    renderAll();
}

/* ===================== INIT ===================== */

document.addEventListener('DOMContentLoaded', async () => {
    if (window.ecoAuth) {
        await ecoAuth.requireAdmin();
        try {
            const { data } = await ecoAuth.client.auth.getSession();
            const user = data?.session?.user;
            if (user) {
                const displayName = user.user_metadata?.full_name || user.email || 'Admin';
                document.getElementById('adminName').textContent = displayName;

                const avatarEl = document.getElementById('topbarAvatar');
                if (avatarEl) {
                    const initials = displayName
                        .trim()
                        .split(/\s+/)
                        .map(part => part[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();
                    avatarEl.textContent = initials || 'A';
                    avatarEl.title = displayName;
                }
            }
        } catch (e) { /* keep default label */ }

        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => window.ecoAuth.signOut());
        }
    }

    updateSectionSubtitle();
    renderAll();
    setupScrollSpy();

    const topbarSearch = document.getElementById('topbarSearch');
    const studentSearchInput = document.getElementById('studentSearch');
    topbarSearch?.addEventListener('input', (e) => {
        const value = e.target.value;
        if (studentSearchInput) studentSearchInput.value = value;
        currentFilter.search = value.trim().toLowerCase();
        renderStudentTable();
    });
    topbarSearch?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setActiveView('students');
        }
    });

    document.querySelectorAll('.sidebar-bg .nav-link[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveView(link.dataset.view);
        });
    });

    document.getElementById('studentTableBody').addEventListener('click', handleTableClick);
    document.getElementById('archivedTableBody').addEventListener('click', handleTableClick);

    document.getElementById('studentSearch').addEventListener('input', (e) => {
        currentFilter.search = e.target.value.trim().toLowerCase();
        renderStudentTable();
        if (topbarSearch) topbarSearch.value = e.target.value;
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
        currentFilter.status = e.target.value;
        renderStudentTable();
    });

    document.getElementById('sectionSelect').addEventListener('change', (e) => {
        currentFilter.section = e.target.value;
        updateSectionSubtitle();
        renderAll();
    });

    document.getElementById('manageForm').addEventListener('submit', handleManageFormSubmit);
    document.getElementById('manageDeactivateBtn').addEventListener('click', handleManageDeactivate);

    document.querySelectorAll('[data-close-modal]').forEach(el => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.admin-modal.is-open').forEach(m => closeModal(m.id));
        }
    });

    document.getElementById('goToStudentsBtn')?.addEventListener('click', (e) => { e.preventDefault(); setActiveView('students'); });
    document.getElementById('headerLedgerLink')?.addEventListener('click', () => setActiveView('students'));
});