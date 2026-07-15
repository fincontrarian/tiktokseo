import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { convertLeadsForUser } from "@/lib/data/leads";
import { redis } from "@/lib/redis";

/**
 * Auth.js v5 configuration: email magic link + Google, database sessions
 * via the Prisma adapter. Import `auth` through lib/auth.ts (getSession),
 * not from here — callers should never depend on Auth.js types.
 */

export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

/** Where the latest magic link for an email is parked for dev/E2E pickup. */
export function magicLinkKey(email: string): string {
  return `magiclink:${email.toLowerCase()}`;
}

async function deliverMagicLink(email: string, url: string): Promise<void> {
  // Always park the link in Redis: dev and E2E read it back via
  // /api/dev/magic-link instead of an inbox.
  await redis.set(magicLinkKey(email), url, "EX", MAGIC_LINK_TTL_SECONDS);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth] magic link for ${email}: ${url}`);
      return;
    }
    throw new Error("RESEND_API_KEY is required to send sign-in emails");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Findable <login@findable.app>",
      to: [email],
      subject: "Sign in to Findable",
      html: [
        `<p>Click the link below to sign in to Findable. It expires in 15 minutes.</p>`,
        `<p><a href="${url}">Sign in to Findable</a></p>`,
        `<p>If you didn't request this, you can safely ignore this email.</p>`,
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    throw new Error(`Magic-link email failed: ${response.status}`);
  }
}

const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  from: process.env.EMAIL_FROM ?? "Findable <login@findable.app>",
  maxAge: MAGIC_LINK_TTL_SECONDS,
  options: {},
  sendVerificationRequest: async ({ identifier, url }) => {
    await deliverMagicLink(identifier, url);
  },
};

const providers: NextAuthConfig["providers"] = [emailProvider];

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

if (googleEnabled) {
  providers.push(
    Google({
      // Google verifies email ownership, so linking a Google login to an
      // existing magic-link user with the same address is safe and keeps
      // one user per person.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin?sent=1",
    error: "/signin?error=auth",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // First login: anyone who left their email at a gate (audit lead capture)
    // becomes a converted lead.
    async createUser({ user }) {
      if (user.id && user.email) {
        await convertLeadsForUser(user.id, user.email);
      }
    },
  },
  trustHost: true,
});
