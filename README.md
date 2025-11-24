# Excel Access Portal (Supabase + Node.js)

A production-grade, backend-first setup that serves an Excel file with:
- Supabase Auth (first account = admin via metadata)
- Public view endpoint for anonymous users
- Read-only download for authenticated users
- Admin/editor write via ExcelJS
- NDJSON audit logs in Supabase Storage
- Single Supabase client to avoid duplication errors
- Smooth toasts and loading overlay in the frontend

## Prerequisites
- Supabase project with:
  - Auth enabled (Email magic link recommended)
  - Storage buckets:
    - `excel` (store `master.xlsx`)
    - `logs` (for NDJSON audit files)
- Configure bucket policies:
  - `excel`: allow read via signed URLs; you can set it public or private (recommended: private + use signed URLs)
  - `logs`: allow uploads for authenticated users (anon-key server requests are treated as "no user"; if blocked, make logs bucket writable or use a service key; otherwise, handle logging client-side)

## Setup
1. Backend
   - cd project-root/server
   - npm install
   - Fill `.env` with SUPABASE_URL and SUPABASE_ANON_KEY and bucket configs
   - npm run start

2. Frontend
   - cd project-root/frontend
   - npm install
   - Update SUPABASE_URL and SUPABASE_ANON_KEY in `src/main.js`
   - npm run dev
   - Open http://localhost:3000

## Roles
- First admin: Set metadata in Supabase Dashboard:
  - user_metadata.role = "admin"
- Default users: role = "user"
- Grant editor rights: set user_metadata.can_edit = true

## Endpoints
- GET /excel/public    → signed URL for anonymous view
- GET /excel/download  → signed URL for authenticated download (+ audit)
- POST /excel/update   → apply cell changes (admin/editor only)
- GET /roles/me        → identity and role
- GET /roles/guide     → guidance for metadata updates

## Notes
- With anon key only, you cannot modify other users’ metadata server-side. Use Supabase Dashboard or let signed-in users self-update via `supabase.auth.updateUser({ data: { can_edit: true } })` with admin approval flow.
- If your `logs` bucket disallows server writes with anon key, switch to service role on the backend or log client-side per event.

## Security
- All write operations are gated by metadata role checks.
- Frontend never sees keys other than anon.
- Signed URLs expire quickly (60s).
- Single Supabase client per backend process.
