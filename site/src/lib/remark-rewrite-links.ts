import { visit } from "unist-util-visit";
import type { Root, Link } from "mdast";

interface Options {
  base?: string;
}

/**
 * Remark plugin that rewrites relative `.md` links to root paths.
 * e.g. `[Setup](setup.md)` → `[Setup](/stitch-mcp/setup)`
 *      `[Setup](setup.md#section)` → `[Setup](/stitch-mcp/setup#section)`
 */
export function remarkRewriteLinks(options: Options = {}) {
  const base = (options.base ?? "").replace(/\/$/, "");
  return (tree: Root) => {
    visit(tree, "link", (node: Link) => {
      const url = node.url;
      if (!url.startsWith("http") && url.includes(".md")) {
        node.url = base + "/" + url.replace(/\.md(#|$)/, "$1");
      }
    });
  };
}
