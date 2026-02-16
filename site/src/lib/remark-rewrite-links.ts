import { visit } from "unist-util-visit";
import type { Root, Link } from "mdast";

/**
 * Remark plugin that rewrites relative `.md` links to root paths.
 * e.g. `[Setup](setup.md)` → `[Setup](/setup)`
 *      `[Setup](setup.md#section)` → `[Setup](/setup#section)`
 */
export function remarkRewriteLinks() {
  return (tree: Root) => {
    visit(tree, "link", (node: Link) => {
      const url = node.url;
      if (!url.startsWith("http") && url.includes(".md")) {
        node.url = "/" + url.replace(/\.md(#|$)/, "$1");
      }
    });
  };
}
