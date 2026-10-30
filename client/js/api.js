import { SaveSync } from '../shared/saveSync.js';
import { encodeMessage, decodeMessage } from '../shared/wire.js';

const apiUrl = new URL('../api', import.meta.url);
// Asset versions must not change the API endpoint or saved API override key.
apiUrl.pathname = apiUrl.pathname.replace(/\/_v\/[a-f0-9]{16}\//, '/');
const DEFAULT_API = apiUrl.href;
const API_STORAGE_KEY = `forgetax.api:${DEFAULT_API}`;

function detectBase() {
  const fromQuery = new URLSearchParams(location.search).get('api');
  if (fromQuery) {
    const cleaned = fromQuery.replace(/\/+$/, '');
    localStorage.setItem(API_STORAGE_KEY, cleaned);
    return cleaned;
  }
  return localStorage.getItem(API_STORAGE_KEY) || DEFAULT_API;
}

export const API_BASE = detectBase();
const TOKEN_KEY = 'forgetax.token';
let sync = null;
const saveSync = () => sync || (sync = new SaveSync(request));

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
  if (token !== getToken()) sync = null;
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
  const headers = {
    'Content-Type': 'application/json',
    // Experimental protobuf transport (shared/wire.js); a JSON-only server
    // ignores this and answers JSON.
    Accept: 'application/json, application/x-protobuf',
  };
  let payload;
  if (body !== undefined) {
    const encoded = encodeMessage(body);
    headers['Content-Type'] = encoded.type;
    payload = encoded.bytes;
  }
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError(err.name === 'AbortError' ? '连接云端超时。' : '无法连接云端服务器。', 'network', 0);
  }
  clearTimeout(timer);
  let data = null;
  try {
    const bytes = new Uint8Array(await res.arrayBuffer());
    data = decodeMessage(bytes, res.headers.get('content-type') || '');
  } catch { data = null; }
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
  saveSync().rememberProfile(data.profile);
  return data;
}

export async function login(username, password) {
  const data = await request('/login', { method: 'POST', body: { username, password }, auth: false });
  setToken(data.token);
  setCachedUser(data.user);
  saveSync().rememberProfile(data.profile);
  return data;
}

export async function me() {
  const data = await request('/me');
  setCachedUser(data.user);
  saveSync().rememberProfile(data.profile);
  return data;
}

export async function getSaves() {
  const data = await request('/saves');
  for (const save of data.slots || []) saveSync().remember(save);
  return data.slots || [];
}

export async function getSave(slot) {
  const data = await request(`/saves/${slot}`);
  saveSync().remember(data.save);
  return data.save;
}

export async function putSave(slot, state, profile) {
  return saveSync().save(slot, state, profile);
}

export async function deleteSave(slot) {
  const data = await request(`/saves/${slot}`, { method: 'DELETE' });
  saveSync().slots.delete(slot);
  return data;
}

export async function pushProfile(profile) {
  const data = await request('/profile', { method: 'POST', body: { profile } });
  saveSync().rememberProfile(data.profile);
  return data;
}

export function logout() {
  setToken('');
  setCachedUser(null);
}

export function apiInfo() {
  return { base: API_BASE };
}
