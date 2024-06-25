class FileSystemBrowser {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.tree = null;
    this.treeRenderer = null;
    this.processingIndicator = this.createProcessingIndicator();
    this.containerElement.appendChild(this.processingIndicator);
  }

  createProcessingIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "processing-indicator";
    indicator.textContent = "Processing...";
    indicator.style.display = "none";
    // Add any additional styling here
    return indicator;
  }

  showProcessingIndicator() {
    this.processingIndicator.style.display = "block";
  }

  hideProcessingIndicator() {
    this.processingIndicator.style.display = "none";
  }

  async selectFolder() {
    try {
      this.showProcessingIndicator();
      const directoryHandle = await window.showDirectoryPicker();
      this.tree = await this.createTreeFromDirectoryHandle(directoryHandle);
      await this.renderTree();
    } catch (error) {
      console.error("Error selecting folder:", error);
      // Optionally, show an error message to the user
    } finally {
      this.hideProcessingIndicator();
    }
  }

  async createTreeFromDirectoryHandle(directoryHandle, path = "") {
    const tree = new Tree();
    const rootNode = new TreeNode({
      name: directoryHandle.name,
      type: "folder",
    });
    tree.addNode(rootNode);

    for await (const entry of directoryHandle.values()) {
      if (entry.kind === "file") {
        rootNode.addChild(new TreeNode({ name: entry.name, type: "file" }));
      } else if (entry.kind === "directory") {
        const subTree = await this.createTreeFromDirectoryHandle(
          entry,
          `${path}/${entry.name}`,
        );
        rootNode.addChild(subTree.nodes[0]);
      }
    }

    return tree;
  }

  async renderTree() {
    if (!this.tree) {
      console.error("No tree to render");
      return;
    }

    this.treeRenderer = new TreeRenderer(this.tree, this.containerElement, {
      onToggle: (node, isOpen) => {
        console.log(`${node.data.name} is now ${isOpen ? "open" : "closed"}`);
      },
      onSelect: (selectedItems) => {
        console.log("Selected items:", selectedItems);
      },
    });

    await this.treeRenderer.render();
  }
}
