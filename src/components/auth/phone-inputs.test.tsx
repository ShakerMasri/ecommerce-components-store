import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "~/components/account/ProfileForm";
import { PHONE_INPUT_MAX_LENGTH } from "~/lib/phone";
import { translations } from "~/lib/translations";
import { registerSchema, updateProfileSchema } from "~/lib/validations";
import { RegisterForm } from "./RegisterForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("~/lib/auth-client", () => ({ authClient: {} }));
vi.mock("~/components/providers/AppPreferencesProvider", () => ({
  useAppPreferences: () => ({ t: translations.en, language: "en" }),
}));

describe.each(["registration", "profile"] as const)(
  "%s phone entry",
  (form) => {
    it("allows the formatted international input intact and shares the raw limit", async () => {
      const user = userEvent.setup();
      const profile = {
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
        phone: "",
      };
      render(
        form === "registration" ? (
          <RegisterForm googleSignInEnabled={false} />
        ) : (
          <ProfileForm user={profile} />
        ),
      );
      const input = screen.getByRole("textbox", {
        name: translations.en.auth.phone,
      });
      const formatted = "00970 (59) 912 - 3456";
      await user.type(input, formatted);
      expect(input).toHaveValue(formatted);
      expect(input).toHaveAttribute(
        "maxLength",
        String(PHONE_INPUT_MAX_LENGTH),
      );
      const schema =
        form === "registration" ? registerSchema : updateProfileSchema;
      expect(
        schema.parse({
          ...profile,
          password: "test-password",
          phone: (input as HTMLInputElement).value,
        }).phone,
      ).toBe("+970599123456");
      // jsdom/user-event does not enforce the native tel maxlength behavior.
      // Check the DOM bound above and the server-side bound independently.
      expect(
        schema.safeParse({
          ...profile,
          password: "test-password",
          phone: formatted.padEnd(PHONE_INPUT_MAX_LENGTH + 1, " "),
        }).success,
      ).toBe(false);
    });
  },
);
