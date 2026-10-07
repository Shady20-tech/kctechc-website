import { SITE } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { LEGAL_FR } from "./legal.fr";

/**
 * Types live in this module; the French parallel document lives in `legal.fr.ts`
 * which imports them with `import type`. That keeps the type dependency one-way
 * — `legal.fr.ts` borrows only erased types — so this module can import the
 * French values without an import cycle.
 */

/**
 * Canonical Terms of Service and Privacy Policy.
 *
 * Written from the site's actual behaviour and the supplied business facts, so
 * every statement here is checkable against the codebase:
 *
 *   - the account fields are those `auth.ts` validates;
 *   - the inquiry, checkout and delivery fields are those `inquiry.ts` and
 *     `checkout.ts` accept;
 *   - the IP handling is the salted hash in `inquiries/actions.ts`;
 *   - the payment methods are the three `checkout.ts` permits, and no card or
 *     mobile-money details are collected on this site: an order is sent to our
 *     team, who confirm it and arrange payment directly with the customer;
 *   - the retention periods are the working assumption supplied with this phase,
 *     flagged in `retentionNote` as still to be confirmed by the business.
 *
 * Nothing is claimed about KC Technology Corporation that the brief does not
 * support — no registration number, no certifications, no named clients. Where a
 * statement is an internal policy rather than a verifiable fact (retention,
 * grievance response time) it is written as a commitment, not as a legal claim.
 *
 * `Last updated` is the site revision date: the pages are part of the static set
 * and change when the site ships, so one date is honest for both.
 */

export type LegalSection = {
  /** Anchor id, stable across locales so a link keeps working after a switch. */
  id: string;
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  /** SEO description, one sentence. */
  description: string;
  intro: string;
  /** Human-readable date shown on the page. */
  updatedAt: string;
  /** Machine-readable equivalent for the `<time>` element and structured data. */
  updatedAtIso: string;
  retentionNote?: string;
  sections: readonly LegalSection[];
};

const CONTACT_EMAIL = SITE.email;
const CONTACT_PHONE = SITE.phones[0]!;
const POSTAL_ADDRESS = `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.region}, ${SITE.address.country}`;

/**
 * The site revision date, duplicated here rather than imported so this module
 * stays a pure data file with no dependency on the config barrel.
 */
