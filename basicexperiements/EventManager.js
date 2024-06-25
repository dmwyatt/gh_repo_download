export default class EventManager {
  constructor(stateManager, options = {}) {
    this.stateManager = stateManager;
    this.options = {
      onSelect: () => {},
      onToggle: () => {},
      ...options,
    };
  }

  registerEvents(node) {
    const checkbox = node.element.querySelector(".checkbox");
    if (checkbox) {
      checkbox.checked = this.stateManager.state.selectedItems.get(node);
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        this.handleCheckboxChange(node);
      });
      node.checkbox = checkbox;
    }

    const chevron = node.element.querySelector(".chevron");
    if (chevron && node.data.type === "folder") {
      chevron.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleChevronClick(node);
      });
    }

    const label = node.element.querySelector(".node-label");
    if (label) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        if (node.data.type === "folder") {
          this.handleLabelClick(node);
        }
      });
    }
  }

  handleCheckboxChange(node) {
    const selectedItems = this.stateManager.toggleSelection(node);
    this.options.onSelect(selectedItems);
    this.updateCheckboxState(node);
  }

  handleChevronClick(node) {
    this.toggleFolder(node);
  }

  handleLabelClick(node) {
    this.toggleFolder(node);
  }

  toggleFolder(node) {
    const nodeElement = node.element;
    const childrenContainer = nodeElement.querySelector(".children-container");
    const isOpen = childrenContainer.style.display !== "none";

    if (!isOpen && childrenContainer.childElementCount === 0) {
      const fragment = document.createDocumentFragment();
      node.children.forEach((child) => {
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
    this.options.onToggle(node, !isOpen);
  }

  updateCheckboxState(node) {
    const state = this.stateManager.state.selectedItems.get(node);
    if (node.checkbox) {
      node.checkbox.checked = state === true;
      node.checkbox.indeterminate = state === "indeterminate";
    }

    if (node.children) {
      node.children.forEach((child) => {
        if (child.element) {
          this.updateCheckboxState(child);
        }
      });
    }
  }
}
