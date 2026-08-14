import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth-guards";
import { getIconSettings } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin-nav";
import { IconSettingsForm } from "@/components/icon-settings-form";

export const metadata: Metadata = {
  title: "系统设置",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage();

  const iconSettings = await getIconSettings();

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">系统设置</h1>
        <p className="mt-1 text-sm text-ink/45">站点级配置，保存后立即生效，无需重启。</p>
      </div>

      <section className="rounded-2xl border-2 border-sakura-100 bg-white p-5">
        <h2 className="mb-1 font-display text-lg text-ink">🎨 图标生成 API</h2>
        <p className="mb-4 text-xs text-ink/45">
          创建工具且未手动填写图标时，自动调用该 API 生成图标。
        </p>
        <IconSettingsForm initial={iconSettings} />
      </section>
    </div>
  );
}