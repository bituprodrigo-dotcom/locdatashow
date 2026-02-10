"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Verificação de sessão ao mudar de rota (inclui voltar/avançar do navegador)
    if (status === "unauthenticated" && pathname.startsWith("/dashboard")) {
      router.replace("/login?error=session_expired");
    }
  }, [status, pathname, router]);

  return <>{children}</>;
}
