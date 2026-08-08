import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { changeUserPassword, clearUserToken, downloadProtectedFile, fetchUserProfile, getExpenseHistory, getGroupMembers, getIncomeHistory, getUserToken, getUserTopPickers, updateUserBankDetails, updateUserPhone, userLogin, getUserPaymentHistory, getUserFineHistory } from '../lib/api.js';

const initialLogin = { email: '', password: '' };
const initialPassword = { currentPassword: '', newPassword: '', confirmPassword: '' };
const expensePlanDescriptions = {
  'own-car': 'includes trailer and accommodation',
  'rented-car': 'includes trailer, accommodation, and car',
};
const supportWhatsAppUrl = 'https://wa.me/358449500808';
const formatDateOnlyUtc = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'UTC',
}).format(new Date(value));
const formatCompactKg = value => new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
}).format(Number(value || 0));

const getNameInitials = value => {
  const parts = String(value || '').trim().split(' ').filter(Boolean);
  if (!parts.length) {
    return 'P';
  }

  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

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
  const [bankForm, setBankForm] = useState({ bankName: '', bankAccountNumber: '' });
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');
  const [bankSaving, setBankSaving] = useState(false);
  const [groupMembers, setGroupMembers] = useState(null);
  const [groupError, setGroupError] = useState('');
  const [incomeRecords, setIncomeRecords] = useState(null);
  const [incomeError, setIncomeError] = useState('');
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(10);
  const [incomeFilterForm, setIncomeFilterForm] = useState({ startDate: '', endDate: '' });
  const [appliedIncomeFilters, setAppliedIncomeFilters] = useState({ startDate: '', endDate: '' });
  const [expenseRecords, setExpenseRecords] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);
  const [expenseFilterForm, setExpenseFilterForm] = useState({ startDate: '', endDate: '' });
  const [appliedExpenseFilters, setAppliedExpenseFilters] = useState({ startDate: '', endDate: '' });
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [fineHistory, setFineHistory] = useState({ fineRecords: [], summary: { count: 0, amount: 0, vatAmount: 0, netAmount: 0 } });
  const [fineLoading, setFineLoading] = useState(false);
  const [fineError, setFineError] = useState('');
  const [topPickers, setTopPickers] = useState([]);
  const [topPickersLoading, setTopPickersLoading] = useState(false);
  const [topPickersError, setTopPickersError] = useState('');

  const { section } = useParams();

  const sections = useMemo(
    () => [
      { key: 'info', label: 'My information' },
      { key: 'settings', label: 'Settings' },
      { key: 'bank', label: 'Bank details' },
      { key: 'group', label: 'Group members' },
      { key: 'income', label: 'Income details' },
      { key: 'expense', label: 'Expense details' },
      { key: 'payments', label: 'Payment history' },
      { key: 'fines', label: 'Fine details' },
      { key: 'top-pickers', label: 'Top pickers' },
      { key: 'contact-support', label: 'Contact support' },
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
  const bankActionRequired = !profile?.user?.bankName || !profile?.user?.bankAccountNumber;
  const incomeTotal = Number(incomeRecords?.totalIncome || 0);
  const expenseTotal = Number(expenseRecords?.totalExpense || 0);
  const fineTotal = Number(fineHistory?.summary?.netAmount || 0);
  const maxTopPickerWeight = topPickers.length ? Math.max(...topPickers.map(item => Number(item.netBerryWeightKg || 0))) : 0;

  const loadProfile = async () => {
    setProfileError('');
    try {
      const response = await fetchUserProfile();
      setProfile(response.data);
      setMustChangePassword(Boolean(response.data?.user?.mustChangePassword));
      setPhoneForm(response.data?.applicant?.phoneNumber || '');
      setBankForm({
        bankName: response.data?.user?.bankName || '',
        bankAccountNumber: response.data?.user?.bankAccountNumber || '',
      });
    } catch (error) {
      setProfileError(error.message || 'Unable to load profile');
    }
  };

  const loadGroupMembers = async () => {
    setGroupError('');
    try {
      const response = await getGroupMembers();
      setGroupMembers(response.data);
    } catch (error) {
      setGroupError(error.message || 'Unable to load group members');
    }
  };

  const loadIncomeHistory = async (nextPage = incomePage, nextFilters = appliedIncomeFilters) => {
    setIncomeError('');
    setIncomeLoading(true);
    try {
      const response = await getIncomeHistory({
        page: nextPage,
        limit: incomePageSize,
        ...nextFilters,
      });
      setIncomeRecords(response.data);
    } catch (error) {
      setIncomeError(error.message || 'Unable to load income history');
    } finally {
      setIncomeLoading(false);
    }
  };

  const loadExpenseHistory = async (nextPage = expensePage, nextFilters = appliedExpenseFilters) => {
    setExpenseError('');
    setExpenseLoading(true);
    try {
      const response = await getExpenseHistory({
        page: nextPage,
        limit: expensePageSize,
        ...nextFilters,
      });
      setExpenseRecords(response.data);
    } catch (error) {
      setExpenseError(error.message || 'Unable to load expense history');
    } finally {
      setExpenseLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeSection === 'group') {
      loadGroupMembers();
    }
  }, [isAuthenticated, activeSection]);

  useEffect(() => {
    if (isAuthenticated && activeSection === 'income') {
      loadIncomeHistory();
    }
  }, [isAuthenticated, activeSection, incomePage, incomePageSize, appliedIncomeFilters]);

  useEffect(() => {
    if (isAuthenticated && activeSection === 'expense') {
      loadExpenseHistory();
    }
  }, [isAuthenticated, activeSection, expensePage, expensePageSize, appliedExpenseFilters]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== 'payments') {
      return;
    }

    const loadPaymentHistory = async () => {
      setPaymentLoading(true);
      setPaymentError('');

      try {
        const response = await getUserPaymentHistory();
        setPaymentRecords(response.data?.paymentRecords || []);
      } catch (error) {
        setPaymentRecords([]);
        setPaymentError(error.message || 'Unable to load payment history');
      } finally {
        setPaymentLoading(false);
      }
    };

    loadPaymentHistory();
  }, [isAuthenticated, activeSection]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== 'fines') {
      return;
    }

    const loadFineHistory = async () => {
      setFineLoading(true);
      setFineError('');

      try {
        const response = await getUserFineHistory();
        setFineHistory(response.data || { fineRecords: [], summary: { count: 0, amount: 0, vatAmount: 0, netAmount: 0 } });
      } catch (error) {
        setFineHistory({ fineRecords: [], summary: { count: 0, amount: 0, vatAmount: 0, netAmount: 0 } });
        setFineError(error.message || 'Unable to load fine history');
      } finally {
        setFineLoading(false);
      }
    };

    loadFineHistory();
  }, [isAuthenticated, activeSection]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== 'top-pickers') {
      return;
    }

    const loadTopPickers = async () => {
      setTopPickersLoading(true);
      setTopPickersError('');

      try {
        const response = await getUserTopPickers();
        setTopPickers(response.data?.topPickers || []);
      } catch (error) {
        setTopPickers([]);
        setTopPickersError(error.message || 'Unable to load top pickers');
      } finally {
        setTopPickersLoading(false);
      }
    };

    loadTopPickers();
  }, [isAuthenticated, activeSection]);

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

  const handleBankSubmit = async event => {
    event.preventDefault();
    setBankError('');
    setBankSuccess('');

    if (!bankForm.bankName.trim() || !bankForm.bankAccountNumber.trim()) {
      setBankError('Bank name and account number are required');
      return;
    }

    setBankSaving(true);
    try {
      await updateUserBankDetails(bankForm.bankName.trim(), bankForm.bankAccountNumber.trim());
      setBankSuccess('Bank details updated');
      await loadProfile();
    } catch (error) {
      setBankError(error.message || 'Failed to update bank details');
    } finally {
      setBankSaving(false);
    }
  };

  const handleIncomeFilterSubmit = async event => {
    event.preventDefault();
    const nextFilters = { ...incomeFilterForm };
    setAppliedIncomeFilters(nextFilters);
    setIncomePage(1);
  };

  const handleIncomeFilterReset = async () => {
    const nextFilters = { startDate: '', endDate: '' };
    setIncomeFilterForm(nextFilters);
    setAppliedIncomeFilters(nextFilters);
    setIncomePage(1);
  };

  const handleExpenseFilterSubmit = async event => {
    event.preventDefault();
    const nextFilters = { ...expenseFilterForm };
    setAppliedExpenseFilters(nextFilters);
    setExpensePage(1);
  };

  const handleExpenseFilterReset = async () => {
    const nextFilters = { startDate: '', endDate: '' };
    setExpenseFilterForm(nextFilters);
    setAppliedExpenseFilters(nextFilters);
    setExpensePage(1);
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
    setExpenseRecords(null);
    setPaymentRecords([]); // Reset payment records on logout
      setTopPickers([]);
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
                Sign in to review your application status, group name, and contact details.
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
              <PasswordField
                label="Password"
                value={loginForm.password}
                onChange={event => setLoginForm(current => ({ ...current, password: event.target.value }))}
                autoComplete="current-password"
                required
                labelClassName="block text-left text-sm font-medium text-slate-700"
              />
              <div className="mt-2 text-right">
                <Link to="/portal/forgot-password" className="text-sm font-semibold text-forest-700 hover:text-forest-800">
                  Forgot password?
                </Link>
              </div>
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
                {bankActionRequired ? (
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
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Picker ID</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.user?.pickerId || 'Not assigned yet'}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Group name</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.applicant?.groupName || 'Not assigned yet'}</dd>
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
                    <PasswordField
                      label="Current password"
                      value={passwordForm.currentPassword}
                      onChange={event => setPasswordForm(current => ({ ...current, currentPassword: event.target.value }))}
                      required
                    />
                    <PasswordField
                      label="New password"
                      value={passwordForm.newPassword}
                      onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))}
                      required
                    />
                    <PasswordField
                      label="Confirm new password"
                      value={passwordForm.confirmPassword}
                      onChange={event => setPasswordForm(current => ({ ...current, confirmPassword: event.target.value }))}
                      required
                    />
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

            {activeSection === 'bank' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Bank details</h3>
                  {bankActionRequired ? (
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Action required</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">Add your bank name and account number for payment processing.</p>
                <form className="mt-5 grid gap-4" onSubmit={handleBankSubmit}>
                  <label className="block text-sm font-medium text-slate-700">
                    Bank name
                    <input
                      className="input mt-2"
                      value={bankForm.bankName}
                      onChange={event => setBankForm(current => ({ ...current, bankName: event.target.value }))}
                      placeholder="Example Bank"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Bank account number
                    <input
                      className="input mt-2"
                      value={bankForm.bankAccountNumber}
                      onChange={event => setBankForm(current => ({ ...current, bankAccountNumber: event.target.value }))}
                      placeholder="FI00 1234 5678 90"
                      required
                    />
                  </label>
                  {bankError ? <p className="text-sm text-rose-600">{bankError}</p> : null}
                  {bankSuccess ? <p className="text-sm text-emerald-600">{bankSuccess}</p> : null}
                  <button
                    type="submit"
                    className="rounded-full bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={bankSaving}
                  >
                    {bankSaving ? 'Saving…' : 'Save bank details'}
                  </button>
                </form>
              </div>
            )}

            {activeSection === 'group' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <h3 className="text-xl font-semibold text-slate-900">Group members</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {groupMembers?.groupName ? `Members in ${groupMembers.groupName}` : 'Members assigned to your group will appear here.'}
                </p>
                {groupError ? <p className="mt-3 text-sm text-rose-600">{groupError}</p> : null}
                <div className="mt-5 grid gap-3">
                  {groupMembers?.members && groupMembers.members.length > 0 ? (
                    groupMembers.members.map(member => (
                      <div key={member._id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{member.fullName}</p>
                            <p className="text-xs text-slate-500">{member.email}</p>
                            {member.phoneNumber ? <p className="text-xs text-slate-500">{member.phoneNumber}</p> : null}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Group</p>
                            <p className="text-sm font-semibold text-slate-900">{member.groupName}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                      No group members assigned yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'income' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Income details</h3>
                    <p className="mt-1 text-sm text-slate-500">Track your daily berry picking income and weight details.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    Total earned: <span className="text-forest-700">€{incomeTotal.toFixed(2)}</span>
                  </div>
                </div>
                <form className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2" onSubmit={handleIncomeFilterSubmit}>
                  <label className="block text-sm font-medium text-slate-700">
                    Start date
                    <input
                      className="input mt-2"
                      type="date"
                      value={incomeFilterForm.startDate}
                      onChange={event => setIncomeFilterForm(current => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    End date
                    <input
                      className="input mt-2"
                      type="date"
                      value={incomeFilterForm.endDate}
                      onChange={event => setIncomeFilterForm(current => ({ ...current, endDate: event.target.value }))}
                    />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="rounded-full bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800">
                      Apply date filter
                    </button>
                    <button type="button" onClick={handleIncomeFilterReset} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Reset
                    </button>
                  </div>
                </form>
                {incomeError ? <p className="mt-3 text-sm text-rose-600">{incomeError}</p> : null}
                <div className="mt-5">
                  {incomeRecords?.records && incomeRecords.records.length > 0 ? (
                    <div>
                      <div className="space-y-3 md:hidden">
                        {incomeRecords.records.map(record => {
                          const date = new Date(record.date);
                          const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

                          return (
                            <article key={record._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{formatted}</p>
                                  <p className="text-xs text-slate-500">{record.location || '—'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs uppercase tracking-wide text-slate-400">Income</p>
                                  <p className="text-base font-semibold text-emerald-700">€{record.calculatedIncome.toFixed(2)}</p>
                                </div>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Berry type</dt>
                                  <dd className="font-medium text-slate-900">{record.berryType || '—'}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Unit price</dt>
                                  <dd className="font-medium text-slate-900">€{Number(record.amount || 0).toFixed(2)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Berry wt</dt>
                                  <dd className="font-medium text-slate-900">{record.berryWeightKg}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Cart wt</dt>
                                  <dd className="font-medium text-slate-900">{record.carrotWeightKg}</dd>
                                </div>
                              </dl>
                            </article>
                          );
                        })}
                      </div>
                      <div className="hidden md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-4 py-3 text-left font-semibold text-slate-900">Date</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-900">Location</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-900">Berry type</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-900">Berry (kg)</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-900">Cart (kg)</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-900">Unit price</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-900">Income</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incomeRecords.records.map(record => {
                              const date = new Date(record.date);
                              const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                              return (
                                <tr key={record._id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-4 py-3 font-medium text-slate-900">{formatted}</td>
                                  <td className="px-4 py-3 text-slate-600">{record.location || '—'}</td>
                                  <td className="px-4 py-3 text-slate-600">{record.berryType || '—'}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">{record.berryWeightKg}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">{record.carrotWeightKg}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">€{Number(record.amount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">€{record.calculatedIncome.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Page {incomeRecords.page} of {incomeRecords.totalPages} ({incomeRecords.total} records)
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIncomePage(p => Math.max(1, p - 1))}
                            disabled={incomePage === 1 || incomeLoading}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setIncomePage(p => Math.min(incomeRecords.totalPages, p + 1))}
                            disabled={incomePage === incomeRecords.totalPages || incomeLoading}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl bg-forest-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        Total amount earned: <span className="text-forest-700">€{incomeTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      {incomeLoading ? 'Loading income records...' : 'No income records yet. Daily tracking will appear here.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'expense' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Expense details</h3>
                    <p className="mt-1 text-sm text-slate-500">Daily expense rows are generated from the active group or individual plan.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    Total expense: <span className="text-rose-700">€{expenseTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-100 bg-forest-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Current daily plan</p>
                  <p className="mt-1">
                    {expenseRecords?.currentPlan
                      ? `${expenseRecords.currentPlan.expenseType === 'own-car' ? 'Own car' : 'Rented car'} · €${Number(expenseRecords.currentPlan.dailyAmount || 0).toFixed(2)} / day · ${expensePlanDescriptions[expenseRecords.currentPlan.expenseType] || expensePlanDescriptions['own-car']}`
                      : 'No active expense plan found yet.'}
                  </p>
                </div>

                <form className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2" onSubmit={handleExpenseFilterSubmit}>
                  <label className="block text-sm font-medium text-slate-700">
                    Start date
                    <input
                      className="input mt-2"
                      type="date"
                      value={expenseFilterForm.startDate}
                      onChange={event => setExpenseFilterForm(current => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    End date
                    <input
                      className="input mt-2"
                      type="date"
                      value={expenseFilterForm.endDate}
                      onChange={event => setExpenseFilterForm(current => ({ ...current, endDate: event.target.value }))}
                    />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="rounded-full bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800">
                      Apply date filter
                    </button>
                    <button type="button" onClick={handleExpenseFilterReset} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Reset
                    </button>
                  </div>
                </form>

                {expenseError ? <p className="mt-3 text-sm text-rose-600">{expenseError}</p> : null}

                <div className="mt-5">
                  {expenseRecords?.records && expenseRecords.records.length > 0 ? (
                    <div>
                      <div className="space-y-3 md:hidden">
                        {expenseRecords.records.map(record => {
                          const date = new Date(record.date);
                          const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

                          return (
                            <article key={record._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{formatted}</p>
                                  <p className="text-xs text-slate-500">{record.groupName || '—'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs uppercase tracking-wide text-slate-400">Expense</p>
                                  <p className="text-base font-semibold text-rose-700">€{Number(record.calculatedExpense || 0).toFixed(2)}</p>
                                </div>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Plan</dt>
                                  <dd className="font-medium text-slate-900">{record.expenseType === 'own-car' ? 'Own car' : 'Rented car'}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Daily rate</dt>
                                  <dd className="font-medium text-slate-900">€{Number(record.dailyAmount || 0).toFixed(2)}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                  <dt className="text-xs uppercase tracking-wide text-slate-400">Includes</dt>
                                  <dd className="font-medium text-slate-900">
                                    {expensePlanDescriptions[record.expenseType] || expensePlanDescriptions['own-car']}
                                  </dd>
                                </div>
                              </dl>
                            </article>
                          );
                        })}
                      </div>

                      <div className="hidden md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-4 py-3 text-left font-semibold text-slate-900">Date</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-900">Plan</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-900">Group</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-900">Daily rate</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-900">Expense</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenseRecords.records.map(record => {
                              const date = new Date(record.date);
                              const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                              return (
                                <tr key={record._id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-4 py-3 font-medium text-slate-900">{formatted}</td>
                                  <td className="px-4 py-3 text-slate-600">{record.expenseType === 'own-car' ? 'Own car' : 'Rented car'}</td>
                                  <td className="px-4 py-3 text-slate-600">{record.groupName || '—'}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">€{Number(record.dailyAmount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-rose-600">€{Number(record.calculatedExpense || 0).toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Page {expenseRecords.page} of {expenseRecords.totalPages} ({expenseRecords.total} records)
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setExpensePage(p => Math.max(1, p - 1))}
                            disabled={expensePage === 1 || expenseLoading}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpensePage(p => Math.min(expenseRecords.totalPages, p + 1))}
                            disabled={expensePage === expenseRecords.totalPages || expenseLoading}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-forest-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        Total expense: <span className="text-rose-700">€{expenseTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      {expenseLoading ? 'Loading expense records...' : 'No expense records yet. Recurring daily expenses will appear here.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'payments' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Payment history</h3>
                    <p className="mt-1 text-sm text-slate-500">Settlements that were marked as paid for your account.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    Total payments: <span className="text-forest-700">{paymentRecords.length}</span>
                  </div>
                </div>

                {paymentError ? <p className="mt-3 text-sm text-rose-600">{paymentError}</p> : null}

                <div className="mt-5">
                  {paymentLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      Loading payment history...
                    </div>
                  ) : paymentRecords.length > 0 ? (
                    <div className="space-y-3">
                      {paymentRecords.map(record => (
                        <article key={record._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatDateOnlyUtc(record.fromDate)}
                                {' '}
                                to
                                {' '}
                                {formatDateOnlyUtc(record.toDate)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Paid on {new Date(record.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-wide text-slate-400">Paid amount</p>
                              <p className="text-lg font-semibold text-forest-700">€{Number(record.paidAmount || 0).toFixed(2)}</p>
                            </div>
                          </div>
                          <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-400">Income total</dt>
                              <dd className="mt-1 font-semibold text-slate-900">€{Number(record.incomeTotal || 0).toFixed(2)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-400">Expense total</dt>
                              <dd className="mt-1 font-semibold text-slate-900">€{Number(record.expenseTotal || 0).toFixed(2)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-400">Fine total</dt>
                              <dd className="mt-1 font-semibold text-slate-900">€{Number(record.fineTotal || 0).toFixed(2)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-400">Net payable</dt>
                              <dd className="mt-1 font-semibold text-forest-700">€{Number(record.netPayable || 0).toFixed(2)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
                              <dd className="mt-1 font-semibold capitalize text-forest-700">{record.status || 'paid'}</dd>
                            </div>
                          </dl>
                          {record.notes ? <p className="mt-3 text-sm text-slate-600">Note: {record.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      No payment history yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'fines' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Fine details</h3>
                    <p className="mt-1 text-sm text-slate-500">Fines are shown separately from expenses and are deducted in settlement.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    Total fine: <span className="text-rose-700">€{fineTotal.toFixed(2)}</span>
                  </div>
                </div>

                {fineError ? <p className="mt-3 text-sm text-rose-600">{fineError}</p> : null}

                <div className="mt-5">
                  {fineLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      Loading fine history...
                    </div>
                  ) : fineHistory.fineRecords.length > 0 ? (
                    <div className="space-y-3">
                      {fineHistory.fineRecords.map(record => {
                        const hasAttachment = Boolean(record.attachment?.filename || record.attachment?.data);

                        return (
                          <article key={record._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{record.date ? formatDateOnlyUtc(record.date) : '—'}</p>
                                <p className="mt-1 text-sm text-slate-600">{record.reason || '—'}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Attachment:{' '}
                                  {hasAttachment ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await downloadProtectedFile({
                                            path: `/api/users/fines/${record._id}/attachment`,
                                            token: getUserToken(),
                                            filename: record.attachment?.filename || 'attachment',
                                            openInNewTab: true,
                                          });
                                        } catch {
                                          setFineError('Failed to open attachment');
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 font-medium text-forest-700 hover:text-forest-800 hover:underline"
                                    >
                                      <span aria-hidden="true">⬇</span>
                                      <span>{record.attachment?.filename || 'Attachment'}</span>
                                    </button>
                                  ) : (
                                    'None'
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Net</p>
                                <p className="text-lg font-semibold text-rose-700">€{Number(record.netAmount || 0).toFixed(2)}</p>
                              </div>
                            </div>
                            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                              <div>
                                <dt className="text-xs uppercase tracking-wide text-slate-400">Amount</dt>
                                <dd className="mt-1 font-semibold text-slate-900">€{Number(record.amount || 0).toFixed(2)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase tracking-wide text-slate-400">VAT</dt>
                                <dd className="mt-1 font-semibold text-slate-900">€{Number(record.vatAmount || 0).toFixed(2)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase tracking-wide text-slate-400">Net deduction</dt>
                                <dd className="mt-1 font-semibold text-rose-700">€{Number(record.netAmount || 0).toFixed(2)}</dd>
                              </div>
                            </dl>
                            {hasAttachment ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await downloadProtectedFile({
                                        path: `/api/users/fines/${record._id}/attachment`,
                                        token: getUserToken(),
                                        filename: record.attachment?.filename || 'attachment',
                                        openInNewTab: true,
                                      });
                                    } catch {
                                      setFineError('Failed to open attachment');
                                    }
                                  }}
                                  className="inline-flex rounded-full border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50"
                                >
                                  View attachment
                                </button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      No fine history yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'top-pickers' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Top pickers</h3>
                    <p className="mt-1 text-sm text-slate-500">A leaderboard to keep you motivated. It ranks everyone by net berry weight picked until today.</p>
                  </div>
                  <div className="rounded-2xl bg-forest-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    {topPickers.length ? `${topPickers.length} pickers ranked` : 'No ranking yet'}
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-forest-100 bg-gradient-to-br from-forest-800 via-forest-700 to-forest-600 px-4 pb-5 pt-4 text-white sm:px-5 sm:pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">Leaderboard</p>
                      <p className="mt-1 text-sm text-white/85">Top 3 by net berry weight</p>
                    </div>
                    <span className="rounded-full bg-forest-900/40 px-3 py-1 text-xs font-semibold text-forest-50">Live rank</span>
                  </div>

                  {topPickersError ? <p className="mt-4 text-sm text-rose-100">{topPickersError}</p> : null}
                  {topPickersLoading ? <p className="mt-4 text-sm text-white/85">Loading top pickers...</p> : null}

                  {!topPickersLoading && topPickers.length > 0 ? (() => {
                    const first = topPickers.find(item => item.rank === 1) || topPickers[0] || null;
                    const second = topPickers.find(item => item.rank === 2) || topPickers[1] || null;
                    const third = topPickers.find(item => item.rank === 3) || topPickers[2] || null;
                    const podiumOrder = [second, first, third].filter(Boolean);

                    const heightByRank = (rank) => {
                      if (rank === 1) return 'h-40';
                      if (rank === 2) return 'h-28';
                      return 'h-24';
                    };

                    return (
                      <div className="mt-5">
                        <div className="flex items-end justify-center gap-2 sm:gap-3">
                          {podiumOrder.map(picker => (
                            <div key={`podium-${picker.applicantId}`} className="flex w-[31%] max-w-[130px] flex-col items-center">
                              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/40 bg-white/15 text-sm font-bold text-white backdrop-blur">
                                {getNameInitials(picker.fullName)}
                              </div>
                              <p className="max-w-full truncate text-center text-xs font-semibold text-white">{picker.fullName}</p>
                              <p className="mt-0.5 text-[11px] text-white/80">{picker.pickerId || '—'}</p>
                              <div className={`mt-3 flex w-full ${heightByRank(picker.rank)} items-center justify-center rounded-t-2xl border border-forest-200/70 bg-gradient-to-b from-forest-100 via-forest-200 to-forest-300 text-forest-900 shadow-lg`}>
                                <div className="text-center">
                                  <p className="text-3xl font-extrabold leading-none">{picker.rank}</p>
                                  <p className="mt-1 text-[11px] font-semibold">{formatCompactKg(picker.netBerryWeightKg)} kg</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })() : !topPickersLoading ? (
                    <div className="mt-5 rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-sm text-white/85">
                      No leaderboard data yet.
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-100 bg-white">
                  <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                    <h4 className="text-sm font-semibold text-slate-900">Other pickers</h4>
                    <p className="mt-1 text-xs text-slate-500">Ranks below top 3</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {!topPickersLoading && topPickers.length > 3 ? topPickers.slice(3).map(picker => (
                      <article key={`list-${picker.applicantId}`} className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">#{picker.rank} {picker.fullName}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{picker.pickerId || '—'} · {picker.groupName || 'No group'}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-forest-700">{formatCompactKg(picker.netBerryWeightKg)} kg</p>
                        </div>
                      </article>
                    )) : null}

                    {!topPickersLoading && topPickers.length <= 3 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500">No more ranks below top 3 yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'contact-support' && (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Contact support</h3>
                    <p className="mt-1 text-sm text-slate-500">Open WhatsApp to chat with our support team.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    +358 44 950 0808
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Need help?</p>
                  <p className="mt-1">Send a message on WhatsApp and include your name plus a short description of the issue.</p>
                </div>

                <div className="mt-6">
                  <a
                    href={supportWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 sm:w-auto"
                  >
                    Chat on WhatsApp
                  </a>
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
