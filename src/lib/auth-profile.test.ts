// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  return {
    db,
    headers: new Headers(),
    rateLimit: vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      response: new Response(null, { status: 429 }),
    })),
    update: vi.fn(),
  };
});
vi.mock("better-auth/adapters/prisma", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return { prismaAdapter: () => memoryAdapter(state.db) };
});
vi.mock("~/lib/prisma", () => ({ prisma: { user: { update: state.update } } }));
vi.mock("~/server/email", () => ({ sendAuthEmail: vi.fn() }));
vi.mock("~/lib/rate-limit", () => ({ rateLimit: state.rateLimit }));
vi.mock("next/headers", () => ({ headers: async () => state.headers }));

import { POST } from "~/app/api/auth/[...all]/route";
import { PATCH } from "~/app/api/profile/route";
import { auth } from "./auth";
import { env } from "~/env";
import { createOrderSchema } from "~/server/validations/order";

const profile = { name: "Test customer", phone: "+970599123456" };
const credentials = {
  email: "synthetic@example.test",
  password: "SyntheticPassword123!",
};
function request(
  path: string,
  body: unknown,
  cookie?: string,
  origin = env.APP_URL,
) {
  return new Request(`${env.APP_URL}/api/${path}`, {
    method: path === "profile" ? "PATCH" : "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function signIn() {
  const response = await POST(request("auth/sign-in/email", credentials));
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie).toBeTruthy();
  state.headers = new Headers({ cookie });
  return cookie;
}
async function signedUp() {
  expect(
    (await POST(request("auth/sign-up/email", { ...credentials, ...profile })))
      .status,
  ).toBe(200);
  return signIn();
}

beforeEach(async () => {
  // Better Auth skips origin checks by default in NODE_ENV=test. Exercise the
  // production check here without altering the application configuration.
  (await auth.$context).skipOriginCheck = false;
  for (const rows of Object.values(state.db)) rows.length = 0;
  state.headers = new Headers();
  state.rateLimit.mockClear().mockResolvedValue({
    ok: true,
    response: new Response(null, { status: 429 }),
  });
  state.update
    .mockReset()
    .mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const user = state.db.user!.find((row) => row.id === where.id);
        if (!user) throw new Error("Missing fixture user");
        Object.assign(user, data);
        return user;
      },
    );
});

const invalidProfiles = [
  { name: "" },
  { name: " \t " },
  { name: "a" },
  { name: "a".repeat(51) },
  { name: "a".repeat(5000) },
  { name: null },
  { name: 42 },
  { phone: "" },
  { phone: "not-a-phone" },
  { phone: null },
  { phone: 599123456 },
  { phone: "+9700599123456" },
  { phone: "+970599123456\n" },
  { phone: " ".repeat(28) + "+970599123456 " },
];

