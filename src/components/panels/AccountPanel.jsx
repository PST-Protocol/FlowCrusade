import React, { useEffect, useState } from 'react';
import { Cloud, HardDrive, LogIn, LogOut, Search, Trophy, Users, UserPlus, Save } from 'lucide-react';
import { register, login, logout, getSavedUser, updateProfile, searchUser, addFriend, listFriends, createGroup, listGroups, addMember, getLeaderboard, saveCloudSnapshot, loadCloudSnapshot } from '../../services/authApi';

export default function AccountPanel({ t, theme, settings, setSettings, tasks, setTasks, stats, showToast }) {
  const [user, setUser] = useState(getSavedUser());
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ identifier: '', email: '', phone: '', password: '', username: '' });
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchId, setSearchId] = useState('');
  const [found, setFound] = useState(null);
  const [groupName, setGroupName] = useState('');

  const storageMode = settings.storageMode || 'local';
  const rankingOptIn = Boolean(settings.rankingOptIn);

  const refreshSocial = async () => {
    if (!user) return;
    try {
      const [f, g, lb] = await Promise.all([listFriends(), listGroups(), getLeaderboard()]);
      setFriends(f.friends || []); setGroups(g.groups || []); setLeaderboard(lb.leaderboard || []);
    } catch {}
  };
  useEffect(() => { refreshSocial(); }, [user?.id]);

  const submitAuth = async () => {
    try {
      const data = mode === 'login' ? await login({ identifier: form.identifier, password: form.password }) : await register({ email: form.email, phone: form.phone, username: form.username, password: form.password });
      setUser(data.user); setSettings(prev => ({ ...prev, storageMode: data.user.storageMode || 'local', rankingOptIn: data.user.rankingOptIn })); showToast?.('Logged in successfully');
    } catch (e) { showToast?.(e.message, 'warning'); }
  };
  const savePrefs = async (patch) => {
    const next = { ...settings, ...patch }; setSettings(next);
    if (user) {
      try { const data = await updateProfile({ username: user.username, storageMode: next.storageMode, rankingOptIn: next.rankingOptIn }); setUser(data.user); showToast?.('Account settings saved'); }
      catch (e) { showToast?.(e.message, 'warning'); }
    }
  };
  const doSearch = async () => { try { const data = await searchUser(searchId); setFound(data.user); } catch(e) { setFound(null); showToast?.(e.message, 'warning'); } };
  const doAddFriend = async (id) => { try { await addFriend(id); showToast?.('Friend added'); refreshSocial(); } catch(e) { showToast?.(e.message, 'warning'); } };
  const doCreateGroup = async () => { try { await createGroup(groupName || 'Study Group'); setGroupName(''); showToast?.('Study group created'); refreshSocial(); } catch(e) { showToast?.(e.message, 'warning'); } };
  const cloudSave = async () => { try { await saveCloudSnapshot(tasks, stats); showToast?.('Saved to cloud'); refreshSocial(); } catch(e) { showToast?.(e.message, 'warning'); } };
  const cloudLoad = async () => { try { const data = await loadCloudSnapshot(); if (Array.isArray(data.tasks) && data.tasks.length) setTasks(data.tasks); showToast?.('Cloud snapshot loaded'); } catch(e) { showToast?.(e.message, 'warning'); } };

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 ${t.textMuted}`}>Storage Choice</h4>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => savePrefs({ storageMode: 'local' })} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${storageMode === 'local' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : `${t.border} ${t.textMuted}`}`}><HardDrive className="w-5 h-5"/><span className="text-xs font-bold">Local only</span></button>
          <button onClick={() => savePrefs({ storageMode: 'cloud' })} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${storageMode === 'cloud' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : `${t.border} ${t.textMuted}`}`}><Cloud className="w-5 h-5"/><span className="text-xs font-bold">Cloud</span></button>
        </div>
        <p className={`mt-3 text-xs ${t.textMuted}`}>Local mode does not need a database. Cloud mode requires an account. When DATABASE_URL is available, the backend uses PostgreSQL; otherwise it falls back to a local JSON file.</p>
      </div>

      {!user ? (
        <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
          <div className="flex gap-2 mb-4"><button onClick={() => setMode('login')} className={`px-3 py-2 rounded-xl text-xs font-bold ${mode==='login'?'bg-indigo-600 text-white':t.secondaryBtn}`}>Login</button><button onClick={() => setMode('register')} className={`px-3 py-2 rounded-xl text-xs font-bold ${mode==='register'?'bg-indigo-600 text-white':t.secondaryBtn}`}>Create Account</button></div>
          {mode === 'login' ? <input className={`w-full mb-2 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Email / phone / 8-digit ID" value={form.identifier} onChange={e=>setForm({...form, identifier:e.target.value})}/> : <><input className={`w-full mb-2 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/><input className={`w-full mb-2 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Phone optional" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/><input className={`w-full mb-2 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/></>}
          <input type="password" className={`w-full mb-3 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
          <button onClick={submitAuth} className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-2"><LogIn className="w-4 h-4"/>{mode === 'login' ? 'Login' : 'Create account'}</button>
        </div>
      ) : (
        <>
          <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
            <div className="flex items-start justify-between gap-3"><div><p className={`text-sm font-black ${t.textMain}`}>{user.username}</p><p className={`text-xs ${t.textMuted}`}>ID: {user.id}</p></div><button onClick={() => { logout(); setUser(null); }} className={`p-2 rounded-xl ${t.secondaryBtn}`}><LogOut className="w-4 h-4"/></button></div>
            <input className={`w-full mt-3 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} value={user.username} onChange={e=>setUser({...user, username:e.target.value})}/>
            <label className="mt-3 flex items-center justify-between text-sm"><span className={t.textMain}>Participate in ranking</span><input type="checkbox" checked={rankingOptIn} onChange={e=>savePrefs({ rankingOptIn: e.target.checked })}/></label>
            <button onClick={() => savePrefs({})} className="mt-3 w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4"/>Save profile</button>
            {storageMode === 'cloud' && <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={cloudSave} className={`px-3 py-2 rounded-xl text-xs font-bold ${t.secondaryBtn}`}>Save Cloud</button><button onClick={cloudLoad} className={`px-3 py-2 rounded-xl text-xs font-bold ${t.secondaryBtn}`}>Load Cloud</button></div>}
          </div>

          <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 ${t.textMuted}`}>Friends</h4>
            <div className="flex gap-2"><input className={`flex-1 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Search 8-digit ID" value={searchId} onChange={e=>setSearchId(e.target.value)}/><button onClick={doSearch} className={`px-3 rounded-xl ${t.secondaryBtn}`}><Search className="w-4 h-4"/></button></div>
            {found && <div className={`mt-3 p-3 rounded-xl border ${t.border}`}><p className="text-sm font-bold">{found.username}</p><p className={`text-xs ${t.textMuted}`}>{found.id}</p><button onClick={()=>doAddFriend(found.id)} className="mt-2 text-xs font-bold text-indigo-400 flex gap-1"><UserPlus className="w-3 h-3"/>Add friend</button></div>}
            <div className="mt-3 space-y-2">{friends.map(f => <div key={f.id} className={`text-xs p-2 rounded-lg ${theme==='dark'?'bg-white/5':'bg-slate-50'}`}>{f.username} · {f.id}</div>)}</div>
          </div>

          <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 ${t.textMuted}`}>Study Groups</h4>
            <div className="flex gap-2"><input className={`flex-1 px-3 py-2 rounded-xl border ${t.border} ${theme==='dark'?'bg-black/20':'bg-white'}`} placeholder="Group name" value={groupName} onChange={e=>setGroupName(e.target.value)}/><button onClick={doCreateGroup} className={`px-3 rounded-xl ${t.secondaryBtn}`}><Users className="w-4 h-4"/></button></div>
            <div className="mt-3 space-y-2">{groups.map(g => <div key={g.groupId} className={`text-xs p-2 rounded-lg ${theme==='dark'?'bg-white/5':'bg-slate-50'}`}>{g.name}</div>)}</div>
          </div>

          <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 flex gap-2 items-center ${t.textMuted}`}><Trophy className="w-4 h-4"/> Leaderboard</h4>
            <div className="space-y-2">{leaderboard.map(row => <div key={row.id} className={`flex justify-between text-xs p-2 rounded-lg ${theme==='dark'?'bg-white/5':'bg-slate-50'}`}><span>#{row.rank} {row.username}</span><b>{row.score}</b></div>)}</div>
          </div>
        </>
      )}
    </div>
  );
}
