/**
 * The KYC verification model, mirrored from the database.
 *
 * These are the values the KYC tables accept, declared here so a form can offer
 * them synchronously. They are asserted against
 * `20260101000060_kyc_verification.sql` by `kyc.test.ts`, so the mirror cannot
 * drift from the enums the way a hand-copied list would.
 *
 * ## The rule this module exists to keep legible
 *
 * The brief's central rule for this phase: "The existence of a user-selected
 * account type must never grant posting permissions." A user may *declare* an
 * intent to be a landlord or an agent at signup; that declaration creates an
 * application, never a capability. A capability exists only when a super admin
 * approves the KYC application, and the approval writes the membership row from
 * the server.
 *
 * Nothing here grants anything. These are labels and shapes; the grants live in
 * the RLS policies and in `approve_kyc_application`.
 */

/** The capabilities a KYC application may be for. Mirrors `membership_type`. */
export const KYC_MEMBERSHIP_TYPES = ["landlord", "agent"] as const;
export type KycMembershipType = (typeof KYC_MEMBERSHIP_TYPES)[number];

/**
 * The account type a user declares at signup. Mirrors `public.account_type`.
 *
 * A DECLARATION, not a capability. It routes the onboarding — a landlord is
 * offered a KYC application, a buyer is not — and nothing in the schema reads it
 * as a permission. The two landlord/agent members are the same vocabulary as
 * `KYC_MEMBERSHIP_TYPES` so the declaration can pre-select the right application
 * without a translation table; `buyer` has no application because a property
 * seeker needs no capability.
 */
export const ACCOUNT_TYPES = ["buyer", "landlord", "agent"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** The account types that have a KYC application behind them. */
export const CAPABILITY_ACCOUNT_TYPES = ["landlord", "agent"] as const;

/** True when the account type is one that requires KYC to act. */
export function accountTypeRequiresKyc(type: AccountType): boolean {
  return type !== "buyer";
}

/** Map a declared account type to the capability it implies, if any. */
export function capabilityForAccountType(
  type: AccountType,
): KycMembershipType | null {
  return type === "buyer" ? null : type;
}

/**
 * Where a KYC application has reached.
 *
 * `not_started` is deliberately absent: it is the absence of a row, not a state
 * of one, matching `membership_status`.
 */
export const KYC_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "changes_requested",
] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

/** The statuses an applicant may set for themselves, mirroring the RLS policy. */
export const KYC_APPLICANT_SETTABLE_STATUSES = [
  "draft",
  "submitted",
] as const satisfies readonly KycStatus[];

/**
 * The statuses an applicant may reset by resubmitting.
 *
 * A refusal and a request for changes are both the applicant's to answer, and a
 * submission still under review may be corrected. `approved` is excluded: it is a
 * live capability its holder may not reset, and an approved row is only ever
 * written by the super-admin approval path.
 */
export const KYC_REAPPLICABLE_STATUSES = [
  "submitted",
  "rejected",
  "changes_requested",
] as const satisfies readonly KycStatus[];

/** The statuses a super admin still has to decide. */
export const KYC_PENDING_STATUSES = [
  "submitted",
  "under_review",
] as const satisfies readonly KycStatus[];

/** True when the status is a decided state, one way or the other. */
export function isKycDecidedStatus(status: KycStatus): boolean {
  return status === "approved" || status === "rejected";
}

/**
 * The accepted identification types.
 *
 * The brief names three. The value is stored, and a label is looked up by
 * `kycIdTypeLabelKey`, so the two are allowed to differ.
 */
export const KYC_ID_TYPES = [
  "national_id_card",
  "international_passport",
  "other_government_id",
] as const;
export type KycIdType = (typeof KYC_ID_TYPES)[number];

/**
 * What a stored KYC file is.
 *
 * `id_front` and `id_back` are separate because the brief requires the applicant
 * to be told which side to upload and the reviewer to see which side they are
 * looking at. `face_video` is a manual liveness recording reviewed by a person;
 * no facial-recognition processing is performed and no biometric template is
 * created.
 */
export const KYC_DOCUMENT_KINDS = [
  "id_front",
  "id_back",
  "face_video",
  "proof_of_address",
  "other",
] as const;
export type KycDocumentKind = (typeof KYC_DOCUMENT_KINDS)[number];

/** The kinds that are an identity document (as opposed to a video or a note). */
export const KYC_IDENTITY_KINDS = ["id_front", "id_back"] as const;

/** The kinds a valid application must carry at minimum. */
export const KYC_REQUIRED_DOCUMENT_KINDS = [
  "id_front",
  "face_video",
] as const satisfies readonly KycDocumentKind[];

/** The property-specific legal document kinds. */
export const LEGAL_DOCUMENT_KINDS = [
  "land_title",
  "ownership_certificate",
  "sale_agreement",
  "agency_mandate",
  "owner_authorization",
  "other",
] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

/** The residency statuses an applicant may state. */
export const KYC_RESIDENCY_STATUSES = [
  "permanent",
  "temporary",
  "non_resident",
] as const;
export type KycResidencyStatus = (typeof KYC_RESIDENCY_STATUSES)[number];

