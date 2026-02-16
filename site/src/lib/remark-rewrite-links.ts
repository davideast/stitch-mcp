import { visit } from "unist-util-visit";
import type { Root, Link } from "mdast";

/**
 * Remark plugin that rewrites relative `.md` links to `/docs/` paths.
 * e.g. `[Setup](setup.md)` → `[Setup](/docs/setup)`
 *      `[Setup](setup.md#section)` → `[Setup](/docs/setup#section)`
 */
export function remarkRewriteLinks() {
  return (tree: Root) => {
    visit(tree, "link", (node: Link) => {
      const url = node.url;
      if (!url.startsWith("http") && url.includes(".md")) {
        node.url = "/docs/" + url.replace(/\.md(#|$)/, "$1");
      }
    });
  };
}
