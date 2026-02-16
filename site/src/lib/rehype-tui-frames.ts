import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

const TERMINAL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh"]);
const NO_LABEL_LANGUAGES = new Set(["plaintext"]);

function getLabel(language: string): string | null {
  if (NO_LABEL_LANGUAGES.has(language)) return null;
  if (TERMINAL_LANGUAGES.has(language)) return "TERMINAL";
  return language.toUpperCase();
}

function createCopyButton(): Element {
  return {
    type: "element",
    tagName: "button",
    properties: {
      className: ["tui-frame-copy"],
      dataRole: "tui-copy",
      type: "button",
    },
    children: [{ type: "text", value: "COPY" }],
  };
}

/**
 * Rehype plugin that wraps Shiki code blocks in a TUI-style frame
 * with a labeled header bar, decorative dots, and a copy button.
 */
export function rehypeTuiFrames() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (
        node.tagName !== "pre" ||
        !node.properties?.dataLanguage ||
        !parent ||
        index === undefined
      )
        return;

      const language = String(node.properties.dataLanguage);
      const label = getLabel(language);

      const headerRight: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-frame-actions"] },
        children: [
          createCopyButton(),
          {
            type: "element",
            tagName: "div",
            properties: { className: ["tui-frame-dots"] },
            children: [
              { type: "element", tagName: "div", properties: {}, children: [] },
              { type: "element", tagName: "div", properties: {}, children: [] },
            ],
          },
        ],
      };

      const headerChildren: Element[] = [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["tui-frame-label"] },
          children: label ? [{ type: "text", value: label }] : [],
        },
        headerRight,
      ];

      const header: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-frame-header"] },
        children: headerChildren,
      };

      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-frame"] },
        children: [header, node],
      };

      parent.children[index] = wrapper;
    });
  };
}
