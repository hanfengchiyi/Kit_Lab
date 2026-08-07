/** 自制内联 SVG 装饰素材：樱花、星星、云朵、星球、波浪、Logo 与空状态插画。
 *  全部本地渲染、无外链，均可离线/自托管使用。默认 aria-hidden，纯装饰用途。 */

interface DecorProps {
  className?: string;
}

/** 五瓣樱花，花瓣用 currentColor，花蕊固定奶黄色 */
export function SakuraFlower({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <g fill="currentColor">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} cx="20" cy="10.5" rx="5.6" ry="8.8" transform={`rotate(${deg} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="4.6" fill="#ffd166" />
      <circle cx="20" cy="20" r="1.8" fill="#ff9f43" />
    </svg>
  );
}

/** 四芒星，用 currentColor */
export function SparkleStar({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <path
        d="M20 3c1.9 8.6 5 11.7 13.6 13.6C25 18.5 21.9 21.6 20 30.2c-1.9-8.6-5-11.7-13.6-13.6C15 14.7 18.1 11.6 20 3z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 云朵，用 currentColor */
export function CloudPuff({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden="true" focusable="false">
      <path
        d="M13 27a7.5 7.5 0 1 1 1.6-14.8A10 10 0 0 1 34 14.5 6.5 6.5 0 0 1 39.5 27H13z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 站点 Logo：圆角方块里的烧瓶 + 气泡 + 小星星 */
export function Logo({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="kitlab-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc4da" />
          <stop offset="1" stopColor="#b8ddff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#kitlab-logo-bg)" />
      <path d="M20 10h8v9l7 13a6.5 6.5 0 0 1-5.9 9.5H18.9A6.5 6.5 0 0 1 13 32l7-13v-9z" fill="#fff" />
      <path d="M16.5 29h15l3.5 6.6a4.5 4.5 0 0 1-4 6.6H17a4.5 4.5 0 0 1-4-6.6l3.5-6.6z" fill="#fb74a9" />
      <circle cx="21.5" cy="33.5" r="2" fill="#fff" />
      <circle cx="26.5" cy="37.5" r="1.4" fill="#fff" />
      <path d="M17 10h14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M37 8l1.1 2.6 2.6 1.1-2.6 1.1L37 15.4l-1.1-2.6-2.6-1.1 2.6-1.1L37 8z"
        fill="#ffd166"
      />
    </svg>
  );
}

/** 波浪分隔线，用 currentColor，宽度撑满 */
export function WaveDivider({ className }: DecorProps) {
  return (
    <svg
      viewBox="0 0 1440 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 55c120-30 240-42 360-30s240 42 360 42 240-30 360-42 240 12 360 30v45H0V55z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 搜索无结果插画：委屈小星球 + 放大镜 + 星星 */
export function EmptySearchArt({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="132" rx="52" ry="8" fill="#ece6ff" />
      <circle cx="88" cy="78" r="38" fill="#ffe1ec" />
      <ellipse
        cx="88" cy="86"
        rx="56" ry="13"
        fill="none"
        stroke="#8ac7ff"
        strokeWidth="7"
        strokeLinecap="round"
        transform="rotate(-14 88 86)"
      />
      <circle cx="77" cy="72" r="3.5" fill="#57466b" />
      <circle cx="99" cy="72" r="3.5" fill="#57466b" />
      <path d="M80 88q8-6 16 0" fill="none" stroke="#57466b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="66" cy="82" r="4" fill="#ffc4da" opacity="0.9" />
      <circle cx="110" cy="82" r="4" fill="#ffc4da" opacity="0.9" />
      {/* 放大镜 */}
      <circle cx="148" cy="50" r="20" fill="#fff" stroke="#bda4fb" strokeWidth="6" />
      <path d="M162 64l16 16" stroke="#bda4fb" strokeWidth="8" strokeLinecap="round" />
      {/* 星星点缀 */}
      <path
        d="M34 30l1.6 3.9 3.9 1.6-3.9 1.6L34 41l-1.6-3.9-3.9-1.6 3.9-1.6L34 30z"
        fill="#ffd166"
      />
      <path
        d="M168 102l1.3 3.1 3.1 1.3-3.1 1.3-1.3 3.1-1.3-3.1-3.1-1.3 3.1-1.3 1.3-3.1z"
        fill="#8ac7ff"
      />
      <circle cx="30" cy="70" r="3" fill="#ffc4da" />
    </svg>
  );
}

/** 空状态插画：打开的箱子，蹦出爱心与星星 */
export function EmptyBoxArt({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="132" rx="56" ry="8" fill="#ece6ff" />
      {/* 箱体 */}
      <path d="M60 84h80v34a8 8 0 0 1-8 8H68a8 8 0 0 1-8-8V84z" fill="#dcedff" />
      <path d="M60 84h80v10H60z" fill="#8ac7ff" />
      {/* 箱盖（翻开） */}
      <path d="M60 84L38 66l14-10 22 18-14 10z" fill="#b8ddff" />
      <path d="M140 84l22-18-14-10-22 18 14 10z" fill="#b8ddff" />
      {/* 蹦出的爱心 */}
      <path
        d="M100 62c-3-8-16-8-16 1 0 7 9 12 16 17 7-5 16-10 16-17 0-9-13-9-16-1z"
        fill="#fb74a9"
      />
      <path
        d="M72 46c-2-5-10-5-10 1 0 4 6 7 10 10 4-3 10-6 10-10 0-6-8-6-10-1z"
        fill="#ffc4da"
      />
      <path
        d="M132 42c-2-5-10-5-10 1 0 4 6 7 10 10 4-3 10-6 10-10 0-6-8-6-10-1z"
        fill="#ffc4da"
      />
      {/* 星星点缀 */}
      <path
        d="M52 24l1.6 3.9 3.9 1.6-3.9 1.6L52 35l-1.6-3.9-3.9-1.6 3.9-1.6L52 24z"
        fill="#ffd166"
      />
      <path
        d="M152 20l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9-3.9-1.6 3.9-1.6 1.6-3.9z"
        fill="#bda4fb"
      />
      <circle cx="118" cy="26" r="3" fill="#8ac7ff" />
    </svg>
  );
}
