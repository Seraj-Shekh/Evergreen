import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { adminLogin, clearAdminToken, fetchAdminTopPickers, getAdminToken } from '../lib/api.js';

const loginInitial = { username: '', password: '' };

const formatCompactKg = value => new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
}).format(Number(value || 0));

const getMaxNetBerry = topPickers => (topPickers.length ? Math.max(...topPickers.map(picker => Number(picker.netBerryWeightKg || 0))) : 0);

export default function AdminTopPickersPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topPickers, setTopPickers] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setTopPickers([]);
    }
  }, [isAuthenticated]);

  const loadTopPickers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchAdminTopPickers();
      setTopPickers(response.data.topPickers || []);
    } catch (loadError) {
      setTopPickers([]);
      setError(loadError.message || 'Failed to load top pickers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadTopPickers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleLoginSubmit = async event => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      await adminLogin(loginForm);
      setIsAuthenticated(true);
      setLoginForm(loginInitial);
    } catch (error) {
      setLoginError(error.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setTopPickers([]);
    setError('');
  };

  const maxNetBerry = getMaxNetBerry(topPickers);

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Top pickers</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to see who has picked the most net berry weight so far.</p>
          <form className="mt-6 space-y-4 text-left" onSubmit={handleLoginSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Username
              <input
                className="input mt-2"
                value={loginForm.username}
                onChange={event => setLoginForm(current => ({ ...current, username: event.target.value }))}
                autoComplete="username"
                required
              />
            </label>
            <PasswordField
              label="Password"
              value={loginForm.password}
              onChange={event => setLoginForm(current => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
              required
              labelClassName="block text-sm font-medium text-slate-700"
            />
            {loginError ? <p className="text-sm text-rose-600">{loginError}</p> : null}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-forest-100 bg-white px-5 py-6 shadow-soft sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(22,101,52,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(120,53,15,0.10),transparent_30%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to admin
              </button>
              <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Top pickers</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Highest net berry pickers</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">This leaderboard ranks pickers by net berry weight picked until today, calculated as berry weight minus cart weight.</p>
          </div>
          <div className="rounded-3xl bg-white/90 px-4 py-3 text-right shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pickers loaded</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{topPickers.length}</p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadTopPickers}
            className="rounded-full border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {topPickers.slice(0, 4).map(picker => (
          <div key={picker.applicantId} className={`rounded-3xl border p-4 shadow-soft ${picker.rank === 1 ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white' : 'border-forest-100 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Rank #{picker.rank}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{picker.fullName}</h2>
                <p className="mt-1 text-sm text-slate-500">{picker.pickerId || '—'}</p>
                <p className="mt-1 text-sm text-slate-500">{picker.groupName || '—'}</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Net berry wt</p>
                <p className="text-lg font-semibold text-forest-700">{formatCompactKg(picker.netBerryWeightKg)} kg</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-forest-600 to-emerald-400"
                  style={{ width: `${maxNetBerry ? Math.max(8, (picker.netBerryWeightKg / maxNetBerry) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-forest-100 bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-forest-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
            <p className="text-sm text-slate-500">Top pickers ordered by net berry weight picked until today.</p>
          </div>
        </div>

        {error ? <p className="px-5 py-4 text-sm text-rose-600 sm:px-6">{error}</p> : null}
        {loading ? <p className="px-5 py-4 text-sm text-slate-600 sm:px-6">Loading top pickers…</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold sm:px-6">Rank</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Name</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Picker ID</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Net berry wt</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Group</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!loading && topPickers.length > 0 ? topPickers.map(picker => (
                <tr key={picker.applicantId} className={picker.rank === 1 ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'}>
                  <td className="px-5 py-4 sm:px-6">
                    <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      #{picker.rank}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900 sm:px-6">{picker.fullName}</td>
                  <td className="px-5 py-4 text-slate-700 sm:px-6">{picker.pickerId || '—'}</td>
                  <td className="px-5 py-4 font-semibold text-forest-700 sm:px-6">{formatCompactKg(picker.netBerryWeightKg)} kg</td>
                  <td className="px-5 py-4 text-slate-700 sm:px-6">{picker.groupName || '—'}</td>
                </tr>
              )) : null}
              {!loading && topPickers.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500 sm:px-6" colSpan="5">
                    No picker data found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
