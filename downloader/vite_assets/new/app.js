import Alpine from "alpinejs";

import { FolderTreeHelper, isFile, getFileFromItem } from "./FolderTreeHelper";

function app() {
  return {
    githubUrl: "",
    selectedItems: [],
    folderTreeHelper: null,
    selectedCount: 0,
    selectedSize: 0,
    maxFiles: 3,
    maxSizeMB: 500,

    init() {
      const selectionValidator = (currentSelection, node, isSelecting) => {
        let newCount = this.selectedCount;
        let newSize = this.selectedSize;

        const nodeFileCount = this.folderTreeHelper.getFileCount(node);
        const nodeSize = this.folderTreeHelper.getTotalSize(node);

        if (isSelecting) {
          newCount += nodeFileCount;
          newSize += nodeSize;
        } else {
          newCount -= nodeFileCount;
          newSize -= nodeSize;
        }

        console.info({ newCount, newSize, nodeFileCount, nodeSize });

        return (
          newCount <= this.maxFiles && newSize <= this.maxSizeMB * 1024 * 1024
        );
      };

      this.folderTreeHelper = new FolderTreeHelper(
        document.getElementById("tree-container"),
        selectionValidator,
      );

      document.addEventListener("selectionChanged", (event) => {
        console.log("selection change", event);
        const selectedNodes = event.detail.selectedNodes;
        this.selectedCount = selectedNodes.reduce(
          (count, node) => count + this.folderTreeHelper.getFileCount(node),
          0,
        );
        this.selectedSize = selectedNodes.reduce(
          (size, node) => size + this.folderTreeHelper.getTotalSize(node),
          0,
        );
        console.log("selected count", this.selectedCount);
        console.log("selected size", this.selectedSize);
        this.updateSelectionDisplay();
      });

      document.addEventListener("selectionInvalid", (event) => {
        console.log("Invalid selection", event);
        const { node, attemptedState } = event.detail;
        const action = attemptedState ? "select" : "deselect";
        const nodeType = node.data.type === "folder" ? "folder" : "file";
        const reason =
          this.folderTreeHelper.getFileCount(node) > this.maxFiles
            ? `exceed the limit of ${this.maxFiles} files`
            : `exceed the limit of ${this.maxSizeMB} MB`;

        alert(`Cannot ${action} this ${nodeType}. It would ${reason}.`);
      });
    },

    updateSelectionDisplay() {
      // Update the UI to show current selection status
      // This could update a progress bar, change colors, etc.
    },

    showSelectionInvalidWarning(node, attemptedState) {
      const action = attemptedState ? "select" : "deselect";
      alert(
        `Cannot ${action} "${node.data.name}". It would exceed the file count or size limit.`,
      );
    },

    async selectFolder() {
      document.getElementById("folder-dialog").showModal();
      const tree = await this.folderTreeHelper.selectFolder();
      if (tree) {
        console.log("Folder selected and tree rendered");
      }
    },

    confirmAndUploadFiles() {
      this.selectedItems = this.folderTreeHelper.getSelectedItems();
      console.log("Selected items:", this.selectedItems);
      this.closeDialog();
      this.submitFileUploadForm();
    },

    closeDialog() {
      document.getElementById("folder-dialog").close();
      document.getElementById("tree-container").innerHTML = "";
    },

    async submitFileUploadForm() {
      const form = document.getElementById("file-upload-form");

      // Clear any existing file inputs
      form
        .querySelectorAll('input[type="file"]')
        .forEach((input) => input.remove());

      const filePromises = this.selectedItems.map(async (item) => {
        if (isFile(item)) {
          const file = await getFileFromItem(item);
          if (file) {
            // Create a new File object with the relative path as the name
            return new File([file], item.path, { type: file.type });
          }
        }
        return null;
      });

      const files = (await Promise.all(filePromises)).filter(
        (file) => file !== null,
      );

      // Now that we have all File objects, we can add them to the form
      files.forEach((file) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.name = "files[]";
        fileInput.style.display = "none";

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        form.appendChild(fileInput);
      });

      // Submit the form
      form.submit();
    },
  };
}

Alpine.data("app", app);

window.Alpine = Alpine;

Alpine.start();
