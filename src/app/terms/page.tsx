import type { Metadata } from "next";
import { LegalPolicyClient } from "~/components/legal/LegalPolicyClient";
import { policyConfig } from "~/config/policies";
import { storeConfig } from "~/config/store";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: `${policyConfig.locales.en.pages.terms.title} | ${storeConfig.name}`,
  description: policyConfig.locales.en.pages.terms.description,
};

export default function TermsPage() {
  return <LegalPolicyClient pageKey="terms" />;
}
