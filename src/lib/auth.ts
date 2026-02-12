import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

// Debug: Log environment variables (remove in production)
console.log("[Auth Debug] GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "Missing");
console.log("[Auth Debug] GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Missing");
console.log("[Auth Debug] GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "Set" : "Missing");
console.log("[Auth Debug] AUTH_SECRET:", process.env.AUTH_SECRET ? "Set" : "Missing");
console.log("[Auth Debug] AUTH_URL:", process.env.AUTH_URL ? "Set" : "Missing");
console.log("[Auth Debug] AUTH_TRUST_HOST:", process.env.AUTH_TRUST_HOST ? "Set" : "Missing");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as any),
  session: {
    strategy: "jwt",
  },
  debug: true,
  logger: {
    error(code, ...message) {
      console.error("[Auth Error]", code, ...message);
    },
    warn(code) {
      console.warn("[Auth Warn]", code);
    },
    debug(code, ...message) {
      console.log("[Auth Debug]", code, ...message);
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
      console.log("[Auth Event] signIn:", JSON.stringify(message, null, 2));
    },
    signOut(message) {
      console.log("[Auth Event] signOut:", JSON.stringify(message, null, 2));
    },
    createUser(message) {
      console.log("[Auth Event] createUser:", JSON.stringify(message, null, 2));
    },
    linkAccount(message) {
      console.log("[Auth Event] linkAccount:", JSON.stringify(message, null, 2));
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("[Auth Callback] signIn called:", {
        userId: user?.id,
        userEmail: user?.email,
        provider: account?.provider,
        accountType: account?.type,
        profileEmail: profile?.email,
      });
      return true; // Allow sign in
    },
    jwt({ token, user, account }) {
      if (user) {
        console.log("[Auth Callback] jwt - new user sign in:", {
          userId: user.id,
          email: user.email,
          provider: account?.provider,
        });
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
