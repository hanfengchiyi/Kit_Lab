import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth-guards";
import { ToolForm } from "@/components/tool-form";
import { listCategoryNames } from "@/lib/categories";

export const metadata: Metadata = {
  title: "新增工具",
};

export default async function NewMyToolPage() {
  await requireUserPage();

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">新增私有工具</h1>
      <ToolForm visibility="private" cancelHref="/my" categories={await listCategoryNames()} />
    </div>
  );
}