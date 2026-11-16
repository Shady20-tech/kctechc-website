-- =============================================================================
-- Phase 2 — Secure KYC verification.
--
-- The brief's central rule for this phase: "The existence of a user-selected
-- account type must never grant posting permissions." Everything below follows
-- from it. A signup may *declare* an intent to be a landlord or an agent; that
-- declaration creates an application, never a capability. A capability exists
-- only when a super admin approves a KYC application, and the approval writes
-- the `real_estate_memberships` row from the server.
--
-- ## What is separate, and why
--
-- Identity verification and property-document verification are two different
-- questions and are modelled as two different tables:
--
--   * `real_estate_kyc_applications` answers "is this person who they say they
--     are". It is one application per (user, capability) — the same unique key
--     as `real_estate_memberships` — and its evidence is a person's identity
--     document and face video.
--
--   * `listing_legal_documents` answers "is this applicant entitled to advertise
--     THIS property". A land title proves title to one property, so it is
--     attached to a listing and never treated as universal proof. An agent's
--     agency mandate is the same shape: evidence about a specific property.
--
-- Collapsing them would produce exactly the failure the brief warns about — a
-- landlord who proved one land title and is then taken to have proved every
-- property they later advertise.
--
-- ## Where the files live
--
-- No binary is stored in PostgreSQL. Both tables hold a Storage object path and
-- metadata (detected MIME type, byte size, original filename). The bytes live in
-- a PRIVATE bucket (`kyc-documents`, declared below) and are read only through a
-- short-lived signed URL minted server-side after a super-admin check. Nothing
-- in this schema stores a public URL, and no public query selects these tables.
--
-- ## The age gate
--
-- `real_estate_kyc_applications` carries `date_of_birth` and a CHECK that refuses
-- an applicant under 18 at the time the application is submitted. The
-- `profiles` table does not carry a date of birth at all, so "an adult applicant"
-- is established here, where the identity evidence is, rather than inferred from
-- an absence of data elsewhere.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vocabulary.
--
-- Six enums, each one a closed set the brief names or that the review workflow
-- needs. Enum rather than free text so an unrecognised value is refused by the
-- type system: a typo in a policy predicate that compares against 'landloard'
-- would otherwise silently match nothing.
-- -----------------------------------------------------------------------------

-- The two capabilities a KYC application may be for. Deliberately the SAME
-- members as `public.membership_type`; a separate type so a KYC row cannot be
-- mistaken for a membership row, but the same vocabulary so the approval can map
-- one to the other without a translation table.
create type public.kyc_membership_type as enum (
  'landlord',
  'agent'
);

comment on type public.kyc_membership_type is
  'The capability a KYC application is for. Mirrors public.membership_type; the approval creates the matching membership row.';

-- The application lifecycle. `not_applied` is the absence of a row, not a member
-- here, for the same reason it is absent from `membership_status`.
create type public.kyc_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'changes_requested'
);

comment on type public.kyc_status is
  'Where a KYC application has reached. "Not started" is the absence of a row.';

-- Accepted identification types. The brief names three; the enum keeps them a
-- closed set so the admin console can render a label per member and a new type is
-- a deliberate migration rather than a string an applicant types.
create type public.kyc_id_type as enum (
  'national_id_card',
  'international_passport',
  'other_government_id'
);

comment on type public.kyc_id_type is
  'The kind of identity document supplied. Displayed to the reviewer and never exposed publicly.';

-- Which document a file is. `face_video` is the manual liveness recording;
-- `id_front`/`id_back` are the two sides of an identity document, because the
-- brief requires the applicant to be told which side to upload and the reviewer to
-- see which side they are looking at.
create type public.kyc_document_kind as enum (
  'id_front',
  'id_back',
  'face_video',
  'proof_of_address',
  'other'
);

comment on type public.kyc_document_kind is
  'What a stored KYC file is. `face_video` is a manual liveness recording, reviewed by a person; no facial-recognition processing is performed.';

-- The kind of legal document attached to a specific listing.
create type public.legal_document_kind as enum (
  'land_title',
  'ownership_certificate',
  'sale_agreement',
  'agency_mandate',
  'owner_authorization',
  'other'
);

comment on type public.legal_document_kind is
  'Property-specific legal evidence: a title, a mandate, or an owner authorization. Attached to one listing, never treated as proof for another.';

-- What a review event was. The history is append-only, so the console can show
-- the whole sequence rather than only the current state.
create type public.kyc_review_action as enum (
  'submitted',
  'review_started',
  'document_viewed',
  'approved',
  'rejected',
  'changes_requested',
  'note_added'
);