const LAST_UPDATED = "24 September 2026";
/** The same revision as `SITE_REVISION_DATE`, in the form a crawler reads. */
const LAST_UPDATED_ISO = "2026-09-24";

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: "agreement",
    heading: "Agreement to these terms",
    body: `These terms govern your use of the KC Technology Corporation website and any order, inquiry or account you create through it. The site is operated by ${SITE.legalName} ("KC Technology", "we", "us"), whose head office is at ${POSTAL_ADDRESS}.

By using the site you accept these terms. If you do not accept them, please do not use the site. Where an order or service has its own written agreement, that agreement governs the service and these terms govern the website itself.`,
  },
  {
    id: "about-us",
    heading: "About us and how to reach us",
    body: `We operate Digital Marketing, Electrical Services and Real Estate from our head office in ${SITE.address.city}, ${SITE.address.country}, and serve customers nationwide.

For any question about these terms, an order or a project, contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}, or by post at ${POSTAL_ADDRESS}.`,
  },
  {
    id: "services-and-scope",
    heading: "Our services and the scope of work",
    body: `**Digital Marketing.** Storefront, campaigns and technology products. Orders from our online store are governed by the ordering and payment sections below.

**Electrical Services.** Electrical engineering, installation, maintenance and infrastructure work. This work is scoped, priced and delivered under a separate written quotation. Nothing on this website is an offer to perform regulated electrical work, and no work begins until a quotation has been agreed.

**Real Estate.** Property listings and brokerage introductions across Cameroon. A listing describes a property as reported by the vendor or our agents. It is not a warranty of title, condition, area, price or availability, and it does not replace your own inspection and legal due diligence, or the verification of title with the land registry.

Any figure, timeline or description published on the site is indicative until confirmed in a written quotation or listing agreement.`,
  },
  {
    id: "accounts",
    heading: "Your account",
    body: `You may create an account to place orders, save properties and track requests. Creating an account requires your full name, email address and a password of at least eight characters. You must confirm your email address before you can sign in.

You are responsible for keeping your password and access to your email account secure, and for activity that happens under your account. Passwords are stored by our authentication provider, never in plain text and never in a form we can read. Tell us promptly at ${CONTACT_EMAIL} if you believe your account has been accessed by someone else.`,
  },
  {
    id: "orders-payments",
    heading: "Orders and payment",
    body: `**Placing an order.** An order is placed when you submit the checkout form and send it to us. Prices are shown in Central African CFA francs (XAF).

**Payment methods.** We do not take payment on this website. When you send an order you choose how you would like to pay — MTN Mobile Money, Orange Money, bank transfer, or an arrangement our team agrees with you — and we contact you using the details you provided to confirm the order, agree the method and finalise payment. No card or mobile-money details are entered on this site and none are stored by it.

**Confirmation.** We confirm an order ourselves once payment is arranged. An order sent through the website is a request to purchase, not a completed sale, until we confirm it and payment is finalised.

**Delivery and collection.** Orders may be collected from our office in ${SITE.address.city} or delivered to the address you give us at checkout. A delivery order requires a street address and a city. Delivery fees, where they apply, are shown and agreed at checkout, and an order is described as either a delivery order or a collection order in both the checkout and the receipt.`,
  },
  {
    id: "inquiries",
    heading: "Quotations and pre-contractual information",
    body: `A quotation we issue is an invitation to agree, not a binding offer, unless it states otherwise and is signed by both parties. A quotation is based on the information available to us at the time, including photographs and any measurements you supply; a site inspection may change it.

Where you provide measurements, photographs, drawings or documents for a quotation, you confirm you are entitled to share them and that they are accurate to the best of your knowledge.`,
  },
  {
    id: "cancellation",
    heading: "Cancellation, returns and refunds",
    body: `**Cancelling an order.** Contact us at ${CONTACT_EMAIL} as soon as possible. Where an order has not yet been dispatched or installed, we will cancel it and refund any amount already paid.

**Returns and refunds.** Goods are returnable if they are faulty, not as described or not fit for the purpose we agreed. Electrical goods and materials that have been installed, altered or used are not returnable except where they are faulty. Approved refunds are made by the same payment channel used to pay, or as our team agrees with you.

**Services in progress.** Where installation or campaign work has begun, the amount already performed is chargeable and is deducted from any refund.

**Legally required rights.** Nothing in this section limits any right you have under the applicable law of Cameroon, including the consumer protection provisions of Law No. 2011/012.`,
  },
  {
    id: "consumer-rights",
    heading: "Consumer protection",
    body: `If you are dealing with us as a consumer, you have the protection of Cameroon's consumer protection law, in particular Law No. 2011/012 of 6 May 2011 on consumer protection. Nothing on this website, and nothing we agree separately, removes or reduces those rights.

If something has gone wrong with an order or a service, tell us first at ${CONTACT_EMAIL} or ${CONTACT_PHONE} so we have the opportunity to put it right.`,
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use of the site",
    body: `You must not:

1. copy, scrape or republish the site or its content except as these terms allow;
2. attempt to gain access to any part of the site or our systems that you are not authorised to use;
3. submit false, misleading or unlawful material, including through an inquiry or a review;
4. interfere with the site's operation, including by attempting to overload it;
5. use this site for any unlawful purpose.

We may suspend or close an account, and refuse or cancel an order, where these terms are broken or where we are required to do so by law.`,
  },
  {
    id: "ip",
    heading: "Intellectual property",
    body: `The site's design, text, code, images, brand and logos belong to ${SITE.legalName} or are used with permission. You may read, print and share the pages for your own personal or internal business use. Anything beyond that — republishing, redistributing or using our content to train or supply a competing service — needs our written permission first.

Content you send us — photographs, documents, brand assets or copy for a campaign — remains yours. By sending it you give us permission to use it for the purpose you sent it for, whether a quotation, an order or a project.`,
  },
  {
    id: "availability",
    heading: "Availability and accuracy of the site",
    body: `We try to keep the site accurate and available, but we cannot promise it will be uninterrupted or free of error. Listings, prices, stock and service availability change and may be out of date between publications.

We may change, suspend or withdraw any part of the site at any time.`,
  },
  {
    id: "liability",
    heading: "Our responsibility to you",
    body: `We are responsible for loss you suffer that is a foreseeable result of our breaking these terms or of our failing to use reasonable care and skill. We are not responsible for loss that is not foreseeable, for business losses such as lost profit or lost opportunity where the site is used in the course of a business, or for loss caused by something outside our reasonable control.

Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be limited.`,
  },
  {
    id: "privacy-reference",
    heading: "Your data",
    body: `How we handle personal data — what we collect, why, how long we keep it and the choices you have — is set out in our [Privacy Policy](/en/privacy). It forms part of these terms.`,
  },
  {
    id: "general",
    heading: "Changes to these terms and governing law",
    body: `We may update these terms to reflect changes to the site or to the law. The version published on this page at the time you use the site is the version that applies, and the date at the top of the page records when it last changed.

These terms are governed by the law of Cameroon, and the courts of Cameroon have jurisdiction over any dispute arising from them. If any provision is found to be unenforceable, the rest remains in force.`,
  },
];

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: "scope",
    heading: "Who we are and what this notice covers",
    body: `This notice explains how ${SITE.legalName} ("KC Technology", "we", "us") handles personal data collected through this website, our online store, our inquiry and quotation forms, and our property listings.

We are the data controller for that processing. Our head office is at ${POSTAL_ADDRESS}, and you can reach us about privacy at ${CONTACT_EMAIL} or ${CONTACT_PHONE}.`,
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    body: `**When you contact us or request a quotation.** Your name, email address, an optional telephone number, the subject and body of your message, and — where you attach one — the file you upload, such as a photograph or drawing. If you submit a quote request, we record the original filename of any file you attach.

**When you create an account.** Your full name, email address and password. The password is handled by our authentication provider and is never stored in a readable form.

**When you place an order.** Your name, email address, optional telephone number, the fulfilment method (delivery or collection), and, for a delivery, the delivery address, city, region and any delivery notes you add.

**When you browse and we measure.** If you allow measurement, we record which pages are viewed and simple interaction events such as products viewed or added to a cart. We do not send names, email addresses or telephone numbers to our measurement service. If you do not allow measurement, no measurement script is loaded at all.

**Automatically, for security and records.** When you submit an inquiry or quote request we record a salted, one-way hash of your IP address, your browser's user-agent string, and the time of submission. The hash is derived with a secret salt and cannot be reversed to your IP address. We record it to detect and limit abuse, not to identify you.

We do not collect card numbers, mobile-money numbers or bank credentials. No payment is taken on this site; an order is sent to our team, who confirm it and arrange payment directly with you.`,
  },
  {
    id: "why",
    heading: "Why we use it and the lawful basis",
    body: `We use personal data to:

1. answer your inquiry and prepare a quotation;
2. create and administer your account, including confirming your email and allowing a password reset;
3. process, fulfil and deliver an order, and contact you to confirm it and arrange payment;
4. arrange a property viewing or pass your enquiry to the relevant agent;
5. keep the site secure, prevent abuse and limit automated submissions;
6. measure how the site is used, but only where you have allowed it;
7. meet our legal, accounting and tax obligations.

Our lawful bases are: **performance of a contract** where the processing is needed to fulfil an order or a project for you; **your consent** for measurement cookies and for optional marketing measurement; **our legitimate interests** in responding to enquiries, keeping the site secure and improving our services, balanced against your rights; and **legal obligation** for records we must keep.

Cookies and measurement are described in the Cookies section below. Where measurement relies on your consent, you can withdraw it at any time without losing access to the site.`,
  },
  {
    id: "sharing",
    heading: "Who we share it with",
    body: `We use a small number of service providers, and share data only as needed for them to perform their service:

1. **Supabase** — hosting of the database that stores accounts, orders, inquiries and listings.
2. **Our email provider** — delivering account, enquiry and order-notification emails on our behalf, including the order you send us and the confirmation we send you.
3. **Tolgee** — the translation management service that supplies the site's interface text.
4. **Google Analytics** — if and only if you allow measurement, receiving anonymous usage events with no direct identifiers.
5. **Professional advisers, auditors and authorities** — where we are required to disclose information, or where it is necessary to establish, exercise or defend a legal claim.

We do not sell your personal data, and we do not share it for other parties' independent marketing. Some of these providers process data on servers outside Cameroon, including in the European Union and the United States.`,
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: `We keep personal data only as long as we need it for the purpose it was collected for:

1. **Accounts** — while your account is open, and for a short period after it is closed so that any outstanding order or request can be resolved.
2. **Inquiries and quotations that do not become work** — up to 24 months from the last contact, after which they are deleted.
3. **Orders, invoices and payment records** — for the accounting and tax retention period required of us, which we treat as 10 years.
4. **Uploaded quotation files** — with the inquiry they belong to, and deleted on the same schedule.
5. **Security records (IP hash and user-agent)** — for a limited period sufficient to detect a pattern of abuse, after which they are deleted.
6. **Measurement data** — per the retention of our measurement provider, and not linked by us to any identifier.

When a retention period ends we delete the data, or irreversibly anonymise it where it is needed in aggregate form.`,
  },
  {
    id: "cookies",
    heading: "Cookies and measurement",
    body: `We use a small number of cookies and similar technologies. Measurement is **off by default**: if you have not answered the cookie notice, no measurement script is loaded.

1. **Essential** — keeping you signed in and remembering a choice such as your language or your cookie preferences. These cannot be turned off without breaking the site.
2. **Measurement** — anonymous counting of page visits and interaction events. Loaded only if you allow it. No names, email addresses or telephone numbers are sent. Withdrawing consent stops it and drops the cookie.
3. **Advertising measurement** — separate from the above and off unless you turn it on. We turn it on only for measuring the performance of our own advertising.

You can change or withdraw your choices at any time using the cookie settings control in the site footer, and you can also delete or block cookies through your browser.`,
  },
  {
    id: "rights",
    heading: "Your rights",
    body: `You have the right to:

1. **Know** whether we hold personal data about you, and to receive a copy of it;
2. **Correct** data that is inaccurate or incomplete;
3. **Delete** data where we no longer have a reason to keep it;
4. **Restrict or object** to processing, including objecting to measurement or any processing based on our legitimate interests;
5. **Withdraw consent** at any time, where processing relies on consent, without affecting processing that already happened;
6. **Portability** — receive the data you gave us in a structured, commonly used form;
7. **Complain** to the competent data protection authority in Cameroon.

To exercise any of these, email ${CONTACT_EMAIL}. We will respond within 30 days. A request that concerns an account must come from an authorised holder of that account, so we may ask you to prove your identity first.`,
  },
  {
    id: "security",
    heading: "How we protect it",
    body: `Accounts are authenticated and passwords are hashed by our authentication provider. Access to stored data is restricted by role, and database row-level security rules decide which rows each role may read or write. Administrative areas require a signed-in account with the appropriate role, and administrative actions are recorded in an audit log.

Data is transmitted over HTTPS. We keep the number of people with access to customer data to those who need it for their work. No system is perfectly secure, but if a breach occurs that is likely to put you at risk, we will tell you and the competent authority as required by law.`,
  },
  {
    id: "children",
    heading: "Children",
    body: `This site and its store are intended for adults acting for themselves or for a business. We do not knowingly collect personal data from anyone under 18. If you believe a child has provided us with personal data, contact us at ${CONTACT_EMAIL} and we will delete it.`,
  },
  {
    id: "changes",
    heading: "Changes to this notice",
    body: `We may update this notice as the site or the law changes. The date at the top of the page records when it last changed, and the version published here is the one that applies to your use of the site.`,
  },
];

