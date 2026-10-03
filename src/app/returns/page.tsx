import type { Metadata } from "next";
import { LegalPolicyClient } from "~/components/legal/LegalPolicyClient";
import { policyConfig } from "~/config/policies";
import { storeConfig } from "~/config/store";

export const metadata: Metadata = {
  alternates: { canonical: "/returns" },
  title: `${policyConfig.locales.en.pages.returns.title} | ${storeConfig.name}`,
  description: policyConfig.locales.en.pages.returns.description,
};

export default function ReturnsPage() {
  return <LegalPolicyClient pageKey="returns" />;
}
