-- =============================================================================
-- Behavioural validation of the Storage bucket declarations.
--
-- The application derives a public URL for project photography and a signed URL
-- for inquiry attachments, but until migration 44 those two buckets existed only
-- in `supabase/config.toml`. A hosted project therefore started without them and
-- every upload failed, which no test caught because the failure only appears
-- against a real Storage API.
--
-- This proves the schema declares the buckets with the intended visibility and
-- limits, and — the part that matters most — that no *private* bucket is public.
-- Getting `inquiry-attachments` wrong would expose a visitor's own photographs
-- of their home to anyone with the URL, so the public/private assertion is the
-- point of this file.
--
-- Limits are asserted against the same constants the application validates with
-- (`src/lib/uploads/validation.ts`): a bucket that accepts more than the app
-- sends is harmless, but a bucket that accepts *less* turns a size check into a
-- confusing upload failure.
-- =============================================================================

do $$
declare
  v_public boolean;
  v_limit bigint;
  v_types text[];
begin
  -- ---------------------------------------------------------------------------
  -- project-media: public, 5 MiB, images only.
  -- ---------------------------------------------------------------------------
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_types
    from storage.buckets
   where id = 'project-media';

  if not found then
    raise exception 'VALIDATION FAIL: project-media bucket is not declared in the schema';
  end if;
  if v_public is not true then
    raise exception 'VALIDATION FAIL: project-media is not public (project pages would 404 their images)';
  end if;
  if v_limit <> 5242880 then
    raise exception 'VALIDATION FAIL: project-media limit is % (expected 5242880, MAX_PROJECT_IMAGE_BYTES)', v_limit;
  end if;
  if v_types is null or not (v_types @> array['image/jpeg', 'image/png', 'image/webp', 'image/avif']) then
    raise exception 'VALIDATION FAIL: project-media does not accept the project image types: %', v_types;
  end if;

  -- ---------------------------------------------------------------------------
  -- inquiry-attachments: PRIVATE, 10 MiB, images and PDF.
  --
  -- The `public = false` assertion is the security-critical one.
  -- ---------------------------------------------------------------------------
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_types
    from storage.buckets
   where id = 'inquiry-attachments';

  if not found then
    raise exception 'VALIDATION FAIL: inquiry-attachments bucket is not declared in the schema';
  end if;
  if v_public is not false then
    raise exception 'VALIDATION FAIL: inquiry-attachments is public (a visitor''s own photographs would be world-readable)';
  end if;
  if v_limit <> 10485760 then
    raise exception 'VALIDATION FAIL: inquiry-attachments limit is % (expected 10485760, MAX_ATTACHMENT_BYTES)', v_limit;
  end if;
  if v_types is null or not (v_types @> array['image/jpeg', 'application/pdf']) then
    raise exception 'VALIDATION FAIL: inquiry-attachments does not accept the attachment types: %', v_types;
  end if;

  -- ---------------------------------------------------------------------------
  -- Every bucket that holds visitor or customer data must stay private. The
  -- public set is an explicit allow-list, so a new bucket added as public by
  -- accident fails here rather than silently exposing its objects.
  -- ---------------------------------------------------------------------------
  if exists (
    select 1 from storage.buckets
     where public
       and id not in ('product-media', 'property-media', 'content-media', 'avatars', 'project-media')
  ) then
    raise exception 'VALIDATION FAIL: an unexpected bucket is public: %',
      (select string_agg(id, ', ') from storage.buckets
        where public and id not in ('product-media', 'property-media', 'content-media', 'avatars', 'project-media'));
  end if;

  raise notice 'PASS  project and inquiry buckets are declared with the intended visibility and limits';
end
$$;

select 'ALL STORAGE BUCKET VALIDATIONS PASSED' as result;