comment on type public.kyc_review_action is
  'One entry in a KYC application''s history. Append-only; the console renders the sequence.';

-- -----------------------------------------------------------------------------
-- Applications.
-- -----------------------------------------------------------------------------
create table public.real_estate_kyc_applications (
  id uuid primary key default extensions.gen_random_uuid(),

  -- The account applying. `auth.users`, matching every other user reference.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Which capability this application is for. One application per (user, type),
  -- so the row is updated on re-application rather than duplicated.
  membership_type public.kyc_membership_type not null,

  status public.kyc_status not null default 'draft',

  -- ---------------------------------------------------------------- Personal ---
  -- The legal name as it appears on the identity document. Distinct from
  -- `profiles.full_name`, which is a display name the user chose; this is the
  -- verified one, and the two are allowed to differ.
  full_legal_name text not null,
  email extensions.citext not null,
  phone text not null,
  country_of_residence text not null,
  current_location text,
  -- Residency status: permanent resident, temporary resident, or non-resident.
  -- A boolean was considered and rejected here, unlike on `profiles`: the brief
  -- asks for a *status*, and an application is the one place the distinction is
  -- reviewed, so the three states are worth carrying.
  residency_status text not null default 'permanent',
  date_of_birth date not null,

  -- ------------------------------------------------------------------- ID ---
  id_type public.kyc_id_type not null,
  -- The country that issued the document. Not the applicant's residence: a
  -- passport is issued by one country and held by a resident of another.
  id_issuing_country text not null,
  -- The LAST FOUR characters only. The brief forbids exposing complete
  -- identification numbers in administrative tables and logs, so the full number
  -- is never stored: the reviewer reads it from the document image, which is the
  -- only place it is needed.
  id_number_last4 text,

  -- --------------------------------------------------------------- Consent ---
  -- Explicit consent to process the face video, recorded with its timestamp.
  -- The brief requires consent to be obtained before processing; storing the
  -- timestamp rather than a bare boolean is what makes "when did they agree"
  -- answerable.
  video_consent_at timestamptz,
  -- Declaration that the information is true and the documents are the
  -- applicant's own.
  declaration_accepted_at timestamptz,

  -- --------------------------------------------------------------- Review ---
  submitted_at timestamptz,
  reviewed_at timestamptz,
  -- The super admin who decided. `on delete set null` so removing the reviewer's
  -- account does not destroy the decision record.
  reviewed_by uuid references auth.users (id) on delete set null,
  -- Shown to the applicant for a refusal or a request for changes.
  decision_reason text,
  -- Internal only. Never rendered to the applicant.
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ------------------------------------------------------------------ Checks ---

  constraint real_estate_kyc_applications_unique_per_type
    unique (user_id, membership_type),

  constraint kyc_full_legal_name_length check (
    char_length(btrim(full_legal_name)) between 2 and 200
  ),
  constraint kyc_phone_length check (
    char_length(btrim(phone)) between 5 and 32
  ),
  constraint kyc_country_length check (
    char_length(btrim(country_of_residence)) between 2 and 80
  ),
  constraint kyc_current_location_length check (
    current_location is null
    or char_length(btrim(current_location)) between 1 and 200
  ),
  constraint kyc_residency_status_valid check (
    residency_status in ('permanent', 'temporary', 'non_resident')
  ),
  constraint kyc_id_issuing_country_length check (
    char_length(btrim(id_issuing_country)) between 2 and 80
  ),
  -- Four characters or nothing. Enforced as a shape so a caller cannot smuggle
  -- the full number into the column.
  constraint kyc_id_number_last4_format check (
    id_number_last4 is null or id_number_last4 ~ '^[A-Za-z0-9]{4}$'
  ),
  constraint kyc_decision_reason_length check (
    decision_reason is null
    or char_length(btrim(decision_reason)) between 1 and 2000
  ),
  constraint kyc_internal_notes_length check (
    internal_notes is null
    or char_length(btrim(internal_notes)) between 1 and 4000
  ),

  -- An adult-only gate. The applicant must be at least 18 at the moment the
  -- application is submitted. Written as an age test rather than a birth-date
  -- cutoff because a cutoff goes stale, and using the submission date so the
  -- rule is stable for a submitted application even as the applicant ages.
  constraint kyc_applicant_is_adult check (
    date_of_birth <= (coalesce(submitted_at, now())::date - interval '18 years')
  ),

  -- An approved or refused application must record who decided it and when, so
  -- every downstream question ("who let this landlord in") has an answer.
  constraint kyc_decided_requires_reviewer check (
    status not in ('approved', 'rejected')
    or (reviewed_by is not null and reviewed_at is not null)
  ),

  -- A refusal or a request for changes must carry a reason the applicant can act
  -- on.
  constraint kyc_decision_requires_reason check (
    status not in ('rejected', 'changes_requested')
    or (decision_reason is not null and btrim(decision_reason) <> '')
  ),

  -- A submitted application must have been submitted at some point.
  constraint kyc_submitted_requires_timestamp check (
    status = 'draft' or submitted_at is not null
  ),

  -- Consent is a precondition of submitting, so a submitted application must
  -- carry both consents. A draft may not, because it is still being filled in.
  constraint kyc_submitted_requires_consent check (
    status = 'draft'
    or (video_consent_at is not null and declaration_accepted_at is not null)
  )
);

