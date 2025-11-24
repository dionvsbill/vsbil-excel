import { Router } from 'express';
import { supabase } from '../app.js';

const router = Router();

// Resolve identity and role from JWT
async function getIdentity(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return { user: null, role: 'anonymous', can_edit: false };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { user: null, role: 'anonymous', can_edit: false };

  const md = data.user.user_metadata || {};
  const role = md.role === 'admin' ? 'admin' : 'user';
  const can_edit = role === 'admin' || Boolean(md.can_edit);

  return { user: data.user, role, can_edit };
}

// 🔒 Middleware: require authenticated user
export async function requireAuth(req, res, next) {
  const ident = await getIdentity(req);
  if (!ident.user) return res.status(401).json({ error: 'Unauthorized' });
  req.identity = ident;
  next();
}

// 🔒 Middleware: require admin role
export async function requireAdmin(req, res, next) {
  const ident = await getIdentity(req);
  if (!ident.user) return res.status(401).json({ error: 'Unauthorized' });
  if (ident.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  req.identity = ident;
  next();
}

// 🔒 Middleware: require edit permission (admin or editor)
export async function requireEditor(req, res, next) {
  const ident = await getIdentity(req);
  if (!ident.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!ident.can_edit) return res.status(403).json({ error: 'Forbidden' });
  req.identity = ident;
  next();
}

// Self-check: who am I?
router.get('/me', requireAuth, (req, res) => {
  const ident = req.identity;
  res.json({
    id: ident.user.id,
    email: ident.user.email,
    role: ident.role,
    can_edit: ident.can_edit
  });
});

// Admin can enable their own edit flag via session update (demo only)
router.post('/self-edit', requireAdmin, (req, res) => {
  res.json({
    instruction: 'Call supabase.auth.updateUser({ data: { can_edit: true } }) from frontend session.'
  });
});

// Guidance endpoint
router.get('/guide', (req, res) => {
  res.json({
    note: 'With anon key only, updating other users metadata must be done in Supabase Dashboard or via client session.',
    steps: [
      'Mark first account as admin (user_metadata.role=admin) in Supabase Dashboard.',
      'Default new users will be role=user.',
      'Admin can grant edit by setting user_metadata.can_edit=true for that user in Dashboard.',
      'Alternatively, allow editors to self-claim via a moderated frontend that calls supabase.auth.updateUser.'
    ]
  });
});

export default router;
