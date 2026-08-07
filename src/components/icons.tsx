/** 轻量内联描边图标（lucide 风格，stroke=currentColor），避免引入图标库 */

interface IconProps {
  className?: string;
}

function base(className?: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false as const,
  };
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
    </svg>
  );
}

export function WrenchIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14.5 6.5a4.2 4.2 0 0 1 5.6-1.4l-3 3 1.5 1.4 3-3a4.2 4.2 0 0 1-5.9 5.7L7 20.4a2 2 0 0 1-2.8-2.8l8.4-8.4a4.2 4.2 0 0 1 1.9-2.7z" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 11.5l2 2 3.5-3.5" />
    </svg>
  );
}

export function LoginIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
      <path d="M10 8l4 4-4 4M14 12H4" />
    </svg>
  );
}

export function UserPlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" />
      <path d="M18 8v6M21 11h-6" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </svg>
  );
}
