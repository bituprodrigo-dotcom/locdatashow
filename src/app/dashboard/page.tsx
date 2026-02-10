"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SCHEDULE_SLOTS } from "@/constants/schedule";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";

interface SlotAvailability {
  slot: number;
  availableCount: number;
  totalProjectors: number;
  isReservedByUser: boolean;
  reservations?: {
    projectorName: string;
    userName: string;
    userArea?: string;
  }[];
}

interface ActiveReservation {
  id: string;
  date: string;
  slots: number[];
  endTime: string; // HH:mm
}

interface ReservationResponse {
    id: string;
    date: string;
    slots?: number[];
    slot?: number;
}

interface Teacher {
    id: string;
    name: string;
    email: string;
    area: string;
    role: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeReservation, setActiveReservation] = useState<ActiveReservation | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [showReturnAlert, setShowReturnAlert] = useState(false);
  
  // Teachers list state
  const [isTeachersOpen, setIsTeachersOpen] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
        if (session.user.role === "admin") {
            router.push("/dashboard/admin");
        }
    }
  }, [status, router, session]);

  const fetchAvailability = useCallback(async () => {
    if (!date) return;
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const res = await fetch(`/api/availability?date=${formattedDate}&includeDetails=true`);
      if (res.ok) {
        const data = await res.json();
        setAvailability(data);
        
        // Check for active reservation on selected date (if it's today)
        // Ideally we should fetch my-reservations separately to find the active one
      }
    } catch {
      toast.error("Erro ao carregar disponibilidade");
    }
  }, [date]);

  // Fetch active reservation specifically
  const fetchActiveReservation = useCallback(async () => {
      // Logic to find if there is an ongoing reservation today
      const today = new Date();
      const formattedDate = format(today, "yyyy-MM-dd");
      
      // We can reuse my-reservations API or create a new one. Let's filter client side for now from availability or separate call
      // Simplest: Call my-reservations
      const res = await fetch('/api/my-reservations');
      if(res.ok) {
          const data = await res.json();
          const todayRes = data.find((r: ReservationResponse) => r.date === formattedDate); // Assuming single active reservation logic for simplicity
          if (todayRes) {
              // Calculate end time based on last slot
              const lastSlotId = Math.max(...(todayRes.slots || [todayRes.slot || 0])); // Handle legacy 'slot' vs new 'slots'
              const lastSlot = SCHEDULE_SLOTS.find(s => s.id === lastSlotId);
              if (lastSlot) {
                  setActiveReservation({
                      id: todayRes.id,
                      date: todayRes.date,
                      slots: todayRes.slots || [todayRes.slot],
                      endTime: lastSlot.endTime
                  });
              }
          } else {
              setActiveReservation(null);
          }
      }
  }, []);

  const fetchTeachers = async () => {
      try {
          const res = await fetch('/api/users');
          if (res.ok) {
              const data = await res.json();
              setTeachers(data);
              setIsTeachersOpen(true);
          } else {
              toast.error("Erro ao carregar lista de professores");
          }
      } catch {
          toast.error("Erro de conexão");
      }
  };

  useEffect(() => {
    if (date) {
      fetchAvailability();
    }
    fetchActiveReservation();
  }, [fetchAvailability, date, fetchActiveReservation]);

  // Countdown logic
  useEffect(() => {
      if (!activeReservation) return;

      const timer = setInterval(() => {
          const now = new Date();
          const [hours, minutes] = activeReservation.endTime.split(':').map(Number);
          const endTime = new Date();
          endTime.setHours(hours, minutes, 0);
          
          const diff = endTime.getTime() - now.getTime();
          
          if (diff <= 0) {
              setCountdown("Expirado");
              setShowReturnAlert(true);
          } else {
              const m = Math.floor(diff / 60000);
              const s = Math.floor((diff % 60000) / 1000);
              setCountdown(`${m}m ${s}s`);
              
              if (m < 5) setShowReturnAlert(true);
              else setShowReturnAlert(false);
          }
      }, 1000);

      return () => clearInterval(timer);
  }, [activeReservation]);

  const handleSlotClick = (slotId: number) => {
    const slotData = availability.find((s) => s.slot === slotId);
    
    if (slotData?.isReservedByUser) {
      toast.info("Você já reservou um projetor neste horário.");
      return;
    }
    
    if (slotData && slotData.availableCount === 0) {
      toast.error("Não há projetores disponíveis neste horário.");
      return;
    }

    // Toggle selection
    if (selectedSlots.includes(slotId)) {
        setSelectedSlots(selectedSlots.filter(id => id !== slotId));
    } else {
        setSelectedSlots([...selectedSlots, slotId].sort((a, b) => a - b));
    }
  };

  const handleConfirmReservation = async () => {
    if (selectedSlots.length === 0 || !date || !session?.user) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          slots: selectedSlots,
        }),
      });

      if (res.ok) {
        toast.success("Reserva realizada com sucesso!");
        setIsConfirmOpen(false);
        setSelectedSlots([]);
        fetchAvailability();
        fetchActiveReservation();
      } else {
        const data = await res.json();
        toast.error(data.message || "Erro ao realizar reserva");
      }
    } catch {
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    if (!date) return;
    
    const doc = new jsPDF();
    const dateStr = format(date, "dd/MM/yyyy");
    
    doc.setFontSize(18);
    doc.text(`Quadro de Horários - ${dateStr}`, 14, 20);
    
    doc.setFontSize(12);
    let yPos = 40;
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.text("Horário", 14, yPos);
    doc.text("Slot", 40, yPos);
    doc.text("Professor / Área", 80, yPos);
    doc.text("Projetor", 150, yPos);
    yPos += 10;
    doc.setFont("helvetica", "normal");
    
    SCHEDULE_SLOTS.forEach((slot) => {
      const slotData = availability.find((s) => s.slot === slot.id);
      const timeRange = `${slot.startTime} - ${slot.endTime}`;
      
      doc.text(timeRange, 14, yPos);
      doc.text(slot.label, 40, yPos);
      
      if (slotData?.reservations && slotData.reservations.length > 0) {
        slotData.reservations.forEach((res, index) => {
            if (index > 0) yPos += 7;
            doc.text(`${res.userName} (${res.userArea || 'N/A'})`, 80, yPos);
            doc.text(res.projectorName, 150, yPos);
        });
      } else {
         doc.text(`${slotData?.availableCount} disponíveis`, 80, yPos);
      }
      
      yPos += 15;
    });
    
    doc.save(`horarios-${format(date, "yyyy-MM-dd")}.pdf`);
  };

  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-4 flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-1/3 space-y-6">
        {activeReservation && (
            <Card className={`border-2 ${showReturnAlert ? 'border-red-500 animate-pulse' : 'border-green-500'}`}>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        Reserva Ativa
                        {showReturnAlert && <Badge variant="destructive">DEVOLUÇÃO IMEDIATA</Badge>}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-mono text-center mb-4">
                        {countdown}
                    </div>
                    <p className="text-center text-sm text-gray-600">
                        Entrega prevista: {activeReservation.endTime}
                    </p>
                </CardContent>
            </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Selecione a Data</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              locale={ptBR}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </CardContent>
        </Card>
        
        <div className="space-y-2">
           <Button variant="outline" className="w-full" onClick={() => router.push('/my-reservations')}>
             Minhas Reservas
           </Button>
           <Button variant="outline" className="w-full" onClick={fetchTeachers}>
             <Users className="mr-2 h-4 w-4" />
             Professores Registrados
           </Button>
           <Button variant="secondary" className="w-full" onClick={generatePDF}>
             Baixar Relatório PDF
           </Button>
           <Button variant="destructive" className="w-full" onClick={() => signOut({ callbackUrl: "/login" })}>
             Sair
           </Button>
        </div>
      </div>

      <div className="w-full md:w-2/3">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>
              Disponibilidade para {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "..."}
            </CardTitle>
            {selectedSlots.length > 0 && (
                <Button onClick={() => setIsConfirmOpen(true)} className="w-full sm:w-auto">
                    Confirmar ({selectedSlots.length} slots)
                </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SCHEDULE_SLOTS.map((slot) => {
                const slotData = availability.find((s) => s.slot === slot.id);
                const availableCount = slotData?.availableCount ?? 0;
                const total = slotData?.totalProjectors ?? 0;
                const isReserved = slotData?.isReservedByUser;
                const isSelected = selectedSlots.includes(slot.id);

                let bgColor = "bg-green-100 hover:bg-green-200 border-green-300";
                if (isReserved) bgColor = "bg-blue-100 hover:bg-blue-200 border-blue-300 cursor-default";
                else if (availableCount === 0) bgColor = "bg-red-100 hover:bg-red-200 border-red-300 cursor-not-allowed";
                else if (isSelected) bgColor = "bg-yellow-100 hover:bg-yellow-200 border-yellow-400 ring-2 ring-yellow-400";

                return (
                  <div
                    key={slot.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${bgColor}`}
                    onClick={() => handleSlotClick(slot.id)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{slot.label}</span>
                      <span className="text-sm text-gray-600">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {isReserved
                          ? "Reservado por você"
                          : availableCount === 0
                          ? "Esgotado"
                          : `${availableCount} de ${total} disponíveis`}
                      </span>
                      {isReserved && <Badge className="bg-blue-500">Sua Reserva</Badge>}
                      {isSelected && <Badge className="bg-yellow-600">Selecionado</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Reserva</DialogTitle>
            <DialogDescription>
              Você deseja reservar projetor(es) para os seguintes horários do dia {date && format(date, "dd/MM/yyyy")}?
              <ul className="list-disc pl-5 mt-2">
                  {selectedSlots.map(id => {
                      const s = SCHEDULE_SLOTS.find(slot => slot.id === id);
                      return <li key={id}>{s?.label} ({s?.startTime} - {s?.endTime})</li>
                  })}
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmReservation} disabled={isLoading}>
              {isLoading ? "Reservando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTeachersOpen} onOpenChange={setIsTeachersOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Professores Registrados</DialogTitle>
                <DialogDescription>Lista de todos os professores cadastrados no sistema.</DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Email</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teachers.map(teacher => (
                            <TableRow key={teacher.id}>
                                <TableCell className="font-medium">{teacher.name}</TableCell>
                                <TableCell>{teacher.area}</TableCell>
                                <TableCell className="text-gray-500 text-sm">{teacher.email}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
