# Plan 002: Fix invoice/document file access — private buckets served via signed URLs, not broken public URLs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0bc851b..HEAD -- lib/services/file-service.ts lib/utils/storage-initializer.ts hooks/use-movimiento-archivos.ts components/transactions/file-list.tsx components/transactions/transaction-files.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but plan 003, bulk export, depends on this one)
- **Category**: bug
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

Invoice/document files are uploaded to Supabase Storage buckets created with
`public: false` (`lib/utils/storage-initializer.ts`), but the app then calls
`supabase.storage.from(bucket).getPublicUrl(path)` to build the URL it
persists in `movimiento_archivo.url_publica`
(`lib/services/file-service.ts:112-115`) and opens directly in a new tab
(`components/transactions/file-list.tsx:94,103`). `getPublicUrl` only
produces a working URL when the bucket (or an explicit storage.objects
policy) grants public/anon read — there is no such policy anywhere in
`scripts/*.sql` (confirmed via `grep -rn "storage.objects" scripts/*.sql` →
no matches). **This means every "view/download factura" click likely
returns a 403/400 from Supabase Storage** — the core promise of the
invoice-attachment feature (upload a receipt, look at it later) is broken
by construction, unless someone manually flipped a bucket to public in the
Supabase dashboard outside of tracked code (which would itself be a
security exposure: financial documents readable by anyone with the URL, no
auth). Either way, the fix is the same: serve files through short-lived
signed URLs generated server-side per request, never through a
persisted "public" URL.

## Current state

- `lib/utils/storage-initializer.ts:19-23` and `:51-55` — both `facturas`
  and `documentos` buckets created with `public: false`.
- `lib/services/file-service.ts:108-121` (`uploadFile` method):
  ```ts
  const { data: urlData } = supabase.storage
    .from(bucketType)
    .getPublicUrl(data.path)

  return {
    url: urlData.publicUrl,
    path: data.path,
    bucket: bucketType
  }
  ```
- `lib/services/file-service.ts:143-161` (`listFiles` method) — also
  broken/dead: it calls `supabase.storage.from(bucket).list(movimientoId, ...)`,
  but files are uploaded under a
  `${delegacionCodigo}/${year}/${month}/${movimientoId}/${filename}` prefix
  (see `uploadFile`, lines ~95-99), so listing by `movimientoId` alone as a
  top-level folder never matches anything. This method is currently unused
  in practice (`hooks/use-movimiento-archivos.ts` reads the
  `movimiento_archivo` DB table directly instead) — delete it as part of
  this plan rather than leave a trap for a future feature (e.g. plan 003's
  bulk export) to accidentally reach for.
- `hooks/use-movimiento-archivos.ts:108` — persists `url_publica: uploadResult.url`
  into the `movimiento_archivo` row at upload time.
- `components/transactions/file-list.tsx:90-105` — the "view"/"download"
  actions:
  ```ts
  const handleView = (archivo: MovimientoArchivo) => {
    window.open(archivo.url_publica, '_blank')
  }
  const handleDownload = (archivo: MovimientoArchivo) => {
    ...
    window.open(archivo.url_publica, '_blank')
  }
  ```
  (Exact line numbers/content may differ slightly — read the file to find
  the two `window.open(archivo.url_publica` call sites before editing.)
- `lib/types/database.ts:362-377` — `movimiento_archivo` row shape,
  including `url_publica: string` and `path_storage: string`. `path_storage`
  is the field you need going forward (it's the real Storage object path);
  `url_publica` becomes redundant after this fix but do NOT drop the column
  (see Scope — DB migrations are out of scope for this plan).
- Existing server-route pattern to mirror: `app/api/admin/users/[id]/route.ts`
  for how this repo writes an authenticated API route handler (import style,
  error response shape).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Install   | `pnpm install`       | exit 0               |
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual check) | `pnpm dev` | starts on :3000 |

## Scope

**In scope**:
- `lib/services/file-service.ts` — remove `getPublicUrl` usage from
  `uploadFile`; delete the broken `listFiles` method.
- New file: `app/api/files/signed-url/route.ts` — authenticated route that
  takes a `path` + `bucket` and returns a short-lived signed URL.
- `components/transactions/file-list.tsx` — `handleView`/`handleDownload`
  (or equivalently-named functions — read the file first) to fetch a signed
  URL from the new route instead of using `archivo.url_publica` directly.
- `hooks/use-movimiento-archivos.ts` — keep persisting `url_publica` for
  backward compatibility with existing rows (do not remove the field/insert
  — see STOP conditions on schema changes), but the app must stop *reading*
  it as an authoritative access URL.

**Out of scope**:
- Any Supabase Storage bucket configuration changes via SQL/dashboard — if
  you determine buckets were manually made public outside of tracked code,
  STOP and report; do not silently "fix" bucket visibility yourself, since
  that's an infra change with its own blast radius (also review by a human
  who has dashboard access).
- Database schema migrations (dropping/renaming `url_publica`) — out of
  scope; a follow-up migration can clean this up later once the new signed-
  URL path is confirmed working in production.
- `components/ui/file-attachment-dropzone.tsx` — upload validation logic,
  untouched by this plan.
- Bulk export (plan 003) — depends on this plan's signed-URL route but is
  its own separate piece of work.

## Git workflow

