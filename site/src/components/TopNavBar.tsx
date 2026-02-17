interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

interface TopNavBarProps {
  links?: NavLink[];
}

export function TopNavBar({ links = [] }: TopNavBarProps) {
  return (
    <nav className="fixed top-0 w-full z-50 bg-bg/95 backdrop-blur-sm border-b border-border-strong">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <a href="/" className="text-white font-bold text-lg">
              &gt; stitch-mcp
              <span className="animate-pulse">_</span>
            </a>
          </div>
          <div className="flex items-center gap-6 text-sm">
            {links.map((link) => (
              <a
                key={link.href}
                className="text-dim hover:text-white transition-colors"
                href={link.href}
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                [ {link.label} ]
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
