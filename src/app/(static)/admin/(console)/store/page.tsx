import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { isElevatedRole } from "@/lib/auth/roles";
import { getAuthState } from "@/lib/auth/session";
import { createTranslator } from "@/lib/i18n/translator";
import { loadProductRecords } from "@/lib/store/loaders";
import { availabilityLabelKey, formatPrice } from "@/lib/store/types";
import type { ProductRecord } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/**
 * Admin: the store catalogue.
 *
 * The nav model has always linked `/admin/store` here, and until this page existed
 * that link 404'd. It is the index the editor needs to reach a product's detail
 * view, so it lists the canonical records rather than the localized ones — the
 * catalogue is edited in the source language and localized afterwards.
 *
 * The "newest first" ordering is deliberate: a product just created through
 * `/admin/store/new` is a draft at the top of the list, which is where the editor
 * looks for it.
 */
export default async function AdminStorePage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Fstore");
  }
  if (!state.profile || !isElevatedRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const products = [...(await loadProductRecords())].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );

  return (
    <>
      <PageIntro
        eyebrow={t("admin.store.catalogueHeading")}
        heading={t("admin.store.catalogueHeading")}
        intro={t("admin.store.catalogueIntro")}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/store/new" variant="primary">
          {t("admin.store.addProduct")}
        </ButtonLink>
      </div>

      <div className="mt-8">
        {products.length === 0 ? (
          <Notice tone="info" title={t("admin.store.catalogueHeading")}>
            <p>{t("admin.store.noProducts")}</p>
          </Notice>
        ) : (
          <DataTable<ProductRecord>
            caption={t("admin.store.catalogueHeading")}
            columns={[
              {
                key: "title",
                header: t("admin.store.columnName"),
                render: (row) => row.title,
              },
              {
                key: "sku",
                header: t("admin.store.columnSku"),
                render: (row) => <span className="font-mono">{row.sku}</span>,
              },
              {
                key: "category",
                header: t("admin.store.columnCategory"),
                render: (row) => row.categorySlug,
              },
              {
                key: "price",
                header: t("admin.store.columnPrice"),
                align: "end",
                render: (row) => formatPrice(row.priceMinor, row.currency, "en"),
              },
              {
                key: "stock",
                header: t("admin.store.columnStock"),
                align: "end",
                render: (row) => row.stock,
              },
              {
                key: "status",
                header: t("admin.store.columnStatus"),
                render: (row) => (
                  <Badge tone={row.publishedAt ? "success" : "neutral"}>
                    {row.publishedAt
                      ? t("admin.store.statusPublished")
                      : t("admin.store.statusDraft")}
                  </Badge>
                ),
              },
              {
                key: "availability",
                header: t("admin.store.columnAvailability"),
                render: (row) => t(availabilityLabelKey(row.availability)),
              },
            ]}
            rows={products}
            getRowKey={(row) => row.id}
            emptyMessage={t("admin.store.noProducts")}
            rowHeaderKey="title"
            scrollLabel={t("admin.store.catalogueHeading")}
          />
        )}
      </div>
    </>
  );
}
