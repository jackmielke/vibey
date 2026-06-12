-- ===========================================================================
-- SECURITY: stop anonymous/world read of secrets + PII (audit findings).
-- Edge functions use the service_role key (RLS bypass), so locking client
-- roles (anon/authenticated) does not affect server-side flows. Verified no
-- client-side reads of these tables in the app. Admin UI keeps access via
-- has_role(auth.uid(),'admin').
-- ===========================================================================

-- 1) Telegram bot tokens + webhook keys were world-readable through the public
--    USING(true) SELECT on communities / telegram_bots. Revoke the secret
--    COLUMNS from client roles. (Rotate the actual tokens separately — assume
--    the previously-exposed ones are compromised.)
REVOKE SELECT (telegram_bot_token, webhook_api_key) ON public.communities FROM anon, authenticated;
REVOKE SELECT (bot_token) ON public.telegram_bots FROM anon, authenticated;

-- 2) applications — was anon read + anon "confirmation" UPDATE (self-accept).
DROP POLICY IF EXISTS "Anyone can view applications" ON public.applications;
DROP POLICY IF EXISTS "Anyone can update applications for confirmation" ON public.applications;
CREATE POLICY "Admins can view applications" ON public.applications
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admins can update applications" ON public.applications
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text)) WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- 3) orders — was anon read + anon UPDATE (forge "paid"). Keep INSERT so
--    checkout still works; edge functions update via service_role.
DROP POLICY IF EXISTS "Anyone can view orders by email" ON public.orders;
DROP POLICY IF EXISTS "Edge functions can update orders" ON public.orders;
CREATE POLICY "Admins can view orders" ON public.orders
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- 4) sponsors — was anon read of contact PII. Keep public submit.
DROP POLICY IF EXISTS "Anyone can view sponsors" ON public.sponsors;
CREATE POLICY "Admins can view sponsors" ON public.sponsors
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- 5) contact_submissions — was anon read + anon DELETE (wipe leads). Keep submit.
DROP POLICY IF EXISTS "Allow read access to contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Allow delete access to contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions" ON public.contact_submissions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admins can delete contact submissions" ON public.contact_submissions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- 6) telegram_chat_sessions — was anon read/write/delete (ALL USING true).
--    Drop the public ALL; keep the scoped bot-owner SELECT. Edge fns use service_role.
DROP POLICY IF EXISTS "Edge functions can manage chat sessions" ON public.telegram_chat_sessions;

-- 7) user_embeddings — was anon read of all member bio vectors. Semantic search
--    runs server-side (service_role). Keep self insert/update.
DROP POLICY IF EXISTS "Anyone can view user embeddings for search" ON public.user_embeddings;
