import {
  defaultGetIcon,
  defaultGetChevron,
  defaultNodeTemplate,
} from "./defaults";
export class TreeNodeRenderer {
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
