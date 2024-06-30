import { TreeNode } from "./TreeNode";
import { TreeStateManager } from "./TreeStateManager";
import {
  defaultGetIcon,
  defaultGetChevron,
  defaultGetNodeTemplate,
} from "./defaults";
import { RenderOptions } from "./treeTypes";

export class TreeNodeRenderer<T> {
  node: TreeNode<T>;
  stateManager: TreeStateManager<T>;
  options: RenderOptions<T>;

  constructor(
    node: TreeNode<T>,
    stateManager: TreeStateManager<T>,
    options: Partial<RenderOptions<T>> = {},
  ) {
    this.node = node;
    this.stateManager = stateManager;
    this.options = {
      getNodeTemplate: defaultGetNodeTemplate,
      getIcon: defaultGetIcon,
      getChevron: defaultGetChevron,
      onSelect: () => {},
      onToggle: () => {},
      ...options,
    };
  }

  render(): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = this.options
      .getNodeTemplate(this.node, this.options)
      .trim();
    const nodeElement = template.content.firstChild as HTMLElement;
    this.node.element = nodeElement;

    this.updateCheckboxState();
    this.setupEventListeners();
    return nodeElement;
  }
  updateCheckboxState(): void {
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

  setupEventListeners(): void {
    const checkbox = this.node.element?.querySelector(
      ".checkbox",
    ) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked =
        this.stateManager.state.selectedItems.get(this.node) || false;
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        const selectedItems = this.stateManager.toggleSelection(this.node);
        this.options.onSelect(selectedItems);
        this.updateCheckboxState();
      });
      this.node.checkbox = checkbox;
    }

    const chevron = this.node.element?.querySelector(".chevron");
    if (chevron && this.node.data.type === "folder") {
      chevron.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleFolder();
      });
    }

    const label = this.node.element?.querySelector(".node-label");
    if (label) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.node.data.type === "folder") {
          this.toggleFolder();
        }
      });
    }
  }

  toggleFolder(): void {
    const nodeElement = this.node.element;
    if (!nodeElement) return;

    const childrenContainer = nodeElement.querySelector(
      ".children-container",
    ) as HTMLElement;
    if (!childrenContainer) return;

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
