import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  try {
    const { name, area } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    const userRef = doc(db, "users", session.user.id);
    
    const updateData: any = { name };
    // Only update area if provided (and maybe restrict to professors? but admin might want to change it too)
    if (area !== undefined) {
        updateData.area = area;
    }

    await updateDoc(userRef, updateData);

    return NextResponse.json({ message: "Perfil atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
