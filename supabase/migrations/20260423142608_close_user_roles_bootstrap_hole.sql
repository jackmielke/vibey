-- Close the "first user becomes admin" bootstrap loophole on user_roles.
-- The old policy had three branches; the first let any authenticated user
-- self-grant admin when COUNT(admins) = 0. That's exploitable (an admin row
-- could be temporarily deleted, or race conditions, or a leaked key). Bootstrap
-- should happen via migration (service role), never at runtime.
--
-- New policy: only existing admins can insert admin/non-member rows, and
-- regular users can only self-grant 'member'.

DROP POLICY IF EXISTS "Allow admin role management" ON public.user_roles;

CREATE POLICY "Admins manage roles, users self-member"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- existing admins can insert any role for anyone
    has_role(get_user_id_from_auth(auth.uid()), 'admin'::text)
    -- OR users can self-grant the 'member' role only
    OR (role = 'member'::app_role AND user_id = get_user_id_from_auth(auth.uid()))
  );

COMMENT ON POLICY "Admins manage roles, users self-member" ON public.user_roles IS
  'Replaces the previous policy which allowed any user to self-grant admin when the admins table was empty. Bootstrap now happens via service-role migration only.';
