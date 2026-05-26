import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_FILE = path.join(__dirname, 'data', 'cloud-local.json');
const JWT_SECRET = process.env.JWT_SECRET || 'flow-crusade-dev-secret-change-me';
const TOKEN_DAYS = 30;

let pool = null;
let postgresReady = false;
let initPromise = null;

function ensureLocalFile() {
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  if (!fs.existsSync(LOCAL_FILE)) {
    fs.writeFileSync(LOCAL_FILE, JSON.stringify({ users: [], friendships: [], groups: [], groupMembers: [], taskSnapshots: [] }, null, 2));
  }
}

function readLocal() {
  ensureLocalFile();
  try {
    const data = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
    return {
      users: Array.isArray(data.users) ? data.users : [],
      friendships: Array.isArray(data.friendships) ? data.friendships : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      groupMembers: Array.isArray(data.groupMembers) ? data.groupMembers : [],
      taskSnapshots: Array.isArray(data.taskSnapshots) ? data.taskSnapshots : [],
    };
  } catch {
    return { users: [], friendships: [], groups: [], groupMembers: [], taskSnapshots: [] };
  }
}

function writeLocal(data) {
  ensureLocalFile();
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2));
}

function hasDatabaseUrl() {
  return Boolean((process.env.DATABASE_URL || '').trim());
}

export function getCloudMode() {
  return postgresReady ? 'postgres' : 'local-json';
}

export async function initCloudStore() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!hasDatabaseUrl()) {
      console.log('☁️ Cloud DB mode: local-json fallback (DATABASE_URL not set)');
      return false;
    }
    try {
      pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined });
      await pool.query('select 1');
      await pool.query(`
        create table if not exists users (
          internal_uuid uuid primary key,
          public_id char(8) unique not null,
          email text unique,
          phone text unique,
          username text not null,
          password_hash text not null,
          password_salt text not null,
          ranking_opt_in boolean not null default false,
          storage_mode text not null default 'local',
          total_score integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table if not exists friendships (
          user_uuid uuid not null references users(internal_uuid) on delete cascade,
          friend_uuid uuid not null references users(internal_uuid) on delete cascade,
          created_at timestamptz not null default now(),
          primary key(user_uuid, friend_uuid)
        );
        create table if not exists study_groups (
          group_id uuid primary key,
          owner_uuid uuid not null references users(internal_uuid) on delete cascade,
          name text not null,
          created_at timestamptz not null default now()
        );
        create table if not exists study_group_members (
          group_id uuid not null references study_groups(group_id) on delete cascade,
          user_uuid uuid not null references users(internal_uuid) on delete cascade,
          joined_at timestamptz not null default now(),
          primary key(group_id, user_uuid)
        );
        create table if not exists task_snapshots (
          user_uuid uuid primary key references users(internal_uuid) on delete cascade,
          tasks_json jsonb not null default '[]'::jsonb,
          stats_json jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now()
        );
      `);
      postgresReady = true;
      console.log('☁️ Cloud DB mode: PostgreSQL connected');
      return true;
    } catch (error) {
      postgresReady = false;
      console.warn(`☁️ Cloud DB mode: local-json fallback (${error.message})`);
      return false;
    }
  })();
  return initPromise;
}