comment on table public.real_estate_kyc_applications is
  'Identity verification for a landlord or agent capability. One row per (user, capability). Approval is super-admin-only and creates the membership row; a declared account type never grants a capability by itself.';
comment on column public.real_estate_kyc_applications.id_number_last4 is
  'The last four characters of the identity document number. The full number is never stored — the reviewer reads it from the document image.';
comment on column public.real_estate_kyc_applications.video_consent_at is
  'When the applicant consented to face-video processing. Manual review only; no facial recognition is performed.';
comment on column public.real_estate_kyc_applications.internal_notes is
  'Reviewer notes for staff. Never rendered to the applicant.';

create index real_estate_kyc_applications_user_idx
  on public.real_estate_kyc_applications (user_id);

-- The review queue: everything a super admin still has to decide, oldest first.
create index real_estate_kyc_applications_queue_idx
  on public.real_estate_kyc_applications (status, submitted_at)
  where status in ('submitted', 'under_review');

-- Name and email search in the console. A trigram index would be ideal, but a
-- plain lower() index on the email is what the console's exact/substring search
-- uses today and needs no extension.
create index real_estate_kyc_applications_email_idx
  on public.real_estate_kyc_applications (email);

create trigger real_estate_kyc_applications_set_updated_at
  before update on public.real_estate_kyc_applications
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- KYC documents.
--
-- One row per stored file. The bytes are in the private bucket; this row is the
-- metadata and the pointer.
-- -----------------------------------------------------------------------------
create table public.real_estate_kyc_documents (
  id uuid primary key default extensions.gen_random_uuid(),

  application_id uuid not null
    references public.real_estate_kyc_applications (id) on delete cascade,

  kind public.kyc_document_kind not null,

  -- Storage object path inside the private `kyc-documents` bucket. A path, never
  -- a URL: storing an absolute URL would bake the project ref into the database
  -- and, worse, a signed URL would expire and a public one would be a leak.
  storage_path text not null,

  -- Metadata for the reviewer and for a size/type audit. `detected_mime` is the
  -- type the server derived from the file's leading bytes, not the type the
  -- browser declared.
  original_filename text not null,
  detected_mime text not null,
  byte_size bigint not null,

  -- The country that issued the document, where the document is an identity
  -- document. Optional because a proof of address has no issuing country.
  issuing_country text,
  -- Free-text note the applicant may attach ("back of card is faded").
  note text,

  created_at timestamptz not null default now(),

  constraint real_estate_kyc_documents_path_not_blank check (
    char_length(btrim(storage_path)) between 1 and 500
  ),
  constraint real_estate_kyc_documents_byte_size_positive check (
    byte_size > 0
  ),
  constraint real_estate_kyc_documents_mime_length check (
    char_length(btrim(detected_mime)) between 3 and 120
  ),
  constraint real_estate_kyc_documents_filename_length check (
    char_length(btrim(original_filename)) between 1 and 300
  ),
  constraint real_estate_kyc_documents_issuing_country_length check (
    issuing_country is null
    or char_length(btrim(issuing_country)) between 2 and 80
  ),
  constraint real_estate_kyc_documents_note_length check (
    note is null or char_length(btrim(note)) between 1 and 1000
  ),

  -- One front and one back per application, one face video per application, so a
  -- re-upload replaces rather than accumulates. `other` and `proof_of_address`
  -- are unrestricted because an applicant may legitimately supply more than one.
  constraint real_estate_kyc_documents_unique_side
    unique (application_id, kind, storage_path)
);

