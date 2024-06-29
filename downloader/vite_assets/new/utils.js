import { Zip } from "fflate";

/**
 * Reads a File or Blob as an ArrayBuffer.
 *
 * @param {File | Blob} file - The File or Blob to be read.
 * @returns {Promise<Uint8Array>} A promise that resolves with the file contents as a Uint8Array.
 * @throws {Error} If there's an error reading the file.
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(new Uint8Array(event.target.result));
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Asynchronously compresses an array of files into a ZIP archive using a streaming approach.
 *
 * @param {File[]} files - An array of File objects to be compressed.
 * @param {(processedFiles: number, totalFiles: number, compressedSize: number, totalSize: number) => void} [progressCallback] - Optional callback for progress updates.
 *        Called with the number of processed files, total number of files, current compressed size, and total uncompressed size.
 * @param {(fileName: string, error: Error) => void} [errorCallback] - Optional callback for individual file errors.
 *        Called with the name of the file that encountered an error and the error object.
 * @param {boolean} [abortOnError=false] - If true, the entire process will abort on the first error encountered.
 *        If false, it will continue processing other files after an error.
 * @returns {Promise<{zipBuffer: Uint8Array, errors: Array<{file: string, error: string}>}>} A promise that resolves with an object containing:
 *          - zipBuffer: The compressed ZIP file as a Uint8Array.
 *          - errors: An array of objects describing any errors encountered, each containing the file name and error message.
 * @throws {Error} If abortOnError is true and an error is encountered, or if there's an error in the ZIP stream itself.
 */ export function zipFilesAsync(
  files,
  progressCallback = null,
  errorCallback = null,
  abortOnError = false,
) {
  return new Promise((resolve, reject) => {
    const totalFiles = files.length;
    let processedFiles = 0;
    let totalSize = 0;
    let compressedSize = 0;
    let zipChunks = [];
    let errors = [];

    const zipStream = new Zip((err, data, final) => {
      if (err) {
        reject(err);
      } else {
        zipChunks.push(data);
        compressedSize += data.length;
        if (progressCallback) {
          progressCallback(
            processedFiles,
            totalFiles,
            compressedSize,
            totalSize,
          );
        }
        if (final) {
          const zipBuffer = new Uint8Array(compressedSize);
          let offset = 0;
          for (const chunk of zipChunks) {
            zipBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          resolve({ zipBuffer, errors });
        }
      }
    });

    function processNextFile(index) {
      if (index >= files.length) {
        zipStream.end();
        return;
      }

      const file = files[index];
      readFileAsArrayBuffer(file)
        .then((fileData) => {
          totalSize += fileData.length;
          processedFiles++;

          const zipObject = new fflate.ZipPassThrough(file.name);
          zipStream.add(zipObject);
          zipObject.push(fileData, true);

          if (progressCallback) {
            progressCallback(
              processedFiles,
              totalFiles,
              compressedSize,
              totalSize,
            );
          }

          processNextFile(index + 1);
        })
        .catch((error) => {
          console.error(`Error reading file ${file.name}:`, error);
          errors.push({ file: file.name, error: error.message });

          if (errorCallback) {
            errorCallback(file.name, error);
          }

          if (abortOnError) {
            reject(
              new Error(`Error reading file ${file.name}: ${error.message}`),
            );
          } else {
            processedFiles++;
            if (progressCallback) {
              progressCallback(
                processedFiles,
                totalFiles,
                compressedSize,
                totalSize,
              );
            }
            processNextFile(index + 1);
          }
        });
    }

    processNextFile(0);
  });
}
