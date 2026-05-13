
CREATE POLICY "Telegram users can insert their own relationships"
ON public.vibey_relationships
FOR INSERT
TO authenticated
WITH CHECK (
  telegram_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.telegram_user_id = vibey_relationships.telegram_user_id
  )
);

CREATE POLICY "Telegram users can update their own relationships"
ON public.vibey_relationships
FOR UPDATE
TO authenticated
USING (
  telegram_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.telegram_user_id = vibey_relationships.telegram_user_id
  )
)
WITH CHECK (
  telegram_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.telegram_user_id = vibey_relationships.telegram_user_id
  )
);
