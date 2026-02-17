import { useState, useCallback } from "react";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-dim hover:text-primary transition-colors text-xs cursor-pointer"
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? "[done]" : "[copy]"}
    </button>
  );
}
