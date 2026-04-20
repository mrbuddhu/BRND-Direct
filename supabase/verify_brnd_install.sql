-- ============================================================
-- BRND Direct — read-only install check
-- Run in: Supabase Dashboard → SQL → New query → Run
-- Does NOT modify your database.
-- ============================================================

WITH checks AS (
  SELECT 'table public.profiles' AS item,
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'profiles'
         ) AS ok
  UNION ALL
  SELECT 'table public.buyer_profiles',
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'buyer_profiles'
         )
  UNION ALL
  SELECT 'table public.notifications',
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'notifications'
         )
  UNION ALL
  SELECT 'column profiles.status',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
         )
  UNION ALL
  SELECT 'column profiles.role',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
         )
  UNION ALL
  SELECT 'column buyer_profiles.profile_id',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'buyer_profiles' AND column_name = 'profile_id'
         )
  UNION ALL
  SELECT 'column buyer_profiles.business_name',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'buyer_profiles' AND column_name = 'business_name'
         )
  UNION ALL
  SELECT 'function public.handle_new_user()',
         EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
         )
  UNION ALL
  SELECT 'trigger on_auth_user_created on auth.users',
         EXISTS (
           SELECT 1
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace ns ON ns.oid = c.relnamespace
           WHERE ns.nspname = 'auth'
             AND c.relname = 'users'
             AND NOT t.tgisinternal
             AND t.tgname = 'on_auth_user_created'
         )
  UNION ALL
  SELECT 'enum types user_role + account_status',
         (EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
          AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status'))
)
SELECT item,
       CASE WHEN ok THEN 'OK' ELSE 'MISSING — fix with schema.sql or migrations' END AS status
FROM checks
UNION ALL
SELECT '— SUMMARY —',
       (SELECT COUNT(*) FILTER (WHERE ok)::text || ' / ' || COUNT(*)::text || ' checks passed'
        FROM checks)
UNION ALL
SELECT '— RESULT —',
       CASE WHEN (SELECT bool_and(ok) FROM checks)
            THEN 'All listed pieces exist (buyer signup wiring looks aligned).'
            ELSE 'Some pieces missing — open Postgres logs after signup, then apply schema/migrations.'
       END
ORDER BY item;
