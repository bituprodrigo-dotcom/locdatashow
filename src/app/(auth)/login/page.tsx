"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "session_expired") {
        // Timeout pequeno para garantir que o Toaster já montou
        setTimeout(() => {
            toast.error("Sessão expirada. Por favor, faça login novamente para acessar o sistema.");
        }, 100);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Credenciais inválidas");
      } else {
        toast.success("Login realizado com sucesso!");
        // O redirecionamento real deve ser tratado aqui ou via callback do next-auth, 
        // mas como o signIn não retorna os dados da sessão imediatamente, 
        // vamos redirecionar para uma rota intermediária ou dashboard que fará o roteamento final
        // Ou melhor, podemos buscar a sessão logo após? Não, melhor deixar o middleware ou a página dashboard lidar.
        // Vamos redirecionar para /dashboard e lá ele decide.
        // Mas o user pediu: "Ao logar... o usuário é redirecionado para o /dashboard/admin"
        // Vamos forçar um reload ou fetch session?
        // Simplificando: vamos para /dashboard, e o /dashboard/page.tsx vai checar o role e redirecionar se for admin.
        router.push("/dashboard");
      }
    } catch {
      toast.error("Ocorreu um erro ao tentar fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="professor@escola.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            Não tem uma conta?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
