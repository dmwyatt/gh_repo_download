import { zip } from "fflate";

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(new Uint8Array(event.target.result));
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

function zipFilesAsync(
  files,
  prepareProgressCallback = null,
  compressProgressCallback = null,
) {
  return new Promise((resolve, reject) => {
    const data = {}; // This will be our AsyncZippable object
    let totalSize = 0;
    const totalFiles = files.length;
    let processedFiles = 0;

    // Prepare files
    const prepareFiles = async () => {
      for (const file of files) {
        try {
          const fileData = await readFileAsArrayBuffer(file);
          data[file.name] = fileData;
          totalSize += fileData.length;
          processedFiles++;

          if (prepareProgressCallback) {
            prepareProgressCallback(processedFiles, totalFiles, totalSize);
          }
        } catch (error) {
          console.error(`Error reading file ${file.name}:`, error);
          // Optionally, you might want to reject here or continue with other files
        }
      }
    };

    // Compress files
    const compressFiles = () => {
      return new Promise((resolveCompress, rejectCompress) => {
        const opts = {
          level: 6,
          mem: 8,
        };

        if (compressProgressCallback) {
          compressProgressCallback(0, 0, totalSize);
        }

        const zipCallback = (err, zipData) => {
          if (err) {
            rejectCompress(err);
          } else {
            if (compressProgressCallback) {
              compressProgressCallback(100, zipData.length, totalSize);
            }
            resolveCompress(zipData);
          }
        };

        zip(data, opts, zipCallback);
      });
    };

    // Run the entire process
    prepareFiles()
      .then(() => compressFiles())
      .then((zipData) => {
        console.log(
          `Compression complete. Final size: ${zipData.length} bytes (${((zipData.length / totalSize) * 100).toFixed(2)}% of original)`,
        );
        resolve(zipData);
      })
      .catch(reject);
  });
}
