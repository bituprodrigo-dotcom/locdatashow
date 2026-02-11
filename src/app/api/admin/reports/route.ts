import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const area = searchParams.get("area"); // Filter by area
  const professorName = searchParams.get("professorName"); // Filter by name (partial match?)

  if (!startDate || !endDate) {
    return NextResponse.json({ message: "Data de início e fim são obrigatórias" }, { status: 400 });
  }

  try {
    const reservationsRef = collection(db, "reservations");
    // Basic date filtering
    const q = query(
      reservationsRef,
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const snapshot = await getDocs(q);
    const reservations: any[] = [];

    // Fetch all users to map names and areas (Optimization: could cache this)
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    const usersMap = new Map();
    usersSnapshot.docs.forEach(doc => {
        usersMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Fetch all projectors
    const projectorsRef = collection(db, "projectors");
    const projectorsSnapshot = await getDocs(projectorsRef);
    const projectorsMap = new Map();
    projectorsSnapshot.docs.forEach(doc => {
        projectorsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const user = usersMap.get(data.userId);
      const projector = projectorsMap.get(data.projectorId);

      // Apply filters that Firestore couldn't handle easily (OR partial matches)
      
      // Filter by Area
      if (area && user?.area !== area) {
        continue;
      }

      // Filter by Professor Name (case insensitive partial match)
      if (professorName) {
        const name = user?.name || "";
        if (!name.toLowerCase().includes(professorName.toLowerCase())) {
            continue;
        }
      }

      reservations.push({
        id: docSnapshot.id,
        date: data.date,
        slots: data.slots || [data.slot], // Handle legacy 'slot'
        user: {
            name: user?.name || "Desconhecido",
            area: user?.area || "N/A",
            email: user?.email
        },
        projector: {
            name: projector?.name || "Desconhecido"
        },
        createdAt: data.createdAt
      });
    }

    // Sort by date and slot
    reservations.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.slots[0] || 0) - (b.slots[0] || 0);
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  }
}
