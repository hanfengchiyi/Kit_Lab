interface ToolIconProps {
  /** 图标值：/api/icons/<file> 路径或 emoji；空值显示默认 🔧 */
  icon: string | null | undefined;
  /** 尺寸类，如 "size-10"（默认）或 "size-11" */
  sizeClass?: string;
  /** 圆角类，如 "rounded-xl"（默认） */
  roundedClass?: string;
}

/** 工具图标：站内生成图标用 <img>（懒加载），emoji 直接渲染；无图标时回退 🔧 */
export function ToolIcon({ icon, sizeClass = "size-10", roundedClass = "rounded-xl" }: ToolIconProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-sakura-50 text-xl ${sizeClass} ${roundedClass}`}
      aria-hidden
    >
      {icon?.startsWith("/api/icons/") ? (
        // 生成图标固定 1:1，宽高明确可避免布局偏移。
        // 图标是本地小图片且带 immutable 缓存，next/image 的优化管线收益不大，用原生 img。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          loading="lazy"
          width={48}
          height={48}
          className={`size-full ${roundedClass} object-cover`}
        />
      ) : (
        icon || "🔧"
      )}
    </span>
  );
}