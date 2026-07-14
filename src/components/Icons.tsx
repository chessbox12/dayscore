/** Consistent 24px stroke icons (1.8px stroke, round caps). */
import { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const Base = ({ size = 20, children, ...rest }: P) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const GearIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6a7.8 7.8 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.8 7.8 0 0 0 2.6-1.5l2.4 1 2-3.4Z" />
  </Base>
);

export const ChevronLeftIcon = (p: P) => (
  <Base {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Base>
);

export const ChevronRightIcon = (p: P) => (
  <Base {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Base>
);

export const CloseIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const DownloadIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 4v10M8 10.5l4 4 4-4" />
    <path d="M5 19.5h14" />
  </Base>
);

export const TrashIcon = (p: P) => (
  <Base {...p}>
    <path d="M4.5 6.5h15M9.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6M7 6.5l.8 12.2a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 6.5" />
  </Base>
);
