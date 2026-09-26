import type { ServiceRecord } from "./types";

/**
 * Bundled Digital Marketing service content.
 *
 * These are the nine service areas the business brief names for the Digital
 * Marketing department. The canonical (English) text is authored here; French is
 * authored as an overlay, exactly as a Supabase translation row would supply it,
 * so both sources flow through `resolveLocalized` unchanged.
 *
 * Content rule for this file: it describes what each discipline is and how work
 * is scoped. It makes no claim about KC Technology Corporation that the brief
 * does not support — no client counts, years of trading, prices, certifications,
 * guarantees, team size or named clients. Anything of that kind belongs in the
 * CMS once the business supplies it, and would be false here.
 *
 * Local context is limited to verified national facts (Cameroon's bilingual
 * market, the XAF currency, nationwide coverage) rather than invented
 * market statistics.
 */

export const DEFAULT_SERVICES: readonly ServiceRecord[] = [
  {
    slug: "social-media-marketing",
    department: "digital-marketing",
    title: "Social Media Marketing",
    summary:
      "Planning, publishing and managing a business presence on social platforms, with a content calendar and reporting you can act on.",
    description:
      "Social media marketing covers the ongoing work of representing a business on social platforms: deciding what to publish, publishing it consistently, responding to messages, and measuring what the activity produces. It is a recurring commitment rather than a one-off task, because an account that goes quiet loses the reach it built.\n\nWe start by agreeing who the audience is and what the account is for — enquiries, sales, recruitment or credibility. From there we build a content calendar, produce the posts, and manage the day-to-day publishing and replies. Cameroon's market is bilingual, so English and French audiences can be served from the same brand with content planned for each rather than one translated literally into the other.\n\nThe work is measured against the objectives set at the start. Reporting shows what was published, how it performed and what changes next month, so the account is managed against a plan instead of posting for its own sake.",
    features: [
      "Channel strategy: which platforms are worth the effort, and which to skip",
      "A content calendar agreed in advance, so publishing is predictable",
      "Post production: copy, image and short-form video assets",
      "Community management: replies to comments and direct messages",
      "Paid promotion of selected posts where organic reach is not enough",
      "Monthly reporting against the agreed objectives",
    ],
    faqs: [
      {
        question: "Which social platforms do you manage?",
        answer:
          "The platforms are chosen from your audience rather than from a fixed list. Facebook and Instagram carry most consumer reach in Cameroon, LinkedIn suits business-to-business work, and TikTok is worth considering where the audience is younger. We recommend a set at the start and explain why each one is or is not included.",
      },
      {
        question: "How often should a business post?",
        answer:
          "Consistency matters more than volume. A sustainable schedule you can maintain for a year beats a burst of daily posts followed by silence. We agree a frequency you can support with the material available, then adjust once there is data on what performs.",
      },
      {
        question: "Can you work in both English and French?",
        answer:
          "Yes. Cameroon's market is bilingual and we plan content for English and French audiences deliberately, rather than translating one audience's posts word for word into the other.",
      },
    ],
    deliveryNotes:
      "Delivered remotely with scheduled check-ins, which keeps the work continuous without requiring you to be available for every post. Where a shoot is needed, it is arranged in advance and the resulting assets are reused across channels.",
  },
  {
    slug: "website-design-development",
    department: "digital-marketing",
    title: "Website Design & Development",
    summary:
      "Design and build of business websites that load quickly, work on a phone, and can be found and updated.",
    description:
      "A business website has to do three things: load quickly on the phones most visitors are using, be clear about what the business does, and be maintainable after launch. Design that ignores the third point becomes a site nobody can update without calling a developer.\n\nWe design and build sites on modern foundations — server-rendered pages, responsive layouts and structured metadata — so the content is available to search engines in the first response rather than assembled by a script afterwards. That choice affects how the site is found as much as how it looks.\n\nBefore launch we agree who will update the content and how. Where the answer is 'the business, without a developer', the site is built so that routine changes — text, images, prices, opening hours — can be made through an editing interface rather than through code.",
    features: [
      "Responsive design that is built for mobile first, not adapted to it",
      "Server-rendered pages, so content is visible to search engines immediately",
      "Content management for text, images and routine updates",
      "Contact and enquiry forms connected to a real inbox, with spam controls",
      "Structured data and metadata for search and social sharing",
      "Accessibility work: keyboard navigation, contrast and labelled form fields",
    ],
    faqs: [
      {
        question: "How long does a website take to build?",
        answer:
          "It depends on the number of pages and how quickly content and approvals come back. The schedule is agreed before work starts and broken into stages, so you always know what is being worked on and what is waiting on you.",
      },
      {
        question: "Can I update the website myself after launch?",
        answer:
          "Yes, where that is the arrangement we agreed. Routine content is placed in an editing interface so text and images can be changed without a developer. Structural changes still need development work, and we say which is which before launch.",
      },
      {
        question: "Will the site work on a slow connection?",
        answer:
          "It is built to. Pages are kept light, images are served in modern compressed formats, and the page is rendered on the server so the visitor is not waiting for a script to assemble it. This matters where visitors are on mobile data.",
      },
    ],
    deliveryNotes:
      "Domains, hosting and email are arranged in your name so you keep control of them. You receive the accounts and access details at handover rather than being locked to us for routine changes.",
  },
  {
    slug: "seo",
    department: "digital-marketing",
    title: "SEO",
    summary:
      "Search engine optimisation: making a site findable for the searches its customers actually make, and keeping it that way.",
    description:
      "SEO is the work of making a website appear in search results for the terms its customers use. It is not a single change but a set of related ones: technical foundations, content that answers real questions, and a structure that search engines can read without guessing.\n\nWe start with the technical base, because content improvements are wasted on a site that cannot be crawled or that loads slowly on mobile. That covers page speed, how pages are linked, whether each page has a single clear subject, and whether the site tells search engines which pages exist.\n\nFrom there the work moves to content: what customers actually search for, which of those searches the business can answer credibly, and where the current pages fall short. Because Cameroon's market searches in both English and French, the language split is part of the plan rather than an afterthought — a page written for English speakers does not rank for French queries.",
    features: [
      "Technical audit: crawlability, page speed, mobile behaviour and site structure",
      "Keyword research grounded in the searches your customers make",
      "On-page work: titles, descriptions, headings and internal links",
      "Local search readiness for customers searching within Cameroon",
      "Bilingual planning for English and French queries",
      "Ongoing measurement, so progress is reported rather than asserted",
    ],
    faqs: [
      {
        question: "How long does SEO take to show results?",
        answer:
          "Technical fixes can be picked up within weeks, while content and authority changes typically take months to move rankings. Search engines need time to recrawl and reassess a site. We report what has changed at each stage rather than promising a position by a fixed date, because no honest provider can guarantee a ranking.",
      },
      {
        question: "Do I need SEO if I run ads?",
        answer:
          "They do different jobs. Ads buy visibility while you pay for them and stop when you stop paying; SEO builds visibility you keep. Ads are useful for immediate enquiries, and SEO for lowering the cost of enquiries over time. Many businesses run both.",
      },
      {
        question: "Is SEO different for a Cameroon audience?",
        answer:
          "Partly. Search behaviour, language mix and the proportion of mobile searches differ from other markets. The bilingual split is the main difference: English and French queries need their own pages rather than one page attempting both.",
      },
    ],
    deliveryNotes:
      "Work is prioritised by impact, so the changes most likely to matter are made first rather than as one large batch at the end. Access to your analytics and search console is used for measurement, and you keep ownership of both accounts.",
  },
  {
    slug: "google-online-ads",
    department: "digital-marketing",
    title: "Google / Online Ads",
    summary:
      "Paid search and online advertising: campaigns set up to reach people already looking, with budgets controlled and results reported.",
    description:
      "Online advertising buys visibility while it runs. It is the fastest route to enquiries and the easiest place to waste money, so the work is as much about control as about reach: which searches are worth bidding on, what a click may cost, and how to stop spending on traffic that never converts.\n\nWe set up campaigns around intent. Someone searching for a service they need now is worth more than a broad audience impression, so search campaigns are built from the terms that indicate a real requirement, with negative keywords used to exclude the searches that merely look similar. Budgets are set explicitly, and spend is monitored against results rather than left running unattended.\n\nMeasurement is agreed before launch. That means defining what counts as an enquiry, tracking it, and reporting cost against outcomes instead of only impressions and clicks. Where a campaign is not producing, that is reported plainly rather than buried.",
    features: [
      "Search campaigns built around terms that indicate real intent",
      "Negative keyword work, to stop paying for irrelevant searches",
      "Explicit budgets and spend monitoring, so cost stays predictable",
      "Landing pages that match the promise the ad made",
      "Conversion tracking, so enquiries are counted rather than assumed",
      "Reporting on cost per enquiry, not only clicks and impressions",
    ],
    faqs: [
      {
        question: "How much should I spend on ads?",
        answer:
          "There is no universal figure. It is set from what an enquiry is worth to you and how many you need, then adjusted against actual results once the campaign has run. We agree a starting budget with you and a point at which it will be reviewed, rather than recommending a number without knowing your margins.",
      },
      {
        question: "Do ads work for a local business in Cameroon?",
        answer:
          "Yes. Search advertising can be limited to the areas you actually serve, so a business working in the Southwest Region is not paying to appear nationwide. That geographic control is one of the main reasons to use search ads over broader formats.",
      },
      {
        question: "What happens to the ads if I stop paying?",
        answer:
          "They stop. That is the essential difference between advertising and SEO: ads rent visibility for as long as the budget runs, while SEO work persists. We are clear about which of the two you are buying.",
      },
    ],
    deliveryNotes:
      "Accounts are created in your name and ownership stays with you, so campaign history and audience data remain yours if the working relationship changes. Reporting shows spend alongside results so the cost of each enquiry is visible.",
  },
  {
    slug: "content-branding",
    department: "digital-marketing",
    title: "Content & Branding",
    summary:
      "Writing, brand identity and the messaging that makes a business consistent everywhere it appears.",
    description:
      "Content and branding cover how a business describes itself and how it looks while doing so. The two are handled together because they fail together: distinctive visuals carrying vague messaging, or clear writing wearing an identity that could belong to anyone, both leave the same impression.\n\nWe work on the substance first — what the business actually offers, who it serves, and what makes it the better choice for that customer. That becomes the messaging used across the website, social accounts, proposals and signage. Then the visual identity: type, colour and layout applied consistently so the business is recognisable wherever it appears.\n\nBecause Cameroon's market is bilingual, brand voice is defined for English and French separately. A slogan that works in one language often reads badly translated into the other, so both are written as originals rather than one being converted from the other.",
    features: [
      "Positioning and messaging: what you offer, to whom, and why you",
      "Brand identity: logo use, colour, typography and layout rules",
      "Website and marketing copy written for a defined audience",
      "Bilingual brand voice for English and French audiences",
      "A usage guide so suppliers and staff keep the identity consistent",
      "Templates for routine documents, posts and presentations",
    ],
    faqs: [
      {
        question: "Can you work with a brand identity we already have?",
        answer:
          "Yes. Where an identity exists and works, we apply and document it rather than replacing it. Where something is inconsistent or unusable at small sizes, we say so and propose the smallest change that fixes it.",
      },
      {
        question: "Do we need a full brand identity, or just copywriting?",
        answer:
          "These are separable, and plenty of businesses need only one. If your identity is sound and the messaging is unclear, copywriting alone is the right purchase. We will tell you which applies rather than selling the larger piece of work.",
      },
      {
        question: "Will the French and English versions match?",
        answer:
          "They will be consistent in voice without being literal translations. Each language is written for its own audience, sharing the same positioning and the same facts.",
      },
    ],
    deliveryNotes:
      "Deliverables include the editable source files and the usage rules, so the identity can be applied by other suppliers without returning to us. Ownership of the finished brand assets transfers to you.",
  },
  {
    slug: "ecommerce-store-development",
    department: "digital-marketing",
    title: "E-commerce Store Development",
    summary:
      "Online stores: catalogue, cart, checkout and payment, built so stock and orders stay accurate.",
    description:
      "An online store is a website with obligations a brochure site does not have. It has to hold accurate stock, take payment reliably, and survive the awkward cases: a payment that fails after the order is placed, a customer who wants to return an item, or an order that must be corrected before dispatch.\n\nThe build covers the catalogue, the cart and checkout, and the connection to a payment provider. The details that decide whether a store is usable are less visible: how a product variant is chosen, what happens when a payment is declined, whether delivery costs are clear before the final step, and how the shop owner sees and processes an order.\n\nPayment handling is done through an established provider rather than by storing card details ourselves. Prices are shown in XAF with clear delivery terms, because an unclear final cost is one of the most common reasons an online purchase is abandoned.",
    features: [
      "Product catalogue with variants, stock levels and categories",
      "Cart and checkout designed to reduce abandoned purchases",
      "Payment through an established provider, with no card details stored",
      "Order management so you can see, process and correct orders",
      "Clear delivery costs and terms shown before the final step",
      "Localized storefront for English and French customers",
    ],
    faqs: [
      {
        question: "Which payment methods can an online store accept?",
        answer:
          "It depends on the provider and on what your customers use. Card payments are standard, and mobile money is widely used in Cameroon, so a provider supporting both is usually the practical choice. The specific methods are confirmed against a live provider account rather than assumed.",
      },
      {
        question: "How do I handle delivery?",
        answer:
          "Delivery options and charges are configured to match how you actually deliver — flat rate, by zone, or collected in person. They are shown to the customer before payment so the final cost is never a surprise.",
      },
      {
        question: "Can I manage stock and orders myself?",
        answer:
          "Yes. The store is built so the owner can add products, adjust stock and process orders without a developer. Training on the interface is part of handover.",
      },
    ],
    deliveryNotes:
      "The store is built so payment credentials stay in your provider account and are never handled by us. Launch is staged: a test transaction is run end to end before the store goes live to customers.",
  },
  {
    slug: "training-consulting",
    department: "digital-marketing",
    title: "Training & Consulting",
    summary:
      "Practical training and advisory work so your own team can run digital activity confidently.",
    description:
      "Training and consulting are for businesses that intend to run their own digital work rather than outsource all of it. The aim is capability: your team able to publish, measure and improve without needing to ask permission or wait on an agency.\n\nTraining is practical and built around your actual tools and accounts, not generic slides. Sessions work on the real social accounts, the real website and the real reports, so what is learned applies the same afternoon. Where a team is split across roles, the training is split to match — what a manager needs to read from a report is not what the person publishing needs to do.\n\nConsulting is the advisory side: reviewing what you already do, identifying what is worth keeping and what is costing effort without returning anything, and agreeing a plan. Where the honest answer is that a planned activity is not worth the investment, we say so.",
    features: [
      "Hands-on training on your own accounts and tools, not generic examples",
      "Role-specific sessions for managers and for the people doing the work",
      "Content and publishing workflows your team can maintain",
      "Analytics training: reading reports and deciding what to change",
      "Audits of existing digital activity, with what to keep and what to stop",
      "A written plan with priorities and responsibilities",
    ],
    faqs: [
      {
        question: "Do you train on tools we already use?",
        answer:
          "Yes. Training is built around the accounts and tools you actually work with, so the session is directly applicable. Where a current tool is the wrong fit, that is raised separately as a recommendation rather than taught as though it were sound.",
      },
      {
        question: "How many people can attend a session?",
        answer:
          "Sessions work best in small groups so everyone can follow on their own screen. Where a team is larger, it is run as several sessions grouped by role rather than one large presentation.",
      },
      {
        question: "Is training delivered in English or French?",
        answer:
          "Either, or both where a team is mixed. Materials are provided in the language the session is delivered in.",
      },
    ],
    deliveryNotes:
      "Sessions are delivered on your premises or remotely, and include reference material the team keeps. Follow-up is available after the training so questions that arise in real use can be answered rather than left.",
  },
  {
    slug: "influencer-affiliate-marketing",
    department: "digital-marketing",
    title: "Influencer / Affiliate Marketing",
    summary:
      "Working with creators and partners to reach audiences you do not already have, with disclosure and measurement handled properly.",
    description:
      "Influencer and affiliate marketing reach customers through people they already follow or trust. The work is largely selection and management: finding partners whose audience genuinely overlaps yours, agreeing what they will do, and measuring whether it produced anything.\n\nFollower counts are a poor guide on their own. A partner with a smaller, closely matched audience usually outperforms a larger, mismatched one, so selection looks at who the audience is and how they engage rather than at the headline number. The arrangement — what is delivered, when, and what it costs — is agreed in writing before anything is published.\n\nDisclosure is handled properly. Paid promotion must be identifiable as such, which protects the audience and the business alike, and the terms are agreed with the partner rather than left to them. Affiliate arrangements are tracked so commissions are paid on genuine referred sales rather than estimated.",
    features: [
      "Partner selection based on audience fit, not follower count alone",
      "Written agreements covering deliverables, timing and cost",
      "Clear disclosure of paid promotion, as required by platform rules",
      "Affiliate tracking so commission is paid on verified referrals",
      "Campaign briefs that give the partner something specific to work with",
      "Reporting on enquiries and sales, not only reach",
    ],
    faqs: [
      {
        question: "How do you choose an influencer to work with?",
        answer:
          "By audience fit first. We look at who follows them, where they are, and how they engage, then compare that with your actual customers. A smaller audience that matches your market is usually worth more than a large one that does not.",
      },
      {
        question: "What is the difference between influencer and affiliate marketing?",
        answer:
          "Influencers are usually paid for a defined piece of content, while affiliates are paid a commission on sales they refer. The first buys reach and credibility, the second pays only for results. Which suits you depends on whether you need awareness or direct sales.",
      },
      {
        question: "Does paid promotion have to be disclosed?",
        answer:
          "Yes. Platform rules and advertising standards require paid partnerships to be identifiable as advertising. We agree the disclosure with the partner in advance so it is clear to the audience.",
      },
    ],
    deliveryNotes:
      "Partners are briefed in writing, and content is reviewed against the agreed brief before publication. Where a partner's audience is French-speaking, the brief and disclosure are prepared in French.",
  },
  {
    slug: "online-business-setup-automation",
    department: "digital-marketing",
    title: "Online Business Setup & Automation",
    summary:
      "Getting a business online properly and automating the repetitive work: accounts, tools and the processes that connect them.",
    description:
      "Setting a business up online is mostly a sequence of small decisions that are expensive to change later: which domain and hosting, which email addresses, which accounts, and who holds the credentials. Made carelessly, they leave a business dependent on whoever set them up. Made deliberately, the business owns its own infrastructure from the start.\n\nThe second part is automation — removing repetitive manual work. That covers the routine: an enquiry form that files itself and notifies the right person, an invoice that is generated rather than typed, a booking that confirms itself, a report that arrives without anyone compiling it. Each one is small; together they return hours every week.\n\nAutomation is applied where it is genuinely reliable. A process that breaks silently is worse than a manual one, so anything automated is monitored and has a defined fallback for when it fails.",
    features: [
      "Domain, hosting and business email set up in your name, with you holding the accounts",
      "Business accounts configured with access control and two-factor authentication",
      "Enquiry handling: forms that file, tag and notify automatically",
      "Automated quotations, invoices and booking confirmations",
      "Scheduled reporting delivered without manual compilation",
      "Documentation of what was set up and how to run it",
    ],
    faqs: [
      {
        question: "Who owns the accounts you set up?",
        answer:
          "You do. Domains, hosting, email and business accounts are registered in your name and the credentials are handed to you. This matters because a business that does not control its own domain and email is dependent on whoever does.",
      },
      {
        question: "What can realistically be automated?",
        answer:
          "Repetitive, rule-based tasks: routing enquiries, generating standard documents, sending confirmations and compiling reports. Work requiring judgement is not automated. Each candidate process is assessed on how reliable the automation would be before it is built.",
      },
      {
        question: "What happens if an automated process fails?",
        answer:
          "It is monitored, and each one has a defined fallback so work is not lost silently. A failing automation that nobody notices is worse than doing the task manually, so this is designed in from the start.",
      },
    ],
    deliveryNotes:
      "Handover includes written documentation of the accounts, the automations and how to change them, so the business is not dependent on us to make routine adjustments.",
  },
];
