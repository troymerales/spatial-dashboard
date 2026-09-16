/** Small inline icons. Kept local so the page pulls in no icon dependency. */

const base = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function WarnIcon() {
  return (
    <svg {...base}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...base} width={15} height={15}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

/*
 * Panel toggles. Each icon is the workspace rectangle with the edge it controls
 * marked, so the button says which panel it affects without needing a label.
 * The marked edge is filled when the panel is showing (`on`) and hollow when it
 * is collapsed, giving state at a glance as well as position.
 */

export function PanelLeftIcon({ on = true }: { on?: boolean }) {
  return (
    <svg {...base} width={15} height={15}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {on && <rect x="3" y="4" width="6" height="16" rx="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

export function PanelRightIcon({ on = true }: { on?: boolean }) {
  return (
    <svg {...base} width={15} height={15}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
      {on && <rect x="15" y="4" width="6" height="16" rx="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

export function PanelBottomIcon({ on = true }: { on?: boolean }) {
  return (
    <svg {...base} width={15} height={15}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 14h18" />
      {on && <rect x="3" y="14" width="18" height="6" rx="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
