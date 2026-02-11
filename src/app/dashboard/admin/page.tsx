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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { SCHEDULE_SLOTS } from "@/constants/schedule";
import { Trash2, Menu, FileDown } from "lucide-react";
import { ProfileDialog } from "@/components/profile-dialog";
import jsPDF from "jspdf";

interface Projector {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
}

interface SlotAvailability {
  slot: number;
  availableCount: number;
  totalProjectors: number;
  reservations?: {
    id: string;
    projectorName: string;
    userName: string;
    userArea?: string;
  }[];
}

interface ReportItem {
    id: string;
    date: string;
    slots: number[];
    user: {
        name: string;
        area: string;
        email?: string;
    };
    projector: {
        name: string;
    };
    createdAt: string;
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

  // Reports state
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(new Date());
  const [reportArea, setReportArea] = useState("");
  const [reportProfessor, setReportProfessor] = useState("");
  const [reportResults, setReportResults] = useState<ReportItem[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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
          status: "disponivel",
          createdAt: new Date().toISOString()
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

  const handleCancelReservation = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta reserva do usuário?")) return;
    try {
        const res = await fetch(`/api/reservations?id=${id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success("Reserva cancelada pelo administrador.");
            fetchOverview();
        } else {
             const data = await res.json();
             toast.error(data.message || "Erro ao cancelar reserva.");
        }
    } catch {
        toast.error("Erro de conexão.");
    }
  }

  const fetchReports = async () => {
      if (!reportStartDate || !reportEndDate) {
          toast.error("Selecione o intervalo de datas");
          return;
      }
      
      setIsGeneratingReport(true);
      try {
          const params = new URLSearchParams({
              startDate: format(reportStartDate, "yyyy-MM-dd"),
              endDate: format(reportEndDate, "yyyy-MM-dd"),
          });
          if (reportArea) params.append("area", reportArea);
          if (reportProfessor) params.append("professorName", reportProfessor);

          const res = await fetch(`/api/admin/reports?${params.toString()}`);
          if (res.ok) {
              const data = await res.json();
              setReportResults(data);
          } else {
              toast.error("Erro ao buscar relatório");
          }
      } catch {
          toast.error("Erro de conexão");
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const generateReportPDF = () => {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("Relatório de Reservas", 14, 20);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 26);
      
      if (reportStartDate && reportEndDate) {
          doc.text(`Período: ${format(reportStartDate, "dd/MM/yyyy")} a ${format(reportEndDate, "dd/MM/yyyy")}`, 14, 32);
      }

      let yPos = 40;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      
      // Headers
      doc.text("Data", 14, yPos);
      doc.text("Horário", 40, yPos);
      doc.text("Professor / Área", 80, yPos);
      doc.text("Projetor", 150, yPos);
      
      yPos += 8;
      doc.line(14, yPos - 5, 195, yPos - 5); // Divider line
      doc.setFont("helvetica", "normal");

      reportResults.forEach((item, index) => {
          if (yPos > 280) {
              doc.addPage();
              yPos = 20;
          }

          // Fix timezone issue by manually formatting the date string (YYYY-MM-DD)
          const [year, month, day] = item.date.split('-');
          const dateStr = `${day}/${month}`;
          
          const slotsStr = item.slots.map(sid => SCHEDULE_SLOTS.find(s => s.id === sid)?.label).join(", ");
          const profStr = `${item.user.name.substring(0, 20)} (${item.user.area || 'N/A'})`;
          
          doc.text(dateStr, 14, yPos);
          doc.text(slotsStr, 40, yPos);
          doc.text(profStr, 80, yPos);
          doc.text(item.projector.name, 150, yPos);
          
          yPos += 8;
      });

      doc.save("relatorio-reservas.pdf");
  };

  if (status === "loading") return <div>Carregando...</div>;

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header Responsivo */}
      <div className="flex flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-3xl font-bold truncate">Painel Admin</h1>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="hidden md:flex gap-2">
                <ProfileDialog />
                <Button variant="outline" onClick={() => router.push("/dashboard")}>Ver como Professor</Button>
                <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/login" })}>Sair</Button>
            </div>
            
            <div className="md:hidden flex items-center gap-2">
                <ProfileDialog />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                            Ver como Professor
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => signOut({ callbackUrl: "/login" })}>
                            Sair
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto mb-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="projectors">Gerenciar Projetores</TabsTrigger>
            <TabsTrigger value="inventory">Inventário</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
            <div className="flex flex-col lg:flex-row gap-6">
                <Card className="w-full lg:w-auto h-fit">
                    <CardHeader>
                        <CardTitle>Selecione a Data</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
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
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="whitespace-nowrap">Horário</TableHead>
                                        <TableHead>Slot</TableHead>
                                        <TableHead>Ocupação</TableHead>
                                        <TableHead className="min-w-[200px]">Detalhes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {SCHEDULE_SLOTS.map(slot => {
                                        const slotData = overviewData.find(d => d.slot === slot.id);
                                        const reservations = slotData?.reservations || [];
                                        const isFull = slotData?.availableCount === 0;

                                        return (
                                            <TableRow key={slot.id} className={isFull ? "bg-red-50" : ""}>
                                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{slot.startTime} - {slot.endTime}</TableCell>
                                                <TableCell className="text-xs md:text-sm">{slot.label}</TableCell>
                                                <TableCell>
                                                    {slotData ? (
                                                        <span className={`text-xs md:text-sm font-bold ${isFull ? "text-red-600" : "text-green-600"}`}>
                                                            {slotData.totalProjectors - slotData.availableCount} / {slotData.totalProjectors}
                                                        </span>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {reservations.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {reservations.map((res, idx) => (
                                                                <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm border-b last:border-0 pb-1 last:pb-0 gap-2">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-xs md:text-sm">{res.userName}</span> 
                                                                        <span className="text-gray-500 text-[10px] md:text-xs">({res.userArea})</span>
                                                                        <span className="text-blue-600 text-[10px] md:text-xs">{res.projectorName}</span>
                                                                    </div>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 self-end sm:self-center"
                                                                        onClick={() => handleCancelReservation(res.id)}
                                                                        title="Cancelar reserva"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-xs">Sem reservas</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="projectors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projetores Cadastrados</CardTitle>
              <Button onClick={() => { setEditingProjector(null); setNewProjectorName(""); setIsDialogOpen(true); }}>
                Novo Projetor
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                        <TableCell className="whitespace-nowrap">{proj.name}</TableCell>
                        <TableCell>{proj.status}</TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
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
              </div>
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

        <TabsContent value="reports">
            <Card>
                <CardHeader>
                    <CardTitle>Relatórios Administrativos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex flex-col space-y-2">
                            <Label>Data Início</Label>
                            <Calendar
                                mode="single"
                                selected={reportStartDate}
                                onSelect={setReportStartDate}
                                className="rounded-md border w-fit"
                                locale={ptBR}
                            />
                        </div>
                        <div className="flex flex-col space-y-2">
                            <Label>Data Fim</Label>
                            <Calendar
                                mode="single"
                                selected={reportEndDate}
                                onSelect={setReportEndDate}
                                className="rounded-md border w-fit"
                                locale={ptBR}
                            />
                        </div>
                        <div className="flex flex-col gap-4 flex-1">
                            <div className="space-y-2">
                                <Label>Área de Atuação</Label>
                                <Input 
                                    placeholder="Ex: Gestão e Negócios" 
                                    value={reportArea}
                                    onChange={(e) => setReportArea(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Professor</Label>
                                <Input 
                                    placeholder="Nome do professor" 
                                    value={reportProfessor}
                                    onChange={(e) => setReportProfessor(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 mt-auto">
                                <Button onClick={fetchReports} disabled={isGeneratingReport} className="flex-1">
                                    {isGeneratingReport ? "Buscando..." : "Gerar Relatório"}
                                </Button>
                                {reportResults.length > 0 && (
                                    <Button variant="secondary" onClick={generateReportPDF} title="Exportar PDF">
                                        <FileDown className="h-4 w-4 mr-2" /> PDF
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {reportResults.length > 0 && (
                        <div className="overflow-x-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Slot</TableHead>
                                        <TableHead>Professor</TableHead>
                                        <TableHead>Área</TableHead>
                                        <TableHead>Projetor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportResults.map((item, idx) => {
                                        // Fix timezone display issue
                                        const [y, m, d] = item.date.split('-');
                                        const dateDisplay = `${d}/${m}/${y}`;
                                        
                                        return (
                                        <TableRow key={idx}>
                                            <TableCell className="whitespace-nowrap">{dateDisplay}</TableCell>
                                            <TableCell>
                                                {item.slots.map(s => SCHEDULE_SLOTS.find(slot => slot.id === s)?.label).join(", ")}
                                            </TableCell>
                                            <TableCell>{item.user.name}</TableCell>
                                            <TableCell>{item.user.area}</TableCell>
                                            <TableCell>{item.projector.name}</TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
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
