const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const ADMIN_TOKEN_KEY = 'evergreen_admin_token';
const USER_TOKEN_KEY = 'evergreen_user_token';

const jsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const parseJson = async response => response.json().catch(() => ({}));

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

export const submitApplication = async payload => {
  return request('/api/applications', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
};

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || '';

export const setAdminToken = token => localStorage.setItem(ADMIN_TOKEN_KEY, token);

export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

export const getUserToken = () => localStorage.getItem(USER_TOKEN_KEY) || '';

export const setUserToken = token => localStorage.setItem(USER_TOKEN_KEY, token);

export const clearUserToken = () => localStorage.removeItem(USER_TOKEN_KEY);

export const adminLogin = async credentials => {
  const data = await request('/api/admin/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(credentials),
  });

  if (data?.data?.token) {
    setAdminToken(data.data.token);
  }

  return data;
};

export const fetchApplicants = async (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });

  return request(`/api/admin/applicants${query.toString() ? `?${query.toString()}` : ''}`, {
    headers: jsonHeaders(getAdminToken()),
  });
};

export const fetchApplicant = async id => request(`/api/admin/applicants/${id}`, { headers: jsonHeaders(getAdminToken()) });

export const updateApplicantStatus = async (id, status) =>
  request(`/api/admin/applicants/${id}/status`, {
    method: 'PATCH',
    headers: jsonHeaders(getAdminToken()),
    body: JSON.stringify({ status }),
  });

export const createUserAccounts = async payload =>
  request('/api/admin/users/create', {
    method: 'POST',
    headers: jsonHeaders(getAdminToken()),
    body: JSON.stringify(payload),
  });

export const addAdminIncomeRecord = async payload =>
  request('/api/admin/income', {
    method: 'POST',
    headers: jsonHeaders(getAdminToken()),
    body: JSON.stringify(payload),
  });

export const fetchAdminIncomeRecords = async (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });

  return request(`/api/admin/income${query.toString() ? `?${query.toString()}` : ''}`, {
    headers: jsonHeaders(getAdminToken()),
  });
};

export const userLogin = async credentials => {
  const data = await request('/api/users/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(credentials),
  });

  if (data?.data?.token) {
    setUserToken(data.data.token);
  }

  return data;
};

export const requestUserPasswordReset = async email =>
  request('/api/users/forgot-password', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });

export const resetUserPassword = async (token, newPassword) =>
  request('/api/users/reset-password', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ token, newPassword }),
  });

export const fetchUserProfile = async () =>
  request('/api/users/me', { headers: jsonHeaders(getUserToken()) });

export const changeUserPassword = async (currentPassword, newPassword) =>
  request('/api/users/change-password', {
    method: 'POST',
    headers: jsonHeaders(getUserToken()),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const updateUserPhone = async phoneNumber =>
  request('/api/users/profile', {
    method: 'PATCH',
    headers: jsonHeaders(getUserToken()),
    body: JSON.stringify({ phoneNumber }),
  });

export const updateUserBankDetails = async (bankName, bankAccountNumber) =>
  request('/api/users/bank-details', {
    method: 'PATCH',
    headers: jsonHeaders(getUserToken()),
    body: JSON.stringify({ bankName, bankAccountNumber }),
  });

export const getGroupMembers = async () =>
  request('/api/users/group-members', {
    headers: jsonHeaders(getUserToken()),
  });

export const getIncomeHistory = async (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });

  return request(`/api/users/income${query.toString() ? `?${query.toString()}` : ''}`, {
    headers: jsonHeaders(getUserToken()),
  });
};

