import type { SVGProps } from "react";

type FlagProps = SVGProps<SVGSVGElement> & { title?: string };

/** Tricolore — used for Français. */
export function FlagFR(props: FlagProps) {
  return (
    <svg viewBox="0 0 24 16" width="20" height="14" aria-hidden={!props.title} {...props}>
      {props.title ? <title>{props.title}</title> : null}
      <rect width="8" height="16" fill="#0055A4" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#EF4135" />
      <rect width="24" height="16" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="0.6" />
    </svg>
  );
}

/** Union Jack — used for English. */
export function FlagGB(props: FlagProps) {
  return (
    <svg viewBox="0 0 24 16" width="20" height="14" aria-hidden={!props.title} {...props}>
      {props.title ? <title>{props.title}</title> : null}
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 L24 16 M24 0 L0 16" stroke="#fff" strokeWidth="3" />
      <path d="M0 0 L24 16 M24 0 L0 16" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M12 0 V16 M0 8 H24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0 V16 M0 8 H24" stroke="#C8102E" strokeWidth="2.6" />
      <rect width="24" height="16" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="0.6" />
    </svg>
  );
}

/** Morocco — used for العربية, the market this product is built for. */
export function FlagMA(props: FlagProps) {
  return (
    <svg viewBox="0 0 24 16" width="20" height="14" aria-hidden={!props.title} {...props}>
      {props.title ? <title>{props.title}</title> : null}
      <rect width="24" height="16" fill="#C1272D" />
      <path
        d="M12 3.4 L13.4 7.4 L17.6 7.4 L14.1 9.9 L15.5 14 L12 11.5 L8.5 14 L9.9 9.9 L6.4 7.4 L10.6 7.4 Z"
        fill="none"
        stroke="#006233"
        strokeWidth="1.15"
        strokeLinejoin="miter"
      />
      <rect width="24" height="16" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="0.6" />
    </svg>
  );
}

export const FLAG_BY_LOCALE = {
  fr: FlagFR,
  en: FlagGB,
  ar: FlagMA,
} as const;
