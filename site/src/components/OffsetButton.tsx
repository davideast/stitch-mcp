import type { ReactNode } from "react";

interface OffsetButtonProps {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
  external?: boolean;
}

export function OffsetButton({
  href,
  variant = "primary",
  children,
  external,
}: OffsetButtonProps) {
  const shadowColor =
    variant === "primary" ? "bg-dim" : "bg-border-strong";
  const bgColor =
    variant === "primary"
      ? "border-white bg-white text-black"
      : "border-border-strong bg-bg text-secondary hover:bg-surface";

  return (
    <a
      className="group relative inline-block focus:outline-none"
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <span
        className={`absolute inset-0 translate-x-1 translate-y-1 ${shadowColor} group-hover:translate-x-1.5 group-hover:translate-y-1.5 transition-transform`}
      />
      <span
        className={`relative block border px-8 py-3 text-sm font-bold uppercase tracking-widest group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 transition-transform ${bgColor}`}
      >
        {children}
      </span>
    </a>
  );
}
