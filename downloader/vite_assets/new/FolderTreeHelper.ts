import { getFileSystemIcon } from "./fileSystemHelpers";
import { defaultGetChevron } from "./tree/defaults";
import { TreeRenderer } from "./tree/TreeRenderer";
import { Tree } from "./tree/Tree";
import { TreeNode } from "./tree/TreeNode";
import { TreeConfig, TreeRenderFunctions } from "./tree/treeTypes";
import { FileSystemHelper } from "./FileSystemHelper";
import type { FileSystemNodeData } from "./tree/TreeNode";
import type { SelectionValidator } from "./tree/TreeStateManager";

interface SelectedItem {
  name: string;
  type: "file" | "folder";
  path: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle | null;
  file: File | null;
}

export class FolderTreeHelper {
  private readonly container: HTMLElement;
  private readonly loadingElement: HTMLElement;
  private fileMap: Map<TreeNode<FileSystemNodeData>, File>;
  private fileSystemHelper: FileSystemHelper;
  private readonly treeConfig: TreeConfig<FileSystemNodeData>;
  private renderer?: TreeRenderer<FileSystemNodeData>;

  constructor(
    container: HTMLElement,
    selectionValidator: SelectionValidator<FileSystemNodeData> = () => true,
  ) {
    this.container = container;
    this.loadingElement = this.createLoadingElement();
    this.container.appendChild(this.loadingElement);
    this.fileMap = new Map();
    this.fileSystemHelper = new FileSystemHelper();

    this.treeConfig = {
      renderFunctions: {
        getNodeTemplate: getFileSystemNodeTemplate,
        getIcon: getFileSystemIcon,
        getChevron: defaultGetChevron,
        shouldInitiallyHideChildren: (node: TreeNode<any>) =>
          node.data.type === "folder",
      },
      eventHandlers: {
        onSelect: (selectedItems) => {
          console.log("Selected items:", selectedItems);
        },
        onToggle: (node, isOpen) => {
          console.log("Node toggled:", node, "Is open:", isOpen);
        },
      },
      selectionValidator: selectionValidator,
    };
  }

