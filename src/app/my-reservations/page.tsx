"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SCHEDULE_SLOTS } from "@/constants/schedule";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Reservation {
  id: string;
  date: string;
  slots: number[];
  projector: {
    name: string;
  };
}

export default function MyReservationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchReservations();
    }
  }, [session]);

  const fetchReservations = async () => {
    try {
      const res = await fetch("/api/my-reservations");
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      } else {
        toast.error("Erro ao carregar reservas");
      }
    } catch {
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return;

    try {
      const res = await fetch(`/api/my-reservations?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Reserva cancelada com sucesso!");
        setReservations(reservations.filter((r) => r.id !== id));
      } else {
        toast.error("Erro ao cancelar reserva");
      }
    } catch {
      toast.error("Erro ao conectar com o servidor");
    }
  };

  if (status === "loading" || isLoading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Minhas Reservas Futuras</CardTitle>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Voltar para Dashboard
          </Button>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Você não possui reservas futuras.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Horários</TableHead>
                    <TableHead>Projetor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => {
                    const slots = reservation.slots || []; // Fallback for safety
                    const slotLabels = slots.map(slotId => {
                        const s = SCHEDULE_SLOTS.find(sch => sch.id === slotId);
                        return s ? `${s.label} (${s.startTime})` : `Slot ${slotId}`;
                    }).join(", ");

                    return (
                      <TableRow key={reservation.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(reservation.date), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          {slotLabels}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{reservation.projector.name}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelReservation(reservation.id)}
                          >
                            Cancelar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
