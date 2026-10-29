const DEFAULT_API = `${location.protocol}//${location.hostname || '127.0.0.1'}:3001/api`;

function detectBase() {
  const fromQuery = new URLSearchParams(location.search).get('api');
  if (fromQuery) {
    const cleaned = fromQuery.replace(/\/+$/, '');
    localStorage.setItem('forgetax.api', cleaned);
    return cleaned;
  }
  return localStorage.getItem('forgetax.api') || DEFAULT_API;
}

export const API_BASE = detectBase();
const TOKEN_KEY = 'forgetax.token';

export class ApiError extends Error {
  constructor(message, code = 'error', status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('forgetax.user') || 'null'); } catch { return null; }
}
export function setCachedUser(user) {
  if (user) localStorage.setItem('forgetax.user', JSON.stringify(user));
  else localStorage.removeItem('forgetax.user');
}

async function request(path, { method = 'GET', body, auth = true, timeout = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError(err.name === 'AbortError' ? '连接云端超时。' : '无法连接云端服务器。', 'network', 0);
  }
  clearTimeout(timer);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401 && auth) {
      setToken('');
      setCachedUser(null);
    }
    throw new ApiError(data?.message || data?.error || `请求失败（${res.status}）`, data?.error || 'http', res.status);
  }
  return data;
}

export async function register(username, password) {
  const data = await request('/register', { method: 'POST', body: { username, password }, auth: false });
  setToken(data.token);
  setCachedUser(data.user);
  return data;
}

export async function login(username, password) {
  const data = await request('/login', { method: 'POST', body: { username, password }, auth: false });
  setToken(data.token);
  setCachedUser(data.user);
  return data;
}

export async function me() {
  const data = await request('/me');
  setCachedUser(data.user);
  return data;
}

export async function getSaves() {
  const data = await request('/saves');
  return data.slots || [];
}

export async function getSave(slot) {
  const data = await request(`/saves/${slot}`);
  return data.save;
}

export async function putSave(slot, state, profile) {
  return request(`/saves/${slot}`, { method: 'PUT', body: { state, profile } });
}

export async function deleteSave(slot) {
  return request(`/saves/${slot}`, { method: 'DELETE' });
}

export async function pushProfile(profile) {
  return request('/profile', { method: 'POST', body: { profile } });
}

export function logout() {
  setToken('');
  setCachedUser(null);
}

export function apiInfo() {
  return { base: API_BASE };
}
