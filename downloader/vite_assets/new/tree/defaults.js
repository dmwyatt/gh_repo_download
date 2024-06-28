export function defaultNodeTemplate(node, options) {
  const isFolder = node.data.type === "folder";
  return `
    <div class="tree-node ${isFolder ? "folder" : "file"}">
      <div class="node-content">
        <input type="checkbox" class="checkbox">
        ${isFolder ? options.getChevron(node).outerHTML : ""}
        ${options.getIcon(node).outerHTML}
        <span class="node-label">${node.data.name}</span>
      </div>
      ${isFolder ? '<div class="children-container" style="display: none;"></div>' : ""}
    </div>
  `;
}

export function defaultGetChevron(node) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("chevron");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

export function defaultGetIcon(node) {
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
