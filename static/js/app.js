function setupAlpine(Alpine, FolderTreeHelper) {
  Alpine.data("app", () => {
    console.log("Initializing app data");
    return {
      isDialogOpen: false,
      githubUrl: "",
      selectedItems: [],
      folderTreeHelper: null,

      init() {
        this.folderTreeHelper = new FolderTreeHelper(
          document.getElementById("tree-container"),
        );
      },

      async selectFolder() {
        const success = await this.folderTreeHelper.selectFolder();
        if (success) {
          console.log("Folder selected and tree rendered");
          this.isDialogOpen = true;
        }
      },

      confirmSelection() {
        this.selectedItems = this.folderTreeHelper.getSelectedItems();
        console.log("Selected items:", this.selectedItems);
        this.closeDialog();
        this.processSelectedItems();
      },

      closeDialog() {
        this.isDialogOpen = false;
        this.folderTreeHelper.clearTree();
      },

      submitGithubUrl() {
        console.log("Submitted GitHub URL:", this.githubUrl);
        // Process the GitHub URL here
      },

      processSelectedItems() {
        // Process the selected items here
        console.log("Processing selected items:", this.selectedItems);
      },
    };
  });
}
