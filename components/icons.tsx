// One drawn icon set, one stroke weight (1.75 on a 24 grid). No emoji, no glyph icons.
import type { Mode } from "@/lib/config";

type P = { className?: string; title?: string };

function Svg({ className = "size-5", title, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {children}
    </svg>
  );
}

const MODE_PATHS: Record<Mode, React.ReactNode> = {
  train: (
    <>
      <rect x="5.5" y="3" width="13" height="13.5" rx="3" />
      <path d="M5.5 10h13M9 13.5h.01M15 13.5h.01M8.5 16.5 6.5 21M15.5 16.5l2 4.5M7.5 19h9" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3.5" width="16" height="14" rx="2.5" />
      <path d="M4 11h16M8 17.5V20M16 17.5V20M7.5 14.25h.01M16.5 14.25h.01M9 6.5h6" />
    </>
  ),
  flight: <path d="M12 2.75c.85 0 1.35 1.05 1.35 2.4v4.1l7.15 4.3v1.9l-7.15-2.3v4.6l2.4 1.75v1.75L12 20.2l-3.75 1.05V19.5l2.4-1.75v-4.6l-7.15 2.3v-1.9l7.15-4.3v-4.1c0-1.35.5-2.4 1.35-2.4Z" />,
  cab: (
    <>
      <path d="M4 17v-3.5l1.75-4.5h12.5L20 13.5V17Z" />
      <path d="M9.5 9 10 6h4l.5 3M4 17v2M20 17v2M7.5 14h.01M16.5 14h.01" />
    </>
  ),
};

export function ModeIcon({ mode, ...p }: P & { mode: Mode }) {
  return <Svg {...p}>{MODE_PATHS[mode]}</Svg>;
}

export const DiscoverIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15 9-1.75 4.25L9 15l1.75-4.25Z" />
  </Svg>
);
export const TripsIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="5" cy="17" r="2" />
    <circle cx="19" cy="7" r="2" />
    <path d="M7 17c5 0 5-10 10-10" />
  </Svg>
);
export const InboxIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 13.5 6 5h12l2 8.5V19H4Z" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" />
  </Svg>
);
export const ProfileIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.75-3.5 3.5-5.5 7-5.5s6.25 2 7 5.5" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const MoreIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />
  </Svg>
);
export const BackIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 5 8 12l7 7" />
  </Svg>
);
export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const CopyIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Svg>
);
export const ChevronIcon = (p: P & { dir?: "left" | "right" }) => (
  <Svg {...p}>
    <path d={p.dir === "left" ? "M14.5 6 8.5 12l6 6" : "m9.5 6 6 6-6 6"} />
  </Svg>
);
