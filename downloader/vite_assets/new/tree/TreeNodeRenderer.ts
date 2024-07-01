import { TreeNode } from "./TreeNode";
import { TreeStateManager } from "./TreeStateManager";
import {
  TreeRenderFunctions,
  TreeEventHandlers,
  SelectionChangeInfo,
} from "./treeTypes";

export class TreeNodeRenderer<T> {
  node: TreeNode<T>;
  stateManager: TreeStateManager<T>;
  renderFunctions: TreeRenderFunctions<T>;
  eventHandlers: TreeEventHandlers<T>;

  constructor(
    node: TreeNode<T>,
    stateManager: TreeStateManager<T>,
    renderFunctions: TreeRenderFunctions<T>,
    eventHandlers: TreeEventHandlers<T>,
  ) {
    this.node = node;
    this.stateManager = stateManager;
    this.renderFunctions = renderFunctions;
    this.eventHandlers = eventHandlers;
  }

  render(): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = this.renderFunctions
      .getNodeTemplate(this.node, this.renderFunctions)
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
      this.setCheckboxState(this.node.checkbox, state);
    }

    if (this.node.children.length > 0) {
      this.node.children.forEach((child) => {
        if (child.element) {
          new TreeNodeRenderer(
            child,
            this.stateManager,
            this.renderFunctions,
            this.eventHandlers,
          ).updateCheckboxState();
        }
      });
    }
  }

  private setCheckboxState(
    checkbox: HTMLInputElement,
    state: boolean | "indeterminate" | undefined,
  ): void {
    if (state === "indeterminate") {
      checkbox.indeterminate = true;
      checkbox.checked = false;
    } else {
      checkbox.indeterminate = false;
      checkbox.checked = state === true;
    }
  }

  setupEventListeners(): void {
    const checkbox = this.node.element?.querySelector(
      ".checkbox",
    ) as HTMLInputElement | null;
    if (checkbox) {
      const state = this.stateManager.state.selectedItems.get(this.node);
      this.setCheckboxState(checkbox, state);

      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        const newState = this.stateManager.toggleSelection(this.node);
        const changeInfo: SelectionChangeInfo<T> = {
          node: this.node,
          newState: newState,
          source: "user",
        };
        this.eventHandlers.onSelect(changeInfo);
        this.updateCheckboxState();
      });
      this.node.checkbox = checkbox;
    }

    const chevron = this.node.element?.querySelector(".chevron");
    if (chevron && this.node.children.length > 0) {
      chevron.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleChildren();
      });
    }

    const label = this.node.element?.querySelector(".node-label");
    if (label) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.node.children.length > 0) {
          this.toggleChildren();
        }
      });
    }
  }

  toggleChildren(): void {
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
          this.renderFunctions,
          this.eventHandlers,
        );
        fragment.appendChild(childRenderer.render());
      });
      childrenContainer.appendChild(fragment);
    }

    childrenContainer.style.display = isOpen ? "none" : "block";
    nodeElement.classList.toggle("open", !isOpen);
    this.eventHandlers.onToggle(this.node, !isOpen);
  }
}
