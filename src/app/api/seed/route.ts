import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";

export async function GET() {
  try {
    const projectorsRef = collection(db, "projectors");
    const snapshot = await getDocs(projectorsRef);

    if (!snapshot.empty) {
      return NextResponse.json(
        { message: "O banco de dados já possui projetores cadastrados." },
        { status: 400 }
      );
    }

    const initialProjectors = [
      { name: "Projetor 01", status: "disponivel" },
      { name: "Projetor 02", status: "disponivel" },
      { name: "Projetor 03", status: "disponivel" },
      { name: "Projetor 04", status: "disponivel" },
      { name: "Projetor 05", status: "disponivel" },
    ];

    for (const proj of initialProjectors) {
      await addDoc(projectorsRef, {
        ...proj,
        createdAt: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { message: "Projetores iniciais cadastrados com sucesso!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao popular banco:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
