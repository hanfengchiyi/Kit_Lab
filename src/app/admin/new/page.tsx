import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth-guards";
import { ToolForm } from "@/components/tool-form";
import { listCategoryNames } from "@/lib/categories";

export const metadata: Metadata = {
  title: "新增公共工具",
};

export default async function NewAdminToolPage() {
  await requireAdminPage();

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">新增公共工具</h1>
      <ToolForm visibility="public" cancelHref="/admin" categories={await listCategoryNames()} />
    </div>
  );
}