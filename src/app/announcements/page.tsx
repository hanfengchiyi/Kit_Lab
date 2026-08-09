import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { EmptyBoxArt, SakuraFlower, SparkleStar } from "@/components/decorations";

export const metadata: Metadata = {
  title: "公告与用户守则",
};

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const items = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  const announcements = items.filter((i) => i.kind === "announcement");
  const rules = items.filter((i) => i.kind === "rule");

  const Section = ({
    title,
    list,
    icon,
  }: {
    title: string;
    list: typeof items;
    icon: React.ReactNode;
  }) => (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-ink">
        {icon}
        {title}
      </h2>
      {list.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-sakura-200 bg-white/70 py-8 text-center text-sm text-ink/40">
          暂无内容
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border-2 border-sakura-100 bg-white p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-ink">{item.title}</h3>
                <time className="text-xs text-ink/35">
                  {item.updatedAt.toLocaleDateString("zh-CN")}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/70">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">公告与用户守则</h1>
        <p className="mt-1 text-sm text-ink/45">站点最新动态与使用规范，请大家共同维护良好的工具库氛围。</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center">
          <EmptyBoxArt className="mx-auto w-44 animate-float" />
          <p className="mt-4 font-display text-lg text-ink/70">还没有公告，敬请期待</p>
        </div>
      ) : (
        <>
          <Section
            title="📢 公告"
            list={announcements}
            icon={<SakuraFlower className="size-6 text-sakura-300" />}
          />
          <Section
            title="📜 用户守则"
            list={rules}
            icon={<SparkleStar className="size-6 text-lav-300" />}
          />
        </>
      )}
    </div>
  );
}