export const TERMS_DOCUMENT: LegalDocument = {
  title: "Terms of Service",
  description:
    "The terms governing use of the KC Technology Corporation website, our online store orders, account holders and our services.",
  intro:
    "The terms on which we offer this website and the services you can order through it. Written to be read, not to obscure — if anything here is unclear, contact us and we will explain it.",
  updatedAt: LAST_UPDATED,
  updatedAtIso: LAST_UPDATED_ISO,
  sections: TERMS_SECTIONS,
};

export const PRIVACY_DOCUMENT: LegalDocument = {
  title: "Privacy Policy",
  description:
    "What personal data KC Technology Corporation collects through this website, why we collect it, who we share it with, how long we keep it and the choices you have.",
  intro:
    "This notice describes exactly what this website collects, why, and for how long — including the payment and measurement choices you control. The contents buttons below jump straight to the part you need.",
  updatedAt: LAST_UPDATED,
  updatedAtIso: LAST_UPDATED_ISO,
  retentionNote:
    "Our retention periods are stated as internal commitments rather than as figures fixed by law. The business should confirm the accounting retention period with its accountant.",
  sections: PRIVACY_SECTIONS,
};

/**
 * The canonical (English) documents, keyed for the shared renderer.
 */
export const LEGAL_DOCUMENTS: Record<"terms" | "privacy", LegalDocument> = {
  terms: TERMS_DOCUMENT,
  privacy: PRIVACY_DOCUMENT,
};

/**
 * Resolve a document for a locale.
 *
 * French is authored as a complete parallel document in `legal.fr.ts` rather than
 * as a per-field overlay, because a legal text is only sound as a whole: a French
 * page with English clauses interspersed would misstate the terms. Each locale
 * therefore renders one coherent document, and this function selects between two
 * complete ones rather than merging them.
 */
export function legalDocumentFor(
  key: "terms" | "privacy",
  locale: Locale,
): LegalDocument {
  return locale === "fr" ? LEGAL_FR[key] : LEGAL_DOCUMENTS[key];
}
