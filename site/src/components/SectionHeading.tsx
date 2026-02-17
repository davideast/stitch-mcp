import type { ReactNode } from "react";

interface SectionHeadingProps {
  as?: "h2" | "h3";
  children: ReactNode;
  className?: string;
}

const styles = {
  h2: "text-[28px] leading-[1.3] text-primary font-medium",
  h3: "text-[18px] leading-[1.4] text-primary font-medium",
} as const;

export function SectionHeading({
  as: Tag = "h2",
  children,
  className,
}: SectionHeadingProps) {
  return (
    <Tag className={`${styles[Tag]}${className ? ` ${className}` : ""}`}>
      {children}
    </Tag>
  );
}