function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function normalizePhone(phone) { return String(phone || '').replace(/[^0-9+]/g, '').trim(); }
function makeSalt() { return crypto.randomBytes(16).toString('hex'); }
function hashPassword(password, salt) { return crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex'); }
function verifyPassword(password, salt, hash) { return crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt)), Buffer.from(hash)); }
function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.public_id || u.publicId,
    username: u.username,
    email: u.email || null,
    phone: u.phone || null,
    rankingOptIn: Boolean(u.ranking_opt_in ?? u.rankingOptIn),
    storageMode: u.storage_mode || u.storageMode || 'local',
    totalScore: Number(u.total_score ?? u.totalScore ?? 0),
    createdAt: u.created_at || u.createdAt,
  };
}
function signToken(user) {
  const uuid = user.internal_uuid || user.internalUuid;
  return jwt.sign({ sub: uuid }, JWT_SECRET, { expiresIn: `${TOKEN_DAYS}d` });
}
export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}
export async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) throw Object.assign(new Error('Login required.'), { statusCode: 401 });
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } catch { throw Object.assign(new Error('Invalid or expired login.'), { statusCode: 401 }); }
  const user = await findUserByUuid(decoded.sub);
  if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 401 });
  return user;
}
async function uniquePublicId() {
  for (let i = 0; i < 20; i++) {
    const id = String(crypto.randomInt(10000000, 100000000));
    if (!(await findUserByPublicId(id))) return id;
  }
  throw new Error('Could not generate unique user ID.');
}
export async function findUserByUuid(uuid) {
  await initCloudStore();
  if (postgresReady) return (await pool.query('select * from users where internal_uuid=$1', [uuid])).rows[0] || null;
  return readLocal().users.find(u => u.internalUuid === uuid) || null;
}
export async function findUserByPublicId(publicId) {
  await initCloudStore();
  if (postgresReady) return (await pool.query('select * from users where public_id=$1', [publicId])).rows[0] || null;
  return readLocal().users.find(u => u.publicId === publicId) || null;
}
export async function registerUser({ email, phone, password, username }) {
  await initCloudStore();
  const e = normalizeEmail(email); const p = normalizePhone(phone);
  if (!e && !p) throw Object.assign(new Error('Email or phone is required.'), { statusCode: 400 });
  if (!password || String(password).length < 6) throw Object.assign(new Error('Password must be at least 6 characters.'), { statusCode: 400 });
  const salt = makeSalt(); const passwordHash = hashPassword(password, salt); const publicId = await uniquePublicId(); const internalUuid = crypto.randomUUID();
  const displayName = String(username || (e ? e.split('@')[0] : `User${publicId.slice(-4)}`)).slice(0, 32);
  if (postgresReady) {
    try {
      const { rows } = await pool.query(
        'insert into users(internal_uuid, public_id, email, phone, username, password_hash, password_salt) values($1,$2,$3,$4,$5,$6,$7) returning *',
        [internalUuid, publicId, e || null, p || null, displayName, passwordHash, salt]
      );
      return { user: sanitizeUser(rows[0]), token: signToken(rows[0]), mode: getCloudMode() };
    } catch (error) {
      if (error.code === '23505') throw Object.assign(new Error('This email or phone is already registered.'), { statusCode: 409 });
      throw error;
    }
  }
  const data = readLocal();
  if ((e && data.users.some(u => u.email === e)) || (p && data.users.some(u => u.phone === p))) throw Object.assign(new Error('This email or phone is already registered.'), { statusCode: 409 });
  const user = { internalUuid, publicId, email: e || null, phone: p || null, username: displayName, passwordHash, passwordSalt: salt, rankingOptIn: false, storageMode: 'local', totalScore: 0, createdAt: new Date().toISOString() };
  data.users.push(user); writeLocal(data);
  return { user: sanitizeUser(user), token: signToken(user), mode: getCloudMode() };
}
export async function loginUser({ identifier, password }) {
  await initCloudStore();
  const id = String(identifier || '').trim();
  if (postgresReady) {
    const { rows } = await pool.query('select * from users where email=$1 or phone=$2 or public_id=$3', [normalizeEmail(id), normalizePhone(id), id]);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) throw Object.assign(new Error('Invalid account or password.'), { statusCode: 401 });
    return { user: sanitizeUser(user), token: signToken(user), mode: getCloudMode() };
  }
  const user = readLocal().users.find(u => u.email === normalizeEmail(id) || u.phone === normalizePhone(id) || u.publicId === id);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) throw Object.assign(new Error('Invalid account or password.'), { statusCode: 401 });
  return { user: sanitizeUser(user), token: signToken(user), mode: getCloudMode() };
}
export async function updateProfile(user, patch) {
  await initCloudStore();
  const username = patch.username !== undefined ? String(patch.username).trim().slice(0, 32) : undefined;
  const rankingOptIn = patch.rankingOptIn !== undefined ? Boolean(patch.rankingOptIn) : undefined;
  const storageMode = ['local', 'cloud'].includes(patch.storageMode) ? patch.storageMode : undefined;
  if (postgresReady) {
    const { rows } = await pool.query(`update users set username=coalesce($2, username), ranking_opt_in=coalesce($3, ranking_opt_in), storage_mode=coalesce($4, storage_mode), updated_at=now() where internal_uuid=$1 returning *`, [user.internal_uuid, username ?? null, rankingOptIn ?? null, storageMode ?? null]);
    return sanitizeUser(rows[0]);
  }
  const data = readLocal(); const idx = data.users.findIndex(u => u.internalUuid === user.internalUuid);
  if (idx >= 0) data.users[idx] = { ...data.users[idx], ...(username !== undefined ? { username } : {}), ...(rankingOptIn !== undefined ? { rankingOptIn } : {}), ...(storageMode ? { storageMode } : {}), updatedAt: new Date().toISOString() };
  writeLocal(data); return sanitizeUser(data.users[idx]);
}
export async function searchUserById(publicId) {
  const found = await findUserByPublicId(String(publicId || '').trim());
  return found ? sanitizeUser(found) : null;
}
export async function addFriend(user, friendPublicId) {
  const friend = await findUserByPublicId(String(friendPublicId || '').trim());
  if (!friend) throw Object.assign(new Error('No user found with that ID.'), { statusCode: 404 });
  const userUuid = user.internal_uuid || user.internalUuid; const friendUuid = friend.internal_uuid || friend.internalUuid;
  if (userUuid === friendUuid) throw Object.assign(new Error('You cannot add yourself.'), { statusCode: 400 });
  if (postgresReady) {
    await pool.query('insert into friendships(user_uuid, friend_uuid) values($1,$2),($2,$1) on conflict do nothing', [userUuid, friendUuid]);
  } else {
    const data = readLocal();
    for (const [a,b] of [[userUuid, friendUuid],[friendUuid,userUuid]]) if (!data.friendships.some(f => f.userUuid === a && f.friendUuid === b)) data.friendships.push({ userUuid: a, friendUuid: b, createdAt: new Date().toISOString() });
    writeLocal(data);
  }
  return sanitizeUser(friend);
}
export async function listFriends(user) {
  const userUuid = user.internal_uuid || user.internalUuid;
  if (postgresReady) {
    const { rows } = await pool.query('select u.* from friendships f join users u on u.internal_uuid=f.friend_uuid where f.user_uuid=$1 order by f.created_at desc', [userUuid]);
    return rows.map(sanitizeUser);
  }
  const data = readLocal(); const ids = data.friendships.filter(f => f.userUuid === userUuid).map(f => f.friendUuid);
  return data.users.filter(u => ids.includes(u.internalUuid)).map(sanitizeUser);
}
export async function createGroup(user, name) {
  const groupId = crypto.randomUUID(); const userUuid = user.internal_uuid || user.internalUuid; const groupName = String(name || 'Study Group').trim().slice(0, 50);
  if (postgresReady) {
    await pool.query('insert into study_groups(group_id, owner_uuid, name) values($1,$2,$3)', [groupId, userUuid, groupName]);
    await pool.query('insert into study_group_members(group_id, user_uuid) values($1,$2)', [groupId, userUuid]);
  } else {
    const data = readLocal(); data.groups.push({ groupId, ownerUuid: userUuid, name: groupName, createdAt: new Date().toISOString() }); data.groupMembers.push({ groupId, userUuid, joinedAt: new Date().toISOString() }); writeLocal(data);
  }
  return { groupId, name: groupName, ownerId: sanitizeUser(user).id };
}
export async function addGroupMember(user, groupId, friendPublicId) {
  const friend = await findUserByPublicId(String(friendPublicId || '').trim()); if (!friend) throw Object.assign(new Error('No user found with that ID.'), { statusCode: 404 });
  const friendUuid = friend.internal_uuid || friend.internalUuid;
  if (postgresReady) await pool.query('insert into study_group_members(group_id, user_uuid) values($1,$2) on conflict do nothing', [groupId, friendUuid]);
  else { const data = readLocal(); if (!data.groupMembers.some(m => m.groupId === groupId && m.userUuid === friendUuid)) data.groupMembers.push({ groupId, userUuid: friendUuid, joinedAt: new Date().toISOString() }); writeLocal(data); }
  return sanitizeUser(friend);
}
export async function listGroups(user) {
  const userUuid = user.internal_uuid || user.internalUuid;
  if (postgresReady) {
    const { rows } = await pool.query('select g.group_id, g.name, g.owner_uuid from study_group_members m join study_groups g on g.group_id=m.group_id where m.user_uuid=$1 order by g.created_at desc', [userUuid]);
    return rows.map(r => ({ groupId: r.group_id, name: r.name, ownerUuid: r.owner_uuid }));
  }
  const data = readLocal(); const gids = data.groupMembers.filter(m => m.userUuid === userUuid).map(m => m.groupId);
  return data.groups.filter(g => gids.includes(g.groupId)).map(g => ({ groupId: g.groupId, name: g.name, ownerUuid: g.ownerUuid }));
}
export async function saveSnapshot(user, { tasks, stats }) {
  const userUuid = user.internal_uuid || user.internalUuid; const score = Number(stats?.focusScore || stats?.weightedCredit || 0);
  if (postgresReady) {
    await pool.query(`insert into task_snapshots(user_uuid, tasks_json, stats_json) values($1,$2,$3) on conflict(user_uuid) do update set tasks_json=$2, stats_json=$3, updated_at=now()`, [userUuid, JSON.stringify(tasks || []), JSON.stringify(stats || {})]);
    await pool.query('update users set total_score=greatest(total_score, $2), updated_at=now() where internal_uuid=$1', [userUuid, score]);
  } else {
    const data = readLocal(); const idx = data.taskSnapshots.findIndex(s => s.userUuid === userUuid); const snap = { userUuid, tasks: tasks || [], stats: stats || {}, updatedAt: new Date().toISOString() };
    if (idx >= 0) data.taskSnapshots[idx] = snap; else data.taskSnapshots.push(snap);
    const uidx = data.users.findIndex(u => u.internalUuid === userUuid); if (uidx >= 0) data.users[uidx].totalScore = Math.max(Number(data.users[uidx].totalScore || 0), score);
    writeLocal(data);
  }
  return { ok: true };
}
export async function loadSnapshot(user) {
  const userUuid = user.internal_uuid || user.internalUuid;
  if (postgresReady) {
    const { rows } = await pool.query('select tasks_json, stats_json, updated_at from task_snapshots where user_uuid=$1', [userUuid]);
    const r = rows[0]; return r ? { tasks: r.tasks_json, stats: r.stats_json, updatedAt: r.updated_at } : { tasks: [], stats: {}, updatedAt: null };
  }
  const snap = readLocal().taskSnapshots.find(s => s.userUuid === userUuid); return snap || { tasks: [], stats: {}, updatedAt: null };
}
export async function leaderboard({ groupId } = {}) {
  await initCloudStore();
  if (postgresReady) {
    const params = []; let where = 'where u.ranking_opt_in=true'; let join = '';
    if (groupId) { join = 'join study_group_members m on m.user_uuid=u.internal_uuid'; where += ' and m.group_id=$1'; params.push(groupId); }
    const { rows } = await pool.query(`select u.public_id,u.username,u.total_score from users u ${join} ${where} order by u.total_score desc limit 50`, params);
    return rows.map((r, i) => ({ rank: i + 1, id: r.public_id, username: r.username, score: Number(r.total_score || 0) }));
  }
  const data = readLocal(); let users = data.users.filter(u => u.rankingOptIn);
  if (groupId) { const ids = data.groupMembers.filter(m => m.groupId === groupId).map(m => m.userUuid); users = users.filter(u => ids.includes(u.internalUuid)); }
  return users.sort((a,b) => Number(b.totalScore||0)-Number(a.totalScore||0)).slice(0,50).map((u,i) => ({ rank: i+1, id: u.publicId, username: u.username, score: Number(u.totalScore||0) }));
}
export { sanitizeUser };
