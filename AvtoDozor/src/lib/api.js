import { DEFAULT_SERVER } from '../config';

let baseUrl = DEFAULT_SERVER;
let token = null;
let onUnauthorized = null;

export function normalizeServer(url) {
  let u = (url || '').trim().replace(/\/+$/, '');
  if (!u) return DEFAULT_SERVER;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u;
}

export const setBaseUrl = (url) => {
  baseUrl = normalizeServer(url);
};
export const getBaseUrl = () => baseUrl;
export const setToken = (t) => {
  token = t;
};
export const getToken = () => token;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export const wsUrl = (employeeId) =>
  `${baseUrl.replace(/^http/i, 'ws')}/ws/${employeeId}?token=${encodeURIComponent(token || '')}`;

async function request(path, { method = 'GET', body, auth = true, timeout = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      e?.name === 'AbortError'
        ? 'Сервер не отвечает. Проверьте адрес сервера и подключение.'
        : 'Нет связи с сервером. Проверьте адрес сервера и подключение.',
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && auth && onUnauthorized) onUnauthorized();
    let detail = data?.detail;
    if (Array.isArray(detail)) detail = detail.map((d) => d.msg).join('; ');
    throw new Error(detail || `Ошибка сервера (${res.status})`);
  }
  return data;
}

export const api = {
  login: (login, password) =>
    request('/api/auth/login', { method: 'POST', body: { login, password }, auth: false }),
  me: () => request('/api/employees/me'),
  myWanted: () => request('/api/wanted/my'),
  allWanted: () => request('/api/wanted/all'),
  availablePlates: () => request('/api/wanted/available-plates'),
  violationCategories: () => request('/api/wanted/violation-categories'),
  addWanted: (plate, reason) =>
    request('/api/wanted/add', { method: 'POST', body: { plate, reason } }),
  deleteWanted: (plate) =>
    request(`/api/wanted/${encodeURIComponent(plate)}`, { method: 'DELETE' }),
  cameras: () => request('/api/cameras/'),
  history: (period) =>
    request(`/api/alerts/history${period && period !== 'all' ? `?period=${period}` : ''}`),
  pending: () => request('/api/alerts/pending'),
  setReaction: (id, reaction_status) =>
    request(`/api/alerts/${id}/reaction`, { method: 'PUT', body: { reaction_status } }),
  setFound: (id, found_status) =>
    request(`/api/alerts/${id}/found`, { method: 'PUT', body: { found_status } }),
  exportToken: () => request('/api/alerts/export-token', { method: 'POST' }),
};

export async function buildExportUrl(format, period) {
  const { token: exportToken } = await api.exportToken();
  const p = period && period !== 'all' ? `&period=${period}` : '';
  return `${baseUrl}/api/alerts/export?format=${format}${p}&token=${encodeURIComponent(exportToken)}`;
}
