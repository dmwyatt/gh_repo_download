import { TreeNode } from "./TreeNode";
import { RenderOptions } from "./treeTypes";

export function defaultGetNodeTemplate(
  node: TreeNode<any>,
  options: RenderOptions,
): string {
  const isFolder = node.data.type === "folder";
  return `
    <div class="tree-node ${isFolder ? "folder" : "file"}">
      <div class="node-content">
        <input type="checkbox" class="checkbox">
        ${isFolder ? options.getChevron(node).outerHTML : ""}
        ${options.getIcon(node).outerHTML}
        <span class="node-label">${node.name}</span>
      </div>
      ${isFolder ? '<div class="children-container" style="display: none;"></div>' : ""}
    </div>
  `;
}

export function defaultGetChevron(node: TreeNode<any>): SVGSVGElement {
  const svg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  ) as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("chevron");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

export function defaultGetIcon(node: TreeNode<any>): SVGSVGElement {
  const svg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  ) as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("icon");
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");
  circle.setAttribute("fill", "#999999");
  svg.appendChild(circle);
  return svg;
}
