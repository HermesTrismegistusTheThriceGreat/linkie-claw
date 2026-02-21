import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any),
  session: {
    strategy: "jwt",
  },
  debug: true, // TEMPORARY: Enable auth debug logging in production
  logger: {
    error(code, ...message) {
      console.error("[auth][ERROR]", code, JSON.stringify(message));
    },
    warn(code) {
      console.warn("[auth][WARN]", code);
    },
    debug(code, ...message) {
      console.log("[auth][DEBUG]", code, JSON.stringify(message));
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login", // Redirect auth errors to login page with error param
  },
  events: {
    signIn(message) {
      console.log("[auth][EVENT] signIn:", JSON.stringify(message));
    },
    linkAccount(message) {
      console.log("[auth][EVENT] linkAccount:", JSON.stringify(message));
    },
  },
  callbacks: {
    jwt({ token, user }) {
      console.log("[auth][CALLBACK] jwt called, user:", user?.id ?? "none");
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
