interface ComparisonGridProps {
  columns: string[];
  rows: string[][];
}

export function ComparisonGrid({ columns, rows }: ComparisonGridProps) {
  const gridCols =
    columns.length === 2
      ? "grid-cols-2"
      : columns.length === 3
        ? "grid-cols-3"
        : columns.length === 4
          ? "grid-cols-4"
          : "grid-cols-3";

  return (
    <div className="w-full">
      <div
        className={`grid ${gridCols} border-b border-border py-3 text-[11px] text-primary uppercase tracking-widest leading-none`}
      >
        {columns.map((col) => (
          <div key={col}>{col}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid ${gridCols} border-b border-border py-4 text-sm text-secondary`}
        >
          {row.map((cell, j) => (
            <div key={j}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