- Branch: `advisor/002-fix-invoice-file-access`
- One commit per step, conventional commit style (e.g.
  `fix(facturas): serve invoice files via signed URLs instead of broken public URLs`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add an authenticated signed-URL API route

Create `app/api/files/signed-url/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { path, bucket } = await request.json()

  if (!path || !bucket || !["facturas", "documentos"].includes(bucket)) {
    return NextResponse.json({ error: "path y bucket son requeridos" }, { status: 400 })
  }

  // Ownership check: confirm the requesting user has access to the
  // delegación this file belongs to, via the movimiento_archivo row, before
  // issuing a signed URL. Read hooks/use-movimiento-archivos.ts and
  // lib/services/database.ts to find the established pattern for checking
  // delegation membership server-side (this repo relies on RLS for reads —
  // confirm the `movimiento_archivo` table has an RLS policy scoping by
  // delegation membership; if you cannot confirm this from scripts/*.sql,
  // add an explicit ownership query here using `path_storage` to look up
  // the owning movimiento_archivo row and its delegación before signing).

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300) // 5 minutes

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Error generando URL" }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
```

Use the server client (`createClient()`, RLS-respecting), not
`createAdminClient()` — signed URLs must only be issued for objects the
requesting user's session can actually see, and using the anon/session
client naturally enforces that via the bucket's RLS/policies if any exist.
**If `createClient()` from `lib/supabase/server.ts` cannot call
`.storage.createSignedUrl` due to missing storage RLS policies (all
requests fail with a permission error even for the file's own owner), STOP
and report** — this means storage.objects RLS policies need to be added by
a human with dashboard/migration access first; do not switch to
`createAdminClient()` to work around it, as that would remove the access
check entirely and reintroduce the original risk in a different form.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Remove `getPublicUrl` from the upload path; delete `listFiles`

In `lib/services/file-service.ts`:
- In `uploadFile`, remove the `getPublicUrl` call and the `url` field from
  the returned `FileUploadResult` (or set it to an empty string / keep the
  interface shape but note it's no longer meaningful — read how
  `hooks/use-movimiento-archivos.ts:108` uses `uploadResult.url` and update
  that call site consistently in the same step; you may keep persisting an
  empty string to `url_publica` for schema compatibility rather than
  removing the column write — see Out of scope).
- Delete the `listFiles` static method entirely (confirmed dead/broken,
  see Current state).

**Verify**: `npx tsc --noEmit` → exit 0; `grep -rn "FileService.listFiles" .` (excluding `node_modules`/`.next`) returns no matches.

### Step 3: Fetch signed URLs on view/download in `file-list.tsx`

Replace the direct `window.open(archivo.url_publica, '_blank')` calls with
a fetch to the new route, then open the returned signed URL:

```ts
const handleView = async (archivo: MovimientoArchivo) => {
  const res = await fetch("/api/files/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: archivo.path_storage, bucket: archivo.bucket }),
  })
  if (!res.ok) {
    // surface an error via the existing toast/alert pattern used elsewhere
    // in this file — check for `toast` import (sonner) or the error state
    // wired from use-movimiento-archivos.ts, and use whichever the file
    // already has. Do not silently fail.
    return
  }
  const { url } = await res.json()
  window.open(url, '_blank')
}
```

Apply the same pattern to the download handler. Match the file's existing
error-handling convention (look for how other async handlers in this file
report failures — likely `console.error` today per the UX audit finding
UX-03; if you're implementing this after plan 016 lands, use its toast
pattern instead).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Manual end-to-end check

1. `pnpm dev`, log in, open a transaction with at least one attached file
   (or upload a new one via the UI).
2. Click "view"/"download" on the file.
3. Confirm the file actually opens/downloads (not a 403/400 error page from
   Supabase Storage).
4. Open browser devtools Network tab, confirm the request to
   `/api/files/signed-url` returns 200 with a `url` field pointing at a
   Supabase Storage URL containing a `token=` query parameter (signature).

## Test plan

No test runner is configured in this repo. Step 4's manual check is the
verification. Record in your summary: the exact URL host pattern the signed
URL uses, and confirm it is NOT the same as the old `getPublicUrl` shape
(no `token=` parameter).

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -rn "getPublicUrl" lib/services/file-service.ts` returns no matches
- [ ] `grep -rn "FileService.listFiles" .` (excluding node_modules/.next) returns no matches
- [ ] Manual check in Step 4 confirms a file opens successfully via the new signed-URL path
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The signed-URL route fails even for the file's rightful owner, suggesting
  missing `storage.objects` RLS policies — report this as a database-layer
  gap requiring a human with Supabase dashboard access, don't work around
  it with the admin client.
- You find evidence a bucket was manually set to public in the live
  Supabase project (e.g. an existing file's old `url_publica` still loads
  successfully in a fresh incognito window with no auth) — this is a
  security finding, not just a bug; STOP, report it explicitly, and do not
  change bucket visibility yourself.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Once this lands, plan 003 (bulk export of invoices) should generate
  signed URLs (or stream via the admin client server-side, which is
  appropriate there since it's already an authenticated, delegation-scoped
  export endpoint) rather than reusing `url_publica`.
- A follow-up migration should eventually drop `movimiento_archivo.url_publica`
  once no client code reads it and any external consumers (if the app grows
  an actual public API later) are updated — track this as a new finding if
  `plans/` is revisited.
- If `require-admin.ts` was added by plan 001 before this plan runs, the
  auth pattern there (`requireAdmin`/`createClient` usage) should match
  exactly what this plan writes — reuse the session-check half if it's
  already factored into a shared helper.
