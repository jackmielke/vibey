-- SECURITY (#5): session-files bucket was public with an ALL policy granting
-- anon read/write/DELETE on every object (voice/video recordings). Make it
-- private and drop the public policy. No client code reads it via public URL;
-- writers use the service_role key, which bypasses storage RLS.
UPDATE storage.buckets SET public = false WHERE id = 'session-files';
DROP POLICY IF EXISTS "Allow public access to session files" ON storage.objects;
