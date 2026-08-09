import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ToolForm } from "@/components/tool-form";
import { listCategoryNames } from "@/lib/categories";

export const metadata: Metadata = {
  title: "新增公共工具",
};

export default async function NewAdminToolPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">新增公共工具</h1>
      <ToolForm visibility="public" cancelHref="/admin" categories={await listCategoryNames()} />
    </div>
  );
}
