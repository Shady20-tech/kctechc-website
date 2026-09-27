import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { STORE_PATH } from "@/lib/config/navigation";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { getOrderForOwner, listOrdersForCustomer } from "@/lib/orders/queries";
import { readOrderTokens } from "@/lib/orders/tokens";
import type { OrderStatus, OrderSummary } from "@/lib/orders/types";
import { formatPrice } from "@/lib/store/types";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Order history.
 *
 * Two sources, merged: the orders attached to a signed-in account, and the guest
 * orders whose tokens this browser still holds. The guest set is resolved by
 * loading each remembered order through `getOrderForOwner`, which checks the
 * token — so a reference injected into the cookie by hand returns nothing.
 *
 * Guests are told plainly that these orders live in this browser only. A visitor
 * who clears their cookies loses the list, and a note before that happens is
 * better than a support ticket after.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `${STORE_PATH}/orders`,
    title: t("order.historyHeading"),
    description: t("order.historyIntro"),
    noindex: true,
  });
}

export default async function OrderHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const authState = await getAuthState();
  const customerId = authState.status === "authenticated" ? authState.userId : null;

  const accountOrders = customerId ? await listOrdersForCustomer(customerId) : [];

  // Guest orders: each remembered token is checked against the order it claims to
  // authorize. `allSettled` rather than `all` so one stale reference cannot fail
  // the whole page.
  const guestTokens = await readOrderTokens();
  const guestResults = await Promise.allSettled(
    guestTokens.map(async (entry): Promise<OrderSummary | null> => {
      const order = await getOrderForOwner({
        reference: entry.reference,
        customerId: null,
        accessToken: entry.token,
      });
      if (!order) return null;
      return {
        ...order,
        itemCount: order.lines.reduce((total, line) => total + line.quantity, 0),
      };
    }),
  );

  const guestOrders = guestResults.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );

  // A signed-in customer's account orders take precedence: the same order may
  // appear in both sets once it has been linked to the account.
  const seen = new Set(accountOrders.map((order) => order.reference));
  const merged = [
    ...accountOrders,
    ...guestOrders.filter((order) => !seen.has(order.reference)),
  ].sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${STORE_PATH}` },
    {
      name: t("order.historyHeading"),
      href: `/${resolved}${STORE_PATH}/orders`,
    },
  ];

  return (
    <SectionBand
      labelledBy="orders-heading"
      {...departmentScopeProps("digital-marketing")}
    >
      <Breadcrumbs items={breadcrumbs} ariaLabel={t("a11y.breadcrumb")} className="mb-8" />
      <PageIntro heading={t("order.historyHeading")} intro={t("order.historyIntro")} />
      <h2 id="orders-heading" className="visually-hidden">
        {t("order.historyHeading")}
      </h2>

      {merged.length === 0 ? (
        <div className="mt-10 max-w-2xl">
          <h3 className="text-xl font-semibold text-ink-900">
            {t("order.historyEmpty")}
          </h3>
          <p className="mt-6">
            <ButtonLink href={`/${resolved}${STORE_PATH}`} variant="secondary">
              {t("order.historyEmptyCta")}
            </ButtonLink>
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {!customerId && guestOrders.length > 0 ? (
            <Alert tone="info" title={t("order.guestNoticeHeading")}>
              {t("order.guestNoticeBody")}
            </Alert>
          ) : null}

          <ul className="space-y-4">
            {merged.map((order) => (
              <li
                key={order.reference}
                className="rounded-card border border-border-strong p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm text-ink-900">
                      {order.reference}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {t("order.placedOn", {
                        date: formatDate(order.placedAt, resolved),
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={statusTone(order.status)}>
                      {t(`orderStatus.${order.status}`)}
                    </Badge>
                    <p className="mt-2 font-display text-lg font-bold text-ink-900">
                      {formatPrice(order.totalMinor, order.currency, resolved)}
                    </p>
                    <p className="text-sm text-muted">
                      {order.itemCount === 1
                        ? t("order.historyItemCountOne")
                        : t("order.historyItemCount", { count: order.itemCount })}
                    </p>
                  </div>
                </div>
                <p className="mt-3">
                  <Link
                    href={`/${resolved}${STORE_PATH}/orders/${encodeURIComponent(order.reference)}`}
                    className="text-sm font-medium text-dept-accent underline"
                  >
                    {t("order.viewOrder")}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionBand>
  );
}

function statusTone(status: OrderStatus): "success" | "info" | "warning" | "danger" {
  switch (status) {
    case "paid":
    case "processing":
    case "fulfilled":
      return "success";
    case "pending_payment":
      return "warning";
    case "cancelled":
    case "refunded":
      return "danger";
    default:
      return "info";
  }
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CM" : "en-GB", {
    dateStyle: "long",
  }).format(new Date(iso));
}
