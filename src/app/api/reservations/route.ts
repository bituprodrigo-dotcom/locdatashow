import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc } from "firebase/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  try {
    const { date, slots } = await req.json(); // slots is now an array of numbers

    if (!date || !slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { message: "Dados incompletos" },
        { status: 400 }
      );
    }

    const reservationsRef = collection(db, "reservations");

    // 1. Check if user already has reservations for ANY of these slots on this date
    // Firestore "in" query limits to 10, but slots are usually few (1-2).
    // Better to just fetch all user reservations for the day and check in memory.
    const userResQuery = query(
        reservationsRef,
        where("userId", "==", session.user.id),
        where("date", "==", date)
    );
    const userResSnapshot = await getDocs(userResQuery);
    
    for (const doc of userResSnapshot.docs) {
        const existingSlots = doc.data().slots as number[];
        const hasOverlap = slots.some(s => existingSlots.includes(s));
        if (hasOverlap) {
             return NextResponse.json(
                { message: `Você já possui reserva conflitante neste dia (Slots: ${existingSlots.join(", ")})` },
                { status: 400 }
            );
        }
    }

    // 2. Find available projector for ALL requested slots
    // We need a projector that is NOT reserved in ANY of the requested slots
    const projectorsRef = collection(db, "projectors");
    
    // FETCH AND SORT IN MEMORY to avoid Firestore Composite Index requirements
    const projectorsQuery = query(projectorsRef, where("status", "==", "disponivel"));
    const projectorsSnapshot = await getDocs(projectorsQuery);
    
    let allProjectors = projectorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{ id: string; createdAt?: string; [key: string]: any }>;

    // Sort by createdAt (FIFO) - Oldest projectors first
    // If createdAt is missing (legacy data), treat as oldest (0)
    allProjectors.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tA - tB;
    });

    if (allProjectors.length === 0) {
         return NextResponse.json(
        { message: "Não há projetores cadastrados ou disponíveis no sistema" },
        { status: 400 }
      );
    }

    // Fetch all reservations for the date to check availability
    const dateResQuery = query(reservationsRef, where("date", "==", date));
    const dateResSnapshot = await getDocs(dateResQuery);
    
    // Map of projectorId -> Set of reserved slots
    const projectorSchedule = new Map<string, Set<number>>();
    
    dateResSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const pid = data.projectorId;
        const pSlots = data.slots as number[];
        
        if (!projectorSchedule.has(pid)) {
            projectorSchedule.set(pid, new Set());
        }
        pSlots.forEach(s => projectorSchedule.get(pid)?.add(s));
    });

    // Find a projector that is free for ALL requested slots
    const availableProjector = allProjectors.find(p => {
        const reservedSlots = projectorSchedule.get(p.id);
        if (!reservedSlots) return true; // Brand new, no reservations
        // Check if any requested slot is already taken
        return !slots.some(s => reservedSlots.has(s));
    });

    if (!availableProjector) {
      return NextResponse.json(
        { message: "Não há um único projetor disponível para todos os horários selecionados. Tente reservar separadamente." },
        { status: 400 }
      );
    }

    // Calculate delivery time (end of last slot)
    // We need to import SCHEDULE_SLOTS to know the end time
    // For now, let's just save the slots. The frontend/countdown logic will calculate times.
    // Or we can calculate here. Let's stick to saving slots.

    // Criar a reserva
    const docRef = await addDoc(reservationsRef, {
      date: date,
      slots: slots,
      userId: session.user.id,
      projectorId: availableProjector.id,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ id: docRef.id, message: "Reserva realizada com sucesso!" }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar reserva:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  // Check if user is admin
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { message: "Apenas administradores podem realizar esta ação" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "ID da reserva é obrigatório" },
      { status: 400 }
    );
  }

  try {
    const resDocRef = doc(db, "reservations", id);
    const resDoc = await getDoc(resDocRef);

    if (!resDoc.exists()) {
      return NextResponse.json(
        { message: "Reserva não encontrada" },
        { status: 404 }
      );
    }

    await deleteDoc(resDocRef);

    return NextResponse.json({ message: "Reserva cancelada com sucesso" });
  } catch (error) {
    console.error("Erro ao cancelar reserva (Admin):", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
