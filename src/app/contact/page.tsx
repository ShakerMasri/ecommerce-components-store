import type { Metadata } from "next";
import { LegalPolicyClient } from "~/components/legal/LegalPolicyClient";
import { contactConfig } from "~/config/contact";
import { storeConfig } from "~/config/store";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: `Contact | ${storeConfig.name}`,
  description: contactConfig.contactPage.description.en,
};

export default function ContactPage() {
  return <LegalPolicyClient pageKey="contact" />;
}
