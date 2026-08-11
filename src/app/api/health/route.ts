import { NextResponse } from "next/server";
import { getDatabase } from "@/backend/db/db";

export async function GET() {
  try {
    const db = await getDatabase();
    await db.get("SELECT 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json(
      { status: "error", database: "disconnected" },
      { status: 503 },
    );
  }
}
