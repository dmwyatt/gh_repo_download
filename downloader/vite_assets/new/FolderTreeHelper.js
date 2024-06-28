import { FileSystemHelper } from "./FileSystemHelper";
import { TreeRenderer } from "./tree/TreeRenderer";
import { Tree } from "./tree/Tree";
export class FolderTreeHelper {
  constructor(container, selectionValidator = () => true) {
    this.container = container;
    this.loadingElement = this.createLoadingElement();
    this.container.appendChild(this.loadingElement);
    this.totalFiles = 0;
    this.processedFiles = 0;
    this.fileMap = new Map();
    this.selectionValidator = selectionValidator;
    this.fileSystemHelper = new FileSystemHelper();
  }

  createLoadingElement() {
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

  showLoading(message, useSpinner = true) {
    console.log(`Showing loading indicator: ${message}`);
    this.loadingElement.style.display = "flex";
    this.updateLoadingMessage(message);
    this.loadingElement.querySelector(".spinner").style.display = useSpinner
      ? "block"
      : "none";
    this.loadingElement.querySelector(".progress-container").style.display =
      useSpinner ? "none" : "block";
  }

  hideLoading() {
    console.log("Hiding loading indicator");
    this.loadingElement.style.display = "none";
  }

  updateLoadingMessage(message) {
    const messageElement =
      this.loadingElement.querySelector(".loading-message");
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  updateProgress(progress, total) {
    const percentage = total > 0 ? (progress / total) * 100 : 0;
    const progressBar = this.loadingElement.querySelector(".progress-bar");
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    this.updateLoadingMessage(
      `Processing files... ${progress} / ${total} (${Math.round(percentage)}%)`,
    );
  }

  async selectFolder() {
    console.log("selectFolder started");
    this.showLoading("Selecting folder...", true);
    let rootNode;
    if ("showDirectoryPicker" in window) {
      try {
        console.log("Using showDirectoryPicker");
        const directoryHandle = await window.showDirectoryPicker();
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

  async fallbackToFileInput() {
    return new Promise((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.webkitdirectory = true;
      fileInput.directory = true;
      fileInput.multiple = true;

      fileInput.onchange = async (event) => {
        console.log("Files selected via input");
        const files = event.target.files;
        if (files.length === 0) {
          console.log("No files selected");
          this.hideLoading();
          resolve(null);
          return;
        }

        console.log(`${files.length} files selected`);
        this.showLoading(`Processing 0 / ${files.length} files...`, false);
        const rootNode = await this.fileSystemHelper.buildTreeFromFiles(
          Array.from(files),
        );
        resolve(rootNode);
      };

      console.log("Opening file input dialog");
      fileInput.click();
    });
  }
  renderTree(rootNode) {
    console.log("Rendering tree");
    this.container.innerHTML = "";
    this.container.appendChild(this.loadingElement);
    const tree = new Tree([rootNode]);
    this.renderer = new TreeRenderer(tree, this.container, {
      selectionValidator: this.selectionValidator,
    });
    this.renderer.render();
    return tree;
  }

  getSelectedItems() {
    if (this.renderer && this.renderer.stateManager) {
      const selectedNodes = Array.from(
        this.renderer.stateManager.state.selectedItems.entries(),
      )
        .filter(([node, isSelected]) => isSelected === true)
        .map(([node]) => node);

      return selectedNodes.map((node) => ({
        name: node.data.name,
        type: node.data.type,
        path: this.getNodePath(node),
        handle: node.data.handle || null,
        file: this.fileMap.get(node) || null,
      }));
    }
    return [];
  }

  getNodePath(node) {
    const path = [];
    let currentNode = node;
    while (currentNode) {
      path.unshift(currentNode.data.name);
      currentNode = currentNode.parent;
    }
    return path.join("/");
  }

  async readSelectedFiles() {
    const selectedItems = this.getSelectedItems();
    const fileContents = [];

    for (const item of selectedItems) {
      if (item.type === "file") {
        if (item.handle) {
          const file = await item.handle.getFile();
          const content = await file.text();
          fileContents.push({ name: item.name, path: item.path, content });
        } else if (item.file) {
          const content = await item.file.text();
          fileContents.push({ name: item.name, path: item.path, content });
        }
      }
    }

    return fileContents;
  }

  async yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  getSelectedFilesForUpload() {
    const selectedItems = this.getSelectedItems();
    return selectedItems
      .filter((item) => item.type === "file")
      .map((item) => item.file || item.handle)
      .filter(Boolean);
  }

  getFileCount(node) {
    return this.fileSystemHelper.getFileCount(node);
  }

  getTotalSize(node) {
    return this.fileSystemHelper.getTotalSize(node);
  }
}

export function isFile(item) {
  return item.type === "file";
}

export function isFileSystemFileHandle(item) {
  return item.handle && item.handle.kind === "file";
}

export function isRegularFile(item) {
  return isFile(item) && item.file instanceof File;
}

export async function getFileFromItem(item) {
  if (isRegularFile(item)) {
    return item.file;
  } else if (isFileSystemFileHandle(item)) {
    return item.handle.getFile();
  }
  return null;
}
