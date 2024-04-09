import "vite/modulepreload-polyfill";
import { unzipSync, zipSync } from 'fflate';
import ignore from "ignore";

document.addEventListener('DOMContentLoaded', function () {
  const zipFileInput = document.getElementById('id_zip_file');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const folderForm = document.getElementById('folderForm');
  const forms = document.querySelectorAll('form');

  insertText("Event listeners adding")

  zipFileInput.addEventListener('change', handleFileInputChange);
  removeFileBtn.addEventListener('click', handleRemoveFileClick);
  folderForm.addEventListener('submit', handleFolderSubmit);
  forms.forEach(form => {
    const submitButton = form.querySelector('button[type="submit"]');
    const inputFields = form.querySelectorAll('input, textarea');

    inputFields.forEach(field => {
      field.addEventListener('input', function () {
        const isFormFilled = Array.from(inputFields).every(field => field.value.trim() !== '');
        submitButton.disabled = !isFormFilled;
      });
    });
  });

  insertText("Event listeners added")

  document.getElementById('fillFormButton').addEventListener('click', function () {
        const repoUrl = 'https://github.com/dmwyatt/gh_repo_download';
        const inputField = document.querySelector('input[name="repo_url"]');
        inputField.value = '';
        let i = 0;
        const totalDuration = 425;
        const timeoutDuration = totalDuration / repoUrl.length;

        inputField.classList.add('glow');

        function typeEffect() {
          if (i < repoUrl.length) {
            inputField.value += repoUrl.charAt(i);
            i++;
            setTimeout(typeEffect, timeoutDuration);
          } else {
            inputField.classList.remove('glow');
            inputField.dispatchEvent(new Event('input'));
          }
        }

        typeEffect();
      });
});


// Function to manage error display
function updateZipFileError(message) {
  const zipFileErrorDiv = document.getElementById('zipFileError');

  if (message) {
    zipFileErrorDiv.textContent = message;
    zipFileErrorDiv.style.display = 'block';
  } else {
    zipFileErrorDiv.style.display = 'none';
    zipFileErrorDiv.textContent = '';
  }
}

// Function to handle file input change event
function handleFileInputChange(event) {
  const file = event.target.files[0];
  const removeFileBtn = document.getElementById('removeFileBtn');

  removeFileBtn.style.display = file ? 'inline-block' : 'none';
  updateZipFileError();

  if (file) {

    insertText("File selected");


    const max_size = JSON.parse(document.getElementById('max-repo-size').textContent);
    if (file.size > max_size) {
      insertText("Too big")
      updateZipFileError('This file is too large to process here.');
      return;
    }
    insertText("Size OK")

    const reader = new FileReader();

    reader.onload = function (e) {
      insertText("File loaded")
      const bytes = new Uint8Array(e.target.result);
      if (isValidZipFile(bytes)) {
        insertText("Valid zip file")
        const fullFileReader = new FileReader();
        fullFileReader.onload = function (e) {
          try {
            unzipSync(new Uint8Array(e.target.result));
          } catch (error) {
            updateZipFileError('Unable to unzip.');
          }
        };
        fullFileReader.readAsArrayBuffer(file);
      } else {
        insertText("Not a zip file")
        updateZipFileError('This file does not appear to be a valid ZIP file.');
      }
    };

    insertText("Reading file first 4 bytes")
    reader.readAsArrayBuffer(file.slice(0, 4));
  }
}

// Function to check if a file is a valid ZIP file
function isValidZipFile(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
}

// Function to handle remove file button click event
function handleRemoveFileClick() {
  const fileInput = document.getElementById('id_zip_file');
  fileInput.value = '';
  updateZipFileError();
  this.style.display = 'none';
}

async function handleFolderSubmit(event) {
  event.preventDefault();

  const folderInput = document.getElementById('folderInput');
  const files = folderInput.files;

  if (files.length === 0) {
    console.log('No folder selected.');
    return;
  }

  const folderName = files[0].webkitRelativePath.split('/')[0];
  const zipData = {};

  const manualGitignoreContent = document.getElementById('exclusionRules').value;
  // Filter files based on .gitignore rules
  const filteredFiles = await processFiles(files, manualGitignoreContent);

  // Iterate over filtered files and add them to zipData object
  for (let i = 0; i < filteredFiles.length; i++) {
    const file = filteredFiles[i];
    const relativePath = file.webkitRelativePath;
    const fileData = await file.arrayBuffer();
    zipData[relativePath] = new Uint8Array(fileData);
  }

  // Create a zip file from the zipData object
  const zippedData = zipSync(zipData);

  const zipFileInput = document.querySelector('#id_zip_file');
  const zipFile = new File([zippedData], `${folderName}.zip`, {type: 'application/zip'});
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(zipFile);
  zipFileInput.files = dataTransfer.files;

  document.querySelector('form[method="post"][enctype="multipart/form-data"]').submit();
}

/**
 * Processes files based on .gitignore rules.
 * @param {FileList} files - The list of files to process.
 * @param {string} manualGitignoreContent - The manually provided .gitignore content.
 * @returns {File[]} - An array of filtered files.
 */
async function processFiles(files, manualGitignoreContent = '') {
  const gitignoreFiles = Array.from(files).filter(file => file.name === '.gitignore');

  const ig = ignore().add(manualGitignoreContent);

  const filteredFiles = [];

  for (const file of Array.from(files)) {
    console.log('Processing file:', file.webkitRelativePath);

    if (ig.ignores(file.webkitRelativePath)) {
      console.log('Ignored by manual .gitignore:', file.webkitRelativePath);
      continue;
    }

    let ignored = false;

    for (const gitignoreFile of gitignoreFiles) {
      const gitignoreDirectory = gitignoreFile.webkitRelativePath.replace('.gitignore', '');
      console.log(`Checking .gitignore file in directory: ${gitignoreDirectory} against file: ${file.webkitRelativePath}`);

      if (file.webkitRelativePath.startsWith(gitignoreDirectory)) {
        console.log('Checking .gitignore file:', gitignoreFile.webkitRelativePath);
        const gitignoreContent = await readFileAsync(gitignoreFile);
        const gitignoreIg = ignore().add(gitignoreContent);

        if (gitignoreIg.ignores(file.webkitRelativePath)) {
          console.log('Ignored by .gitignore file:', file.webkitRelativePath);
          ignored = true;
          break;
        }
      }
    }

    if (!ignored) {
      console.log('Not ignored:', file.webkitRelativePath);
      filteredFiles.push(file);
    }
  }

  return filteredFiles;
}

function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result);
    };
    reader.onerror = function() {
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}

function insertText(text) {
  // const p = document.createElement('p');
  // p.textContent = text;
  // p.style.color = 'green';
  // p.style.marginTop = '10px';
  // document.querySelector('button[data-test-id="zip-file-submit"]').after(p);
}
