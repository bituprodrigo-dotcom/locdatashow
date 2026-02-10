import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // Comparação simples de string de data YYYY-MM-DD
    
    const reservationsRef = collection(db, "reservations");
    const q = query(
        reservationsRef, 
        where("userId", "==", session.user.id),
        where("date", ">=", today)
    );
    
    const querySnapshot = await getDocs(q);
    
    const reservations = await Promise.all(querySnapshot.docs.map(async (resDoc) => {
        const data = resDoc.data();
        let projectorName = "Projetor";
        
        if (data.projectorId) {
            const projDoc = await getDoc(doc(db, "projectors", data.projectorId));
            if (projDoc.exists()) {
                projectorName = projDoc.data().name;
            }
        }
        
        return {
            id: resDoc.id,
            ...data,
            projector: { name: projectorName }
        };
    }));
    
    // Ordenar manualmente pois Firestore precisa de índice composto para orderby + where range
    reservations.sort((a, b) => {
        // @ts-expect-error: a.date might not be typed correctly
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        
        // Handle slots array for sorting
        // @ts-expect-error: a.slots/slot might not be typed correctly
        const slotA = a.slots ? (a.slots[0] || 0) : (a.slot || 0);
        // @ts-expect-error: b.slots/slot might not be typed correctly
        const slotB = b.slots ? (b.slots[0] || 0) : (b.slot || 0);
        
        return slotA - slotB;
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Erro ao buscar reservas:", error);
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

    const data = resDoc.data();
    if (data.userId !== session.user.id) {
      return NextResponse.json(
        { message: "Você não tem permissão para cancelar esta reserva" },
        { status: 403 }
      );
    }

    await deleteDoc(resDocRef);

    return NextResponse.json({ message: "Reserva cancelada com sucesso" });
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
