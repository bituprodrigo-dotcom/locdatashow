import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", credentials.email), limit(1));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            return null;
          }

          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            userData.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: userDoc.id,
            name: userData.name,
            email: userData.email,
            role: userData.email === "rodrigo.luis95@gmail.com" ? "admin" : (userData.role || "professor"),
            area: userData.area,
          };
        } catch (error) {
          console.error("Erro na autenticação:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
        if (user) {
            token.role = user.role;
            token.area = user.area;
        }
        return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as string;
        session.user.area = token.area as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
