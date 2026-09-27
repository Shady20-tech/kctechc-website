import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Super-admin: a plain account of the console's security controls.
 *
 * This page states how each control is enforced rather than offering switches. It
 * exists so an administrator reviewing the system does not have to read the schema
 * to answer "is this protected?", and it names the mechanism (a policy, a
 * byte-level type check, an audit write) because a claim about security that does
 * not say where it lives cannot be verified.
 */
export default async function AdminSecurityPage() {
  await requireRole(["super_admin"], "/admin/security");
  const t = createTranslator("en").t;

  const sections = [
    { heading: t("adminSecurity.authHeading"), body: t("adminSecurity.authBody") },
    { heading: t("adminSecurity.rlsHeading"), body: t("adminSecurity.rlsBody") },
    { heading: t("adminSecurity.uploadsHeading"), body: t("adminSecurity.uploadsBody") },
    { heading: t("adminSecurity.auditHeading"), body: t("adminSecurity.auditBody") },
  ];

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.security")}
        heading={t("adminSecurity.heading")}
        intro={t("adminSecurity.intro")}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <Card as="section" key={section.heading}>
            <h2 className="text-lg font-semibold text-ink-900">{section.heading}</h2>
            <p className="mt-2 text-sm text-body">{section.body}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
