import type { Metadata } from "next";
import { LegalPolicyClient } from "~/components/legal/LegalPolicyClient";
import { policyConfig } from "~/config/policies";
import { storeConfig } from "~/config/store";

export const metadata: Metadata = {
  alternates: { canonical: "/shipping" },
  title: `${policyConfig.locales.en.pages.shipping.title} | ${storeConfig.name}`,
  description: policyConfig.locales.en.pages.shipping.description,
};

export default function ShippingPage() {
  return <LegalPolicyClient pageKey="shipping" />;
}
