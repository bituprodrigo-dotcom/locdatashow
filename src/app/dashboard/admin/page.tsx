"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { SCHEDULE_SLOTS } from "@/constants/schedule";

interface Projector {
  id: string;
  name: string;
  status: string;
}

interface SlotAvailability {
  slot: number;
  availableCount: number;
  totalProjectors: number;
  reservations?: {
    projectorName: string;
    userName: string;
    userArea?: string;
  }[];
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projectors, setProjectors] = useState<Projector[]>([]);
  const [newProjectorName, setNewProjectorName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProjector, setEditingProjector] = useState<Projector | null>(null);
  
  // Overview state
  const [overviewDate, setOverviewDate] = useState<Date | undefined>(new Date());
  const [overviewData, setOverviewData] = useState<SlotAvailability[]>([]);

  const fetchProjectors = useCallback(async () => {
    try {
      const q = query(collection(db, "projectors"), orderBy("name"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Projector));
      setProjectors(data);
    } catch {
      toast.error("Erro ao carregar projetores");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if (session.user.role !== "admin") {
        router.push("/dashboard");
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProjectors();
      }
    }
  }, [status, session, router, fetchProjectors]);

  const fetchOverview = useCallback(async () => {
      if (!overviewDate) return;
      try {
        const formattedDate = format(overviewDate, "yyyy-MM-dd");
        const res = await fetch(`/api/availability?date=${formattedDate}&includeDetails=true`);
        if (res.ok) {
          const data = await res.json();
          setOverviewData(data);
        }
      } catch {
        toast.error("Erro ao carregar visão geral");
      }
  }, [overviewDate]);

  useEffect(() => {
      if (overviewDate) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          fetchOverview();
      }
  }, [fetchOverview, overviewDate]);

  const handleSaveProjector = async () => {
    if (!newProjectorName) return;

    try {
      if (editingProjector) {
        await updateDoc(doc(db, "projectors", editingProjector.id), {
          name: newProjectorName
        });
        toast.success("Projetor atualizado!");
      } else {
        await addDoc(collection(db, "projectors"), {
          name: newProjectorName,
          status: "disponivel"
        });
        toast.success("Projetor criado!");
      }
      setIsDialogOpen(false);
      setNewProjectorName("");
      setEditingProjector(null);
      fetchProjectors();
    } catch {
      toast.error("Erro ao salvar projetor");
    }
  };

  const handleDeleteProjector = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      await deleteDoc(doc(db, "projectors", id));
      toast.success("Projetor excluído");
      fetchProjectors();
    } catch {
      toast.error("Erro ao excluir projetor");
    }
  };

  if (status === "loading") return <div>Carregando...</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <div className="space-x-2">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Ver como Professor</Button>
            <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/login" })}>Sair</Button>
        </div>
      </div>

      <Tabs defaultValue="projectors">
        <TabsList>
          <TabsTrigger value="projectors">Gerenciar Projetores</TabsTrigger>
          <TabsTrigger value="inventory">Controle de Inventário</TabsTrigger>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="projectors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projetores Cadastrados</CardTitle>
              <Button onClick={() => { setEditingProjector(null); setNewProjectorName(""); setIsDialogOpen(true); }}>
                Novo Projetor
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectors.map((proj) => (
                    <TableRow key={proj.id}>
                      <TableCell>{proj.name}</TableCell>
                      <TableCell>{proj.status}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingProjector(proj);
                          setNewProjectorName(proj.name);
                          setIsDialogOpen(true);
                        }}>Editar</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteProjector(proj.id)}>Excluir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
            <Card>
                <CardHeader>
                    <CardTitle>Inventário Total</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">{projectors.length} equipamentos cadastrados</p>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="overview">
            <div className="flex flex-col md:flex-row gap-6">
                <Card className="w-full md:w-auto h-fit">
                    <CardHeader>
                        <CardTitle>Selecione a Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Calendar
                            mode="single"
                            selected={overviewDate}
                            onSelect={setOverviewDate}
                            className="rounded-md border"
                            locale={ptBR}
                        />
                    </CardContent>
                </Card>

                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>
                            Reservas do dia {overviewDate ? format(overviewDate, "dd 'de' MMMM", { locale: ptBR }) : "..."}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Horário</TableHead>
                                    <TableHead>Slot</TableHead>
                                    <TableHead>Ocupação</TableHead>
                                    <TableHead>Detalhes (Prof. / Área / Proj.)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {SCHEDULE_SLOTS.map(slot => {
                                    const slotData = overviewData.find(d => d.slot === slot.id);
                                    const reservations = slotData?.reservations || [];
                                    const isFull = slotData?.availableCount === 0;

                                    return (
                                        <TableRow key={slot.id} className={isFull ? "bg-red-50" : ""}>
                                            <TableCell>{slot.startTime} - {slot.endTime}</TableCell>
                                            <TableCell>{slot.label}</TableCell>
                                            <TableCell>
                                                {slotData ? (
                                                    <span className={isFull ? "text-red-600 font-bold" : "text-green-600"}>
                                                        {slotData.totalProjectors - slotData.availableCount} / {slotData.totalProjectors}
                                                    </span>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {reservations.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {reservations.map((res, idx) => (
                                                            <div key={idx} className="text-sm border-b last:border-0 pb-1 last:pb-0">
                                                                <span className="font-medium">{res.userName}</span> 
                                                                <span className="text-gray-500 text-xs ml-1">({res.userArea})</span>
                                                                <span className="block text-xs text-blue-600">↳ {res.projectorName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Sem reservas</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProjector ? "Editar Projetor" : "Novo Projetor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Projetor</Label>
              <Input
                id="name"
                value={newProjectorName}
                onChange={(e) => setNewProjectorName(e.target.value)}
                placeholder="Ex: Projetor 01 - Epson"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProjector}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
