import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const API_BASE = 'http://localhost:8080';

const el = id => document.getElementById(id);
const toastRoot = el('toasts');
const overlay = el('overlay');
const roleBadge = el('roleBadge');

function showOverlay(on = true) { overlay.style.display = on ? 'flex' : 'none'; }

function toast(msg, kind = 'ok', ttl = 3000) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `<span>${msg}</span><span class="close">×</span><div class="progress"></div>`;
  const close = t.querySelector('.close');
  close.onclick = () => t.remove();
  toastRoot.appendChild(t);
  setTimeout(() => t.remove(), ttl);
}

async function getSessionRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { roleBadge.textContent = 'anonymous'; return { role: 'anonymous', can_edit: false }; }
  const md = user.user_metadata || {};
  const role = (md.role === 'admin' || md.role === 'user') ? md.role : 'user';
  roleBadge.textContent = role;
  return { role, can_edit: Boolean(md.can_edit) || role === 'admin', user };
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function apiGet(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()), ...(opts.headers || {}) };
  return fetch(`${API_BASE}${path}`, { method: 'GET', headers });
}

async function apiPost(path, body = {}) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  return fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

// UI bindings
el('loginBtn').onclick = async () => {
  try {
    const email = prompt('Enter email:');
    if (!email) return;
    showOverlay(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    showOverlay(false);
    if (error) { toast(error.message, 'err'); return; }
    toast('Magic link sent to your email. Check inbox.');
  } catch (e) {
    showOverlay(false);
    toast(e.message, 'err');
  }
};

el('logoutBtn').onclick = async () => {
  await supabase.auth.signOut();
  roleBadge.textContent = 'anonymous';
  toast('Logged out', 'ok');
  el('logoutBtn').style.display = 'none';
  el('loginBtn').style.display = '';
};

el('viewPublicBtn').onclick = async () => {
  showOverlay(true);
  try {
    const r = await apiGet('/excel/public');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    el('publicLink').textContent = j.url;
    el('publicLink').href = j.url;
    toast('Public link ready for 60s', 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    showOverlay(false);
  }
};

el('downloadBtn').onclick = async () => {
  showOverlay(true);
  try {
    const r = await apiGet('/excel/download');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    el('downloadLink').textContent = j.url;
    el('downloadLink').href = j.url;
    toast('Download link ready (tracked)', 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    showOverlay(false);
  }
};

el('applyChangeBtn').onclick = async () => {
  showOverlay(true);
  try {
    const sheet = el('sheetInput').value.trim();
    const cell = el('cellInput').value.trim();
    const valueStr = el('valueInput').value;
    const value = valueStr === '' ? null : isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
    if (!sheet || !cell) throw new Error('Sheet and cell are required');

    const r = await apiPost('/excel/update', { changes: [{ sheet, cell, value }] });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Update failed');

    el('updateStatus').textContent = `Applied ${j.changes_applied} change(s)`;
    toast('Workbook updated', 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    showOverlay(false);
  }
};

el('whoamiBtn').onclick = async () => {
  const h = await authHeader();
  if (!h.Authorization) { el('whoamiResult').textContent = 'anonymous'; toast('Not logged in', 'warn'); return; }
  const r = await apiGet('/roles/me');
  const j = await r.json();
  if (!r.ok) { toast(j.error || 'Failed', 'err'); return; }
  el('whoamiResult').textContent = `${j.email} (${j.role}) edit=${j.can_edit ? 'yes' : 'no'}`;
};

// Initial state
(async () => {
  const role = await getSessionRole();
  el('logoutBtn').style.display = role.user ? '' : 'none';
  el('loginBtn').style.display = role.user ? 'none' : '';
})();
