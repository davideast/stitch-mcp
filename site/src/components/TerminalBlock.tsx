import type { ReactNode } from "react";

interface TerminalBlockProps {
  /** Header label, defaults to "TERMINAL" */
  label?: string;
  children: ReactNode;
}

export function TerminalBlock({
  label = "TERMINAL",
  children,
}: TerminalBlockProps) {
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
      <div className="p-6 text-secondary space-y-4 font-mono">{children}</div>
    </div>
  );
}

/** A single command line: $ command */
interface CommandLineProps {
  command: string;
  output?: string;
}

export function CommandLine({ command, output }: CommandLineProps) {
  return (
    <>
      <div className="flex">
        <span className="text-dim mr-3 select-none">$</span>
        <span className="text-white font-bold">{command}</span>
      </div>
      {output ? (
        <div className="text-dim pl-6 pb-2 border-l border-border-strong ml-1">
          {output}
        </div>
      ) : null}
    </>
  );
}
