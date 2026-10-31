/* Configure these values from Supabase Project Settings > API. */
const SUPABASE_URL = 'https://klmrycrkldeafmnsfqex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbXJ5Y3JrbGRlYWZtbnNmcWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNzI1MjgsImV4cCI6MjEwMjk0ODUyOH0.EPpQO9GO1zjyFxIlZ79CWhINEiLS8dDuFa7tiMl8WRg';

const ecoSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.ecoAuth = {
  client: ecoSupabase,

  async getRole(session) {
    const user = session?.user;
    if (!user) return null;

    const { data: profile, error } = await ecoSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw new Error(`Unable to read your account role: ${error.message}`);

    return profile?.role || user.user_metadata?.role || 'student';
  },

  // Section lives only in profiles.section (set by a section code or by an
  // admin). Returns null when the student has not joined a section yet.
  async getSection(session) {
    const user = session?.user;
    if (!user) return null;

    const { data: profile, error } = await ecoSupabase
      .from('profiles')
      .select('section')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw new Error(`Unable to read your section: ${error.message}`);

    const section = String(profile?.section ?? '').trim();
    return section || null;
  },

  // Calls the redeem_section_code() database function
  // (see supabase-section-codes.sql). Always resolves to an object:
  // { ok: true, section } or { ok: false, error, ... }.
  async redeemSectionCode(code) {
    const { data, error } = await ecoSupabase.rpc('redeem_section_code', { p_code: code });
    if (error) return { ok: false, error: 'server_error', detail: error.message };
    return data || { ok: false, error: 'server_error', detail: 'Empty response.' };
  },

  // Student-friendly text for a redeemSectionCode() result.
  sectionCodeMessage(result) {
    switch (result?.error) {
      case 'invalid_code':
        return "That code isn't valid. Check it and try again.";
      case 'expired':
        return 'This code has expired. Ask your teacher for a new one.';
      case 'disabled':
        return 'This code has been turned off. Ask your teacher for a new one.';
      case 'already_in_section':
        return result.section
          ? `You're already in Section ${result.section}. Ask your teacher if it needs to change.`
          : "You're already in a section. Ask your teacher if it needs to change.";
      case 'rate_limited': {
        const mins = Number(result.retry_minutes) || 15;
        return `Too many incorrect tries. Wait ${mins} ${mins === 1 ? 'minute' : 'minutes'}, then try again.`;
      }
      case 'not_student':
        return 'Only student accounts can join a section.';
      case 'no_profile':
        return "We couldn't find your student profile. Please contact your teacher.";
      case 'not_signed_in':
        return 'Your session ended. Please sign in again.';
      default:
        return /redeem_section_code/i.test(result?.detail || '')
          ? 'Section codes are not set up yet. Ask your teacher to run supabase-section-codes.sql in Supabase.'
          : `We couldn't check the code right now. ${result?.detail || 'Please try again.'}`.trim();
    }
  },

  async requireSession() {
    const { data, error } = await ecoSupabase.auth.getSession();
    if (error || !data.session) {
      window.location.replace('login.html');
      return null;
    }
    return data.session;
  },

  async requireRole(role) {
    const session = await this.requireSession();
    if (!session) return null;

    const currentRole = await this.getRole(session);
    if (currentRole !== role) {
      window.location.replace(role === 'admin' ? 'choose.html' : 'admin.html');
      return null;
    }
    return session;
  },

  async requireAdmin() {
    return this.requireRole('admin');
  },

  async requireStudent() {
    const session = await this.requireRole('student');
    if (!session) return null;

    // A student must belong to a section before using the site. If they
    // have none (for example a first Google sign-in), send them to the
    // login page, which shows the "enter your section code" step.
    try {
      const section = await this.getSection(session);
      if (!section) {
        window.location.replace('login.html');
        return null;
      }
    } catch (e) {
      console.error('Section check failed:', e.message);   // don't lock students out on a read error
    }
    return session;
  },

  async signOut() {
    const { error } = await ecoSupabase.auth.signOut();
    if (error) throw new Error(`Unable to sign out: ${error.message}`);
    window.location.replace('index.html');
  }
};

// =========================================
// LOGOUT CONFIRMATION
// Shared by every page that uses auth.js.
// =========================================
let logoutDialog;
let logoutCancelButton;
let logoutConfirmButton;
let logoutError;
let logoutTrigger;
let logoutCloseTimer;
let logoutInProgress = false;
let logoutScrollState;

