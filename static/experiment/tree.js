class TreeNode {
  constructor(data) {
    this.data = data;
    this.children = [];
    this.parent = null;
    this.element = null;
    this.checkbox = null;
  }

  addChild(childNode) {
    childNode.parent = this;
    this.children.push(childNode);
  }
}

class Tree {
  constructor(nodes = []) {
    this.nodes = nodes;
  }

  addNode(node) {
    this.nodes.push(node);
  }
}

class TreeRenderer {
  constructor(tree, containerElement, options = {}) {
    this.tree = tree;
    this.containerElement = containerElement;
    this.options = {
      nodeTemplate: this.defaultNodeTemplate.bind(this),
      getIcon: this.defaultGetIcon,
      getChevron: this.defaultGetChevron,
      onToggle: () => {},
      onSelect: () => {},
      ...options,
    };
    this.selectedItems = new Map();
    this.debounceTimers = new Map(); // For debouncing
    this.injectCSS();
  }

  injectCSS() {
    const styleId = "tree-renderer-styles";
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
    const template = document.createElement("template");
    template.innerHTML = this.options.nodeTemplate(node).trim();
    const nodeElement = template.content.firstChild;
    node.element = nodeElement;

    const checkbox = nodeElement.querySelector(".checkbox");
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        this.toggleSelection(node);
      });
      node.checkbox = checkbox;
    }

    const chevron = nodeElement.querySelector(".chevron");
    if (chevron && node.data.type === "folder") {
      chevron.addEventListener("click", (e) => {
        e.stopPropagation();
        this.debounce(this.toggleFolder.bind(this), node);
      });
    }

    const label = nodeElement.querySelector(".node-label");
    if (label) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        if (node.data.type === "folder") {
          this.debounce(this.toggleFolder.bind(this), node);
        }
      });
    }

    parentElement.appendChild(nodeElement);

    if (node.data.type === "folder") {
      const childrenContainer = nodeElement.querySelector(
        ".children-container",
      );
      if (childrenContainer && !isInitialRender) {
        childrenContainer.style.display = "none"; // Lazy loading
      }
    }

    // Ensure DOM update is complete
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  toggleFolder(node) {
    const nodeElement = node.element;
    const childrenContainer = nodeElement.querySelector(".children-container");
    const isOpen = childrenContainer.style.display !== "none";

    if (!isOpen && childrenContainer.childElementCount === 0) {
      // Lazy load child nodes
      const fragment = document.createDocumentFragment();
      node.children.forEach((child) => this.renderNode(child, fragment, true));
      childrenContainer.appendChild(fragment);
    }

    childrenContainer.style.display = isOpen ? "none" : "block";
    nodeElement.classList.toggle("open", !isOpen);
    this.options.onToggle(node, !isOpen);
  }

  debounce(func, node, delay = 300) {
    const timer = this.debounceTimers.get(node);
    if (timer) {
      clearTimeout(timer);
    }
    const newTimer = setTimeout(() => {
      func(node);
      this.debounceTimers.delete(node);
    }, delay);
    this.debounceTimers.set(node, newTimer);
  }

  toggleSelection(node) {
    const currentState = this.selectedItems.get(node);
    let newState = !currentState;

    this.setNodeSelectionState(node, newState);
    this.updateChildrenSelection(node, newState);
    this.updateParentSelection(node.parent);

    this.options.onSelect(this.getSelectedItems());
  }

  setNodeSelectionState(node, state) {
    this.selectedItems.set(node, state);
    if (node.checkbox) {
      node.checkbox.checked = state;
      node.checkbox.indeterminate = false;
    }
  }

  updateChildrenSelection(node, isSelected) {
    if (node.children) {
      for (const child of node.children) {
        this.setNodeSelectionState(child, isSelected);
        this.updateChildrenSelection(child, isSelected);
      }
    }
  }

  updateParentSelection(node) {
    if (!node) return;

    const childStates = node.children.map((child) =>
      this.selectedItems.get(child),
    );
    let newState;

    if (childStates.every((state) => state === true)) {
      newState = true;
    } else if (
      childStates.some((state) => state === true || state === "indeterminate")
    ) {
      newState = "indeterminate";
    } else {
      newState = false;
    }

    this.selectedItems.set(node, newState);
    if (node.checkbox) {
      node.checkbox.checked = newState === true;
      node.checkbox.indeterminate = newState === "indeterminate";
    }

    this.updateParentSelection(node.parent);
  }

  getSelectedItems() {
    return Array.from(this.selectedItems.entries())
      .filter(([node, isSelected]) => isSelected === true)
      .map(([node]) => node.data.name);
  }

  defaultNodeTemplate(node) {
    const isFolder = node.data.type === "folder";
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
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.classList.add("chevron");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
    path.setAttribute("fill", "currentColor");

    svg.appendChild(path);
    return svg;
  }

  defaultGetIcon(node) {
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
}
