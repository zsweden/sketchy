const s = 16;
const c = 'currentColor';

export function AlignHorizontalIcon() {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={c} stroke="none">
      <rect x="0" y="7.25" width="16" height="1.5" />
      <rect x="1.5" y="2" width="2" height="12" rx="0.5" />
      <rect x="7" y="4" width="2" height="8" rx="0.5" />
      <rect x="12.5" y="3" width="2" height="10" rx="0.5" />
    </svg>
  );
}

export function AlignVerticalIcon() {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={c} stroke="none">
      <rect x="7.25" y="0" width="1.5" height="16" />
      <rect x="2" y="1.5" width="12" height="2" rx="0.5" />
      <rect x="4" y="7" width="8" height="2" rx="0.5" />
      <rect x="3" y="12.5" width="10" height="2" rx="0.5" />
    </svg>
  );
}

export function DistributeHorizontalIcon() {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="1" y="4" width="3" height="8" rx="0.5" />
      <rect x="6.5" y="4" width="3" height="8" rx="0.5" />
      <rect x="12" y="4" width="3" height="8" rx="0.5" />
    </svg>
  );
}

export function DistributeVerticalIcon() {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="4" y="1" width="8" height="3" rx="0.5" />
      <rect x="4" y="6.5" width="8" height="3" rx="0.5" />
      <rect x="4" y="12" width="8" height="3" rx="0.5" />
    </svg>
  );
}