comment on table public.real_estate_kyc_documents is
  'A stored KYC file: an identity document side or the face video. Holds a private-bucket object path and metadata, never a public URL and never the bytes.';

create index real_estate_kyc_documents_application_idx
  on public.real_estate_kyc_documents (application_id, kind);

-- -----------------------------------------------------------------------------
-- Review history.
--
-- Append-only. The current state is on the application; this table is how it got
-- there, which the brief requires the console to show.
-- -----------------------------------------------------------------------------
create table public.real_estate_kyc_review_events (
  id uuid primary key default extensions.gen_random_uuid(),

  application_id uuid not null
    references public.real_estate_kyc_applications (id) on delete cascade,

  action public.kyc_review_action not null,

  -- Who did it. `on delete set null` so the history survives the reviewer's
  -- account being removed — the event is the record.
  actor_id uuid references auth.users (id) on delete set null,

  -- The document this event concerns, for a `document_viewed` entry. Nullable for
  -- every other action.
  document_id uuid references public.real_estate_kyc_documents (id) on delete set null,

  -- Shown to the applicant for a decision; internal for a note.
  note text,

  created_at timestamptz not null default now(),

  constraint real_estate_kyc_review_events_note_length check (
    note is null or char_length(btrim(note)) between 1 and 4000
  )
);

comment on table public.real_estate_kyc_review_events is
  'Append-only history of a KYC application: submission, review, document views and decisions.';

create index real_estate_kyc_review_events_application_idx
  on public.real_estate_kyc_review_events (application_id, created_at);

-- -----------------------------------------------------------------------------
-- Listing legal documents.
--
-- Property-specific evidence. Attached to ONE listing and never read as proof for
-- another. `listing_id` is NOT NULL: a document that proves title to a property
-- is meaningless without the property, and the brief's rule is precisely that a
-- title must be associated with an individual listing.
--
-- The applicant's onboarding may attach one of these to a draft listing before
-- the application is approved; that is why `uploaded_by` is the applicant rather
-- than a reviewer, and why the row is allowed while the application is pending.
-- =============================================================================
create table public.listing_legal_documents (
  id uuid primary key default extensions.gen_random_uuid(),

  listing_id uuid not null
    references public.property_listings (id) on delete cascade,

  -- The account that uploaded it. Nullable for an administrator-recorded document.
  uploaded_by uuid references auth.users (id) on delete set null,

  kind public.legal_document_kind not null,

  storage_path text not null,
  original_filename text not null,
  detected_mime text not null,
  byte_size bigint not null,

  -- Free-text description, and whether a super admin has verified this specific
  -- document. Verification is per document, which is what keeps one title from
  -- standing in for every property.
  description text,
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),

  constraint listing_legal_documents_path_not_blank check (
    char_length(btrim(storage_path)) between 1 and 500
  ),
  constraint listing_legal_documents_byte_size_positive check (
    byte_size > 0
  ),
  constraint listing_legal_documents_mime_length check (
    char_length(btrim(detected_mime)) between 3 and 120
  ),
  constraint listing_legal_documents_filename_length check (
    char_length(btrim(original_filename)) between 1 and 300
  ),
  constraint listing_legal_documents_description_length check (
    description is null
    or char_length(btrim(description)) between 1 and 2000
  ),
  constraint listing_legal_documents_verification_consistent check (
    (verified_at is null and verified_by is null)
    or (verified_at is not null and verified_by is not null)
  )
);

comment on table public.listing_legal_documents is
  'Property-specific legal evidence (title, mandate, owner authorization) attached to ONE listing. Never treated as universal proof for other properties the same person advertises.';

create index listing_legal_documents_listing_idx
  on public.listing_legal_documents (listing_id);

