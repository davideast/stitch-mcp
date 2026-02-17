import type { ReactNode } from "react";

interface PageHeaderProps {
  category: string;
  title: string;
  children?: ReactNode;
}

export function PageHeader({ category, title, children }: PageHeaderProps) {
  return (
    <header>
      <div className="mb-5">
        <span className="text-[11px] font-medium uppercase tracking-widest text-label leading-none">
          {category}
        </span>
      </div>
      <h1 className="text-[44px] leading-[1.1] tracking-[-0.02em] font-normal text-primary mb-6">
        {title}
      </h1>
      <div className="h-[1px] bg-subtle-white w-full mb-6" />
      {children ? (
        <div className="text-[14px] leading-[1.75] text-secondary mb-8">
          {children}
        </div>
      ) : null}
    </header>
  );
}
