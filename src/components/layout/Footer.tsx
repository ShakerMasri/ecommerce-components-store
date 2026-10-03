"use client";

import Link from "next/link";
import Image from "next/image";
import { LegalBusinessDetails } from "~/components/legal/LegalBusinessDetails";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { contactConfig, type ContactSocialIconName } from "~/config/contact";

const socialIconPaths: Record<ContactSocialIconName, string> = {
  instagram:
    "M7.8 2.4h8.4c2.982 0 5.4 2.418 5.4 5.4v8.4c0 2.982-2.418 5.4-5.4 5.4H7.8c-2.982 0-5.4-2.418-5.4-5.4V7.8c0-2.982 2.418-5.4 5.4-5.4m0-2.4C3.492 0 0 3.492 0 7.8v8.4C0 20.508 3.492 24 7.8 24h8.4c4.308 0 7.8-3.492 7.8-7.8V7.8C24 3.492 20.508 0 16.2 0zm4.2 5.837a6.163 6.163 0 1 0 0 12.326 6.163 6.163 0 0 0 0-12.326m0 10.162a4 4 0 1 1 0-7.999 4 4 0 0 1 0 7.999m6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881",
  whatsapp:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.946L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413",
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.76 0 2.072.15 2.608.298v3.325c-.283-.03-.775-.045-1.386-.045-1.967 0-2.728.745-2.728 2.683v1.297h3.92l-.673 3.667h-3.247v7.98z",
};

function SocialIcon({ icon }: { icon: ContactSocialIconName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d={socialIconPaths[icon]} />
    </svg>
  );
}

export function Footer() {
  const { language, t } = useAppPreferences();
  const onlineStoreCta = contactConfig.footer.onlineStoreCta;

  const legalLinks = [
    { href: "/terms", label: t.legal.common.footerLinks.terms },
    { href: "/privacy", label: t.legal.common.footerLinks.privacy },
    { href: "/shipping", label: t.legal.common.footerLinks.shipping },
    { href: "/returns", label: t.legal.common.footerLinks.returns },
    { href: "/contact", label: t.legal.common.footerLinks.contact },
  ];

  const contactLinks = [
    {
      href: contactConfig.phone.href,
      label: t.footer.phone,
      value: contactConfig.phone.display,
      external: false,
    },
    {
      href: contactConfig.email.href,
      label: t.footer.email,
      value: contactConfig.email.address,
      external: false,
    },
  ];

  return (
    <footer className="mt-12 border-t border-[var(--footer-line)] bg-[var(--footer-surface)] text-[var(--footer-ink)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-12">
        <div>
          <p className="text-lg font-bold text-[var(--footer-ink)]">
            <Link href="/" aria-label="DaraKit home" className="block w-fit">
              <Image
                src="/darakit-logo.svg"
                alt="DaraKit home"
                width={1536}
                height={269}
                className="h-7 w-[4.5rem] object-contain"
              />
            </Link>
          </p>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--footer-muted)]">
            © {new Date().getFullYear()} {t.footer.rights}{" "}
            {t.footer.description}
          </p>
        </div>

        {contactConfig.footer.showContactSummary ? (
          <div className="lg:text-end">
            <p className="text-sm font-semibold text-[var(--footer-accent)]">
              {t.footer.contactTitle}
            </p>

            <ul className="mt-3 space-y-1 text-sm">
              {contactLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-1 rounded-md py-2 text-[var(--footer-muted)] transition hover:text-[var(--footer-ink)]"
                  >
                    <span>{link.label}:</span>{" "}
                    <bdi dir="ltr" className="break-all">
                      {link.value}
                    </bdi>
                  </a>
                </li>
              ))}
            </ul>

            {contactConfig.socialLinks.length > 0 ? (
              <ul
                aria-label={t.footer.socialLinks}
                className="mt-4 flex flex-wrap gap-3 lg:justify-end"
              >
                {contactConfig.socialLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${t.footer.openSocialLink} ${link.label}`}
                      title={link.label}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--footer-line)] text-[var(--footer-muted)] transition hover:border-[var(--footer-accent)] hover:text-[var(--footer-ink)] focus-visible:text-[var(--footer-ink)]"
                    >
                      <SocialIcon icon={link.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <LegalBusinessDetails locale={language} variant="footer" />

        {onlineStoreCta.enabled ? (
          <section
            aria-labelledby="footer-online-store-cta-title"
            className="rounded-3xl border border-[var(--footer-line)] bg-white/5 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 lg:col-span-2"
          >
            <div>
              <p
                id="footer-online-store-cta-title"
                className="text-sm font-semibold tracking-[0.2em] text-[var(--footer-accent)] uppercase"
              >
                {t.footer.onlineStoreCtaTitle}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--footer-muted)]">
                {t.footer.onlineStoreCtaDescription}
              </p>
            </div>

            <a
              href={contactConfig.whatsapp.href}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--footer-accent)] px-5 py-3 text-sm font-semibold text-[var(--footer-ink)] transition hover:bg-[var(--footer-accent)] hover:text-[var(--footer-surface)] sm:mt-0"
            >
              <SocialIcon icon="whatsapp" />
              <span>{t.footer.onlineStoreCtaAction}</span>
              <span className="sr-only">{contactConfig.whatsapp.display}</span>
            </a>
          </section>
        ) : null}
      </div>

      <div className="border-t border-[var(--footer-line)]">
        <nav
          aria-label={t.footer.legalLinksLabel}
          className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-1 px-4 py-4 text-sm font-medium text-[var(--footer-muted)] sm:flex sm:flex-wrap sm:gap-x-6 sm:px-6 lg:px-8"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-md py-2 transition hover:text-[var(--footer-ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
