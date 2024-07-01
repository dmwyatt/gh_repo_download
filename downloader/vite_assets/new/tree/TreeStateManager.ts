import { TreeNode } from "./TreeNode";

type SelectionState = boolean | "indeterminate";
export type SelectionValidator<T> = (
  currentSelection: TreeNode<T>[],
  node: TreeNode<T>,
  isSelecting: boolean,
) => boolean;

export class TreeStateManager<T> {
  state: {
    selectedItems: Map<TreeNode<T>, SelectionState>;
  };
  selectionValidator: SelectionValidator<T>;

  constructor(selectionValidator: SelectionValidator<T> = () => true) {
    this.state = {
      selectedItems: new Map(),
    };
    this.selectionValidator = selectionValidator;
  }

  toggleSelection(node: TreeNode<T>): SelectionState {
    const currentState = this.state.selectedItems.get(node) || false;
    const newState = !currentState;

    if (this.selectionValidator(this.getSelectedNodes(), node, newState)) {
      this.updateSelection(node, newState);
      this.emitSelectionChangedEvent();
      return newState;
    } else {
      this.emitSelectionInvalidEvent(node, newState);
      return currentState;
    }
  }

  updateSelection(node: TreeNode<T>, isSelected: boolean): void {
    this.state.selectedItems.set(node, isSelected);

    node.children.forEach((child) => {
      this.updateSelection(child, isSelected);
    });

    if (node.parent) {
      this.updateParentSelection(node.parent);
    }
  }

  getSelectedNodes(): TreeNode<T>[] {
    return Array.from(this.state.selectedItems.entries())
      .filter(([, isSelected]) => isSelected === true)
      .map(([node]) => node);
  }

  emitSelectionChangedEvent(): void {
    const event = new CustomEvent("selectionChanged", {
      detail: { selectedNodes: this.getSelectedNodes() },
    });
    document.dispatchEvent(event);
  }

  emitSelectionInvalidEvent(node: TreeNode<T>, attemptedState: boolean): void {
    const event = new CustomEvent("selectionInvalid", {
      detail: { node, attemptedState },
    });
    document.dispatchEvent(event);
  }

  updateParentSelection(node: TreeNode<T>): void {
    const allSelected = node.children.every(
      (child) => this.state.selectedItems.get(child) === true,
    );
    const anySelected = node.children.some((child) =>
      this.state.selectedItems.get(child),
    );

    let newState: SelectionState;
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

  getSelectedItems(): string[] {
    return Array.from(this.state.selectedItems.entries())
      .filter(([, isSelected]) => isSelected === true)
      .map(([node]) => node.name);
  }
}
