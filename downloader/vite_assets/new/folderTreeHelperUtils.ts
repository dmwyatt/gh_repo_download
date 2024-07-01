import { TreeNode } from "./tree/TreeNode";
import { TreeRenderFunctions } from "./tree/treeTypes";
import type { SelectedItem } from "./fileSystemTypes";

export function isFileSystemFileHandle(
  handle: FileSystemHandle,
): handle is FileSystemFileHandle {
  return handle.kind === "file";
}

export function getFileSystemNodeTemplate(
  node: TreeNode<any>,
  renderFunctions: TreeRenderFunctions<any>,
): string {
  const isFolder = node.data.type === "folder";
  return `
    <div class="tree-node ${isFolder ? "folder" : "file"}">
      <div class="node-content">
        <input type="checkbox" class="checkbox">
        ${isFolder ? renderFunctions.getChevron(node).outerHTML : ""}
        ${renderFunctions.getIcon(node).outerHTML}
        <span class="node-label">${node.name}</span>
      </div>
      ${isFolder ? '<div class="children-container" style="display: none;"></div>' : ""}
    </div>
  `;
}

export function isValidFile(file: File | null): file is File {
  return file !== null;
}

export function createLoadingElement(): HTMLElement {
  const loading = document.createElement("div");
  loading.className = "folder-tree-loading";
  loading.style.display = "none";
  loading.innerHTML = `
      <div class="spinner"></div>
      <div class="progress-container" style="display: none;">
        <div class="progress-bar"></div>
      </div>
      <p class="loading-message">Selecting folder...</p>
    `;
  return loading;
}

export function getNodePath(node: TreeNode<any>): string {
  const path: string[] = [];
  let currentNode: TreeNode<any> | null = node;
  while (currentNode) {
    path.unshift(currentNode.data.name);
    currentNode = currentNode.parent;
  }
  return path.join("/");
}

export async function getFileFromSelectedItem(
  item: SelectedItem & { type: "file" },
): Promise<File | null> {
  if (item.file instanceof File) {
    return item.file;
  }

  if (!item.handle) {
    console.error(`No file or handle available for ${item.name}`);
    return null;
  }

  if (!isFileSystemFileHandle(item.handle)) {
    console.error(`Handle for ${item.name} is not a file handle`);
    return null;
  }

  try {
    return await item.handle.getFile();
  } catch (error) {
    console.error(`Error getting file for ${item.name}:`, error);
    return null;
  }
}
