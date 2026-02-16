interface Tool {
  name: string;
  description: string;
}

interface ToolDefinitionListProps {
  tools: Tool[];
}

export function ToolDefinitionList({ tools }: ToolDefinitionListProps) {
  return (
    <div className="space-y-0 divide-y divide-border-strong border-t border-b border-border-strong">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="py-6 flex flex-col sm:flex-row gap-4 sm:gap-12"
        >
          <code className="font-normal text-primary text-sm sm:w-48 shrink-0">
            {tool.name}
          </code>
          <p className="text-[14px] leading-[1.75] text-secondary">
            {tool.description}
          </p>
        </div>
      ))}
    </div>
  );
}
