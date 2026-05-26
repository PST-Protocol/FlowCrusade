const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
const TOKEN_KEY = 'fc_auth_token';

function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
async function parse(res, fallback) {
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || fallback);
  return data;
}
function headers() { return { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }; }
export function getSavedToken() { return token(); }
export function logout() { setToken(''); localStorage.removeItem('fc_user'); }
export function getSavedUser() { try { return JSON.parse(localStorage.getItem('fc_user') || 'null'); } catch { return null; } }
function saveSession(data) { if (data.token) setToken(data.token); if (data.user) localStorage.setItem('fc_user', JSON.stringify(data.user)); return data; }
export async function register(payload) { return saveSession(await parse(await fetch(`${API_BASE}/api/auth/register`, { method:'POST', headers: headers(), body: JSON.stringify(payload) }), 'Register failed')); }
export async function login(payload) { return saveSession(await parse(await fetch(`${API_BASE}/api/auth/login`, { method:'POST', headers: headers(), body: JSON.stringify(payload) }), 'Login failed')); }
export async function me() { return saveSession(await parse(await fetch(`${API_BASE}/api/auth/me`, { headers: headers() }), 'Session check failed')); }
export async function updateProfile(patch) { const data = await parse(await fetch(`${API_BASE}/api/auth/profile`, { method:'PATCH', headers: headers(), body: JSON.stringify(patch) }), 'Profile update failed'); if (data.user) localStorage.setItem('fc_user', JSON.stringify(data.user)); return data; }
export async function searchUser(id) { return parse(await fetch(`${API_BASE}/api/social/search/${encodeURIComponent(id)}`, { headers: headers() }), 'Search failed'); }
export async function addFriend(id) { return parse(await fetch(`${API_BASE}/api/social/friends`, { method:'POST', headers: headers(), body: JSON.stringify({ friendId: id }) }), 'Add friend failed'); }
export async function listFriends() { return parse(await fetch(`${API_BASE}/api/social/friends`, { headers: headers() }), 'Load friends failed'); }
export async function createGroup(name) { return parse(await fetch(`${API_BASE}/api/social/groups`, { method:'POST', headers: headers(), body: JSON.stringify({ name }) }), 'Create group failed'); }
export async function listGroups() { return parse(await fetch(`${API_BASE}/api/social/groups`, { headers: headers() }), 'Load groups failed'); }
export async function addMember(groupId, friendId) { return parse(await fetch(`${API_BASE}/api/social/groups/${groupId}/members`, { method:'POST', headers: headers(), body: JSON.stringify({ friendId }) }), 'Add member failed'); }
export async function getLeaderboard(groupId='') { const q = groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''; return parse(await fetch(`${API_BASE}/api/social/leaderboard${q}`, { headers: headers() }), 'Load leaderboard failed'); }
export async function saveCloudSnapshot(tasks, stats) { return parse(await fetch(`${API_BASE}/api/cloud/snapshot`, { method:'POST', headers: headers(), body: JSON.stringify({ tasks, stats }) }), 'Cloud save failed'); }
export async function loadCloudSnapshot() { return parse(await fetch(`${API_BASE}/api/cloud/snapshot`, { headers: headers() }), 'Cloud load failed'); }