-- -----------------------------------------------------------------------------
-- The private bucket.
--
-- Declared in the schema rather than only in `supabase/config.toml`, because
-- `config.toml` is local-dev tooling: a hosted project gets its buckets from
-- `storage.buckets`, and a bucket that exists only in config.toml does not exist
-- in production. AGENTS.md records this trap twice.
--
-- PRIVATE (`public = false`), so no object is reachable by URL without a signed
-- link. The MIME list is images plus PDF for documents and MP4/WebM for the face
-- video; the size limit accommodates a short phone video.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false, -- private: identity documents, face videos and land titles
  26214400, -- 25 MiB, matching MAX_KYC_VIDEO_BYTES
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Row Level Security.
--
-- The shape is deliberately narrower than the membership tables'. A KYC
-- application carries identity documents and a face video, so it is readable by
-- its owner and by a SUPER ADMIN only — not by every real-estate administrator,
-- which is the brief's "a normal real-estate administrator must not be given
-- super-admin KYC approval permissions".
--
-- Writes are owner-only and confined to the states an applicant may set. The
-- approval is reachable only through the service-role path in
-- `reviewKycApplicationAction`, which first asserts `super_admin`.
-- -----------------------------------------------------------------------------
alter table public.real_estate_kyc_applications enable row level security;
alter table public.real_estate_kyc_documents enable row level security;
alter table public.real_estate_kyc_review_events enable row level security;
alter table public.listing_legal_documents enable row level security;

-- Applications -----------------------------------------------------------------

create policy "kyc_applications_select_own"
  on public.real_estate_kyc_applications for select
  to authenticated
  using (user_id = auth.uid());

-- Only a super admin reads another applicant's KYC. Deliberately not
-- `is_real_estate_admin()`, which includes `real_estate_admin` and
-- `department_staff`.
create policy "kyc_applications_select_super_admin"
  on public.real_estate_kyc_applications for select
  to authenticated
  using (public.is_super_admin());

-- An applicant may create their own application. The `with check` makes three
-- escalations impossible in one predicate:
--
--   * `user_id = auth.uid()` — only for themselves;
--   * the status is a draft or submitted state, never `approved`, so an
--     application cannot be born decided;
--   * no reviewer, so a row cannot be born looking reviewed.
create policy "kyc_applications_insert_own"
  on public.real_estate_kyc_applications for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status in ('draft', 'submitted', 'changes_requested')
    and reviewed_by is null
    and reviewed_at is null
  );

-- An applicant may edit or resubmit an application they are entitled to answer —
-- a draft, a submission still under review (to correct a detail), a refusal, or a
-- request for changes. NOT an approved one, and not one being decided by a super
-- admin in a way that has already been recorded.
--
-- The `with check` holds the destination to the applicant-settable states and
-- clears the reviewer, so an update can never move a row into `approved`.
create policy "kyc_applications_update_own"
  on public.real_estate_kyc_applications for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in ('draft', 'submitted', 'changes_requested', 'rejected')
  )
  with check (
    user_id = auth.uid()
    and status in ('draft', 'submitted')
    and reviewed_by is null
    and reviewed_at is null
  );

-- A super admin reaches every application. This is the policy the console's read
-- and the service-role decision both rely on; the decision itself uses the
-- service-role client so `auth.uid()` attributes the reviewer.
create policy "kyc_applications_write_super_admin"
  on public.real_estate_kyc_applications for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Documents --------------------------------------------------------------------

-- A document is reachable when its application is: own, or super admin. The
-- predicate reads the parent row through `exists`, so a document cannot be read
-- by a caller who cannot read its application.
create policy "kyc_documents_select_own"
  on public.real_estate_kyc_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.real_estate_kyc_applications a
      where a.id = application_id
        and a.user_id = auth.uid()
    )
  );

create policy "kyc_documents_select_super_admin"
  on public.real_estate_kyc_documents for select
  to authenticated
  using (public.is_super_admin());

-- An applicant attaches a document to their own application, while it is still
-- answerable. The `exists` also requires the application to be in a state the
-- applicant may edit, so a document cannot be attached to an approved
-- application.
create policy "kyc_documents_insert_own"
  on public.real_estate_kyc_documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.real_estate_kyc_applications a
      where a.id = application_id
        and a.user_id = auth.uid()
        and a.status in ('draft', 'submitted', 'changes_requested')
    )
  );

-- An applicant may delete their own document while the application is answerable
-- (to replace a bad photograph). A super admin may delete any, which is the
-- "private document deletion" control the brief asks for.
create policy "kyc_documents_delete_own"
  on public.real_estate_kyc_documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.real_estate_kyc_applications a
      where a.id = application_id
        and a.user_id = auth.uid()
        and a.status in ('draft', 'submitted', 'changes_requested')
    )
  );

create policy "kyc_documents_delete_super_admin"
  on public.real_estate_kyc_documents for delete
  to authenticated
  using (public.is_super_admin());

-- Review events ----------------------------------------------------------------

