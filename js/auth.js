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
    return this.requireRole('student');
  },

  async signOut() {
    await ecoSupabase.auth.signOut();
    window.location.replace('login.html');
  }
};

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