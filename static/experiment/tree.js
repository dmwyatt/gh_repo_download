class TreeNode {
  constructor(data) {
    this.data = data;
    this.children = [];
    this.parent = null;
    // References to DOM elements for efficient updates
    this.element = null;
    this.checkbox = null;
  }

  // Establishes parent-child relationship between nodes
  addChild(childNode) {
    childNode.parent = this;
    this.children.push(childNode);
  }
}

class Tree {
  constructor(nodes = []) {
    this.nodes = nodes;
  }

  // Adds a new root-level node to the tree
  addNode(node) {
    this.nodes.push(node);
  }
}

class TreeRenderer {
  constructor(tree, containerElement, options = {}) {
    this.tree = tree;
    this.containerElement = containerElement;
    // Merge default options with user-provided options
    this.options = {
      nodeTemplate: this.defaultNodeTemplate.bind(this),
      getIcon: this.defaultGetIcon,
      getChevron: this.defaultGetChevron,
      onToggle: () => {},
      onSelect: () => {},
      ...options,
    };
    // Map to track selected items for efficient lookup
    this.selectedItems = new Map();
    // Inject CSS styles for the tree structure
    this.injectCSS();
  }

  injectCSS() {
    const styleId = "tree-renderer-styles";
    // Avoid duplicating styles if already injected
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .tree-node {
          margin-left: 20px;
        }
        .node-content {
          display: flex;
          align-items: center;
          user-select: none;
          padding: 5px;
        }
        .icon, .chevron {
          width: 24px;
          height: 24px;
          margin-right: 5px;
        }
        .chevron {
          transition: transform 0.3s ease;
          cursor: pointer;
        }
        .open > .node-content > .chevron {
          transform: rotate(90deg);
        }
        .checkbox {
          margin-right: 5px;
        }
        .node-label {
          cursor: pointer;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async render() {
    this.containerElement.innerHTML = "";
    for (const node of this.tree.nodes) {
      await this.renderNode(node, this.containerElement);
    }
  }

  async renderNode(node, parentElement, isInitialRender = false) {
    // Create a temporary container to hold the node's HTML
    const template = document.createElement("template");
    template.innerHTML = this.options.nodeTemplate(node).trim();
    const nodeElement = template.content.firstChild;
    // Store reference to the DOM element for efficient updates
    node.element = nodeElement;

    // Set up checkbox event listener
    const checkbox = nodeElement.querySelector(".checkbox");
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        this.toggleSelection(node);
      });
      // Store reference to checkbox for efficient updates
      node.checkbox = checkbox;
    }

    // Set up chevron (expand/collapse) event listener for folders
    const chevron = nodeElement.querySelector(".chevron");
    if (chevron && node.data.type === "folder") {
      chevron.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleFolder(node);
      });
    }

    // Set up label click event listener
    const label = nodeElement.querySelector(".node-label");
    if (label) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        if (node.data.type === "folder") {
          this.toggleFolder(node);
        }
      });
    }

    // Add the node to the DOM
    parentElement.appendChild(nodeElement);

    // Implement lazy loading for folder contents
    if (node.data.type === "folder" && isInitialRender) {
      const childrenContainer = nodeElement.querySelector(
        ".children-container",
      );
      if (childrenContainer) {
        childrenContainer.style.display = "none"; // Hide children initially
      }
    }
  }

  toggleFolder(node) {
    const nodeElement = node.element;
    const childrenContainer = nodeElement.querySelector(".children-container");
    const isOpen = childrenContainer.style.display !== "none";

    if (!isOpen && childrenContainer.childElementCount === 0) {
      // Lazy load child nodes when opening a folder for the first time
      const fragment = document.createDocumentFragment();
      node.children.forEach((child) => this.renderNode(child, fragment));
      childrenContainer.appendChild(fragment);
    }

    // Toggle visibility of children
    childrenContainer.style.display = isOpen ? "none" : "block";
    // Update visual state of the folder (open/closed)
    nodeElement.classList.toggle("open", !isOpen);
    // Trigger onToggle callback with the node and its new state
    this.options.onToggle(node, !isOpen);
  }
  toggleSelection(node) {
    // Get the current selection state of the node
    const currentState = this.selectedItems.get(node);
    // Toggle the state
    let newState = !currentState;

    // Update the node's selection state
    this.setNodeSelectionState(node, newState);
    // Propagate the selection state to all children
    this.updateChildrenSelection(node, newState);
    // Update the selection state of parent nodes
    this.updateParentSelection(node.parent);

    // Trigger the onSelect callback with the currently selected items
    this.options.onSelect(this.getSelectedItems());
  }

  setNodeSelectionState(node, state) {
    // Update the selection state in the Map
    this.selectedItems.set(node, state);
    if (node.checkbox) {
      // Update the checkbox UI
      node.checkbox.checked = state;
      node.checkbox.indeterminate = false;
    }
  }

  updateChildrenSelection(node, isSelected) {
    if (node.children) {
      for (const child of node.children) {
        // Set the same selection state for all children
        this.setNodeSelectionState(child, isSelected);
        // Recursively update grandchildren
        this.updateChildrenSelection(child, isSelected);
      }
    }
  }

  updateParentSelection(node) {
    if (!node) return;

    // Get the selection states of all immediate children
    const childStates = node.children.map((child) =>
      this.selectedItems.get(child),
    );
    let newState;

    // Determine the new state based on children's states
    if (childStates.every((state) => state === true)) {
      newState = true; // All children are selected
    } else if (
      childStates.some((state) => state === true || state === "indeterminate")
    ) {
      newState = "indeterminate"; // Some children are selected or indeterminate
    } else {
      newState = false; // No children are selected
    }

    // Update the node's selection state
    this.selectedItems.set(node, newState);
    if (node.checkbox) {
      node.checkbox.checked = newState === true;
      node.checkbox.indeterminate = newState === "indeterminate";
    }

    // Recursively update the parent's selection state
    this.updateParentSelection(node.parent);
  }

  getSelectedItems() {
    // Return an array of selected item names
    return Array.from(this.selectedItems.entries())
      .filter(([node, isSelected]) => isSelected === true)
      .map(([node]) => node.data.name);
  }

  defaultNodeTemplate(node) {
    const isFolder = node.data.type === "folder";
    // Generate HTML string for a single node
    return `
      <div class="tree-node ${isFolder ? "folder" : "file"}">
        <div class="node-content">
          <input type="checkbox" class="checkbox">
          ${isFolder ? this.options.getChevron(node).outerHTML : ""}
          ${this.options.getIcon(node).outerHTML}
          <span class="node-label">${node.data.name}</span>
        </div>
        ${
          isFolder
            ? '<div class="children-container" style="display: none;"></div>'
            : ""
        }
      </div>
    `;
  }

  defaultGetChevron(node) {
    // Create SVG element for the chevron icon
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.classList.add("chevron");

    // Create path element for the chevron shape
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
    path.setAttribute("fill", "currentColor");

    svg.appendChild(path);
    return svg;
  }

  defaultGetIcon(node) {
    // Create SVG element for the node icon
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.classList.add("icon");

    // Create path element for the icon shape
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (node.data.type === "folder") {
      // Folder icon path and color
      path.setAttribute(
        "d",
        "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
      );
      path.setAttribute("fill", "#FFA000");
    } else {
      // File icon path and color
      path.setAttribute(
        "d",
        "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
      );
      path.setAttribute("fill", "#42A5F5");
    }

    svg.appendChild(path);
    return svg;
  }
}
