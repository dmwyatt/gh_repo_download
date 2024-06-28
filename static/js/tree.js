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

class TreeStateManager {
  constructor(selectionValidator = () => true) {
    this.state = {
      selectedItems: new Map(), // Node -> boolean or 'indeterminate'
    };
    this.selectionValidator = selectionValidator;
  }
  toggleSelection(node) {
    const currentState = this.state.selectedItems.get(node) || false;
    const newState = !currentState;

    // Check if the new selection state is valid
    if (this.selectionValidator(this.getSelectedNodes(), node, newState)) {
      this.updateSelection(node, newState);
      this.emitSelectionChangedEvent();
      return true; // Selection was successful
    } else {
      this.emitSelectionInvalidEvent(node, newState);
      return false; // Selection was prevented
    }
  }

  updateSelection(node, isSelected) {
    // Update the current node
    this.state.selectedItems.set(node, isSelected);

    // Update child nodes recursively
    node.children.forEach((child) => {
      this.updateSelection(child, isSelected);
    });

    // Update parent node recursively
    if (node.parent) {
      this.updateParentSelection(node.parent);
    }
  }

  getSelectedNodes() {
    return Array.from(this.state.selectedItems.entries())
      .filter(([node, isSelected]) => isSelected === true)
      .map(([node]) => node);
  }

  emitSelectionChangedEvent() {
    const event = new CustomEvent("selectionChanged", {
      detail: { selectedNodes: this.getSelectedNodes() },
    });
    document.dispatchEvent(event);
  }

  emitSelectionInvalidEvent(node, attemptedState) {
    const event = new CustomEvent("selectionInvalid", {
      detail: { node, attemptedState },
    });
    document.dispatchEvent(event);
  }

  updateParentSelection(node) {
    const allSelected = node.children.every(
      (child) => this.state.selectedItems.get(child) === true,
    );
    const anySelected = node.children.some((child) =>
      this.state.selectedItems.get(child),
    );

    let newState;
    if (allSelected) {
      newState = true;
    } else if (anySelected) {
      newState = "indeterminate";
    } else {
      newState = false;
    }

    this.state.selectedItems.set(node, newState);

    if (node.checkbox) {
      node.checkbox.checked = newState === true;
      node.checkbox.indeterminate = newState === "indeterminate";
    }

    if (node.parent) {
      this.updateParentSelection(node.parent);
    }
  }

  getSelectedItems() {
    return Array.from(this.state.selectedItems.entries())
      .filter(([node, isSelected]) => isSelected === true)
      .map(([node]) => node.data.name);
  }
}

class TreeNodeRenderer {
  constructor(node, stateManager, options) {
    this.node = node;
    this.stateManager = stateManager;
    this.options = {
      nodeTemplate: defaultNodeTemplate,
      getIcon: defaultGetIcon,
      getChevron: defaultGetChevron,
      ...options,
    };
  }

  render() {
    const template = document.createElement("template");
    template.innerHTML = this.options
      .nodeTemplate(this.node, this.options)
      .trim();
    const nodeElement = template.content.firstChild;
    this.node.element = nodeElement;

    // Apply selection state if it already exists in the state manager
    this.updateCheckboxState();

    this.setupEventListeners();
    return nodeElement;
  }

  updateCheckboxState() {
    const state = this.stateManager.state.selectedItems.get(this.node);
    if (this.node.checkbox) {
      this.node.checkbox.checked = state === true;
      this.node.checkbox.indeterminate = state === "indeterminate";
    }

    if (this.node.children) {
      this.node.children.forEach((child) => {
        if (child.element) {
          new TreeNodeRenderer(
            child,
            this.stateManager,
            this.options,
          ).updateCheckboxState();
        }
      });
    }
  }

  setupEventListeners() {
    const checkbox = this.node.element.querySelector(".checkbox");
    if (checkbox) {
      checkbox.checked = this.stateManager.state.selectedItems.get(this.node);
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        const selectedItems = this.stateManager.toggleSelection(this.node);
        this.options.onSelect(selectedItems);
        this.updateCheckboxState();
      });
      this.node.checkbox = checkbox;
    }

    const chevron = this.node.element.querySelector(".chevron");
    if (chevron && this.node.data.type === "folder") {
      chevron.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleFolder();
      });
    }

    const label = this.node.element.querySelector(".node-label");
    if (label) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.node.data.type === "folder") {
          this.toggleFolder();
        }
      });
    }
  }

  toggleFolder() {
    const nodeElement = this.node.element;
    const childrenContainer = nodeElement.querySelector(".children-container");
    const isOpen = childrenContainer.style.display !== "none";

    if (!isOpen && childrenContainer.childElementCount === 0) {
      const fragment = document.createDocumentFragment();
      this.node.children.forEach((child) => {
        const childRenderer = new TreeNodeRenderer(
          child,
          this.stateManager,
          this.options,
        );
        fragment.appendChild(childRenderer.render());
      });
      childrenContainer.appendChild(fragment);
    }

    childrenContainer.style.display = isOpen ? "none" : "block";
    nodeElement.classList.toggle("open", !isOpen);
    this.options.onToggle(this.node, !isOpen);
  }
}

class TreeRenderer {
  constructor(tree, containerElement, options = {}) {
    this.tree = tree;
    this.containerElement = containerElement;
    this.options = {
      onToggle: () => {},
      onSelect: () => {},
      ...options,
    };
    this.stateManager = new TreeStateManager();
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
      await this.renderNode(node, this.containerElement, true);
    }
  }

  async renderNode(node, parentElement, isInitialRender = false) {
    const nodeRenderer = new TreeNodeRenderer(
      node,
      this.stateManager,
      this.options,
    );
    const nodeElement = nodeRenderer.render();
    parentElement.appendChild(nodeElement);

    if (node.data.type === "folder" && isInitialRender) {
      const childrenContainer = nodeElement.querySelector(
        ".children-container",
      );
      if (childrenContainer) {
        childrenContainer.style.display = "none";
      }
    }
  }
}

function defaultNodeTemplate(node, options) {
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

function defaultGetChevron(node) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("chevron");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

function defaultGetIcon(node) {
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
