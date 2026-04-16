import { NextRequest, NextResponse } from "next/server";
import { getDefaultCSV, getMetadata } from "@/lib/csv";

/** GET /api/metadata — returns {students, lessons, dateRange} for the default CSV. */
export async function GET() {
  try {
    const csv = getDefaultCSV();
    if (!csv) {
      return NextResponse.json(
        { students: [], lessons: [], dateRange: { from: "", to: "" } },
        { status: 200 }
      );
    }
    const meta = getMetadata(csv);
    return NextResponse.json(meta);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/metadata — compute metadata for a client-uploaded CSV.
 * Body: { csv: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { csv } = await req.json();
    if (typeof csv !== "string" || !csv.trim()) {
      return NextResponse.json(
        { students: [], lessons: [], dateRange: { from: "", to: "" } }
      );
    }
    const meta = getMetadata(csv);
    return NextResponse.json(meta);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
