export class TreeStateManager {
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
