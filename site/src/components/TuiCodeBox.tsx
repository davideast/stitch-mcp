import { CopyButton } from "./CopyButton";

interface TuiCodeBoxProps {
  title: string;
  command: string;
}

export function TuiCodeBox({ title, command }: TuiCodeBoxProps) {
  const topWidth = 54;
  const titlePart = `┌─ ${title} `;
  const dashCount = Math.max(0, topWidth - titlePart.length - 1);
  const topLine = `${titlePart}${"─".repeat(dashCount)}┐`;
  const bottomLine = `└${"─".repeat(topWidth - 2)}┘`;

  return (
    <div className="w-full max-w-xl text-left font-mono text-sm">
      <div className="text-dim select-none leading-none">{topLine}</div>
      <div className="bg-bg border-l border-r border-border-strong px-4 py-3 flex justify-between items-center group">
        <code className="text-secondary">
          <span className="text-dim">$</span> {command}
        </code>
        <CopyButton text={command} />
      </div>
      <div className="text-dim select-none leading-none">{bottomLine}</div>
    </div>
  );
}
