import { unzipSync } from 'fflate';

document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('id_zip_file');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const zipFileErrorDiv = document.getElementById('zipFileError');

  // Function to manage error display
  function updateZipFileError(message) {
    if (message) {
      zipFileErrorDiv.textContent = message;
      zipFileErrorDiv.style.display = 'block';
    } else {
      zipFileErrorDiv.style.display = 'none';
      zipFileErrorDiv.textContent = '';
    }
  }

  fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];

    // Immediately show the remove file button when a file is chosen
    removeFileBtn.style.display = file ? 'inline-block' : 'none';

    // Clear previous errors
    updateZipFileError();

    if (file) {
      // Size check
      const max_size = JSON.parse(document.getElementById('max-repo-size').textContent)
      console.log("max_size", max_size)
      if (file.size > max_size) {
        updateZipFileError('This file is too large to process here.');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const bytes = new Uint8Array(e.target.result);
        // Magic number check to see if it's a valid ZIP file

        if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
          // Proceed to read the entire file and attempt to unzip
          const fullFileReader = new FileReader();
          fullFileReader.onload = function(e) {
            try {
              unzipSync(new Uint8Array(e.target.result)); // Try to unzip
              // If no error, optionally update UI to indicate success
            } catch (error) {
              updateZipFileError('Unable to unzip.');
            }
          };
          fullFileReader.readAsArrayBuffer(file);
        } else {
          updateZipFileError('This file does not appear to be a valid ZIP file.');
        }
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
    }
  });

  removeFileBtn.addEventListener('click', function() {
    fileInput.value = ''; // Clear the file input
    updateZipFileError(); // Clear any existing error messages
    this.style.display = 'none'; // Hide the remove button
  });
});