/** What a review event was. Mirrors `kyc_review_action`. */
export const KYC_REVIEW_ACTIONS = [
  "submitted",
  "review_started",
  "document_viewed",
  "approved",
  "rejected",
  "changes_requested",
  "note_added",
] as const;
export type KycReviewAction = (typeof KYC_REVIEW_ACTIONS)[number];

/** The decisions a super admin may record. */
export const KYC_DECISIONS = [
  "approve",
  "reject",
  "request_changes",
] as const;
export type KycDecision = (typeof KYC_DECISIONS)[number];

/** The status a decision moves an application to. */
export const KYC_DECISION_STATUS = {
  approve: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
} as const satisfies Record<KycDecision, KycStatus>;

/** A KYC application as the application reads it. */
export type KycApplicationRecord = {
  id: string;
  userId: string;
  membershipType: KycMembershipType;
  status: KycStatus;
  fullLegalName: string;
  email: string;
  phone: string;
  countryOfResidence: string;
  currentLocation: string | null;
  residencyStatus: KycResidencyStatus;
  dateOfBirth: string;
  idType: KycIdType;
  idIssuingCountry: string;
  idNumberLast4: string | null;
  videoConsentAt: string | null;
  declarationAcceptedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  decisionReason: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A stored KYC document, without its storage path (which never leaves the server). */
export type KycDocumentRecord = {
  id: string;
  applicationId: string;
  kind: KycDocumentKind;
  originalFilename: string;
  detectedMime: string;
  byteSize: number;
  issuingCountry: string | null;
  note: string | null;
  createdAt: string;
};

/** A review event. `internal` notes are filtered before this reaches an applicant. */
export type KycReviewEventRecord = {
  id: string;
  applicationId: string;
  action: KycReviewAction;
  actorId: string | null;
  documentId: string | null;
  note: string | null;
  createdAt: string;
};

/**
 * The review actions whose note the applicant may read.
 *
 * `note` is one column shared by two audiences: a refusal or a request for
 * changes must tell the applicant why, while an approval's note and an explicit
 * `note_added` entry are reviewer-internal. A row-level rule cannot hide one
 * column, so the applicant-facing history filters by this set. Kept here beside
 * the enum so adding a new note-bearing action is a decision, not a silent leak.
 */
export const KYC_APPLICANT_VISIBLE_NOTE_ACTIONS: readonly KycReviewAction[] = [
  "rejected",
  "changes_requested",
];

/** True when an action's `note` is safe to show the applicant. */
export function isApplicantVisibleNote(action: KycReviewAction): boolean {
  return KYC_APPLICANT_VISIBLE_NOTE_ACTIONS.includes(action);
}

/**
 * The message key for a status label, under `account.kyc.status.*`.
 *
 * A function rather than a lookup map so a new enum member is a type error here
 * rather than a missing label that renders a raw key.
 */
export function kycStatusLabelKey(status: KycStatus): string {
  return `account.kyc.status.${status}`;
}

export function kycIdTypeLabelKey(type: KycIdType): string {
  return `account.kyc.idType.${type}`;
}

export function kycDocumentKindLabelKey(kind: KycDocumentKind): string {
  return `account.kyc.documentKind.${kind}`;
}

export function legalDocumentKindLabelKey(kind: LegalDocumentKind): string {
  return `adminKyc.legalDocumentKind.${kind}`;
}

export function kycResidencyStatusLabelKey(status: KycResidencyStatus): string {
  return `account.kyc.residencyStatus.${status}`;
}

/**
 * The message key for the side-of-document guidance, per identity kind.
 *
 * The brief requires guidance explaining which side of a document to upload, and
 * the guidance differs by kind (a passport has a photo page, not a "front"), so
 * it is looked up rather than being one generic string.
 */
export function kycDocumentGuidanceKey(kind: KycDocumentKind): string {
  return `account.kyc.guidance.${kind}`;
}

/** True when the value is a known membership type. */
export function isKycMembershipType(value: string): value is KycMembershipType {
  return (KYC_MEMBERSHIP_TYPES as readonly string[]).includes(value);
}

/** True when the value is a known document kind. */
export function isKycDocumentKind(value: string): value is KycDocumentKind {
  return (KYC_DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * The age, in whole years, of a person born on `dateOfBirth` as of `on`.
 *
 * Used by the client form to refuse an under-18 applicant before a request is
 * made; the database CHECK is the real control, and this exists so the applicant
 * gets a message rather than a constraint violation.
 */
export function ageInYears(dateOfBirth: string, on: Date = new Date()): number {
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return Number.NaN;

  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - birth.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && on.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

/** The minimum age at which a person may apply to publish property. */
export const KYC_MINIMUM_AGE = 18;

/** True when the person is old enough to submit an adult KYC application. */
export function isOldEnoughToApply(
  dateOfBirth: string,
  on: Date = new Date(),
): boolean {
  const age = ageInYears(dateOfBirth, on);
  return Number.isFinite(age) && age >= KYC_MINIMUM_AGE;
}

/**
 * Which of the required documents are missing for a set of uploaded kinds.
 *
 * The form and the action both use this so "you must upload your ID and a face
 * video" is one rule, stated once.
 */
export function missingRequiredDocuments(
  uploaded: readonly KycDocumentKind[],
): KycDocumentKind[] {
  const present = new Set(uploaded);
  return KYC_REQUIRED_DOCUMENT_KINDS.filter((kind) => !present.has(kind));
}
