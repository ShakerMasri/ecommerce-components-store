"use client";

import Link from "next/link";
import { LegalBusinessDetails } from "~/components/legal/LegalBusinessDetails";
import { LegalPage } from "~/components/legal/LegalPage";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import type { LegalPageKey } from "~/lib/translations";
import { contactConfig } from "~/config/contact";

type LegalPolicyClientProps = {
  pageKey: LegalPageKey;
};

export function LegalPolicyClient({ pageKey }: LegalPolicyClientProps) {
  const { language, t } = useAppPreferences();
  const page = t.legal.pages[pageKey];

  return (
    <LegalPage
      badge={t.legal.common.policyBadge}
      title={page.title}
      description={page.description}
      lastUpdatedLabel={t.legal.common.lastUpdatedLabel}
      lastUpdatedDate={t.legal.common.lastUpdatedDate}
    >
      {pageKey === "terms" || pageKey === "contact" ? (
        <LegalBusinessDetails locale={language} />
      ) : null}

      <nav aria-label={t.footer.contactTitle} className="flex flex-wrap gap-4">
        <a
          href={contactConfig.whatsapp.href}
          className="inline-flex min-h-11 items-center gap-2 underline"
        >
          {t.footer.whatsapp}:{" "}
          <bdi dir="ltr">{contactConfig.whatsapp.display}</bdi>
        </a>
        {pageKey !== "returns" ? (
          <>
            <a
              href={contactConfig.phone.href}
              className="inline-flex min-h-11 items-center gap-2 underline"
            >
              {t.footer.phone}:{" "}
              <bdi dir="ltr">{contactConfig.phone.display}</bdi>
            </a>
            <a
              href={contactConfig.email.href}
              className="inline-flex min-h-11 items-center gap-2 underline"
            >
              {t.footer.email}:{" "}
              <bdi dir="ltr">{contactConfig.email.address}</bdi>
            </a>
          </>
        ) : null}
      </nav>

      {page.sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-bold text-[var(--ink)]">
            {section.title}
          </h2>

          <div className="mt-3 space-y-3">
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            {section.items ? (
              <ul className="list-disc space-y-2 ps-6">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            {section.links ? (
              <div className="flex flex-wrap gap-3">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}

      {pageKey === "contact" ? (
        <section>
          <h2 className="text-xl font-bold text-[var(--ink)]">
            {t.legal.common.usefulLinks}
          </h2>

          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
              href="/terms"
            >
              {t.legal.common.footerLinks.terms}
            </Link>
            <Link
              className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
              href="/privacy"
            >
              {t.legal.common.footerLinks.privacy}
            </Link>
            <Link
              className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
              href="/shipping"
            >
              {t.legal.common.footerLinks.shipping}
            </Link>
            <Link
              className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
              href="/returns"
            >
              {t.legal.common.footerLinks.returns}
            </Link>
          </div>
        </section>
      ) : null}
    </LegalPage>
  );
}
