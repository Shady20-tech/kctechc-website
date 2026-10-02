-- =============================================================================
-- Phase 13 — Declare the two remaining Storage buckets as schema.
--
-- `20260101000037_admin_console.sql` made `product-media`, `property-media`,
-- `content-media` and `avatars` part of the schema, with a header explaining
-- exactly why: the buckets were previously declared only in `supabase/config.toml`,
-- which is local-dev tooling, so a production project started with no bucket and
-- every upload failed. That migration did not cover the two buckets the project
-- and inquiry surfaces use:
--
--   * `project-media` (public) — finished-work photography, written by the Work
--     Done admin upload and read by the public project pages. Without it the
--     upload action fails and `projectMediaPublicUrl()` resolves to a 404 object.
--   * `inquiry-attachments` (private) — a visitor's photographs of their own
--     installation, written by the contact form and read through a signed URL.
--     Without it every attachment upload fails.
--
-- Both were reachable only through `config.toml`, so the gap was invisible in
-- local development and only appeared against a hosted project. This migration
-- converges every environment on the values `config.toml` already declares.
--
-- Values are copied from `supabase/config.toml` deliberately rather than
-- invented: `project-media` is public with a 5 MiB limit (matching
-- `MAX_PROJECT_IMAGE_BYTES` / `ALLOWED_PROJECT_IMAGE_TYPES` in
-- `src/lib/uploads/validation.ts`), and `inquiry-attachments` is private with a
-- 10 MiB limit (matching `MAX_ATTACHMENT_BYTES` / `ALLOWED_ATTACHMENT_TYPES`).
--
-- Object writes stay service-role-only from Server Actions after the application
-- authorizes the caller, so no `storage.objects` policy is added here — the same
-- posture as the buckets created in migration 37. The bucket's own
-- `allowed_mime_types` and `file_size_limit` are the second line of defence.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'project-media',
    'project-media',
    true,
    5242880, -- 5 MiB, matching MAX_PROJECT_IMAGE_BYTES
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'inquiry-attachments',
    'inquiry-attachments',
    false, -- private: a visitor's own photographs, served only via signed URLs
    10485760, -- 10 MiB, matching MAX_ATTACHMENT_BYTES
    array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf'
    ]
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
