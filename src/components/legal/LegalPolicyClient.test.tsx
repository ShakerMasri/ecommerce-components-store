import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LegalPolicyClient } from "./LegalPolicyClient";
import { Footer } from "~/components/layout/Footer";
import { WhatsappSupportShortcut } from "~/components/layout/WhatsappSupportShortcut";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { contactConfig } from "~/config/contact";
import { translations } from "~/lib/translations";

vi.mock("next/navigation", () => ({ usePathname: () => "/contact" }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe.each(["en", "ar"] as const)("public contacts in %s", (language) => {
  it("keeps confirmed links visible with an incomplete legal profile and keyboard access", async () => {
    localStorage.setItem("language", language);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    render(
      <AppPreferencesProvider>
        <LegalPolicyClient pageKey="contact" />
        <Footer />
        <WhatsappSupportShortcut />
      </AppPreferencesProvider>,
    );
    const nav = screen.getByRole("navigation", {
      name: translations[language].footer.contactTitle,
    });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://wa.me/972599355107",
      "tel:+972599355107",
      "mailto:support@darakit.com",
    ]);
    expect(document.documentElement.dir).toBe(
      language === "ar" ? "rtl" : "ltr",
    );
    expect(links[1]?.querySelector("bdi")).toHaveAttribute("dir", "ltr");
    expect(links[1]).toHaveTextContent("+972599355107");
    await userEvent.tab();
    expect(links[0]).toHaveFocus();
    await userEvent.tab();
    expect(links[1]).toHaveFocus();
    for (const social of contactConfig.socialLinks) {
      expect(
        screen.getByRole("link", {
          name: `${translations[language].footer.openSocialLink} ${social.label}`,
        }),
      ).toHaveAttribute("href", social.href);
    }
    expect(
      screen.getByTestId("whatsapp-support-shortcut").getAttribute("href"),
    ).toMatch(/^https:\/\/wa.me\/972599355107\?text=/);
    expect(
      screen.queryByText("Legal business information"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("بيانات المتجر القانونية"),
    ).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(
      /support@example|970000000000|google.com\/maps/,
    );
  });

  it.each(["terms", "privacy", "shipping", "returns"] as const)(
    "provides the shared WhatsApp contact on %s",
    (pageKey) => {
      localStorage.setItem("language", language);
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      render(
        <AppPreferencesProvider>
          <LegalPolicyClient pageKey={pageKey} />
        </AppPreferencesProvider>,
      );
      const nav = screen.getByRole("navigation", {
        name: translations[language].footer.contactTitle,
      });
      expect(within(nav).getAllByRole("link")[0]).toHaveAttribute(
        "href",
        "https://wa.me/972599355107",
      );
      if (pageKey === "shipping") {
        expect(
          screen.getByText(
            language === "en"
              ? "Jerusalem: 35 NIS. Excludes West Jerusalem, Ein Rafa, Ein Naqouba and Abu Ghosh. Select their separate delivery area."
              : "القدس: 35 شيكل. باستثناء غرب القدس وعين رافا وعين نقوبا وأبو غوش. اختر منطقة التوصيل المنفصلة الخاصة بها.",
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            language === "en"
              ? "West Jerusalem, Ein Rafa, Ein Naqouba, Abu Ghosh: 50 NIS. These locations have a separate rate from general Jerusalem delivery."
              : "غرب القدس، عين رافا، عين نقوبا، أبو غوش: 50 شيكل. لهذه المناطق رسوم توصيل منفصلة عن رسوم التوصيل العامة للقدس.",
          ),
        ).toBeInTheDocument();
      }
    },
  );
});