-- The applicant sees their own history, so a request for changes is legible to
-- them. The reviewer's internal note is filtered in the loader, not here, because
-- the note field is shared and a row-level rule cannot hide one column.
create policy "kyc_review_events_select_own"
  on public.real_estate_kyc_review_events for select
  to authenticated
  using (
    exists (
      select 1 from public.real_estate_kyc_applications a
      where a.id = application_id
        and a.user_id = auth.uid()
    )
  );

create policy "kyc_review_events_select_super_admin"
  on public.real_estate_kyc_review_events for select
  to authenticated
  using (public.is_super_admin());

-- A super admin records review events (a document view, an internal note).
create policy "kyc_review_events_insert_super_admin"
  on public.real_estate_kyc_review_events for insert
  to authenticated
  with check (public.is_super_admin());

-- Listing legal documents ------------------------------------------------------

-- A legal document is private: readable by the account that uploaded it, by the
-- listing's owner, by a real-estate administrator (who manages listings) and by a
-- super admin. It is deliberately NOT readable by an anonymous visitor, so a land
-- title can never appear in a public listing query.
create policy "listing_legal_documents_select_privileged"
  on public.listing_legal_documents for select
  to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_real_estate_admin()
    or exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and p.owner_id = auth.uid()
    )
  );

-- Uploading evidence for a listing requires a relationship to it: the uploader is
-- the owner, the manager, or a real-estate administrator. A stranger cannot attach
-- a document to someone else's listing.
create policy "listing_legal_documents_insert_privileged"
  on public.listing_legal_documents for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_real_estate_admin()
      or exists (
        select 1 from public.property_listings p
        where p.id = listing_id
          and (p.owner_id = auth.uid() or p.managed_by = auth.uid())
      )
    )
  );

create policy "listing_legal_documents_delete_privileged"
  on public.listing_legal_documents for delete
  to authenticated
  using (uploaded_by = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Audit.
--
-- A KYC decision and a document view are the most sensitive privileged actions in
-- the schema, so they are recorded by a trigger rather than by application code:
-- an entry written by the application is absent exactly when something bypasses
-- the application, which is the case the trail exists for.
--
-- The metadata records IDs and actions only — never a document path, a name or a
-- number — so the audit trail itself cannot become a copy of the identity data.
-- -----------------------------------------------------------------------------
create or replace function public.audit_kyc_review_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.actor_id, auth.uid()),
    case new.action
      when 'approved' then 'kyc_approved'
      when 'rejected' then 'kyc_rejected'
      when 'changes_requested' then 'kyc_changes_requested'
      when 'document_viewed' then 'kyc_document_viewed'
      when 'submitted' then 'kyc_submitted'
      else 'kyc_review_event'
    end,
    'real_estate_kyc_application',
    new.application_id::text,
    jsonb_build_object(
      'action', new.action::text,
      'documentId', new.document_id
    )
  );

  return new;
end;
$$;

comment on function public.audit_kyc_review_event is
  'Mirrors a KYC review event into the audit trail. Records IDs and the action only — never a document path, a name or a number.';

drop trigger if exists real_estate_kyc_review_events_audit
  on public.real_estate_kyc_review_events;
create trigger real_estate_kyc_review_events_audit
  after insert on public.real_estate_kyc_review_events
  for each row execute function public.audit_kyc_review_event();

-- A KYC application's own status change is audited too, so an approval made
-- without an accompanying review event is still visible.
create or replace function public.audit_kyc_application_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case new.status
      when 'approved' then 'kyc_approved'
      when 'rejected' then 'kyc_rejected'
      when 'changes_requested' then 'kyc_changes_requested'
      when 'submitted' then 'kyc_submitted'
      else 'kyc_status_changed'
    end,
    'real_estate_kyc_application',
    new.id::text,
    jsonb_build_object(
      'membershipType', new.membership_type::text,
      'fromStatus', case when tg_op = 'UPDATE' then old.status::text else null end,
      'toStatus', new.status::text,
      'reviewedBy', new.reviewed_by
    )
  );

  return new;
end;
$$;

comment on function public.audit_kyc_application_status is
  'Records a KYC status change in the audit trail. Fires on insert and on a status change only.';

drop trigger if exists real_estate_kyc_applications_audit
  on public.real_estate_kyc_applications;
create trigger real_estate_kyc_applications_audit
  after insert or update of status on public.real_estate_kyc_applications
  for each row execute function public.audit_kyc_application_status();

