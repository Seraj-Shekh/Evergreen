import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import {
  adminLogin,
  clearAdminToken,
  deleteAdminExpensePlan,
  fetchAdminExpensePlans,
  fetchApplicants,
  getAdminToken,
  saveAdminExpensePlan,
} from '../lib/api.js';

const loginInitial = { username: '', password: '' };
const searchInitial = { groupName: '', pickerId: '' };

const today = new Date().toISOString().slice(0, 10);

const expenseTypeOptions = [
  { value: 'own-car', label: 'Own car', defaultAmount: 7.5, description: 'Accommodation + trailer cost' },
  { value: 'rented-car', label: 'Rented car', defaultAmount: 11, description: 'Car rent + accommodation + trailer cost' },
];

const formatCurrency = value => {
  const parsed = Number(value);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(parsed) ? parsed : 0);
};

const formatDate = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Europe/Helsinki',
}).format(new Date(value));

export default function AdminExpensePage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [searchForm, setSearchForm] = useState(searchInitial);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [expensePlans, setExpensePlans] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [planForm, setPlanForm] = useState({
    id: '',
    scopeType: 'group',
    applicantId: '',
    groupName: '',
    expenseType: 'own-car',
    dailyAmount: '7.5',
    startsOn: today,
    endsOn: '',
    isActive: true,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planSuccess, setPlanSuccess] = useState('');

  const searchLabel = useMemo(() => {
    if (searchForm.groupName.trim()) {
      return `group: ${searchForm.groupName.trim()}`;
    }

    if (searchForm.pickerId.trim()) {
      return `picker ID: ${searchForm.pickerId.trim()}`;
    }

    return '';
  }, [searchForm]);

  useEffect(() => {
    if (!isAuthenticated) {
      setApplicants([]);
      setExpensePlans([]);
      setSelectedApplicant(null);
    }
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
    setApplicants([]);
    setExpensePlans([]);
    setSelectedApplicant(null);
  };

  const loadExpenseData = async () => {
    setSearchLoading(true);
    setSearchError('');

    try {
      const response = await fetchApplicants({
        groupName: searchForm.groupName,
        pickerId: searchForm.pickerId,
        limit: 50,
        page: 1,
        sortField: 'createdAt',
        sortDirection: 'desc',
      });

      const nextApplicants = response.data.applicants || [];
      setApplicants(nextApplicants);

      const nextApplicantId = nextApplicants.length === 1 ? nextApplicants[0]._id : '';

      if (nextApplicants.length === 1) {
        setSelectedApplicant(nextApplicants[0]);
        setPlanForm(current => ({
          ...current,
          scopeType: 'applicant',
          applicantId: nextApplicants[0]._id,
          groupName: nextApplicants[0].groupName || current.groupName,
        }));
      } else if (searchForm.groupName.trim()) {
        setPlanForm(current => ({
          ...current,
          scopeType: 'group',
          groupName: searchForm.groupName.trim(),
        }));
      }

      const plansResponse = await fetchAdminExpensePlans({
        groupName: searchForm.groupName,
        applicantId: nextApplicantId,
      });
      setExpensePlans(plansResponse.data.expensePlans || []);
    } catch (error) {
      setApplicants([]);
      setExpensePlans([]);
      setSearchError(error.message || 'Failed to load expense data');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = async event => {
    event.preventDefault();

    if (!searchForm.groupName.trim() && !searchForm.pickerId.trim()) {
      setSearchError('Enter a group name or picker ID to search');
      return;
    }

    await loadExpenseData();
  };

  const clearSearch = () => {
    setSearchForm(searchInitial);
    setApplicants([]);
    setExpensePlans([]);
    setSelectedApplicant(null);
    setPlanForm(current => ({
      ...current,
      scopeType: 'group',
      applicantId: '',
      groupName: '',
    }));
    setSearchError('');
    setPlanError('');
    setPlanSuccess('');
  };

  const loadForApplicant = applicant => {
    setSelectedApplicant(applicant);
    setPlanForm(current => ({
      ...current,
      scopeType: 'applicant',
      applicantId: applicant._id,
      groupName: applicant.groupName || current.groupName,
    }));
  };

  const beginEdit = plan => {
    setPlanError('');
    setPlanSuccess('');
    setPlanForm({
      id: plan._id,
      scopeType: plan.scopeType,
      applicantId: plan.applicantId || '',
      groupName: plan.groupName || '',
      expenseType: plan.expenseType,
      dailyAmount: String(plan.dailyAmount ?? ''),
      startsOn: plan.startsOn ? String(plan.startsOn).slice(0, 10) : today,
      endsOn: plan.endsOn ? String(plan.endsOn).slice(0, 10) : '',
      isActive: Boolean(plan.isActive),
      notes: plan.notes || '',
    });
  };

  const handleExpenseTypeChange = expenseType => {
    const selected = expenseTypeOptions.find(item => item.value === expenseType) || expenseTypeOptions[0];
    setPlanForm(current => ({
      ...current,
      expenseType,
      dailyAmount: current.dailyAmount && Number(current.dailyAmount) > 0 ? current.dailyAmount : String(selected.defaultAmount),
    }));
  };

  const handleSavePlan = async event => {
    event.preventDefault();
    setPlanError('');
    setPlanSuccess('');

    if (planForm.scopeType === 'group' && !planForm.groupName.trim()) {
      setPlanError('Group name is required for group scope');
      return;
    }

    if (planForm.scopeType === 'applicant' && !planForm.applicantId) {
      setPlanError('Select an applicant for person-specific expense control');
      return;
    }

    setSaving(true);

    try {
      const response = await saveAdminExpensePlan({
        id: planForm.id || undefined,
        scopeType: planForm.scopeType,
        applicantId: planForm.scopeType === 'applicant' ? planForm.applicantId : undefined,
        groupName: planForm.scopeType === 'group' ? planForm.groupName : undefined,
        expenseType: planForm.expenseType,
        dailyAmount: planForm.dailyAmount,
        startsOn: planForm.startsOn,
        endsOn: planForm.endsOn || undefined,
        isActive: planForm.isActive,
        notes: planForm.notes,
      });

      setPlanSuccess('Expense plan saved successfully');
      setPlanForm(current => ({
        ...current,
        id: '',
        dailyAmount: String(expenseTypeOptions.find(item => item.value === current.expenseType)?.defaultAmount || 7.5),
      }));
      setSelectedApplicant(current => current ? { ...current } : current);
      await loadExpenseData();
      if (response.data?.expensePlan?.scopeType === 'applicant' && selectedApplicant?._id === response.data.expensePlan?.applicantId) {
        setSelectedApplicant(current => current ? { ...current } : current);
      }
    } catch (error) {
      setPlanError(error.message || 'Failed to save expense plan');
    } finally {
      setSaving(false);
    }
  };

  const stopPlanToday = async plan => {
    setSaving(true);
    setPlanError('');
    setPlanSuccess('');

    try {
      await saveAdminExpensePlan({
        id: plan._id,
        scopeType: plan.scopeType,
        applicantId: plan.applicantId || undefined,
        groupName: plan.groupName || undefined,
        expenseType: plan.expenseType,
        dailyAmount: plan.dailyAmount,
        startsOn: String(plan.startsOn).slice(0, 10),
        endsOn: today,
        isActive: false,
        notes: plan.notes || '',
      });
      setPlanSuccess('Recurring expense stopped from today');
      await loadExpenseData();
    } catch (error) {
      setPlanError(error.message || 'Failed to stop expense plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async plan => {
    const confirmed = window.confirm(`Delete this expense plan and its related expense records?\n\n${plan.scopeType === 'group' ? `Group: ${plan.groupName}` : `Applicant: ${plan.applicant?.fullName || plan.applicantId}`}`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setPlanError('');
    setPlanSuccess('');

    try {
      const response = await deleteAdminExpensePlan(plan._id);
      const deletedCount = response.data?.deletedExpenseRecords || 0;
      setPlanSuccess(`Expense plan deleted${deletedCount ? ` and ${deletedCount} related expense record${deletedCount === 1 ? '' : 's'} removed` : ''}`);

      if (planForm.id === plan._id) {
        setPlanForm(current => ({
          ...current,
          id: '',
          endsOn: '',
          notes: '',
        }));
      }

      await loadExpenseData();
    } catch (error) {
      setPlanError(error.message || 'Failed to delete expense plan');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Expense management</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to assign group and person-specific recurring expenses.</p>
          <form className="mt-6 space-y-4 text-left" onSubmit={handleLoginSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Username
              <input className="input mt-2" value={loginForm.username} onChange={event => setLoginForm(current => ({ ...current, username: event.target.value }))} autoComplete="username" required />
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
            <button type="submit" disabled={loginLoading} className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-forest-100 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/admin')} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Back to admin
            </button>
            <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Expense manager</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Recurring expense control</h1>
          <p className="mt-1 text-sm text-slate-600">Assign daily expense rules for a group or for a specific person, then stop them when needed.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleLogout} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Logout</button>
          <Link to="/admin" className="rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50">Applicant admin</Link>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="block text-sm font-medium text-slate-700">
            Group name
            <input className="input mt-2" value={searchForm.groupName} onChange={event => setSearchForm(current => ({ ...current, groupName: event.target.value }))} placeholder="Group 1" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Picker ID
            <input className="input mt-2" value={searchForm.pickerId} onChange={event => setSearchForm(current => ({ ...current, pickerId: event.target.value }))} placeholder="P-0016" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={searchLoading} className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
              {searchLoading ? 'Loading…' : 'Search'}
            </button>
            <button type="button" onClick={clearSearch} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Clear
            </button>
          </div>
        </div>
        {searchError ? <p className="mt-3 text-sm text-rose-600">{searchError}</p> : null}
        {searchLabel ? <p className="mt-3 text-xs text-slate-500">Showing results for {searchLabel}</p> : null}
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Matched applicants</h2>
              <p className="text-sm text-slate-500">Select a person to switch to individual expense control.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{applicants.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {applicants.length > 0 ? applicants.map(applicant => (
              <button key={applicant._id} type="button" onClick={() => loadForApplicant(applicant)} className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${selectedApplicant?._id === applicant._id ? 'border-forest-300 bg-forest-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{applicant.fullName}</p>
                    <p className="text-xs text-slate-500">{applicant.email}</p>
                    <p className="text-xs text-slate-500">{applicant.pickerId || '—'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{applicant.groupName || 'No group'}</p>
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">Search a group or picker ID to load applicants.</div>
            )}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Current scope</p>
            <p className="mt-1">{planForm.scopeType === 'applicant' ? 'Applicant-specific expense' : 'Group-wide expense'}</p>
            <p className="mt-1 text-xs text-slate-500">If you need to stop recurring charges for one person after they leave, select that applicant and set an end date or stop the plan today.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-slate-900">Create or edit expense plan</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a default daily rate, then overwrite it when the person changes car status or leaves the group.</p>

            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSavePlan}>
              <label className="block text-sm font-medium text-slate-700">
                Scope
                <select className="input mt-2" value={planForm.scopeType} onChange={event => setPlanForm(current => ({ ...current, scopeType: event.target.value }))}>
                  <option value="group">Group</option>
                  <option value="applicant">Applicant</option>
                </select>
              </label>
              {planForm.scopeType === 'group' ? (
                <label className="block text-sm font-medium text-slate-700">
                  Group name
                  <input className="input mt-2" value={planForm.groupName} onChange={event => setPlanForm(current => ({ ...current, groupName: event.target.value }))} placeholder="Group 1" />
                </label>
              ) : (
                <label className="block text-sm font-medium text-slate-700">
                  Applicant
                  <select className="input mt-2" value={planForm.applicantId} onChange={event => {
                    const applicant = applicants.find(item => item._id === event.target.value);
                    setPlanForm(current => ({ ...current, applicantId: event.target.value, groupName: applicant?.groupName || current.groupName }));
                  }}>
                    <option value="">Select applicant</option>
                    {applicants.map(applicant => <option key={applicant._id} value={applicant._id}>{applicant.fullName} {applicant.pickerId ? `(${applicant.pickerId})` : ''}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700">
                Expense type
                <select className="input mt-2" value={planForm.expenseType} onChange={event => handleExpenseTypeChange(event.target.value)}>
                  {expenseTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label} - {option.description}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Daily amount (€)
                <input className="input mt-2" type="number" min="0" step="0.01" value={planForm.dailyAmount} onChange={event => setPlanForm(current => ({ ...current, dailyAmount: event.target.value }))} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Starts on
                <input className="input mt-2" type="date" value={planForm.startsOn} onChange={event => setPlanForm(current => ({ ...current, startsOn: event.target.value }))} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Ends on
                <input className="input mt-2" type="date" value={planForm.endsOn} onChange={event => setPlanForm(current => ({ ...current, endsOn: event.target.value }))} />
                <span className="mt-1 block text-xs text-slate-500">
                  The plan is applied every day from the start date through this end date, inclusive. Leave it empty if the plan should continue until you stop it.
                </span>
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={planForm.isActive} onChange={event => setPlanForm(current => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-forest-700" />
                Active plan
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Notes
                <textarea className="input mt-2 min-h-24" value={planForm.notes} onChange={event => setPlanForm(current => ({ ...current, notes: event.target.value }))} placeholder="Optional note for this expense plan" />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
                  {saving ? 'Saving…' : planForm.id ? 'Update plan' : 'Save plan'}
                </button>
                {planForm.id ? (
                  <button type="button" onClick={() => setPlanForm(current => ({ ...current, id: '', endsOn: '', notes: '' }))} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Cancel edit
                  </button>
                ) : null}
              </div>
              {planError ? <p className="sm:col-span-2 text-sm text-rose-600">{planError}</p> : null}
              {planSuccess ? <p className="sm:col-span-2 text-sm text-emerald-600">{planSuccess}</p> : null}
            </form>
          </div>

          <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Saved expense plans</h2>
                <p className="text-sm text-slate-500">The latest active plan wins from its start date onward.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{expensePlans.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {expensePlans.length > 0 ? expensePlans.map(plan => (
                <div key={plan._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {plan.scopeType === 'group' ? `Group: ${plan.groupName}` : `Applicant: ${plan.applicant?.fullName || plan.applicantId}`}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {plan.expenseType} · {formatCurrency(plan.dailyAmount)} / day
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(plan.startsOn)} {plan.endsOn ? `→ ${formatDate(plan.endsOn)}` : '→ ongoing'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{plan.isActive ? 'Active' : 'Stopped'}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => beginEdit(plan)} className="rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-700 transition hover:bg-forest-50">
                        Edit
                      </button>
                      {plan.isActive ? (
                        <button type="button" onClick={() => stopPlanToday(plan)} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                          Stop today
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleDeletePlan(plan)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No expense plans found for this search.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}