describe("application auth profile boundaries (real Better Auth handlers, memory adapter)", () => {
  it.each(invalidProfiles)(
    "rejects invalid signup case %# without persisting a user or account",
    async (invalid) => {
      const response = await POST(
        request("auth/sign-up/email", {
          ...credentials,
          ...profile,
          ...invalid,
        }),
      );
      expect(response.status).toBe(400);
      expect(state.db.user).toHaveLength(0);
      expect(state.db.account).toHaveLength(0);
    },
  );

  it("requires a phone for email signup", async () => {
    const response = await POST(
      request("auth/sign-up/email", { ...credentials, name: profile.name }),
    );
    expect(response.status).toBe(400);
    expect(state.db.user).toHaveLength(0);
  });

  it.each([
    {
      name: "  أحمد  ",
      phone: " 00970 (599) 123-456 ",
      normalizedName: "أحمد",
    },
    { name: "ab", phone: "0599123456", normalizedName: "ab" },
    {
      name: "  " + "a".repeat(50) + "  ",
      phone: " ".repeat(27) + "+970599123456",
      normalizedName: "a".repeat(50),
    },
  ])(
    "normalizes valid signup boundaries: $normalizedName",
    async ({ name, phone, normalizedName }) => {
      expect(
        (
          await POST(
            request("auth/sign-up/email", {
              ...credentials,
              name,
              phone,
              role: "ADMIN",
            }),
          )
        ).status,
      ).toBe(200);
      expect(state.db.user![0]).toMatchObject({
        name: normalizedName,
        phone: phone.startsWith("05") ? phone : "+970599123456",
        role: "CUSTOMER",
      });
    },
  );

  it("rejects invalid updates atomically and accepts normalized partial updates without writable roles", async () => {
    const cookie = await signedUp();
    for (const invalid of invalidProfiles) {
      const response = await POST(
        request("auth/update-user", { ...profile, ...invalid }, cookie),
      );
      expect(response.status, JSON.stringify(invalid)).toBe(400);
      expect(state.db.user![0]).toMatchObject({ ...profile, role: "CUSTOMER" });
    }
    expect(
      (await POST(request("auth/update-user", { name: "  أحمد  " }, cookie)))
        .status,
    ).toBe(200);
    expect(state.db.user![0]).toMatchObject({
      name: "أحمد",
      phone: profile.phone,
    });
    expect(
      (
        await POST(
          request("auth/update-user", { phone: "00970 (599) 123-456" }, cookie),
        )
      ).status,
    ).toBe(200);
    expect(state.db.user![0]).toMatchObject({
      name: "أحمد",
      phone: profile.phone,
    });
    expect(
      (
        await POST(
          request("auth/update-user", { name: "ab", role: "ADMIN" }, cookie),
        )
      ).status,
    ).toBe(400);
    expect(state.db.user![0]).toMatchObject({ name: "أحمد", role: "CUSTOMER" });
    for (const name of ["ab", "a".repeat(50)]) {
      expect(
        (
          await POST(
            request(
              "auth/update-user",
              { name, phone: " ".repeat(27) + profile.phone },
              cookie,
            ),
          )
        ).status,
      ).toBe(200);
      expect(state.db.user![0]).toMatchObject({ name });
    }
  });

  it("preserves auth session, origin and outer abuse-protection rejection", async () => {
    expect((await POST(request("auth/update-user", profile))).status).toBe(401);
    const cookie = await signedUp();
    expect(
      (
        await POST(
          request(
            "auth/update-user",
            profile,
            cookie,
            "https://attacker.example",
          ),
        )
      ).status,
    ).toBe(403);
    state.rateLimit.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 429 }),
    });
    expect(
      (await POST(request("auth/update-user", profile, cookie))).status,
    ).toBe(429);
    expect(state.db.user![0]).toMatchObject(profile);
  });

  it.each([undefined, null])(
    "allows OAuth creation without a phone (%s) through the actual adapter hook lifecycle",
    async (phone) => {
      const context = await auth.$context;
      const created = await context.internalAdapter.createOAuthUser(
        {
          name: "  OAuth customer  ",
          email: "oauth@example.test",
          emailVerified: true,
          ...(phone === null ? { phone: null } : {}),
        },
        { providerId: "google", accountId: "synthetic-provider-id" },
      );
      expect(created.user.name).toBe("OAuth customer");
      expect(state.db.user![0]?.phone ?? null).toBeNull();
      expect(state.db.account![0]).toMatchObject({
        providerId: "google",
        userId: created.user.id,
      });
      // Non-profile auth lifecycle updates must work for phone-less users.
      await context.internalAdapter.updateUser(created.user.id, {
        emailVerified: true,
      });
      expect(state.db.user![0]).toMatchObject({ emailVerified: true });
      expect(
        createOrderSchema.innerType().shape.phone.safeParse(phone).success,
      ).toBe(false);
    },
  );

  it("also rejects invalid provider/adapter profile writes", async () => {
    const context = await auth.$context;
    await expect(
      context.internalAdapter.createOAuthUser(
        { name: " ", email: "oauth@example.test", emailVerified: true },
        { providerId: "google", accountId: "synthetic-provider-id" },
      ),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
    expect(state.db.user).toHaveLength(0);
  });
});

describe("custom profile handler with real auth sessions", () => {
  it("shares normalized boundaries and rejects invalid inputs without writing", async () => {
    const cookie = await signedUp();
    for (const invalid of invalidProfiles) {
      expect(
        (await PATCH(request("profile", { ...profile, ...invalid }, cookie)))
          .status,
      ).toBe(400);
    }
    expect(state.update).not.toHaveBeenCalled();
    for (const name of ["  أحمد  ", "ab", "a".repeat(50)]) {
      const response = await PATCH(
        request(
          "profile",
          { name, phone: " ".repeat(27) + profile.phone, role: "ADMIN" },
          cookie,
        ),
      );
      expect(response.status).toBe(200);
      expect(state.db.user![0]).toMatchObject({
        name: name.trim(),
        phone: profile.phone,
        role: "CUSTOMER",
      });
      expect(state.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: state.db.user![0]!.id },
          data: { name: name.trim(), phone: profile.phone },
        }),
      );
    }
  });

  it("keeps ownership, CSRF and abuse checks ahead of mutation", async () => {
    expect((await PATCH(request("profile", profile))).status).toBe(401);
    const cookie = await signedUp();
    expect(
      (
        await PATCH(
          request("profile", profile, cookie, "https://attacker.example"),
        )
      ).status,
    ).toBe(403);
    state.rateLimit.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 429 }),
    });
    expect((await PATCH(request("profile", profile, cookie))).status).toBe(429);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.rateLimit).toHaveBeenLastCalledWith(
      expect.any(Request),
      "profileUpdate",
      state.db.user![0]!.id,
    );
  });
});