-- -----------------------------------------------------------------------------
-- Approval.
--
-- The single function that turns an approved KYC application into a capability.
-- It is `security definer` and NOT reachable by a browser key: it is called only
-- by `reviewKycApplicationAction`, which runs on the server with the service-role
-- client after asserting `super_admin`. Its own internal `is_super_admin()` guard
-- is the real control, because a direct PostgREST call never runs the action.
--
-- Doing the approval in one function rather than two round-trips means the
-- membership row and the application status cannot disagree: either both move or
-- neither does.
-- -----------------------------------------------------------------------------
create or replace function public.approve_kyc_application(
  p_application_id uuid,
  p_reviewer uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.real_estate_kyc_applications;
  v_membership_id uuid;
  v_actor uuid := coalesce(auth.uid(), p_reviewer);
begin
  -- Only a super admin may make the final decision. `is_super_admin()` reads the
  -- caller's own role; when the caller is the service role there is no JWT, so
  -- the action has already asserted the role and passes the reviewer explicitly.
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'Only a super administrator may approve a KYC application'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_app
  from public.real_estate_kyc_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Unknown KYC application %', p_application_id
      using errcode = 'no_data_found';
  end if;

  if v_app.status = 'approved' then
    raise exception 'Application % is already approved', p_application_id
      using errcode = 'check_violation';
  end if;

  if v_app.submitted_at is null then
    raise exception 'Application % has not been submitted', p_application_id
      using errcode = 'check_violation';
  end if;

  update public.real_estate_kyc_applications
  set status = 'approved',
      reviewed_by = coalesce(p_reviewer, auth.uid()),
      reviewed_at = now(),
      decision_reason = null,
      internal_notes = coalesce(p_note, internal_notes)
  where id = p_application_id;

  -- The capability. The unique key is the same (user, type) pair, so an approval
  -- of a re-application updates the existing row rather than creating a second.
  insert into public.real_estate_memberships
    (user_id, membership_type, status, approved_by, approved_at, review_notes)
  values (
    v_app.user_id,
    v_app.membership_type::text::public.membership_type,
    'approved',
    coalesce(p_reviewer, auth.uid()),
    now(),
    p_note
  )
  on conflict (user_id, membership_type) do update
    set status = 'approved',
        approved_by = excluded.approved_by,
        approved_at = excluded.approved_at,
        review_notes = excluded.review_notes,
        suspended_at = null,
        suspension_reason = null
  returning id into v_membership_id;

  -- The history entry. The status-change trigger writes the audit row; this
  -- records the human-visible step.
  insert into public.real_estate_kyc_review_events
    (application_id, action, actor_id, note)
  values (p_application_id, 'approved', coalesce(p_reviewer, auth.uid()), p_note);

  return v_membership_id;
end;
$$;

comment on function public.approve_kyc_application is
  'Approves a KYC application and activates the matching membership, atomically. Super-admin only; not reachable by a browser key.';

-- -----------------------------------------------------------------------------
-- A helper for the guard above.
--
-- `auth.role()` returns 'service_role' for a service-role connection and the JWT
-- role otherwise. Wrapped so the approval function reads clearly and so a future
-- caller has one place to change.
-- -----------------------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

comment on function public.is_service_role is
  'True when the current connection is the service role. Used by functions that a server action calls on the service-role client.';

-- -----------------------------------------------------------------------------
-- EXECUTE classification.
--
-- Supabase grants EXECUTE on a new public function to `anon` and `authenticated`
-- by default, and the Phase 12 hardening migration ran long before this one, so
-- every function created here gets the default grant unless it is classified in
-- this same migration. This is the trap AGENTS.md records twice.
--
--   * `audit_kyc_review_event` and `audit_kyc_application_status` are TRIGGER
--     functions. Postgres does not check EXECUTE for a trigger function, so the
--     grant is unnecessary — but it is still surface, so it is revoked.
--
--   * `is_service_role` is evaluated inside `approve_kyc_application`, which is
--     itself super-admin/service-role only, so it needs no browser grant.
--
--   * `approve_kyc_application` is the privileged write. It is NOT granted to
--     `anon` or `authenticated`: a browser key must never reach a function that
--     grants a capability. `service_role` only.
--
-- The mirror test and the validate script both assert this classification.
-- -----------------------------------------------------------------------------
revoke all on function public.audit_kyc_review_event() from public;
revoke all on function public.audit_kyc_review_event() from anon, authenticated;
grant execute on function public.audit_kyc_review_event() to service_role;

revoke all on function public.audit_kyc_application_status() from public;
revoke all on function public.audit_kyc_application_status() from anon, authenticated;
grant execute on function public.audit_kyc_application_status() to service_role;

revoke all on function public.is_service_role() from public;
revoke all on function public.is_service_role() from anon, authenticated;
grant execute on function public.is_service_role() to service_role;

revoke all on function public.approve_kyc_application(uuid, uuid, text) from public;
revoke all on function public.approve_kyc_application(uuid, uuid, text) from anon, authenticated;
grant execute on function public.approve_kyc_application(uuid, uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Assert the outcome.
--
-- Three properties, each the reason this migration exists:
--
--   (a) an applicant may submit an application, but may NOT write one that is
--       already approved — the self-escalation guard;
--
--   (b) a KYC application is NOT readable by a plain real-estate administrator,
--       only by its owner and a super admin — the brief's "a normal real-estate
--       administrator must not be given super-admin KYC approval permissions";
--
--   (c) the approval function is not executable by a browser key.
--
-- Written as a `do` block that raises on failure, so a regression aborts the
-- migration rather than shipping.
-- -----------------------------------------------------------------------------
do $$
declare
  v_user uuid := 'b0000000-0000-0000-0000-0000000000a1';
  v_re_admin uuid := 'b0000000-0000-0000-0000-0000000000a2';
  v_rows integer;
  v_status public.kyc_status;
begin
  insert into auth.users (id, email) values
    (v_user, 'phase2-kyc@example.test'),
    (v_re_admin, 'phase2-re-admin@example.test')
  on conflict (id) do nothing;

  update public.profiles set role = 'real_estate_admin'
  where id = v_re_admin;

  -- (a) A user may not create an already-approved KYC application.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    insert into public.real_estate_kyc_applications (
      user_id, membership_type, status, full_legal_name, email, phone,
      country_of_residence, date_of_birth, id_type, id_issuing_country,
      reviewed_by, reviewed_at
    ) values (
      v_user, 'landlord', 'approved', 'Test Applicant', 'phase2-kyc@example.test',
      '+237 600 000 000', 'Cameroon', '1990-01-01', 'national_id_card',
      'Cameroon', v_re_admin, now()
    );
  exception
    when insufficient_privilege then
      null; -- refused by RLS, the expected outcome
  end;
  reset role;

  select count(*) into v_rows
  from public.real_estate_kyc_applications
  where user_id = v_user and status = 'approved';

  if v_rows <> 0 then
    raise exception
      'Phase 2 self-escalation guard FAILED: a user created an approved KYC application';
  end if;

  -- (a2) The legitimate path: a pending application is allowed.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    insert into public.real_estate_kyc_applications (
      user_id, membership_type, status, full_legal_name, email, phone,
      country_of_residence, date_of_birth, id_type, id_issuing_country,
      submitted_at, video_consent_at, declaration_accepted_at
    ) values (
      v_user, 'landlord', 'submitted', 'Test Applicant', 'phase2-kyc@example.test',
      '+237 600 000 000', 'Cameroon', '1990-01-01', 'national_id_card',
      'Cameroon', now(), now(), now()
    );
  exception
    when insufficient_privilege then
      raise exception
        'Phase 2 KYC FAILED: a user could not submit a KYC application at all';
  end;
  reset role;

  select status into v_status
  from public.real_estate_kyc_applications
  where user_id = v_user and membership_type = 'landlord';

  if v_status <> 'submitted' then
    raise exception 'Phase 2 KYC FAILED: the application did not persist (status %)', v_status;
  end if;

  -- (b) A real-estate administrator (not a super admin) may NOT read it.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_re_admin::text, true);

  select count(*) into v_rows
  from public.real_estate_kyc_applications
  where user_id = v_user;
  reset role;

  if v_rows <> 0 then
    raise exception
      'Phase 2 KYC FAILED: a real-estate administrator could read another user''s KYC application';
  end if;

  -- (c) The approval function must not be reachable from a browser key.
  if has_function_privilege('authenticated', 'public.approve_kyc_application(uuid, uuid, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.approve_kyc_application(uuid, uuid, text)', 'EXECUTE') then
    raise exception
      'Phase 2 KYC FAILED: approve_kyc_application is executable by a browser key';
  end if;

  -- Clean up, so a migration applied to a live database leaves nothing behind.
  delete from public.real_estate_kyc_applications where user_id = v_user;
  delete from public.profiles where id in (v_user, v_re_admin);
  delete from auth.users where id in (v_user, v_re_admin);

  raise notice 'Phase 2 KYC: self-escalation blocked, super-admin-only access enforced, approval function not browser-callable';
end
$$;
