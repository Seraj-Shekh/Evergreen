import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { changeUserPassword, clearUserToken, fetchUserProfile, getUserToken, updateUserPhone, userLogin } from '../lib/api.js';

const initialLogin = { email: '', password: '' };
const initialPassword = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function UserPortalPage() {
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [passwordForm, setPasswordForm] = useState(initialPassword);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [profile, setProfile] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getUserToken()));
  const [phoneForm, setPhoneForm] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);

  const { section } = useParams();

  const sections = useMemo(
    () => [
      { key: 'info', label: 'My information' },
      { key: 'settings', label: 'Settings' },
      { key: 'group', label: 'Group members' },
      { key: 'income', label: 'Income details' },
    ],
    []
  );

  const activeSection = useMemo(() => {
    const match = sections.find(item => item.key === section);
    return match ? match.key : 'menu';
  }, [section, sections]);

  const fullName = profile?.user?.fullName || '';
  const nameParts = fullName.trim().split(' ').filter(Boolean);
  const initials = nameParts.length
    ? `${nameParts[0][0] || ''}${nameParts[nameParts.length - 1][0] || ''}`.toUpperCase()
    : 'EB';

  const loadProfile = async () => {
    setProfileError('');
    try {
      const response = await fetchUserProfile();
      setProfile(response.data);
      setMustChangePassword(Boolean(response.data?.user?.mustChangePassword));
      setPhoneForm(response.data?.applicant?.phoneNumber || '');
    } catch (error) {
      setProfileError(error.message || 'Unable to load profile');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated]);

  const handleLoginSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
      const response = await userLogin(loginForm);
      setMustChangePassword(Boolean(response.data?.mustChangePassword));
      setIsAuthenticated(true);
      setLoginForm(initialLogin);
      await loadProfile();
    } catch (error) {
      setLoginError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async event => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changeUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('Password updated successfully');
      setMustChangePassword(false);
      setPasswordForm(initialPassword);
      await loadProfile();
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async event => {
    event.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');

    if (!phoneForm.trim()) {
      setPhoneError('Phone number is required');
      return false;
    }

    setLoading(true);
    try {
      await updateUserPhone(phoneForm.trim());
      setPhoneSuccess('Phone number updated');
      await loadProfile();
      return true;
    } catch (error) {
      setPhoneError(error.message || 'Failed to update phone number');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const openPhoneDialog = () => {
    setPhoneError('');
    setPhoneSuccess('');
    setPhoneForm(profile?.applicant?.phoneNumber || '');
    setIsPhoneDialogOpen(true);
  };

  const closePhoneDialog = () => {
    setIsPhoneDialogOpen(false);
  };

  const handleLogout = () => {
    clearUserToken();
    setIsAuthenticated(false);
    setProfile(null);
    setLoginForm(initialLogin);
    setPasswordForm(initialPassword);
  };

  if (!isAuthenticated) {
    return (
      <section className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-3xl overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] md:grid-cols-[1.1fr_1.4fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-forest-600 via-forest-700 to-forest-800 p-8 text-white">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold">EB</div>
              <h2 className="mt-6 text-2xl font-semibold">Applicant Portal</h2>
              <p className="mt-2 text-sm text-white/80">
                Sign in to review your application status, group ID, and contact details.
              </p>
              <div className="mt-6 rounded-2xl bg-white/15 px-4 py-3 text-xs">
                <p className="font-semibold">Secure access</p>
                <p className="mt-1 text-white/80">You will be asked to update your password after your first login.</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Login</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Welcome back</h3>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
              <label className="block text-left text-sm font-medium text-slate-700">
                Email
                <input
                  className="input mt-2"
                  type="email"
                  value={loginForm.email}
                  onChange={event => setLoginForm(current => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="block text-left text-sm font-medium text-slate-700">
                Password
                <input
                  className="input mt-2"
                  type="password"
                  value={loginForm.password}
                  onChange={event => setLoginForm(current => ({ ...current, password: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </label>
              {loginError ? <p className="text-left text-sm text-rose-600">{loginError}</p> : null}
              <button
                type="submit"
                className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen w-full bg-slate-50 px-0 py-0 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-10 lg:px-8">
      <div className="min-h-screen w-full rounded-none bg-white shadow-none sm:min-h-0 sm:w-full sm:max-w-6xl sm:rounded-[32px] sm:shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
        <div className="grid min-h-screen gap-6 p-4 sm:min-h-0 sm:p-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block rounded-[28px] border border-slate-100 bg-gradient-to-br from-forest-600 via-forest-700 to-forest-800 p-6 text-white">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-2xl font-semibold">
                {initials}
              </div>
              <h2 className="mt-4 text-lg font-semibold">{profile?.user?.fullName || 'Applicant'}</h2>
              <p className="mt-1 text-xs text-white/70">{profile?.user?.email || ''}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {mustChangePassword ? (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Action required</span>
                ) : null}
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  {profile?.applicant?.status || 'Pending'}
                </span>
              </div>
            </div>

            <nav className="mt-8 space-y-2">
              {sections.map(item => (
                <Link
                  key={item.key}
                  to={`/portal/${item.key}`}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === item.key
                      ? 'bg-white text-slate-900'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-white/70">›</span>
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-8 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Logout
            </button>
          </aside>

          <div className="space-y-6">
            {activeSection !== 'menu' && (
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 lg:hidden">
                <Link to="/portal" className="text-sm font-semibold text-forest-700">← Menu</Link>
                <span className="text-sm font-semibold text-slate-700">
                  {sections.find(item => item.key === activeSection)?.label || 'My information'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-semibold text-slate-700"
                >
                  Logout
                </button>
              </div>
            )}

            {profileError ? <p className="text-sm text-rose-600">{profileError}</p> : null}

            {activeSection === 'menu' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:hidden">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-700 text-white">{initials}</div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Profile</p>
                    <h2 className="text-xl font-semibold text-slate-900">{profile?.user?.fullName || 'Applicant'}</h2>
                    <p className="text-xs text-slate-500">{profile?.user?.email || ''}</p>
                  </div>
                </div>
                <nav className="mt-6 space-y-2">
                  {sections.map(item => (
                    <Link
                      key={item.key}
                      to={`/portal/${item.key}`}
                      className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-slate-400">›</span>
                    </Link>
                  ))}
                </nav>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            )}

            {(activeSection === 'info' || activeSection === 'menu') && (
              <div className={`rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${activeSection === 'menu' ? 'hidden lg:block' : ''}`}>
                <h3 className="text-xl font-semibold text-slate-900">My information</h3>
                <p className="mt-1 text-sm text-slate-500">Your personal details and current status.</p>
                <dl className="mt-6 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.user?.fullName || '—'}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.user?.email || '—'}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Group ID</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.applicant?.groupId || 'Not assigned yet'}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">Phone</dt>
                        <dd className="mt-1 font-semibold text-slate-900">{profile?.applicant?.phoneNumber || '—'}</dd>
                      </div>
                      <button
                        type="button"
                        onClick={openPhoneDialog}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-forest-200 hover:text-forest-700"
                        aria-label="Edit phone number"
                      >
                        ✎
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
                    <dd className="mt-1 font-semibold capitalize text-slate-900">{profile?.applicant?.status || 'Pending'}</dd>
                  </div>
                </dl>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="grid gap-6">
                <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Change password</h3>
                    {mustChangePassword ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Action required</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Use a new password and keep it safe.</p>
                  <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
                    <label className="block text-sm font-medium text-slate-700">
                      Current password
                      <input
                        className="input mt-2"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={event => setPasswordForm(current => ({ ...current, currentPassword: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      New password
                      <input
                        className="input mt-2"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Confirm new password
                      <input
                        className="input mt-2"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={event => setPasswordForm(current => ({ ...current, confirmPassword: event.target.value }))}
                        required
                      />
                    </label>
                    {passwordError ? <p className="text-sm text-rose-600">{passwordError}</p> : null}
                    {passwordSuccess ? <p className="text-sm text-emerald-600">{passwordSuccess}</p> : null}
                    <button
                      type="submit"
                      className="rounded-full bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={loading}
                    >
                      {loading ? 'Saving…' : 'Update password'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeSection === 'group' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <h3 className="text-xl font-semibold text-slate-900">Group members</h3>
                <p className="mt-1 text-sm text-slate-500">Members assigned to your group will appear here.</p>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No group members assigned yet.
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'income' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <h3 className="text-xl font-semibold text-slate-900">Income details</h3>
                <p className="mt-1 text-sm text-slate-500">Daily berry sales and income details will appear here.</p>
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                  This section will be enabled once daily income tracking is added.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isPhoneDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closePhoneDialog} />
          <div className="relative w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Update phone number</h3>
              <button
                type="button"
                onClick={closePhoneDialog}
                className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">Keep your contact info current for updates.</p>
            <form
              className="mt-5 space-y-4"
              onSubmit={async event => {
                const didUpdate = await handlePhoneSubmit(event);
                if (didUpdate) {
                  setIsPhoneDialogOpen(false);
                }
              }}
            >
              <label className="block text-sm font-medium text-slate-700">
                Phone number
                <input
                  className="input mt-2"
                  value={phoneForm}
                  onChange={event => setPhoneForm(event.target.value)}
                  required
                />
              </label>
              {phoneError ? <p className="text-sm text-rose-600">{phoneError}</p> : null}
              {phoneSuccess ? <p className="text-sm text-emerald-600">{phoneSuccess}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={closePhoneDialog}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? 'Saving…' : 'Save phone number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
