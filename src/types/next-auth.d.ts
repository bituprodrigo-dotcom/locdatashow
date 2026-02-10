import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      area?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    area?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    area?: string;
  }
}
