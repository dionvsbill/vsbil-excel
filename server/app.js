// server/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const app = express();

/* -------------------------------------------------------
   Security + middleware
------------------------------------------------------- */
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

// Basic rate limit (tune for your environment)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
});
app.use(limiter);

// Ensure required env vars are present
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) {
    throw new Error(`Missing env: ${k} must be set in .env`);
  }
}

/* -------------------------------------------------------
   Supabase clients
------------------------------------------------------- */
const baseSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const getSupabaseForToken = (token) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

/* -------------------------------------------------------
   Config
------------------------------------------------------- */
export const CONFIG = {
  EXCEL_BUCKET: process.env.EXCEL_BUCKET || 'excel',
  EXCEL_FILE_KEY: process.env.EXCEL_FILE_KEY || 'master.xlsx',
  LOGS_BUCKET: process.env.LOGS_BUCKET || 'logs',
  LOGS_PREFIX: process.env.LOGS_PREFIX || 'excel_access',
};

/* -------------------------------------------------------
   Auth middleware
------------------------------------------------------- */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized: missing bearer token' });

    const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized: invalid token' });

    req.user = data.user;
    req.supabase = getSupabaseForToken(token);
    next();
  } catch (e) {
    console.error('requireAuth error:', e);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('Role check error:', error.message);
      return res.status(403).json({ error: 'Forbidden: role check failed' });
    }
    if (data?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }
    next();
  } catch (e) {
    console.error('requireAdmin error:', e);
    res.status(403).json({ error: 'Forbidden' });
  }
};

/* -------------------------------------------------------
   Health + utility routes
------------------------------------------------------- */
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

/* -------------------------------------------------------
   Excel storage interactions
------------------------------------------------------- */

