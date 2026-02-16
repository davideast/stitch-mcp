import type { ReactNode } from "react";

interface DiagramBoxProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function DiagramBox({ label, children, className }: DiagramBoxProps) {
  return (
    <div
      className={`bg-surface p-6 border border-border-strong${className ? ` ${className}` : ""}`}
    >
      <div className="text-[11px] text-secondary mb-4 uppercase tracking-widest leading-none">
        {label}
      </div>
      <pre className="text-xs text-secondary leading-tight whitespace-pre overflow-x-auto">
        {children}
      </pre>
    </div>
  );
}
