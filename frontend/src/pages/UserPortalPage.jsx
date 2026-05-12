import { useEffect, useState } from 'react';
import { changeUserPassword, clearUserToken, fetchUserProfile, getUserToken, userLogin } from '../lib/api.js';

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

  const loadProfile = async () => {
    setProfileError('');
    try {
      const response = await fetchUserProfile();
      setProfile(response.data);
      setMustChangePassword(Boolean(response.data?.user?.mustChangePassword));
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

  const handleLogout = () => {
    clearUserToken();
    setIsAuthenticated(false);
    setProfile(null);
    setLoginForm(initialLogin);
    setPasswordForm(initialPassword);
  };

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <form className="mt-2 space-y-4" onSubmit={handleLoginSubmit}>
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
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Applicant portal</p>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome{profile?.user?.fullName ? `, ${profile.user.fullName}` : ''}</h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Logout
        </button>
      </div>

      {profileError ? <p className="mt-4 text-sm text-rose-600">{profileError}</p> : null}

      <div className="mt-6 grid gap-6">
        <div className="rounded-3xl border border-forest-100 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-900">Application status</h2>
          <p className="mt-2 text-sm text-slate-600">
            {profile?.applicant?.status ? `Status: ${profile.applicant.status}` : 'Status not available yet.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {profile?.applicant?.submittedAt ? `Submitted ${new Date(profile.applicant.submittedAt).toLocaleString()}` : ''}
          </p>
        </div>

        <div className="rounded-3xl border border-forest-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
            {mustChangePassword ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Action required</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-600">Use a new password and keep it safe.</p>
          <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
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
    </section>
  );
}
