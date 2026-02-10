import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, limit } from "firebase/firestore";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password, area } = await req.json();

    if (!name || !email || !password || !area) {
      return NextResponse.json(
        { message: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return NextResponse.json(
        { message: "Este email já está cadastrado" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === "rodrigo.luis95@gmail.com" ? "admin" : "professor";

    const docRef = await addDoc(usersRef, {
      name,
      email,
      password: hashedPassword,
      area,
      role,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      { message: "Usuário criado com sucesso", user: { id: docRef.id, name, email, role } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
