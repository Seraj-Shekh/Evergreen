import { useEffect, useMemo, useState } from 'react';
import { adminLogin, clearAdminToken, fetchApplicant, fetchApplicants, getAdminToken, updateApplicantStatus } from '../lib/api.js';

const defaultFilters = {
  name: '',
  email: '',
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

  const hasToken = useMemo(() => Boolean(getAdminToken()), []);

  const loadApplicants = async (nextPage = 1, nextFilters = appliedFilters, nextLimit = pageSize) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchApplicants({ ...nextFilters, page: nextPage, limit: nextLimit, sortField: 'createdAt', sortDirection: 'desc' });
      setApplicants(response.data.applicants || []);
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
            <label className="block text-sm font-medium text-slate-700 text-left">
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
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
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
                        <td className="px-6 py-4 font-medium text-slate-900">{applicant.fullName}</td>
                        <td className="px-6 py-4 text-slate-600">{applicant.email}</td>
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
        </aside>
      </div>
    </section>
  );
}
