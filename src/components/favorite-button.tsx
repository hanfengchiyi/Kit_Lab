"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/lib/actions/favorites";

interface FavoriteButtonProps {
  toolId: string;
  initialFavorited: boolean;
  loggedIn: boolean;
}

export function FavoriteButton({ toolId, initialFavorited, loggedIn }: FavoriteButtonProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    // 未登录点击收藏时跳转登录页
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    const previous = favorited;
    setFavorited(!previous); // 乐观更新
    startTransition(async () => {
      const result = await toggleFavorite(toolId);
      if (result?.error) {
        setFavorited(previous); // 失败回滚
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={favorited ? "取消收藏" : "收藏"}
      aria-label={favorited ? "取消收藏" : "收藏"}
      className={`shrink-0 text-xl leading-none transition-transform hover:scale-125 active:scale-90 disabled:opacity-50 ${
        favorited ? "text-amber-400" : "text-sakura-200 hover:text-amber-300"
      }`}
    >
      {/* key 随状态变化重新挂载，从而每次切换都重放 pop 弹跳动画 */}
      <span key={String(favorited)} className="inline-block animate-pop">
        {favorited ? "★" : "☆"}
      </span>
    </button>
  );
}
