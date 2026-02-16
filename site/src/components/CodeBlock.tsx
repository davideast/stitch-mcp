import type { ReactNode } from "react";

interface CodeBlockProps {
  /** Header label like "MCP CONFIG" or "FILE TREE". Omit for unlabeled blocks. */
  label?: string;
  children: ReactNode;
}

export function CodeBlock({ label, children }: CodeBlockProps) {
  if (label) {
    return (
      <div className="bg-bg border border-border-strong text-sm">
        <div className="bg-surface border-b border-border-strong px-3 py-1 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-white uppercase">
            {label}
          </span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-border-strong" />
            <div className="w-2 h-2 bg-border-strong" />
          </div>
        </div>
        <div className="p-6 overflow-x-auto">{children}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-6 border border-border-strong overflow-x-auto text-sm">
      {children}
    </div>
  );
}
