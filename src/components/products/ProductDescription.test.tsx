import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { translations } from "~/lib/translations";
import { ProductDescription } from "./ProductDescription";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe.each(["en", "ar"] as const)(
  "product descriptions in %s",
  (language) => {
    const t = translations[language].products;
    function mount(description: string | null) {
      localStorage.setItem("language", language);
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      return render(
        <AppPreferencesProvider>
          <ProductDescription description={description} />
        </AppPreferencesProvider>,
      );
    }

    it("keeps plain descriptions and their line breaks intact", () => {
      const text = "  A component.\n\nUse it in your project.  ";
      mount(text);
      expect(screen.getByText(/A component/).textContent).toBe(text);
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it.each([null, "", " \n "])(
      "retains the empty-description fallback for %j",
      (text) => {
        mount(text);
        expect(screen.getByText(t.noDescription)).toBeInTheDocument();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
      },
    );

    it("extracts a CRLF block, preserves prose on both sides and localizes quantities", () => {
      mount(
        "Project kit.\r\n\r\n [kit-contents] \r\n1 | ESP32 board\r\n\r\n٢ | أسلاك توصيل\r\n۳ | Headers | straight\r\n [/kit-contents] \r\n\r\nAssembly notes.",
      );
      expect(screen.getByText(/Project kit/).textContent).toBe(
        "Project kit.\n\nAssembly notes.",
      );
      const region = screen.getByRole("region", { name: t.kitContentsTitle });
      expect(within(region).getAllByRole("listitem")).toHaveLength(3);
      expect(within(region).getByText("ESP32 board")).toBeInTheDocument();
      expect(within(region).getByText("أسلاك توصيل")).toBeInTheDocument();
      expect(
        within(region).getByText("Headers | straight"),
      ).toBeInTheDocument();
      expect(
        within(region).getByText(new Intl.NumberFormat(language).format(2), {
          exact: true,
        }),
      ).toBeInTheDocument();
      expect(within(region).getAllByText(`${t.kitQuantity}:`)).toHaveLength(3);
      expect(screen.queryByText(/\[kit-contents\]/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(document.documentElement.dir).toBe(
        language === "ar" ? "rtl" : "ltr",
      );
    });

    it("renders kit-only descriptions without a misleading missing-description message", () => {
      mount("[kit-contents]\n1 | Board\n[/kit-contents]");
      expect(screen.getByRole("listitem")).toHaveTextContent("Board");
      expect(screen.queryByText(t.noDescription)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: t.descriptionTitle }),
      ).not.toBeInTheDocument();
    });

    it.each([
      "[kit-contents]\n1 | Board",
      "1 | Board\n[/kit-contents]",
      "[/kit-contents]\n1 | Board\n[kit-contents]",
      "[kit-contents]\n\n[/kit-contents]",
      "[kit-contents]\n1 Board\n[/kit-contents]",
      "[kit-contents]\n1 | Board\n0 | Wire\n[/kit-contents]",
      "[kit-contents]\n-1 | Board\n[/kit-contents]",
      "[kit-contents]\n1.5 | Board\n[/kit-contents]",
      "[kit-contents]\n1e2 | Board\n[/kit-contents]",
      "[kit-contents]\n9007199254740992 | Board\n[/kit-contents]",
      "[kit-contents]\n1 | \n[/kit-contents]",
      "[kit-contents]\n[kit-contents]\n1 | Board\n[/kit-contents]",
      "[kit-contents]\n1 | Board\n[/kit-contents]\n[kit-contents]\n2 | Wire\n[/kit-contents]",
      "Inline [kit-contents] example\n1 | Board\n[/kit-contents]",
    ])("keeps malformed or ambiguous blocks visible: %j", (description) => {
      const { container } = mount(description);
      expect(container.querySelector("p")?.textContent).toBe(description);
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("treats HTML in component names as text", () => {
      const name = '<img src="x" onerror="alert(1)">';
      const { container } = mount(
        `[kit-contents]\n1 | ${name}\n[/kit-contents]`,
      );
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    });

    it("expands and collapses long lists by keyboard and resets for changed content", async () => {
      const description = `[kit-contents]\n${Array.from({ length: 7 }, (_, index) => `${index + 1} | Part ${index + 1}`).join("\n")}\n[/kit-contents]`;
      const { rerender } = mount(description);
      expect(screen.getAllByRole("listitem")).toHaveLength(5);
      const button = screen.getByRole("button", {
        name: new RegExp(t.showAllComponents),
      });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByRole("list")).toHaveAttribute(
        "id",
        button.getAttribute("aria-controls"),
      );
      button.focus();
      await userEvent.keyboard("{Enter}");
      expect(screen.getAllByRole("listitem")).toHaveLength(7);
      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(button).toHaveAccessibleName(t.showFewerComponents);
      await userEvent.click(button);
      expect(screen.getAllByRole("listitem")).toHaveLength(5);
      await userEvent.click(button);
      rerender(
        <AppPreferencesProvider>
          <ProductDescription
            description={description.replace("Part 1", "Changed part")}
          />
        </AppPreferencesProvider>,
      );
      expect(screen.getAllByRole("listitem")).toHaveLength(5);
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  },
);
