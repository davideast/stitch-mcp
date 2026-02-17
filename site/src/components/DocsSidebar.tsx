import type { ReactNode } from "react";

interface SidebarLink {
  label: string;
  href: string;
}

interface SidebarSection {
  category: string;
  links: SidebarLink[];
}

interface DocsSidebarProps {
  sections: SidebarSection[];
  activePath?: string;
  basePath?: string;
}

const GitHubIcon = () => (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height="12"
    width="12"
    viewBox="0 0 16 16"
  >
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.12-1.61.63-1.76-1.63-.09-.52-.51-.92-.85-1.02-.08-.02-.12-.01-.06.07.21.28.46.72.63 1.25.13.41.44.82 1.13.91.73.1.91.43.95.66.01.55 0 1.29 0 1.54 0 .21-.15.46-.55.38A8.013 8.013 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>
);

/** Short sidebar labels — keep every entry to one line. */
const NAV_LABELS: Record<string, string> = {
  "Connect Your Agent": "Connect Agent",
  "Connection Modes": "Connections",
  "Use Stitch Tools in Agents": "Stitch Tools",
  "Agent Skills": "Agent Skills",
  "Build an Agent Skill": "Build a Skill",
  "Tool Catalog": "Tool Catalog",
  "Virtual Tools": "Virtual Tools",
  "Build a Virtual Tool": "Build a Tool",
  "Command Reference": "Commands",
  "Preview Designs": "Previewing",
};

export function DocsSidebar({ sections, activePath, basePath = "" }: DocsSidebarProps) {
  return (
    <aside className="fixed top-0 left-0 w-[200px] h-screen bg-bg border-r border-subtle-white flex flex-col p-6 z-50">
      <div className="mb-10">
        <a href={`${basePath}/`} className="text-[13px] text-white font-mono">
          stitch-mcp
        </a>
      </div>

      <nav className="flex-1 space-y-8">
        {sections.map((section) => (
          <div key={section.category}>
            <h3 className="text-dim text-[11px] uppercase tracking-wider mb-3">
              {section.category}
            </h3>
            <ul className="space-y-2">
              {section.links.map((link) => {
                const isActive = link.href === activePath;
                const label = NAV_LABELS[link.label] ?? link.label;
                return (
                  <li key={link.href}>
                    <a
                      className={`text-[12px] block pl-4 whitespace-nowrap ${
                        isActive
                          ? "text-primary border-l border-primary"
                          : "text-secondary hover:text-primary transition-colors border-l border-transparent"
                      }`}
                      href={link.href}
                    >
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <a
          className="text-[12px] text-dim hover:text-secondary transition-colors flex items-center gap-2"
          href="https://github.com/nicepkg/stitch-mcp"
        >
          <GitHubIcon />
          GitHub
        </a>
      </div>
    </aside>
  );
}
