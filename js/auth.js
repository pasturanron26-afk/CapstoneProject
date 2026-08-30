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