function lockLogoutBackgroundScroll() {
  if (logoutScrollState) return;

  const bodyStyle = document.body.style;
  const rootStyle = document.documentElement.style;
  const bodyProperties = ['position', 'top', 'left', 'right', 'width', 'overflow'];
  const bodyWidth = window.getComputedStyle(document.body).width;
  const savedBodyStyles = {};

  bodyProperties.forEach((property) => {
    savedBodyStyles[property] = {
      value: bodyStyle.getPropertyValue(property),
      priority: bodyStyle.getPropertyPriority(property)
    };
  });

  logoutScrollState = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    bodyStyles: savedBodyStyles,
    rootOverflow: rootStyle.getPropertyValue('overflow'),
    rootOverflowPriority: rootStyle.getPropertyPriority('overflow'),
    rootScrollbarGutter: rootStyle.getPropertyValue('scrollbar-gutter'),
    rootScrollbarGutterPriority: rootStyle.getPropertyPriority('scrollbar-gutter')
  };

  bodyStyle.position = 'fixed';
  bodyStyle.top = `-${logoutScrollState.scrollY}px`;
  bodyStyle.left = `-${logoutScrollState.scrollX}px`;
  bodyStyle.right = 'auto';
  bodyStyle.width = bodyWidth;
  bodyStyle.overflow = 'hidden';
  rootStyle.scrollbarGutter = 'stable';
  rootStyle.overflow = 'hidden';
}

function unlockLogoutBackgroundScroll() {
  if (!logoutScrollState) return;

  const {
    scrollX,
    scrollY,
    bodyStyles,
    rootOverflow,
    rootOverflowPriority,
    rootScrollbarGutter,
    rootScrollbarGutterPriority
  } = logoutScrollState;
  const bodyStyle = document.body.style;
  const rootStyle = document.documentElement.style;

  Object.entries(bodyStyles).forEach(([property, savedStyle]) => {
    if (savedStyle.value) {
      bodyStyle.setProperty(property, savedStyle.value, savedStyle.priority);
    } else {
      bodyStyle.removeProperty(property);
    }
  });
  if (rootOverflow) {
    rootStyle.setProperty('overflow', rootOverflow, rootOverflowPriority);
  } else {
    rootStyle.removeProperty('overflow');
  }
  if (rootScrollbarGutter) {
    rootStyle.setProperty('scrollbar-gutter', rootScrollbarGutter, rootScrollbarGutterPriority);
  } else {
    rootStyle.removeProperty('scrollbar-gutter');
  }

  logoutScrollState = null;
  return { scrollX, scrollY };
}

function ensureLogoutDialog() {
  if (logoutDialog) return;

  if (!document.querySelector('link[data-logout-confirmation-styles]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'css/logout-confirmation.css';
    stylesheet.dataset.logoutConfirmationStyles = '';
    document.head.append(stylesheet);
  }

  const dialog = document.createElement('div');
  dialog.className = 'logout-confirmation';
  dialog.hidden = true;
  dialog.setAttribute('aria-hidden', 'true');
  dialog.innerHTML = `
    <section
      class="logout-confirmation__modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logoutConfirmationTitle"
      aria-describedby="logoutConfirmationDescription"
      tabindex="-1"
    >
      <div class="logout-confirmation__icon" aria-hidden="true">
        <i class="bi bi-box-arrow-right"></i>
      </div>
      <h2 class="logout-confirmation__title" id="logoutConfirmationTitle">
        Are you sure you want to log out?
      </h2>
      <p class="logout-confirmation__description" id="logoutConfirmationDescription">
        You will be signed out of your account. You can log back in anytime.
      </p>
      <p class="logout-confirmation__error" role="alert" hidden></p>
      <div class="logout-confirmation__actions">
        <button class="logout-confirmation__cancel" type="button">Cancel</button>
        <button class="logout-confirmation__confirm" type="button">
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
          <span>Log Out</span>
        </button>
      </div>
    </section>
  `;
  document.documentElement.append(dialog);

  logoutDialog = dialog;
  logoutCancelButton = dialog.querySelector('.logout-confirmation__cancel');
  logoutConfirmButton = dialog.querySelector('.logout-confirmation__confirm');
  logoutError = dialog.querySelector('.logout-confirmation__error');

  function closeLogoutDialog() {
    if (dialog.hidden || logoutInProgress) return;

    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.inert = true;

    logoutCloseTimer = window.setTimeout(() => {
      dialog.hidden = true;
      dialog.inert = false;
      document.body.classList.remove('logout-confirmation-open');
      const restoredScroll = unlockLogoutBackgroundScroll();
      logoutTrigger?.focus({ preventScroll: true });
      if (restoredScroll) window.scrollTo(restoredScroll.scrollX, restoredScroll.scrollY);
      logoutTrigger = null;
    }, 180);
  }

  logoutCancelButton.addEventListener('click', closeLogoutDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeLogoutDialog();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLogoutDialog();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      (event.shiftKey ? logoutConfirmButton : logoutCancelButton).focus({ preventScroll: true });
    }
  });
  logoutConfirmButton.addEventListener('click', async () => {
    if (logoutInProgress) return;
    logoutInProgress = true;
    logoutConfirmButton.disabled = true;
    logoutCancelButton.disabled = true;
    logoutConfirmButton.querySelector('span').textContent = 'Logging out…';
    logoutError.hidden = true;

    try {
      await window.ecoAuth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      logoutError.textContent = 'We could not log you out. Please try again.';
      logoutError.hidden = false;
      logoutConfirmButton.querySelector('span').textContent = 'Log Out';
      logoutConfirmButton.disabled = false;
      logoutCancelButton.disabled = false;
      logoutInProgress = false;
      logoutConfirmButton.focus({ preventScroll: true });
    }
  });
}

