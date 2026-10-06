import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "~/env";
import { storeConfig } from "~/config/store";
import { prisma } from "~/lib/prisma";
import { clientIpOptions } from "~/lib/client-ip";
import { sendAuthEmail } from "~/server/email";

const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
          mapProfileToUser: () => ({
            role: "CUSTOMER",
          }),
        },
      }
    : undefined;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  trustedOrigins: [env.APP_URL],

  advanced: {
    ipAddress: clientIpOptions,
  },

  ...(googleProvider ? { socialProviders: googleProvider } : {}),

  account: {
    accountLinking: {
      enabled: true,
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CUSTOMER",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,

    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: `Reset your ${storeConfig.name} password`,
        text: [
          "You requested a password reset.",
          "",
          "Open this link to reset your password:",
          url,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Reset your password</h2>
            <p>You requested a password reset.</p>
            <p>
              <a href="${url}"
                 style="display:inline-block;padding:10px 16px;background:#18181b;color:white;text-decoration:none;border-radius:999px;">
                Reset password
              </a>
            </p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    },

    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,

    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: `Verify your ${storeConfig.name} account`,
        text: [
          `Welcome to ${storeConfig.name}.`,
          "",
          "Open this link to verify your email address:",
          url,
          "",
          "This link expires in 1 hour.",
          "",
          "If you did not create this account, you can ignore this email.",
        ].join("\n"),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome to ${storeConfig.name}</h2>
            <p>Please verify your email address before signing in.</p>
            <p>
              <a href="${url}"
                 style="display:inline-block;padding:10px 16px;background:#18181b;color:white;text-decoration:none;border-radius:999px;">
                Verify email
              </a>
            </p>
            <p>This link expires in 1 hour.</p>
            <p>If you did not create this account, you can ignore this email.</p>
          </div>
        `,
      });
    },
  },
});
