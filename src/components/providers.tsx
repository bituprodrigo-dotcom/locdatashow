"use client";

import { SessionProvider } from "next-auth/react";
import { SessionGuard } from "./session-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard>{children}</SessionGuard>
    </SessionProvider>
  );
}
