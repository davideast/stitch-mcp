import type { ReactNode } from "react";

interface SectionDividerProps {
  children: ReactNode;
  /** Center the heading with dashes on both sides (like GET STARTED). Default: trailing rule only. */
  centered?: boolean;
}

export function SectionDivider({
  children,
  centered = false,
}: SectionDividerProps) {
  if (centered) {
    return (
      <div className="flex items-center gap-4 text-dim justify-center">
        <span className="text-border-strong">──────</span>
        <h2 className="text-xl font-bold text-white uppercase tracking-widest">
          {children}
        </h2>
        <span className="text-border-strong">──────</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-dim">
      <span className="text-border-strong">──────</span>
      <h2 className="text-xl font-bold text-white uppercase tracking-widest whitespace-nowrap">
        {children}
      </h2>
      <span className="flex-grow border-b border-border-strong" />
    </div>
  );
}
