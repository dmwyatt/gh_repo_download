import { TreeNode } from "./TreeNode";
import { SelectionChangeEventDetail } from "../eventTypes";
import { SelectionState } from "./treeTypes";

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
  private selectedCount: number = 0;
  private indeterminateCount: number = 0;

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

  updateSelection(node: TreeNode<T>, isSelected: SelectionState): void {
    const oldState = this.state.selectedItems.get(node);

    // Update counters
    if (oldState === true) this.selectedCount--;
    if (oldState === "indeterminate") this.indeterminateCount--;
    if (isSelected === true) this.selectedCount++;
    if (isSelected === "indeterminate") this.indeterminateCount++;

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

  getSelectedCount(): number {
    return this.selectedCount;
  }

  getIndeterminateCount(): number {
    return this.indeterminateCount;
  }

  emitSelectionChangedEvent<U extends T>(): void {
    const event = new CustomEvent<SelectionChangeEventDetail<U>>(
      "selectionChanged",
      {
        detail: {
          selectedNodes: this.getSelectedNodes() as TreeNode<U>[],
          selectedCount: this.selectedCount,
          indeterminateCount: this.indeterminateCount,
        },
      },
    );
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

    const oldState = this.state.selectedItems.get(node);
    if (oldState !== newState) {
      if (oldState === true) this.selectedCount--;
      if (oldState === "indeterminate") this.indeterminateCount--;
      if (newState === true) this.selectedCount++;
      if (newState === "indeterminate") this.indeterminateCount++;
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

  resetSelection() {
    this.state.selectedItems.clear();
    this.selectedCount = 0;
    this.indeterminateCount = 0;
  }
}