  private createLoadingElement(): HTMLElement {
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

  showLoading(message: string, useSpinner: boolean = true): void {
    console.log(`Showing loading indicator: ${message}`);
    this.loadingElement.style.display = "flex";
    this.updateLoadingMessage(message);
    (
      this.loadingElement.querySelector(".spinner") as HTMLElement
    ).style.display = useSpinner ? "block" : "none";
    (
      this.loadingElement.querySelector(".progress-container") as HTMLElement
    ).style.display = useSpinner ? "none" : "block";
  }

  hideLoading(): void {
    console.log("Hiding loading indicator");
    this.loadingElement.style.display = "none";
  }

  updateLoadingMessage(message: string): void {
    const messageElement =
      this.loadingElement.querySelector(".loading-message");
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  updateProgress(progress: number, total: number): void {
    const percentage = total > 0 ? (progress / total) * 100 : 0;
    const progressBar = this.loadingElement.querySelector(
      ".progress-bar",
    ) as HTMLElement;
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    this.updateLoadingMessage(
      `Processing files... ${progress} / ${total} (${Math.round(percentage)}%)`,
    );
  }

  async selectFolder(): Promise<Tree<any> | null> {
    console.log("selectFolder started");
    this.showLoading("Selecting folder...", true);
    let rootNode: TreeNode<any>;
    if ("showDirectoryPicker" in window) {
      try {
        console.log("Using showDirectoryPicker");
        const directoryHandle = await (window as any).showDirectoryPicker();
        console.log("Directory selected, processing files");
        this.showLoading("Processing files...", true);
        rootNode =
          await this.fileSystemHelper.buildTreeFromDirectoryHandle(
            directoryHandle,
          );
      } catch (err) {
        console.error("Error selecting directory:", err);
        this.hideLoading();
        return null;
      }
    } else {
      console.log("Falling back to file input");
      rootNode = await this.fallbackToFileInput();
    }

    if (rootNode) {
      console.log("Tree built, rendering");
      const tree = this.renderTree(rootNode);
      this.hideLoading();
      return tree;
    } else {
      this.hideLoading();
      return null;
    }
  }

  private async fallbackToFileInput(): Promise<TreeNode<any>> {
    return new Promise((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      (fileInput as any).webkitdirectory = true;
      (fileInput as any).directory = true;
      fileInput.multiple = true;

      fileInput.onchange = async (event: Event) => {
        console.log("Files selected via input");
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length === 0) {
          console.log("No files selected");
          this.hideLoading();
          resolve(null as any);
          return;
        }

        if (files) {
          console.log(`${files.length} files selected`);
          this.showLoading(`Processing 0 / ${files.length} files...`, false);
          const rootNode = await this.fileSystemHelper.buildTreeFromFiles(
            Array.from(files),
          );
          resolve(rootNode);
        }
      };

      console.log("Opening file input dialog");
      fileInput.click();
    });
  }

  renderTree(rootNode: TreeNode<any>): Tree<any> {
    console.log("Rendering tree");
    this.container.innerHTML = "";
    this.container.appendChild(this.loadingElement);
    const tree = new Tree([rootNode]);
    this.renderer = new TreeRenderer(tree, this.container, this.treeConfig);
    this.renderer.render();
    return tree;
  }

  getSelectedItems(): SelectedItem[] {
    if (this.renderer && this.renderer.stateManager) {
      const selectedNodes = Array.from(
        this.renderer.stateManager.state.selectedItems.entries(),
      )
        .filter(([_, isSelected]) => isSelected === true)
        .map(([node]) => node);

      return selectedNodes.map((node): SelectedItem => {
        const handle = node.data.handle;
        let fileSystemHandle:
          | FileSystemFileHandle
          | FileSystemDirectoryHandle
          | null = null;

        if (handle) {
          if (handle.kind === "file") {
            fileSystemHandle = handle as FileSystemFileHandle;
          } else if (handle.kind === "directory") {
            fileSystemHandle = handle as FileSystemDirectoryHandle;
          }
        }

        return {
          name: node.name,
          type: node.data.type,
          path: this.getNodePath(node),
          handle: fileSystemHandle,
          file: this.fileMap.get(node) || null,
        };
      });
    }
    return [];
  }

  private getNodePath(node: TreeNode<any>): string {
    const path: string[] = [];
    let currentNode: TreeNode<any> | null = node;
    while (currentNode) {
      path.unshift(currentNode.data.name);
      currentNode = currentNode.parent;
    }
    return path.join("/");
  }

  async readSelectedFiles(): Promise<
    Array<{ name: string; path: string; content: string }>
  > {
    const selectedItems = this.getSelectedItems();
    const fileContents: Array<{ name: string; path: string; content: string }> =
      [];

    for (const item of selectedItems) {
      if (item.type === "file" && item.handle) {
        if (isFileSystemFileHandle(item.handle)) {
          try {
            const file = await item.handle.getFile();
            const content = await file.text();
            fileContents.push({ name: item.name, path: item.path, content });
          } catch (error) {
            console.error(`Error reading file ${item.name}:`, error);
          }
        } else {
          console.warn(
            `Expected file handle for ${item.name}, but got directory handle`,
          );
        }
      }
    }

    return fileContents;
  }

  private async yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async getSelectedFilesForUpload(): Promise<File[]> {
    const selectedItems = this.getSelectedItems();
    const filePromises = selectedItems
      .filter(
        (item): item is SelectedItem & { type: "file" } => item.type === "file",
      )
      .map(this.getFileFromSelectedItem.bind(this));

    return (await Promise.all(filePromises)).filter(this.isValidFile);
  }

  private async getFileFromSelectedItem(
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

  private isValidFile(file: File | null): file is File {
    return file !== null;
  }

  getFileCount(node: TreeNode<FileSystemNodeData>): number {
    return this.fileSystemHelper.getFileCount(node);
  }

  getTotalSize(node: TreeNode<FileSystemNodeData>): number {
    return this.fileSystemHelper.getTotalSize(node);
  }
}

export function isFile(item: { type: string }): boolean {
  return item.type === "file";
}

export function isFileSystemFileHandle(
  handle: FileSystemHandle,
): handle is FileSystemFileHandle {
  return handle.kind === "file";
}

export function isRegularFile(item: { type: string; file?: File }): boolean {
  return isFile(item) && item.file instanceof File;
}

export async function getFileFromItem(
  item: SelectedItem,
): Promise<File | null> {
  if (item.file instanceof File) {
    return item.file;
  } else if (item.handle && isFileSystemFileHandle(item.handle)) {
    try {
      return await item.handle.getFile();
    } catch (error) {
      console.error(`Error getting file for ${item.name}:`, error);
      return null;
    }
  }
  return null;
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