// Public URL (with cache-busting)
app.get('/excel/public', (req, res) => {
  try {
    const { data } = baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .getPublicUrl(CONFIG.EXCEL_FILE_KEY);

    if (!data?.publicUrl) {
      return res.status(404).json({ error: 'File not found in bucket' });
    }
    res.json({ url: `${data.publicUrl}?t=${Date.now()}` });
  } catch (e) {
    console.error('/excel/public error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Download file directly
app.get('/excel/download', async (req, res) => {
  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);

    if (error) return res.status(404).json({ error: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());

    res.setHeader('Content-Disposition', `attachment; filename="${CONFIG.EXCEL_FILE_KEY}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);

    res.status(200).send(buffer);
  } catch (e) {
    console.error('/excel/download error:', e);
    res.status(500).json({ error: e.message });
  }
});


// List sheet names
app.get('/excel/sheets', async (req, res) => {
  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);

    if (error) return res.status(404).json({ error: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheets = workbook.worksheets.map((ws) => ws.name);
    res.json({ sheets });
  } catch (e) {
    console.error('/excel/sheets error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get single cell value
app.get('/excel/get', async (req, res) => {
  const { sheet, cell } = req.query;
  if (!sheet || !cell) return res.status(400).json({ error: 'sheet and cell are required' });

  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);

    if (error) return res.status(404).json({ error: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const ws = workbook.getWorksheet(sheet);
    if (!ws) return res.status(400).json({ error: 'Sheet not found' });

    const value = ws.getCell(cell).value;
    res.json({ sheet, cell, value });
  } catch (e) {
    console.error('/excel/get error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Preview grid
app.get('/excel/preview', async (req, res) => {
  const { sheet, rows = 20, cols = 10 } = req.query;
  const rowsNum = Number(rows);
  const colsNum = Number(cols);
  if (!sheet) return res.status(400).json({ error: 'sheet is required' });

  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);

    if (error) return res.status(404).json({ error: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const ws = workbook.getWorksheet(sheet);
    if (!ws) return res.status(400).json({ error: 'Sheet not found' });

    const preview = [];
    for (let r = 1; r <= rowsNum; r++) {
      const row = [];
      for (let c = 1; c <= colsNum; c++) {
        row.push(ws.getRow(r).getCell(c).value);
      }
      preview.push(row);
    }
    res.json({ sheet, preview });
  } catch (e) {
    console.error('/excel/preview error:', e);
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------
   Update + audit (ADMIN ONLY)
------------------------------------------------------- */
app.post('/excel/update', requireAuth, requireAdmin, async (req, res) => {
  const { changes } = req.body;
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ error: 'No changes provided' });
  }

  try {
    // Download with base client (read-only)
    const { data, error: downloadError } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);
    if (downloadError) return res.status(404).json({ error: downloadError.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Debug: list sheet names
    console.log('Sheet names:', workbook.worksheets.map(ws => ws.name));

    // Lookup profile (id + email) once
    const { data: profile, error: profileError } = await req.supabase
      .from('profiles')
      .select('id, email')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Profile lookup failed' });
    }

    // Apply changes and write audit rows
    for (const c of changes) {
      const ws = workbook.getWorksheet(c.sheet);
      if (!ws) return res.status(400).json({ error: `Sheet ${c.sheet} not found` });

      const oldValue = ws.getCell(c.cell).value;

      // Normalize next value
      const nextVal =
        typeof c.value === 'object' ? JSON.stringify(c.value)
        : typeof c.value === 'number' ? c.value
        : String(c.value ?? '');

      ws.getCell(c.cell).value = nextVal;

      // Insert into audit
      const { error: auditError } = await req.supabase.from('excel_audit').insert({
        sheet: c.sheet,
        cell: c.cell,
        old_value: typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue ?? ''),
        new_value: nextVal,
        changed_at: new Date().toISOString(),
        user_id: profile.id,
        email: profile.email,
      });

      if (auditError) {
        console.error('Audit insert failed:', auditError.message);
        return res.status(500).json({ error: `Audit insert failed: ${auditError.message}` });
      }
    }

    // Write updated workbook buffer
    const outBuffer = await workbook.xlsx.writeBuffer();

    // Upload with token-bound client
    const { error: uploadError } = await req.supabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .upload(CONFIG.EXCEL_FILE_KEY, outBuffer, { upsert: true });
    if (uploadError) {
      console.error('Storage upload failed:', uploadError.message);
      return res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });
    }

    // Optional: write daily storage log
    try {
      const dayISO = new Date().toISOString().slice(0, 10);
      const logKey = `${CONFIG.LOGS_PREFIX}-${dayISO}.json`;
      const logEntry = {
        ts: new Date().toISOString(),
        actor: req.user.id,
        changes: changes.map(c => ({ sheet: c.sheet, cell: c.cell, new_value: c.value })),
      };
      const { error: logErr } = await req.supabase.storage
        .from(CONFIG.LOGS_BUCKET)
        .upload(logKey, JSON.stringify(logEntry, null, 2), { upsert: true });
      if (logErr) console.error('Storage log failed:', logErr.message);
    } catch (logEx) {
      console.error('Storage log exception:', logEx.message);
    }

    // Verify changes
    const { data: verifyData, error: verifyErr } = await req.supabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);
    if (verifyErr) {
      console.error('Verify download failed:', verifyErr.message);
    } else {
      const verifyBuffer = Buffer.from(await verifyData.arrayBuffer());
      const verifyWb = new ExcelJS.Workbook();
      await verifyWb.xlsx.load(verifyBuffer);
      for (const c of changes) {
        const vws = verifyWb.getWorksheet(c.sheet);
        if (!vws) {
          console.error(`Verify: sheet ${c.sheet} not found`);
          continue;
        }
        const vVal = vws.getCell(c.cell).value;
        console.log(`Verify: ${c.sheet}!${c.cell} now =`, vVal);
      }
    }

    res.json({ changes_applied: changes.length });
  } catch (e) {
    console.error('/excel/update error:', e);
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------
   Metadata / exports
------------------------------------------------------- */

// File metadata
app.get('/excel/meta', async (req, res) => {
  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .list('', { limit: 100 });
    if (error) return res.status(404).json({ error: error.message });

    const file = data.find((f) => f.name === CONFIG.EXCEL_FILE_KEY);
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json({
      name: file.name,
      size: file.size,
      last_modified: file.updated_at,
    });
  } catch (e) {
    console.error('/excel/meta error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Export as CSV
app.get('/excel/export/csv', async (req, res) => {
  const { sheet } = req.query;
  if (!sheet) return res.status(400).json({ error: 'sheet is required' });

  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);
    if (error) return res.status(404).json({ error: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const ws = workbook.getWorksheet(sheet);
    if (!ws) return res.status(400).json({ error: 'Sheet not found' });

    let csv = '';
    ws.eachRow((row) => {
      csv += row.values.slice(1).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${sheet}.csv"`);
    res.send(csv);
  } catch (e) {
    console.error('/excel/export/csv error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Export as PDF (basic text table)
app.get('/excel/export/pdf', async (req, res) => {
  const { sheet } = req.query;
  if (!sheet) return res.status(400).json({ error: 'sheet is required' });

  try {
    const { data, error } = await baseSupabase.storage
      .from(CONFIG.EXCEL_BUCKET)
      .download(CONFIG.EXCEL_FILE_KEY);
    if (error) return res.status(404).json({ error: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const ws = workbook.getWorksheet(sheet);
    if (!ws) return res.status(400).json({ error: 'Sheet not found' });

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sheet}.pdf"`);

    doc.pipe(res);
    ws.eachRow((row) => {
      doc.text(row.values.slice(1).join(' | '));
    });
    doc.end();
  } catch (e) {
    console.error('/excel/export/pdf error:', e);
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------
   Audit retrieval (RLS-aware)
------------------------------------------------------- */
app.get('/excel/audit', requireAuth, async (req, res) => {
  try {
    const { data: profile, error: roleErr } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();
    if (roleErr) return res.status(500).json({ error: 'Role check failed' });

    const isAdmin = profile?.role === 'admin';
    console.log('Audit request by', req.user.id, 'admin?', isAdmin);

    let query = req.supabase
      .from('excel_audit')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);
    if (!isAdmin) query = query.eq('user_id', req.user.id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ logs: data });
  } catch (e) {
    console.error('/excel/audit error:', e);
    res.status(500).json({ error: e.message });
  }
});

export { app, baseSupabase as supabase };
