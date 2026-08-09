import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveIconFile } from "@/lib/icon-gen";

export const runtime = "nodejs";

/** 提供自动生成的工具图标（站内路径 /api/icons/<uuid>.png，公开可读） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const filePath = resolveIconFile(file);
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
