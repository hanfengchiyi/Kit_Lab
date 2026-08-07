import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ToolForm } from "@/components/tool-form";

export const metadata: Metadata = {
  title: "新增工具",
};

export default async function NewMyToolPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">新增私有工具</h1>
      <ToolForm visibility="private" cancelHref="/my" />
    </div>
  );
}
