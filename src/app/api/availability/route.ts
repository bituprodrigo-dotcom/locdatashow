import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SCHEDULE_SLOTS } from "@/constants/schedule";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const includeDetails = searchParams.get("includeDetails") === "true";

  if (!dateParam) {
    return NextResponse.json(
      { message: "Data é obrigatória" },
      { status: 400 }
    );
  }

  try {
    // Buscar todos os projetores ativos
    const projectorsRef = collection(db, "projectors");
    const projectorsQuery = query(projectorsRef, where("status", "==", "disponivel"));
    const projectorsSnapshot = await getDocs(projectorsQuery);
    
    const projectors = projectorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    const totalProjectors = projectors.length;

    // Buscar todas as reservas para o dia
    // Firestore armazena datas como strings ou Timestamps. Vamos assumir string YYYY-MM-DD para simplificar a query de igualdade
    const reservationsRef = collection(db, "reservations");
    const reservationsQuery = query(reservationsRef, where("date", "==", dateParam));
    const reservationsSnapshot = await getDocs(reservationsQuery);
    
    const reservations = await Promise.all(reservationsSnapshot.docs.map(async (resDoc) => {
        const data = resDoc.data();
        let userName = "Usuário";
        let userArea = "N/A";
        let projectorName = "Projetor";

        if (includeDetails) {
            // Buscar nome do usuário
            if (data.userId) {
                const userDoc = await getDoc(doc(db, "users", data.userId));
                if (userDoc.exists()) {
                    userName = userDoc.data().name;
                    userArea = userDoc.data().area || "N/A";
                }
            }
            // Buscar nome do projetor (já temos na lista de projetores, mas podemos garantir)
            const proj = projectors.find(p => p.id === data.projectorId);
            if (proj) {
                // @ts-expect-error: projector.name might not be typed correctly in the inferred type
                projectorName = proj.name;
            }
        }

        return {
            id: resDoc.id,
            ...data,
            user: { name: userName },
            area: userArea,
            projector: { name: projectorName }
        };
    }));

    // Calcular disponibilidade para cada slot
    const availability = SCHEDULE_SLOTS.map((slot) => {
      // @ts-expect-error: r.slots might not be typed correctly
      const slotReservations = reservations.filter((r) => r.slots && r.slots.includes(slot.id));
      const reservedCount = slotReservations.length;
      const availableCount = Math.max(0, totalProjectors - reservedCount);
      // @ts-expect-error: r.userId might not be typed correctly
      const isReservedByUser = slotReservations.some((r) => r.userId === session.user.id);

      const result: Record<string, unknown> = {
        slot: slot.id,
        availableCount,
        totalProjectors,
        isReservedByUser,
      };

      if (includeDetails) {
        result.reservations = slotReservations.map(r => ({
            // @ts-expect-error: r.projector might not be typed correctly
            projectorName: r.projector.name,
            // @ts-expect-error: r.user might not be typed correctly
            userName: r.user.name,
            // @ts-expect-error: r.area might not be typed correctly
            userArea: r.area
        }));
      }

      return result;
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Erro ao buscar disponibilidade:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
