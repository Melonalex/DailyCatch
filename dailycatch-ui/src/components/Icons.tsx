type IconProps = { className?: string };

export function IconMenu({ className }: IconProps) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconLanguage({ className }: IconProps) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 12h16.4M12 3.8c2.2 2.4 3.3 5.2 3.3 8.2s-1.1 5.8-3.3 8.2c-2.2-2.4-3.3-5.2-3.3-8.2s1.1-5.8 3.3-8.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconBook({ className }: IconProps) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 8H19" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconEye({ className }: IconProps) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconEyeOff({ className }: IconProps) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5 19 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.2 9.4A3 3 0 0 0 12 15a3 3 0 0 0 2.5-1.3M7 7.8C4.8 9.2 3.2 12 3.2 12S6.4 17.5 12 17.5c1.2 0 2.3-.2 3.3-.6M16.2 14.2C18.6 13 20.8 12 20.8 12S17.4 6.5 12 6.5c-.6 0-1.2.1-1.7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
