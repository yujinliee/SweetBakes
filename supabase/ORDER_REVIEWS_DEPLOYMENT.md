Order Reviews implementation and deployment
===========================================

Nothing was applied or deployed by this implementation.

Migration: `migrations/202609090001_order_reviews.sql`.
Creates `public.order_reviews`, UUID primary key, order/customer foreign keys with
cascading deletion, rating 1–5 CHECK, UNIQUE(order_id), customer and descending date
indexes. RLS grants customer-own and canonical `public.is_admin()` SELECT only.
No browser INSERT, UPDATE or DELETE grants. The authenticated-only security-definer
RPC `submit_order_review(uuid, integer, text)` fixes search_path to public and
checks customer profile, auth.uid(), ownership, canonical `completed`, `paid`, and
rating. It locks the order and rejects duplicates, backed by the unique constraint.
Whitespace-only comments become NULL. No service key is used by the frontend.

Customer changes: `src/services/orderReviewService.js`,
`src/myorders/OrderReviewModal.jsx`, `MyOrdersPage.jsx`, `MyOrdersPage.css`,
`orderHistory.js`, `orderHistory.test.js`.
One batched review read (500 rows per page when needed) is merged by order_id into
the existing orders dataset. No per-order/count queries. Submission updates that
dataset immediately, removes To Review eligibility, and retains All/Reviewed.
To Review requires completed + paid + authenticated ownership data + no review.
No new Realtime subscription. Existing order refreshes also reload review state.

Admin changes: `src/admin/pages/Reviews/Reviews.jsx`, `Reviews.css`,
`src/admin/services/reviewService.js`, `AdminRoutes.jsx`,
`components/AdminSidebar/AdminSidebar.jsx`, `components/AdminTopbar/AdminTopbar.jsx`,
and `pages/Orders/Orders.jsx` (deep-link selection only).
Reviews navigation uses the existing admin guard. Batched joined reads resolve
order/customer contact and product names; search and rating filtering are local.
View Order navigates to `/admin/orders?order=<uuid>` and opens existing Manage Order.

Validation
----------

13 Node tests passed, covering tab/count transitions, reviewed exclusion, All
retention, guest/unpaid exclusion and custom-order eligibility. Production build
passed; targeted ESLint has no errors and one pre-existing hook dependency warning.

A: client review/count state tested; real RPC insertion awaits staging execution.
B: blank-comment NULL assertion supplied in `tests/order_reviews.sql`; not run.
C: invalid 0/6/NULL rating assertions supplied; not run.
D: incomplete/cancelled/unpaid rejection assertions supplied; not run.
E: wrong-customer rejection and RLS isolation assertions supplied; not run.
F: duplicate rejection assertion supplied; not run. Unique key and row lock also
protect concurrent submissions; verify two simultaneous sessions in staging.
G: guest-order/anonymous rejection assertions supplied; not run.
H: admin read/join assertion supplied; not run. Verify rendered columns in browser.
I: View Order deep-link implemented and build-checked; browser interaction pending.

Apply commands (PowerShell, repository root)
------------------------------------------

There are two existing files with version `202609080003`. Compare remote migration
history and resolve that collision before using db push. Do not rename an already
applied version or repair history without confirming what was actually applied.

After reconciliation, with Supabase CLI installed and the project linked:

```powershell
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

Inspect the dry-run list: db push applies ALL pending migrations, not just reviews.
Official command reference: https://supabase.com/docs/reference/cli/supabase-db-push

To apply ONLY this file instead, with psql installed and SWEET_BAKES_DB_URL set to
the intended database connection string:

```powershell
psql "$env:SWEET_BAKES_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202609090001_order_reviews.sql
```

Only after that command succeeds, record the application in the linked project's
migration history (the linked project must be the same database):

```powershell
supabase migration repair 202609090001 --status applied --linked
```

For staging tests, set SWEET_BAKES_DB_URL to a staging/disposable database with the
migration applied, two orders, two customer profiles and one admin profile:

```powershell
psql "$env:SWEET_BAKES_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/order_reviews.sql
```

Tests run real RPC/RLS checks and roll back fixture changes. They must be run as a
database administrator, not an application customer. Do not use production fixtures.

After backend validation, commit/push frontend changes through the existing GitHub
and Vercel deployment process. Frontend deployment IS required; no Xendit or Edge
Function deployment is needed. Verify A–I in staging, then production: submission,
reload persistence, counts, double-submit handling, account isolation, admin table
and View Order. Browser and live-database verification were not performed here.
