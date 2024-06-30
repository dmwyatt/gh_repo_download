import { TreeNode } from "./tree/TreeNode";

export function getFileSystemIcon(node: TreeNode<any>): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  if (node.data.type === "folder") {
    path.setAttribute(
      "d",
      "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
    );
    path.setAttribute("fill", "#FFA000");
  } else {
    path.setAttribute(
      "d",
      "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
    );
    path.setAttribute("fill", "#42A5F5");
  }
  svg.appendChild(path);
  return svg;
}
