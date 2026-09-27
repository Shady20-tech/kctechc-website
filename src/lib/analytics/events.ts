/**
 * Analytics event taxonomy.
 *
 * One definition of every event the site may send, so measurement logic is not
 * scattered through components. Components call `track()` with a name from this
 * union and a payload whose shape TypeScript enforces; nothing constructs a
 * GA4 `gtag()` call directly.
 *
 * Two families, mirroring the brief:
 *
 *   * **Ecommerce** — the GA4 recommended retail funnel. Payloads use GA4's
 *     `items` shape so the built-in ecommerce reports work without custom
 *     dimensions.
 *   * **Conversion** — the lead-generation events this business actually cares
 *     about (quote requests, property inquiries, contact submissions). A
 *     department with no online checkout still produces measurable demand.
 *
 * The critical rule, encoded in the types rather than in a comment: **no PII**.
 * There is no field for a name, email, phone or free-text message. A caller
 * cannot accidentally send one, because `AnalyticsItem` and the event payloads
 * have no such key and `track` strips unknown fields.
 */

/** GA4 ecommerce item. Deliberately narrower than GA4 allows. */
export type AnalyticsItem = {
  /** Product or listing id. Stable, non-personal. */
  item_id: string;
  item_name: string;
  /** Category or department slug. */
  item_category?: string;
  /** Only for store products. */
  item_brand?: string;
  price?: number;
  quantity?: number;
  /** Minor-unit currency code, e.g. XAF. Required for purchase events. */
  currency?: string;
  /** Zero-based position in the list the user was looking at. */
  index?: number;
};

/** Store ecommerce events. */
export type EcommerceEventName =
  | "view_item_list"
  | "view_item"
  | "select_item"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "purchase";

/** Lead and conversion events. */
export type ConversionEventName =
  | "generate_lead"
  | "quote_request"
  | "property_inquiry"
  | "property_viewing_request"
  | "consultation_request"
  | "contact_submit"
  | "department_selection"
  | "site_search";

export type AnalyticsEventName = EcommerceEventName | ConversionEventName;

/**
 * A normalized analytics event.
 *
 * `value` and `currency` are the GA4 monetization pair. `lead_source` and
 * `department` are the dimensions this business reports on.
 *
 * There is intentionally no free-text field beyond `search_term`, which is
 * hashed before it leaves the browser (see `site_search`) because a search box
 * is where visitors type things they should not have to disclose.
 */
export type AnalyticsEvent = {
  name: AnalyticsEventName;
  /** Non-personal parameters. Keys are fixed; see `SAFE_PARAM_KEYS`. */
  params: {
    /** Monetary value in major units, per GA4 convention. */
    value?: number;
    currency?: string;
    items?: AnalyticsItem[];
    /** Which funnel produced this: store, quote form, listing page, contact. */
    lead_source?: string;
    /** Department slug, when the event belongs to one. */
    department?: string;
    /** Content id the event concerns (product, listing, service, insight). */
    content_id?: string;
    content_type?: string;
    /** Search term, already hashed by the caller. Never raw. */
    search_term?: string;
    /** Result count, for search quality. Non-personal. */
    result_count?: number;
    /**
     * The order reference, sent on `purchase`.
     *
     * GA4 deduplicates a purchase on this value, so it must be the order's own
     * reference. It is non-personal — the customer's reference, printed on their
     * receipt, not their identity — and it is already visible to them.
     */
    transaction_id?: string;
  };
};

/**
 * Parameters that may be sent.
 *
 * `track` filters to exactly these keys. A caller that spreads an object
 * containing a customer's email into `params` would otherwise send it, and a
 * type is not enough: a spread of an `any` bypasses the compiler. The allowlist
 * is the real guard, and it is what the test asserts.
 */
export const SAFE_PARAM_KEYS = [
  "value",
  "currency",
  "items",
  "lead_source",
  "department",
  "content_id",
  "content_type",
  "search_term",
  "result_count",
  "transaction_id",
] as const;

/** Keys permitted on an item. Anything else is dropped before dispatch. */
export const SAFE_ITEM_KEYS = [
  "item_id",
  "item_name",
  "item_category",
  "item_brand",
  "price",
  "quantity",
  "currency",
  "index",
] as const;

/**
 * Consent categories.
 *
 * `analytics` gates measurement. `marketing` is separate because an advertising
 * pixel is a different decision for a visitor than anonymous traffic counting,
 * and collapsing them would mean one consent for two purposes.
 */
export type ConsentState = {
  analytics: boolean;
  marketing: boolean;
};

export const DEFAULT_CONSENT: ConsentState = {
  analytics: false,
  marketing: false,
};

export const CONSENT_STORAGE_KEY = "kc_consent_v1";
