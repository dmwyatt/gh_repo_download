// folderTreeHelper.js
import { TreeNode, Tree, TreeRenderer } from "./tree.js";

export class FolderTreeHelper {
  constructor(container) {
    this.container = container;
    this.loadingElement = this.createLoadingElement();
    this.container.appendChild(this.loadingElement);
    this.processingCount = 0;
    this.totalFiles = 0;
    this.processedFiles = 0;
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
        this.showLoading("Processing files...", true); // Keep using spinner
        rootNode = await this.buildTreeFromDirectoryHandle(directoryHandle);
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
  async buildTreeFromDirectoryHandle(directoryHandle, parentNode = null) {
    const node = new TreeNode({ name: directoryHandle.name, type: "folder" });
    if (parentNode) parentNode.addChild(node);

    for await (const entry of directoryHandle.values()) {
      if (entry.kind === "file") {
        const fileNode = new TreeNode({ name: entry.name, type: "file" });
        node.addChild(fileNode);
      } else if (entry.kind === "directory") {
        await this.buildTreeFromDirectoryHandle(entry, node);
      }
    }

    return node;
  }
  fallbackToFileInput() {
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
        this.totalFiles = files.length;
        this.showLoading(`Processing 0 / ${files.length} files...`, false);
        const rootFolderName = files[0].webkitRelativePath.split("/")[0];
        const rootNode = new TreeNode({ name: rootFolderName, type: "folder" });
        console.log("Building tree from files");
        await this.buildTreeFromFiles(rootNode, Array.from(files));
        resolve(rootNode);
      };

      console.log("Opening file input dialog");
      fileInput.click();
    });
  }

  async buildTreeFromFiles(rootNode, files) {
    console.log(`Building tree from ${files.length} files`);
    const pathMap = new Map();
    pathMap.set(rootNode.data.name, rootNode);

    this.processedFiles = 0; // Reset processed files count

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.processedFiles++;
      if (
        this.processedFiles % 100 === 0 ||
        this.processedFiles === files.length
      ) {
        this.updateProgress(this.processedFiles, this.totalFiles);
        await this.yieldToMain();
      }

      const pathParts = file.webkitRelativePath.split("/");
      let currentNode = rootNode;

      for (let j = 1; j < pathParts.length; j++) {
        const part = pathParts[j];
        const path = pathParts.slice(0, j + 1).join("/");

        if (!pathMap.has(path)) {
          const newNode = new TreeNode({
            name: part,
            type: j === pathParts.length - 1 ? "file" : "folder",
          });
          currentNode.addChild(newNode);
          pathMap.set(path, newNode);
        }

        currentNode = pathMap.get(path);
      }
    }
    this.updateProgress(this.totalFiles, this.totalFiles); // Ensure we reach 100%
    console.log("Finished building tree from files");
  }

  async yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  renderTree(rootNode) {
    console.log("Rendering tree");
    this.container.innerHTML = ""; // Clear previous tree
    this.container.appendChild(this.loadingElement); // Re-add loading element
    const tree = new Tree([rootNode]);
    const renderer = new TreeRenderer(tree, this.container);
    renderer.render();
    return tree;
  }
}
