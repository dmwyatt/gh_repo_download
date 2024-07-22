import "vite/modulepreload-polyfill";
import Alpine from "alpinejs";

import { FolderTreeHelper } from "./FolderTreeHelper";
import { getCookie, zipFilesAsync } from "./utils";
import { FileSystemNodeData, TreeNode } from "./tree/TreeNode";
import { loadingManager } from "./loading/LoadingManager";
import type { SelectionChangeEventDetail } from "./eventTypes";

type FileItem = {
  type: string;
  file?: File;
  handle?: FileSystemFileHandle;
};

type SelectionInvalidEventDetail = {
  node: TreeNode<FileSystemNodeData>;
  attemptedState: boolean;
};

function app() {
  return {
    githubUrl: "",
    selectedItems: [] as FileItem[],
    folderTreeHelper: null as FolderTreeHelper | null,
    selectedCount: 0,
    selectedSize: 0,
    maxFiles: 2000,
    maxSizeMB: 25,
    isProcessing: false,

    init() {
      const selectionValidator = () => true;

      this.folderTreeHelper = new FolderTreeHelper(
        document.getElementById("tree-container")!,
        selectionValidator,
      );

      document.addEventListener(
        "selectionChanged",
        (
          event: CustomEvent<SelectionChangeEventDetail<FileSystemNodeData>>,
        ) => {
          const { selectedNodes, selectedCount } = event.detail;

          this.selectedCount = selectedCount;
          this.selectedSize = selectedNodes.reduce(
            (size: number, node: TreeNode<FileSystemNodeData>) =>
              size + this.folderTreeHelper!.getTotalSize(node),
            0,
          );
        },
      );
    },

    isSelectionValid(): boolean {
      return (
        this.selectedCount > 0 && // Ensure something is selected
        this.selectedCount <= this.maxFiles &&
        this.selectedSize <= this.maxSizeMB * 1024 * 1024
      );
    },

    getFilesProgressPercentage(): number {
      return Math.min((this.selectedCount / this.maxFiles) * 100, 100);
    },

    getSizeProgressPercentage(): number {
      return Math.min(
        (this.selectedSize / (this.maxSizeMB * 1024 * 1024)) * 100,
        100,
      );
    },

    formatSize(bytes: number): string {
      return (bytes / (1024 * 1024)).toFixed(2);
    },

    getLimitExceededMessage(): string {
      if (
        this.selectedCount > this.maxFiles &&
        this.selectedSize > this.maxSizeMB * 1024 * 1024
      ) {
        return `Selection exceeds both file count and size limits.`;
      } else if (this.selectedCount > this.maxFiles) {
        return `Selection exceeds the ${this.maxFiles} file limit.`;
      } else if (this.selectedSize > this.maxSizeMB * 1024 * 1024) {
        return `Selection exceeds the ${this.maxSizeMB} MB size limit.`;
      }
      return "";
    },

    updateSelectionDisplay() {
      // Update the UI to show current selection status
      // This could update a progress bar, change colors, etc.
    },

    showSelectionInvalidWarning(node: TreeNode<any>, attemptedState: boolean) {
      const action = attemptedState ? "select" : "deselect";
      alert(
        `Cannot ${action} "${node.data.name}". It would exceed the file count or size limit.`,
      );
    },

    async selectFolder() {
      try {
        this.showLoadingState(); // Show the existing loading spinner
        const tree = await this.folderTreeHelper!.selectFolder();
        if (tree) {
          console.log("Folder selected and tree rendered");
          (
            document.getElementById("folder-dialog") as HTMLDialogElement
          ).showModal(); // Show the full dialog
        } else {
          console.log("Folder selection cancelled or failed");
          // Optionally, provide some feedback to the user
          // this.showNotification("Folder selection was cancelled or failed. Please try again.");
        }
      } catch (error) {
        console.error("Error in folder selection:", error);
        // Handle any errors
      } finally {
        this.hideLoadingState(); // Ensure the loading spinner is hidden
      }
    },

    async confirmAndUploadFiles() {
      this.isProcessing = true;
      this.showLoadingState();

      try {
        const selectedFiles =
          await this.folderTreeHelper!.getSelectedFilesForUpload();

        if (selectedFiles.length === 0) {
          throw new Error("No valid files selected for upload");
        }

        const { zipBuffer, errors } = await zipFilesAsync(
          selectedFiles,
          this.updateProgressBar,
          this.handleZipError,
        );

        if (errors.length > 0) {
          console.error("Errors occurred during zipping:", errors);
          // Optionally, display these errors to the user
        }

        this.submitZipFile(zipBuffer);
      } catch (error) {
        console.error("Error in confirmAndUploadFiles:", error);
        alert(
          (error as Error).message ||
            "An error occurred during the upload process. Please try again.",
        );
      } finally {
        this.isProcessing = false;
        this.hideLoadingState();
      }
    },

    showLoadingState() {
      loadingManager.sendMessage({ type: "start", message: "Processing..." });
    },

    hideLoadingState() {
      loadingManager.sendMessage({ type: "end" });
    },

    updateProgressBar(
      processedFiles: number,
      totalFiles: number,
      compressedSize: number,
      totalSize: number,
    ) {
      const percentage = (processedFiles / totalFiles) * 100;
      loadingManager.sendMessage({
        type: "update",
        progress: processedFiles,
        total: totalFiles,
        message: `Processed ${processedFiles} of ${totalFiles} files (${(compressedSize / 1024 / 1024).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`,
      });
    },

    handleZipError(fileName: string, error: Error) {
      console.error(`Error zipping file ${fileName}:`, error);
      // Optionally, display this error to the user
      alert(`Error processing file: ${fileName}`);
    },

    submitZipFile(zipBuffer: Uint8Array) {
      const blob = new Blob([zipBuffer], { type: "application/zip" });
      const file = new File([blob], "selected_files.zip", {
        type: "application/zip",
      });

      const form = document.createElement("form");
      const fileInput = document.createElement("input");

      // Set up form
      form.action = "/old/";
      form.method = "post";
      form.enctype = "multipart/form-data";

      form.classList.add("hidden");

      // Set up file input
      fileInput.type = "file";
      fileInput.name = "zip_file";

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      form.appendChild(fileInput);

      // Get CSRF token from cookies
      const csrftoken = getCookie("csrftoken");

      // Create and add CSRF token input to form
      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfmiddlewaretoken";
      csrfInput.value = csrftoken!;
      form.appendChild(csrfInput);

      document.body.appendChild(form);

      // Submit form
      form.submit();
    },

    resetSelectionState() {
      this.selectedItems = [];
      this.selectedCount = 0;
      this.selectedSize = 0;
      if (this.folderTreeHelper) {
        this.folderTreeHelper.resetSelection();
      }
    },

    closeDialog() {
      this.resetSelectionState();
      (document.getElementById("folder-dialog") as HTMLDialogElement).close();
      document.getElementById("tree-container")!.innerHTML = "";
    },
  };
}

Alpine.data("app", app);

window.Alpine = Alpine;

Alpine.start();
