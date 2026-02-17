interface NavLink {
  label: string;
  href: string;
}

interface PrevNextNavProps {
  prev?: NavLink;
  next?: NavLink;
}

export function PrevNextNav({ prev, next }: PrevNextNavProps) {
  return (
    <nav className="flex justify-between items-center pt-10 border-t border-border mt-12 text-sm">
      {prev ? (
        <a
          className="group flex items-center gap-3 text-secondary hover:text-white transition-colors"
          href={prev.href}
        >
          <span className="group-hover:-translate-x-1 transition-transform">
            &larr;
          </span>
          <span>{prev.label}</span>
        </a>
      ) : (
        <div />
      )}
      {next ? (
        <a
          className="group flex items-center gap-3 text-secondary hover:text-white transition-colors"
          href={next.href}
        >
          <span>{next.label}</span>
          <span className="group-hover:translate-x-1 transition-transform">
            &rarr;
          </span>
        </a>
      ) : (
        <div />
      )}
    </nav>
  );
}
