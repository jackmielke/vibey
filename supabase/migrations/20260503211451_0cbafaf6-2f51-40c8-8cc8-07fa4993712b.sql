CREATE POLICY "Telegram users can view their own relationships"
ON public.vibey_relationships
FOR SELECT
TO authenticated
USING (
  telegram_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.telegram_user_id = vibey_relationships.telegram_user_id
  )
);