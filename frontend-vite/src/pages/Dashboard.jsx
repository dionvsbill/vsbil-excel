// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Toast from '../components/Toast';
import LoadingOverlay from '../components/LoadingOverlay';
import Login from '../pages/Login';
import Register from '../pages/Register';
import './preview-table.css'; // ✅ styling for Excel-like preview
import InstallButton from '../InstallButton';

 

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('guest');
  const [canEdit, setCanEdit] = useState(false);
  const [users, setUsers] = useState([]);

  const [publicLink, setPublicLink] = useState('');
  const [downloadLink, setDownloadLink] = useState('');
  const [sheet, setSheet] = useState('');
  const [sheets, setSheets] = useState([]);
  const [cell, setCell] = useState('');
  const [value, setValue] = useState('');
  const [previewValue, setPreviewValue] = useState('');
  const [previewGrid, setPreviewGrid] = useState([]);
  const [meta, setMeta] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  const [loading, setLoading] = useState(false);
  const [whoami, setWhoami] = useState('');
  const [sessionDump, setSessionDump] = useState('');

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [theme, setTheme] = useState('system');

  const API_BASE = 'http://localhost:8000';
  

  // ✅ keep session in sync
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) updateUser(data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) updateUser(session.user);
      else {
        setUser(null);
        setRole('guest');
        setCanEdit(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function updateUser(u) {
    setUser(u);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, can_edit')
        .eq('id', u.id)
        .single();
      if (error) {
        Toast.error(error.message);
        setRole('user');
        setCanEdit(false);
        return;
      }
      setRole(data?.role || 'user');
      setCanEdit(data?.can_edit || data?.role === 'admin');
    } catch (err) {
      Toast.error(err.message);
      setRole('user');
      setCanEdit(false);
    }
  }

  // ✅ fetch all users if admin
  useEffect(() => {
    if (role === 'admin') {
      supabase
        .from('profiles')
        .select('id, email, role, can_edit')
        .then(({ data, error }) => {
          if (error) Toast.error(error.message);
          else setUsers(data || []);
        });
    }
  }, [role]);

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function apiGet(path) {
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_BASE}${path}`, { headers });
      return await res.json();
    } catch (e) {
      Toast.error(e.message);
      return { error: e.message };
    } finally {
      setLoading(false);
    }
  }

  async function apiPost(path, body) {
    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      return await res.json();
    } catch (e) {
      Toast.error(e.message);
      return { error: e.message };
    } finally {
      setLoading(false);
    }
  }

  // ✅ Excel actions
  async function getPublicLink() {
    const j = await apiGet('/excel/public');
    if (j.error) Toast.error(j.error);
    else { setPublicLink(j.url); Toast.success('Public link ready'); }
  }

  async function getDownloadLink() {
  if (!user) {
    Toast.warn('Login required');
    return;
  }

  try {
    const response = await fetch('/excel/download');
    if (!response.ok) {
      const err = await response.json();
      Toast.error(err.error || 'Download failed');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'master.xlsx'; // customize filename if needed
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    Toast.success('Download started');
  } catch (e) {
    console.error('Download error:', e);
    Toast.error('Download failed');
  }
}


  async function loadSheets() {
    const j = await apiGet('/excel/sheets');
    if (j.error) Toast.error(j.error);
    else setSheets(j.sheets || []);
  }

  async function previewCell() {
    if (!sheet || !cell) { Toast.error('Select sheet and cell'); return; }
    const j = await apiGet(`/excel/get?sheet=${encodeURIComponent(sheet)}&cell=${encodeURIComponent(cell)}`);
    if (j.error) Toast.error(j.error);
    else setPreviewValue(j.value ?? '(empty)');
  }

  async function previewSheet() {
    if (!sheet) { Toast.error('Select a sheet'); return; }
    const j = await apiGet(`/excel/preview?sheet=${encodeURIComponent(sheet)}&rows=20&cols=10`);
    if (j.error) Toast.error(j.error);
    else setPreviewGrid(j.preview || []);
  }

  async function applyChange() {
    if (!sheet || !cell) { Toast.error('Sheet and cell required'); return; }
    const j = await apiPost('/excel/update', { changes: [{ sheet, cell, value }] });
    if (j.error) Toast.error(j.error);
    else { Toast.success(`Applied ${j.changes_applied} change(s)`); }
  }

  async function getMeta() {
    const j = await apiGet('/excel/meta');
    if (j.error) Toast.error(j.error);
    else setMeta(j);
  }

  async function getAuditLogs() {
    const j = await apiGet('/excel/audit');
    if (j.error) Toast.error(j.error);
    else setAuditLogs(j.logs || []);
  }

  async function exportCSV() {
    if (!sheet) { Toast.error('Select a sheet'); return; }
    window.open(`${API_BASE}/excel/export/csv?sheet=${encodeURIComponent(sheet)}`, '_blank');
  }

  async function exportPDF() {
    if (!sheet) { Toast.error('Select a sheet'); return; }
    window.open(`${API_BASE}/excel/export/pdf?sheet=${encodeURIComponent(sheet)}`, '_blank');
  }

  // ✅ Session & role tools
  async function whoAmI() {
    const headers = await authHeader();
    if (!headers.Authorization) {
      setWhoami('anonymous');
      Toast.warn('Not logged in');
      return;
    }
    const j = await apiGet('/roles/me');
    if (j.error) Toast.error(j.error);
    else setWhoami(`${j.email} (${j.role}) edit=${j.can_edit ? 'yes' : 'no'}`);
  }

  async function dumpSession() {
    const { data: { session } } = await supabase.auth.getSession();
    setSessionDump(JSON.stringify(session, null, 2));
    Toast.success('Session dumped');
  }

  async function pingApi() {
    const j = await apiGet('/ping');
    if (j.error) Toast.error(j.error);
    else Toast.success(`API responded: ${j.message || 'ok'}`);
  }

  function clearLinks() {
    setPublicLink('');
    setDownloadLink('');
    Toast.warn('Links cleared');
  }

  async function grantAccess(userId) {
    const { error } = await supabase.from('profiles').update({ can_edit: true }).eq('id', userId);
    if (error) Toast.error(error.message);
    else {
      Toast.success('Access granted');
      setUsers(users.map(u => u.id === userId ? { ...u, can_edit: true } : u));
    }
  }

  async function revokeAccess(userId) {
    const { error } = await supabase.from('profiles').update({ can_edit: false }).eq('id', userId);
    if (error) Toast.error(error.message);
    else {
      Toast.success('Access revoked');
      setUsers(users.map(u => u.id === userId ? { ...u, can_edit: false } : u));
    }
  }

  // ✅ Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  return (
    <div>
      <header className="navbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="brand">
          Excel Dashboard <span className="role-badge">{role}</span>
        </div>
        <div className="row" style={{ gap: '8px', flexWrap: 'nowrap' }}>
          {!user && <button onClick={() => setShowLogin(true)} style={{ fontSize: '0.85em', padding: '6px 10px' }}>Login</button>}
          {user && <button className="secondary" onClick={() => supabase.auth.signOut()} style={{ fontSize: '0.85em', color: 'var(--text)', padding: '6px 10px' }}>Logout</button>}
          {!user && <button onClick={() => setShowRegister(true)} style={{ fontSize: '0.85em', padding: '6px 10px' }}>Register</button>}
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            style={{
              fontSize: '0.85em',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--muted)',
              background: 'var(--card)',
              color: 'var(--text)',
            }}
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </header>

      <div className="dashboard">
        <h1>Excel Access Dashboard</h1>
        <div>
          <InstallButton />
        </div>
        {user ? (
          <p>Welcome <strong>{user.email}</strong> (role: {role})</p>
          
        ) : (
          <div className="guest-banner">
            <p>You are browsing as <strong>Guest</strong></p>
            <p className="hint">Sign up or log in to unlock downloads and editing features.</p>
          </div>
        )}

        <div className="grid">
          {/* Public and download links */}
          <div className="card">
            <h2>Public View</h2>
            <button onClick={getPublicLink} disabled={loading}>Get Public Link</button>
            {publicLink && <a href={publicLink} target="_blank" rel="noopener noreferrer">{publicLink}</a>}
          </div>

          <div className="card">
            <h2>Authenticated Download</h2>
            {user ? (
              <>
                <button onClick={getDownloadLink} disabled={loading}>Get Download Link</button>
                {downloadLink && (
                  <a href={downloadLink} target="_blank" rel="noopener noreferrer">
                    {downloadLink}
                  </a>
                )}
              </>
            ) : (
              <p className="muted">Login required to access tracked downloads.</p>
            )}
          </div>

          {/* Update Excel */}
          {(role === 'admin' || canEdit) && (
            <div className="card">
              <h2>Update Excel</h2>
              <button onClick={loadSheets} disabled={loading}>Load Sheets</button>
              {sheets.length > 0 && (
                <select value={sheet} onChange={e => setSheet(e.target.value)}>
                  <option value="">Select sheet</option>
                  {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <input value={cell} onChange={e => setCell(e.target.value)} placeholder="Cell (e.g. A1)" />
              <input value={value} onChange={e => setValue(e.target.value)} placeholder="New value" />

              <button onClick={previewCell} disabled={loading}>Preview Cell</button>
              {previewValue && <p className="muted">Current value in {sheet} {cell}: <strong>{previewValue}</strong></p>}

              <button className="warn" onClick={applyChange} disabled={loading}>Apply Change</button>

              <button onClick={previewSheet} disabled={loading}>Preview Sheet</button>
              {previewGrid.length > 0 && (
                <div style={{ maxWidth: '100%', maxHeight: '300px', overflow: 'auto' }}>
                  <table className="preview-table">
                    <tbody>
                      {previewGrid.map((row, i) => (
                        <tr key={i}>
                          {row.map((cellVal, j) => (
                            <td key={j}>{cellVal ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button onClick={exportCSV} disabled={loading}>Export CSV</button>
              <button onClick={exportPDF} disabled={loading}>Export PDF</button>
            </div>
          )}

          {/* Metadata */}
          <div className="card">
            <h2>File Metadata</h2>
            <button onClick={getMeta} disabled={loading}>Get Metadata</button>
            {meta && (
              <ul>
                <li>Name: {meta.name}</li>
                <li>Size: {meta.size} bytes</li>
                <li>Last Modified: {meta.last_modified}</li>
              </ul>
            )}
          </div>

          {/* Audit logs */}
          <div className="card">
            <h2>Audit Log</h2>
            <button onClick={getAuditLogs} disabled={loading}>Load Audit Logs</button>
            {auditLogs.length > 0 && (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Sheet</th>
                    <th>Cell</th>
                    <th>Old Value</th>
                    <th>New Value</th>
                    <th>Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => (
                    <tr key={idx}>
                      <td>{log.email}</td>
                      <td>{log.sheet}</td>
                      <td>{log.cell}</td>
                      <td>{log.old_value}</td>
                      <td>{log.new_value}</td>
                      <td>{log.changed_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* User access management */}
          {role === 'admin' && (
            <div className="card">
              <h2>User Access Management</h2>
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Can Edit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-role-${u.role}`}>{u.role}</span></td>
                      <td><span className={`badge ${u.can_edit ? 'badge-access-yes' : 'badge-access-no'}`}>{u.can_edit ? 'Yes' : 'No'}</span></td>
                      <td>
                        <button onClick={() => grantAccess(u.id)}>Grant</button>
                        <button onClick={() => revokeAccess(u.id)}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Session & role */}
          <div className="card">
            <h2>Session & Role</h2>
            <button onClick={whoAmI} disabled={loading}>Who am I?</button>
            {whoami && <span className="token">{whoami}</span>}
            <button onClick={dumpSession} disabled={loading}>Dump Session JSON</button>
            {sessionDump && <pre className="token">{sessionDump}</pre>}
          </div>

          {/* Quick tools */}
          <div className="card">
            <h2>Quick Tools</h2>
            <button onClick={pingApi} disabled={loading}>Ping API</button>
            <button onClick={clearLinks} disabled={loading}>Clear Links</button>
          </div>
        </div>
      </div>

      <LoadingOverlay show={loading} />

      {/* ✅ Render modals */}
      <Login
        show={showLogin}
        onClose={() => setShowLogin(false)}
        onShowRegister={() => { setShowLogin(false); setShowRegister(true); }}
      />
      <Register
        show={showRegister}
        onClose={() => setShowRegister(false)}
        onShowLogin={() => { setShowRegister(false); setShowLogin(true); }}
      />
    </div>
  );
}
