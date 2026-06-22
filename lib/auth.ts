import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import CredentialsProvider from "next-auth/providers/credentials"
import PostgresAdapter from "@auth/pg-adapter"
import bcrypt from "bcryptjs"
import { pool } from "./pool"

const providers: NextAuthOptions["providers"] = []

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    })
  )
}

if (process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET) {
  providers.push({
    id: "amazon",
    name: "Amazon",
    type: "oauth",
    authorization: {
      url: "https://www.amazon.com/ap/oa",
      params: { scope: "profile" },
    },
    token: "https://api.amazon.com/auth/o2/token",
    userinfo: "https://api.amazon.com/user/profile",
    profile(profile) {
      return {
        id: profile.user_id,
        name: profile.name,
        email: profile.email,
        image: null,
      }
    },
    clientId: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
  })
}

providers.push(
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@example.com" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [credentials.email]);
      const user = rows[0];

      if (!user || !user.password) {
        return null;
      }

      const isValid = await bcrypt.compare(credentials.password, user.password);
      if (!isValid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    }
  })
)

export const authOptions: NextAuthOptions = {
  adapter: PostgresAdapter(pool) as any,
  session: {
    strategy: "jwt",
  },
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "default_secret_for_development_only_12345",
}
