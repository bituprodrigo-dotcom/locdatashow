"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export function ProfileDialog() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(session?.user?.name || "");
  const [area, setArea] = useState(session?.user?.area || "");

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, area }),
      });

      if (res.ok) {
        toast.success("Perfil atualizado com sucesso");
        // Update session client-side to reflect changes immediately
        await update({
            ...session,
            user: {
                ...session?.user,
                name,
                area
            }
        });
        setOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.message || "Erro ao atualizar perfil");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Configurações de Perfil">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Faça alterações no seu perfil aqui. Clique em salvar quando terminar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          {session?.user?.role !== "admin" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="area" className="text-right">
                Área
              </Label>
              <Input
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="col-span-3"
                placeholder="Ex: Gestão e Negócios"
              />
            </div>
          )}
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar alterações"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
