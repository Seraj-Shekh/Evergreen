import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import {
  addAdminIncomeRecord,
  adminLogin,
  clearAdminToken,
  createUserAccounts,
  fetchAdminIncomeRecords,
  fetchApplicant,
  fetchApplicants,
  getAdminToken,
  updateApplicantStatus,
} from '../lib/api.js';

const defaultFilters = {
  name: '',
  email: '',
  pickerId: '',
  groupName: '',
  hasOwnCar: '',
  hasDrivingLicense: '',
  status: '',
};

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' },
];

const booleanOptions = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const pageSizeOptions = [20, 25];

const today = new Date().toISOString().slice(0, 10);

const statusClassName = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  reviewed: 'bg-sky-50 text-sky-700 ring-sky-200',
  selected: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const formatDate = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Helsinki',
}).format(new Date(value));

const formatNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value || '0');
};

const initialLogin = { username: '', password: '' };

export default function AdminPage() {
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState('');
  const [statusSaving, setStatusSaving] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [selectedApplicantIds, setSelectedApplicantIds] = useState([]);
  const [selectedApplicantLookup, setSelectedApplicantLookup] = useState({});
  const [groupAccountForm, setGroupAccountForm] = useState({ groupName: '' });
  const [groupAccountLoading, setGroupAccountLoading] = useState(false);
  const [groupAccountError, setGroupAccountError] = useState('');
  const [groupAccountSuccess, setGroupAccountSuccess] = useState('');
  const [incomeForm, setIncomeForm] = useState({ applicantId: '', date: today, location: '', berryType: '', berryWeightKg: '', carrotWeightKg: '', amount: '' });
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeError, setIncomeError] = useState('');
  const [incomeSuccess, setIncomeSuccess] = useState('');
  const [incomeRecords, setIncomeRecords] = useState([]);

  const hasToken = useMemo(() => Boolean(getAdminToken()), []);

  const selectedApplicantNames = useMemo(() => {
    return selectedApplicantIds.map(id => selectedApplicantLookup[id]).filter(Boolean);
  }, [selectedApplicantIds, selectedApplicantLookup]);

  const loadApplicants = async (nextPage = 1, nextFilters = appliedFilters, nextLimit = pageSize) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchApplicants({ ...nextFilters, page: nextPage, limit: nextLimit, sortField: 'createdAt', sortDirection: 'desc' });
      const nextApplicants = response.data.applicants || [];

      setApplicants(nextApplicants);
      setSelectedApplicantLookup(current => {
        const nextLookup = { ...current };
        nextApplicants.forEach(applicant => {
          nextLookup[applicant._id] = applicant.fullName;
        });
        return nextLookup;
      });
      setPagination({
        page: response.data.page,
        limit: response.data.limit,
        total: response.data.total,
        totalPages: response.data.totalPages,
      });
      setPage(response.data.page);
    } catch (fetchError) {
      if (String(fetchError.message).toLowerCase().includes('unauthorized')) {
        clearAdminToken();
        setIsAuthenticated(false);
      }
      setError(fetchError.message || 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasToken) {
      setIsAuthenticated(true);
      loadApplicants(1, defaultFilters, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  useEffect(() => {
    if (selectedApplicant?._id) {
      setIncomeForm(current => ({ ...current, applicantId: selectedApplicant._id }));
    }
  }, [selectedApplicant]);

  useEffect(() => {
    if (isAuthenticated) {
      (async () => {
        try {
          const response = await fetchAdminIncomeRecords({ limit: 10, page: 1 });
          setIncomeRecords(response.data.records || []);
        } catch {
          setIncomeRecords([]);
        }
      })();
    }
  }, [isAuthenticated]);

  const handleLoginSubmit = async event => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      await adminLogin(loginForm);
      setIsAuthenticated(true);
      setLoginForm(initialLogin);
      await loadApplicants(1, defaultFilters, pageSize);
    } catch (loginErr) {
      setLoginError(loginErr.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setApplicants([]);
    setSelectedApplicant(null);
    setSelectedApplicantIds([]);
    setSelectedApplicantLookup({});
  };

  const handleApplyFilters = async event => {
    event.preventDefault();
    setAppliedFilters(filters);
    await loadApplicants(1, filters, pageSize);
  };

  const handleResetFilters = async () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    await loadApplicants(1, defaultFilters, pageSize);
  };

  const toggleApplicantSelection = applicantId => {
    setSelectedApplicantIds(current => (
      current.includes(applicantId)
        ? current.filter(id => id !== applicantId)
        : [...current, applicantId]
    ));
  };

  const handleCreateGroupAccounts = async event => {
    event.preventDefault();
    setGroupAccountError('');
    setGroupAccountSuccess('');

    if (!groupAccountForm.groupName.trim()) {
      setGroupAccountError('Group name is required');
      return;
    }

    if (selectedApplicantIds.length === 0) {
      setGroupAccountError('Select at least one applicant');
      return;
    }

    setGroupAccountLoading(true);

    try {
      const groupAssignments = Object.fromEntries(selectedApplicantIds.map(id => [id, groupAccountForm.groupName.trim()]));
      const response = await createUserAccounts({ applicantIds: selectedApplicantIds, groupAssignments });
      const createdCount = response.data.created?.length || 0;
      const updatedCount = response.data.updated?.length || 0;
      setGroupAccountSuccess(`Created ${createdCount} and updated ${updatedCount} account(s).`);
      setGroupAccountForm({ groupName: '' });
      setSelectedApplicantIds([]);
      await loadApplicants(pagination.page, appliedFilters, pageSize);
    } catch (createError) {
      setGroupAccountError(createError.message || 'Failed to create accounts');
    } finally {
      setGroupAccountLoading(false);
    }
  };

  const handleIncomeSubmit = async event => {
    event.preventDefault();
    setIncomeError('');
    setIncomeSuccess('');

    if (!incomeForm.applicantId) {
      setIncomeError('Select an applicant');
      return;
    }

    setIncomeSaving(true);

    try {
      const response = await addAdminIncomeRecord(incomeForm);
      const savedRecord = response.data?.incomeRecord;
      if (savedRecord) {
        setIncomeRecords(current => [savedRecord, ...current.filter(item => item._id !== savedRecord._id)]);
      }
      setIncomeSuccess(`Income saved. Calculated income: ${savedRecord?.calculatedIncome ?? '0'}`);
      setIncomeForm(current => ({ ...current, location: '', berryType: '', berryWeightKg: '', carrotWeightKg: '', amount: '' }));
    } catch (incomeSaveError) {
      setIncomeError(incomeSaveError.message || 'Failed to save income record');
    } finally {
      setIncomeSaving(false);
    }
  };

  const handlePageSizeChange = async event => {
    const nextSize = Number(event.target.value);
    setPageSize(nextSize);
    await loadApplicants(1, appliedFilters, nextSize);
  };

  const openApplicantDetails = async applicant => {
    setSelectedApplicant(applicant);
    setSelectedLoading(true);
    setSelectedError('');

    try {
      const response = await fetchApplicant(applicant._id);
      setSelectedApplicant(response.data.applicant);
    } catch (detailError) {
      setSelectedError(detailError.message || 'Failed to load applicant details');
    } finally {
      setSelectedLoading(false);
    }
  };

  const saveStatus = async nextStatus => {
    if (!selectedApplicant) {
      return;
    }

    setStatusSaving(nextStatus);

    try {
      const response = await updateApplicantStatus(selectedApplicant._id, nextStatus);
      setSelectedApplicant(response.data.applicant);
      setApplicants(current => current.map(item => (item._id === response.data.applicant._id ? response.data.applicant : item)));
    } catch (statusError) {
      setSelectedError(statusError.message || 'Failed to update status');
    } finally {
      setStatusSaving('');
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 shadow-soft text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <form className="mt-2 space-y-4" onSubmit={handleLoginSubmit}>
            <label className="block text-sm font-medium text-slate-700 text-left">
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
              labelClassName="block text-sm font-medium text-slate-700 text-left"
            />
            {loginError ? <p className="text-sm text-rose-600 text-left">{loginError}</p> : null}
            <button
              type="submit"
              className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loginLoading}
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
      <div className="mb-4 flex items-center justify-end gap-2 sm:gap-3">
        <Link to="/admin/income" className="rounded-full border border-forest-200 px-3 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50 sm:px-4">
          Income manager
        </Link>
        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm">
          <span className="whitespace-nowrap">Rows</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
          >
            {pageSizeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => loadApplicants(page, appliedFilters)} className="rounded-full border border-forest-200 px-3 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50 sm:px-4">
          Refresh
        </button>
        <button type="button" onClick={handleLogout} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-4">
          Logout
        </button>
      </div>

      <form onSubmit={handleApplyFilters} className="mt-6 grid grid-cols-1 gap-3 rounded-3xl border border-forest-100 bg-white p-4 shadow-soft sm:grid-cols-2 sm:p-5 xl:grid-cols-6 xl:gap-4 xl:p-6">
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Name
          <input className="input mt-2" value={filters.name} onChange={event => setFilters(current => ({ ...current, name: event.target.value }))} placeholder="Search name" />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Email
          <input className="input mt-2" value={filters.email} onChange={event => setFilters(current => ({ ...current, email: event.target.value }))} placeholder="Search email" />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Picker ID
          <input className="input mt-2" value={filters.pickerId} onChange={event => setFilters(current => ({ ...current, pickerId: event.target.value }))} placeholder="Search picker ID" />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Group name
          <input className="input mt-2" value={filters.groupName} onChange={event => setFilters(current => ({ ...current, groupName: event.target.value }))} placeholder="Search group" />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Has car
          <select className="input mt-2" value={filters.hasOwnCar} onChange={event => setFilters(current => ({ ...current, hasOwnCar: event.target.value }))}>
            {booleanOptions.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Driving license
          <select className="input mt-2" value={filters.hasDrivingLicense} onChange={event => setFilters(current => ({ ...current, hasDrivingLicense: event.target.value }))}>
            {booleanOptions.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-1">
          Status
          <select className="input mt-2" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
            {statusOptions.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-2 xl:flex xl:items-end xl:gap-3">
          <button type="submit" className="w-full rounded-full bg-forest-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 sm:px-5">
            Apply filters
          </button>
          <button type="button" onClick={handleResetFilters} className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-5">
            Reset
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border border-forest-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-forest-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Applications</h2>
              <p className="text-sm text-slate-500">{pagination.total} total · Page {pagination.page} of {pagination.totalPages} · {pagination.limit} per page</p>
            </div>
          </div>

          {error ? <p className="px-6 py-4 text-sm text-rose-600">{error}</p> : null}
          {loading ? <p className="px-4 py-6 text-sm text-slate-600">Loading applicants…</p> : null}

          {!loading && applicants.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No applicants found for the current filters.</div>
          ) : null}

          {!loading && applicants.length > 0 ? (
            <>
              {/* Mobile: show compact cards */}
              <div className="md:hidden space-y-3 px-2">
                {applicants.map(applicant => (
                  <button
                    key={applicant._id}
                    onClick={() => openApplicantDetails(applicant)}
                    className="w-full text-left rounded-2xl border border-forest-100 bg-white p-4 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{applicant.fullName}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{applicant.email}</p>
                        <p className="mt-1 break-words text-sm text-slate-500">{applicant.phoneNumber}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <span className={`inline-flex max-w-[96px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold capitalize leading-none ${statusClassName[applicant.status] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}>{applicant.status}</span>
                        <p className="mt-2 text-xs text-slate-400">{formatDate(applicant.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop/table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-forest-100 text-left text-sm">
                  <thead className="bg-forest-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Select</th>
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th className="px-6 py-3 font-semibold">Picker ID</th>
                      <th className="px-6 py-3 font-semibold">Group</th>
                      <th className="px-6 py-3 font-semibold">Phone</th>
                      <th className="px-6 py-3 font-semibold">Car</th>
                      <th className="px-6 py-3 font-semibold">License</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest-50 bg-white">
                    {applicants.map(applicant => (
                      <tr key={applicant._id} className="cursor-pointer hover:bg-forest-50/40" onClick={() => openApplicantDetails(applicant)}>
                        <td className="px-6 py-4" onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedApplicantIds.includes(applicant._id)}
                            onChange={() => toggleApplicantSelection(applicant._id)}
                            aria-label={`Select ${applicant.fullName}`}
                            className="h-4 w-4 rounded border-slate-300 text-forest-700 focus:ring-forest-600"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{applicant.fullName}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.email}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.pickerId || '—'}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.groupName || '—'}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.phoneNumber}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.hasOwnCar ? 'Yes' : 'No'}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.hasDrivingLicense ? 'Yes' : 'No'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClassName[applicant.status] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
                            {applicant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(applicant.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between border-t border-forest-100 px-6 py-4 text-sm text-slate-600">
            <span>
              Showing {applicants.length ? (pagination.page - 1) * pagination.limit + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={pagination.page <= 1 || loading} onClick={() => loadApplicants(pagination.page - 1, appliedFilters, pageSize)} className="rounded-full border border-slate-200 px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => loadApplicants(pagination.page + 1, appliedFilters, pageSize)} className="rounded-full border border-slate-200 px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-forest-100 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-900">Applicant details</h2>
          {selectedLoading ? <p className="mt-4 text-sm text-slate-600">Loading details…</p> : null}
          {selectedError ? <p className="mt-4 text-sm text-rose-600">{selectedError}</p> : null}

          {selectedApplicant ? (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-semibold text-slate-900">{selectedApplicant.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <a className="font-semibold text-forest-700" href={`mailto:${selectedApplicant.email}`}>{selectedApplicant.email}</a>
              </div>
              <div>
                <p className="text-sm text-slate-500">Picker ID</p>
                <p className="font-semibold text-slate-900">{selectedApplicant.pickerId || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Group</p>
                <p className="font-semibold text-slate-900">{selectedApplicant.groupName || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bank name</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedApplicant.bankName || '—'}</p>
                </div>
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bank account</p>
                  <p className="mt-1 font-semibold text-slate-900 break-all">{selectedApplicant.bankAccountNumber || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <a className="font-semibold text-forest-700" href={`tel:${selectedApplicant.phoneNumber}`}>{selectedApplicant.phoneNumber}</a>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Own car</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedApplicant.hasOwnCar ? 'Yes' : 'No'}</p>
                </div>
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Driving license</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedApplicant.hasDrivingLicense ? 'Yes' : 'No'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Car plate</p>
                <p className="font-semibold text-slate-900">{selectedApplicant.carPlateNumber || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClassName[selectedApplicant.status] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
                  {selectedApplicant.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-500">Submitted</p>
                <p className="font-semibold text-slate-900">{formatDate(selectedApplicant.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Additional description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedApplicant.additionalDescription || '—'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Income total</p>
                    <p className="font-semibold text-slate-900">{formatNumber(selectedApplicant.totalIncome || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Records</p>
                    <p className="font-semibold text-slate-900">{selectedApplicant.incomeRecords?.length || 0}</p>
                  </div>
                </div>
                <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {selectedApplicant.incomeRecords?.length > 0 ? selectedApplicant.incomeRecords.map(record => (
                    <div key={record._id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{record.date ? formatDate(record.date) : '—'}</p>
                        <p className="font-semibold text-emerald-700">{formatNumber(record.calculatedIncome)}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <p><span className="font-medium text-slate-800">Location:</span> {record.location || '—'}</p>
                        <p><span className="font-medium text-slate-800">Berry:</span> {record.berryType || '—'}</p>
                        <p><span className="font-medium text-slate-800">Price:</span> {formatNumber(record.amount)}</p>
                        <p><span className="font-medium text-slate-800">Berry wt:</span> {formatNumber(record.berryWeightKg)}</p>
                        <p><span className="font-medium text-slate-800">Cart wt:</span> {formatNumber(record.carrotWeightKg)}</p>
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-500">No income records found for this person.</p>}
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Update status</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {['pending', 'reviewed', 'selected', 'rejected'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => saveStatus(status)}
                      disabled={statusSaving === status}
                      className={`rounded-full px-3 py-2 text-xs font-semibold capitalize transition disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm ${selectedApplicant.status === status ? 'bg-forest-700 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {statusSaving === status ? 'Saving…' : status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">Select an applicant from the table to view full details and update their status.</p>
          )}

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Create group accounts</h3>
            <p className="mt-1 text-xs text-slate-500">Pick applicants from the table, give the group a name, and create login accounts.</p>
            <p className="mt-2 text-xs text-slate-600">Selected: {selectedApplicantIds.length}{selectedApplicantNames.length ? ` (${selectedApplicantNames.join(', ')})` : ''}</p>
            <form className="mt-3 space-y-3" onSubmit={handleCreateGroupAccounts}>
              <label className="block text-xs font-medium text-slate-700">
                Group name
                <input
                  className="input mt-2"
                  value={groupAccountForm.groupName}
                  onChange={event => setGroupAccountForm({ groupName: event.target.value })}
                  placeholder="group1"
                />
              </label>
              {groupAccountError ? <p className="text-xs text-rose-600">{groupAccountError}</p> : null}
              {groupAccountSuccess ? <p className="text-xs text-emerald-600">{groupAccountSuccess}</p> : null}
              <button
                type="submit"
                disabled={groupAccountLoading}
                className="w-full rounded-full bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {groupAccountLoading ? 'Creating…' : 'Create accounts'}
              </button>
            </form>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Add income record</h3>
            <p className="mt-1 text-xs text-slate-500">Set berry wt, carrot wt, and berry price for one applicant.</p>
            <form className="mt-3 space-y-3" onSubmit={handleIncomeSubmit}>
              <label className="block text-xs font-medium text-slate-700">
                Applicant
                <select
                  className="input mt-2"
                  value={incomeForm.applicantId}
                  onChange={event => setIncomeForm(current => ({ ...current, applicantId: event.target.value }))}
                >
                  <option value="">Select applicant</option>
                  {applicants.map(applicant => (
                    <option key={applicant._id} value={applicant._id}>
                      {applicant.fullName}{applicant.groupName ? ` (${applicant.groupName})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Location
                <input
                  className="input mt-2"
                  value={incomeForm.location}
                  onChange={event => setIncomeForm(current => ({ ...current, location: event.target.value }))}
                  placeholder="Field A / Oulu north"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Berry type
                <input
                  className="input mt-2"
                  value={incomeForm.berryType}
                  onChange={event => setIncomeForm(current => ({ ...current, berryType: event.target.value }))}
                  placeholder="Cow berry"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  Date
                  <input
                    className="input mt-2"
                    type="date"
                    value={incomeForm.date}
                    onChange={event => setIncomeForm(current => ({ ...current, date: event.target.value }))}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Berry price / kg
                  <input
                    className="input mt-2"
                    type="number"
                    step="0.01"
                    min="0"
                    value={incomeForm.amount}
                    onChange={event => setIncomeForm(current => ({ ...current, amount: event.target.value }))}
                    placeholder="5"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  Berry wt (kg)
                  <input
                    className="input mt-2"
                    type="number"
                    step="0.01"
                    min="0"
                    value={incomeForm.berryWeightKg}
                    onChange={event => setIncomeForm(current => ({ ...current, berryWeightKg: event.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Cart wt (kg)
                  <input
                    className="input mt-2"
                    type="number"
                    step="0.01"
                    min="0"
                    value={incomeForm.carrotWeightKg}
                    onChange={event => setIncomeForm(current => ({ ...current, carrotWeightKg: event.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>
              {incomeError ? <p className="text-xs text-rose-600">{incomeError}</p> : null}
              {incomeSuccess ? <p className="text-xs text-emerald-600">{incomeSuccess}</p> : null}
              <button
                type="submit"
                disabled={incomeSaving}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {incomeSaving ? 'Saving…' : 'Save income record'}
              </button>
            </form>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent income entries</h3>
            <div className="mt-3 space-y-2">
              {incomeRecords.length > 0 ? incomeRecords.map(record => (
                <div key={record._id} className="rounded-xl bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{record.applicantId}</span>
                    <span className="text-emerald-700">{record.calculatedIncome}</span>
                  </div>
                  <p className="mt-1">{record.date ? formatDate(record.date) : '—'}</p>
                </div>
              )) : <p className="text-xs text-slate-500">No recent income records loaded.</p>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