function openLogoutDialog(trigger) {
  if (logoutDialog.classList.contains('is-open')) {
    logoutCancelButton.focus({ preventScroll: true });
    return;
  }

  window.clearTimeout(logoutCloseTimer);
  lockLogoutBackgroundScroll();
  logoutTrigger = trigger;
  logoutError.hidden = true;
  logoutError.textContent = '';
  logoutConfirmButton.disabled = false;
  logoutCancelButton.disabled = false;
  logoutConfirmButton.querySelector('span').textContent = 'Log Out';
  logoutDialog.inert = false;
  logoutDialog.hidden = false;
  logoutDialog.setAttribute('aria-hidden', 'false');
  document.body.classList.add('logout-confirmation-open');
  window.requestAnimationFrame(() => {
    logoutDialog.classList.add('is-open');
    logoutCancelButton.focus({ preventScroll: true });
  });
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest('#logoutButton, #profileLogoutBtn');
  if (!trigger) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  ensureLogoutDialog();
  openLogoutDialog(trigger);
}, true);

// =========================================
// RESPONSIVE SIDEBAR (MOBILE OFF-CANVAS)
// Runs on every page; no-ops if the page has
// no .sidebar-bg element (e.g. login/signup).
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar-bg');
  if (!sidebar) return;

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'sidebar-toggle-global';
  toggleButton.setAttribute('aria-label', 'Open menu');
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.innerHTML = '<i class="bi bi-list"></i>';

  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';

  document.body.prepend(backdrop);
  document.body.prepend(toggleButton);

  function openSidebar() {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-visible');
    toggleButton.setAttribute('aria-expanded', 'true');
    toggleButton.innerHTML = '<i class="bi bi-x-lg"></i>';
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.innerHTML = '<i class="bi bi-list"></i>';
  }

  toggleButton.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop.addEventListener('click', closeSidebar);

  // Close automatically when a nav link is used on mobile.
  sidebar.querySelectorAll('a.nav-link, button#logoutButton').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });
});

// =========================================
// HEARTBEAT (presence / "last seen")
// Runs on every page that includes this file. If there's an active
// session, pings touch_last_seen() (see add-last-seen-heartbeat.sql)
// right away and then every 60s while the tab stays open, so
// admin.html can show real "Active now" / "Active 9m ago" status
// instead of a guess. No-ops entirely on pages with no session
// (e.g. login.html), and never throws — a failed heartbeat just
// means that student's status goes stale, not a broken page.
// =========================================
(async function startHeartbeat() {
  const { data } = await ecoSupabase.auth.getSession();
  if (!data.session) return;

  const avatarUrl = data.session.user?.user_metadata?.avatar_url
    || data.session.user?.user_metadata?.picture;
  if (avatarUrl) {
    const { error: avatarError } = await ecoSupabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', data.session.user.id);
    if (avatarError && !/avatar_url|column/i.test(avatarError.message || '')) {
      console.error('Profile avatar sync failed:', avatarError.message);
    }
  }

  const beat = () => {
    ecoSupabase.rpc('touch_last_seen').then(({ error }) => {
      if (error) console.error('Heartbeat failed:', error.message);
    });
  };

  beat();
  setInterval(beat, 60000);
})();