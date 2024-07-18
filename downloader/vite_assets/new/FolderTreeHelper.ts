import { getFileSystemIcon } from "./fileSystemHelpers";
import { defaultGetChevron } from "./tree/defaults";
import { TreeRenderer } from "./tree/TreeRenderer";
import { Tree } from "./tree/Tree";
import type { FileSystemNodeData } from "./tree/TreeNode";
import { TreeNode } from "./tree/TreeNode";
import { TreeConfig } from "./tree/treeTypes";
import { FileSystemHelper } from "./FileSystemHelper";
import type { SelectionValidator } from "./tree/TreeStateManager";
import {
  getFileFromSelectedItem,
  getFileSystemNodeTemplate,
  getNodePath,
  isFileSystemFileHandle,
  isValidFile,
} from "./folderTreeHelperUtils";
import { SelectedItem } from "./fileSystemTypes";
import { loadingManager } from "./loading/LoadingManager";

export class FolderTreeHelper {
  private container: HTMLElement;
  private fileSystemHelper: FileSystemHelper;
  private readonly treeConfig: TreeConfig<FileSystemNodeData>;
  private renderer?: TreeRenderer<FileSystemNodeData>;

  constructor(
    container: HTMLElement,
    selectionValidator: SelectionValidator<FileSystemNodeData> = () => true,
  ) {
    this.container = container;
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

  async selectFolder(): Promise<Tree<any> | null> {
    console.log("selectFolder started");
    let rootNode: TreeNode<any>;

    try {
      loadingManager.sendMessage({
        type: "start",
        message: "Selecting directory...",
      });

      if ("webkitdirectory" in HTMLInputElement.prototype) {
        console.log("Using webkitdirectory input");
        rootNode = await this.useWebkitDirectoryInput();
      } else if ("showDirectoryPicker" in window) {
        console.log("Using File System Access API");
        const directoryHandle = await window.showDirectoryPicker();
        rootNode =
          await this.fileSystemHelper.buildTreeFromDirectoryHandle(
            directoryHandle,
          );
      } else {
        throw new Error("Folder selection not supported in this browser");
      }
    } catch (err) {
      console.error("Error selecting directory:", err);
      loadingManager.sendMessage({ type: "end" });
      return null;
    }

    if (rootNode) {
      console.log("Tree built, rendering");
      loadingManager.sendMessage({ type: "end" });
      return this.renderTree(rootNode);
    } else {
      loadingManager.sendMessage({ type: "end" });
      return null;
    }
  }

  private useWebkitDirectoryInput(): Promise<TreeNode<any>> {
    return new Promise((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.webkitdirectory = true;
      fileInput.multiple = true;

      fileInput.onchange = async (event: Event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          console.log(`${files.length} files selected`);
          const rootNode = await this.fileSystemHelper.buildTreeFromFiles(
            Array.from(files),
          );
          resolve(rootNode);
        } else {
          console.log("No files selected");
          resolve(null as any);
        }
      };

      console.log("Opening file input dialog");
      fileInput.click();
    });
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
          loadingManager.sendMessage({ type: "end" });
          resolve(null as any);
          return;
        }

        if (files) {
          console.log(`${files.length} files selected`);
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
          path: getNodePath(node),
          handle: fileSystemHandle,
          file: this.fileSystemHelper.getFileForNode(node) || null,
        };
      });
    }
    return [];
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
      .map(getFileFromSelectedItem);

    return (await Promise.all(filePromises)).filter(isValidFile);
  }

  getFileCount(node: TreeNode<FileSystemNodeData>): number {
    return this.fileSystemHelper.getFileCount(node);
  }

  getTotalSize(node: TreeNode<FileSystemNodeData>): number {
    return this.fileSystemHelper.getTotalSize(node);
  }

  resetSelection() {
    if (this.renderer && this.renderer.stateManager) {
      this.renderer.stateManager.resetSelection();
    }
  }
}
