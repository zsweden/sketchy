import type { ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}

export default function FormField({ label, children }: Props) {
  return (
    <div className="section-stack" style={{ gap: '0.375rem' }}>
      <p className="section-label">{label}</p>
      {children}
    </div>
  );
}
