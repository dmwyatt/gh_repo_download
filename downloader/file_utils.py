import asyncio
import codecs
import logging
import zipfile
from dataclasses import dataclass
from typing import BinaryIO, IO, TextIO

from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def detect_internal_encoding(file: IO) -> str | None:
    """
    Detects the encoding of a file based on common encoding declaration mechanisms.

    Args:
        file: An open file object.

    Returns:
        The detected encoding as a string if found and valid, or None if no encoding
        declaration is detected or the encoding is invalid.

    Supported File Types:
        - Python
        - Ruby
        - XML
        - HTML
        - Perl
        - CSS
        - LaTeX
        - XHTML

    Limitations:
        - The function relies on specific encoding declaration formats and may not
          detect encodings in files that use different declaration mechanisms or lack
          an encoding declaration altogether.
        - The function reads only the first few lines of the file (up to 5 lines) to
          search for encoding declarations. If the declaration appears later in the
          file, it may not be detected.
        - The function assumes that the encoding declaration is in ASCII or a
          compatible encoding. Files with non-ASCII encoding declarations may not be
          detected correctly.
    """
    # Reset the file position to the beginning
    file.seek(0)

    # Read the first few lines of the file
    lines = []
    for _ in range(5):
        line = file.readline()
        if isinstance(line, bytes):
            line = line.decode("ascii", errors="ignore")
        if not line:
            break
        lines.append(line)

    # Join the lines back into a single string
    content = "".join(lines)

    # Check for encoding declarations
    if "# -*- coding:" in content:
        # Python encoding declaration
        encoding = content.split("# -*- coding:", 1)[1].split("-*-", 1)[0].strip()
    elif "# encoding:" in content:
        # Ruby encoding declaration
        encoding = content.split("# encoding:", 1)[1].split("\n", 1)[0].strip()
    elif "<?xml" in content and "encoding=" in content:
        # XML encoding declaration
        encoding = content.split('encoding="', 1)[1].split('"', 1)[0].strip()
    elif "<meta charset=" in content:
        # HTML encoding declaration
        encoding = content.split('<meta charset="', 1)[1].split('"', 1)[0].strip()
    elif "use encoding" in content:
        # Perl encoding declaration
        encoding = content.split("use encoding '", 1)[1].split("'", 1)[0].strip()
    elif "@charset" in content:
        # CSS encoding declaration
        encoding = content.split('@charset "', 1)[1].split('"', 1)[0].strip()
    elif "% !TEX encoding =" in content:
        # LaTeX encoding declaration
        encoding = content.split("% !TEX encoding =", 1)[1].split("\n", 1)[0].strip()
    else:
        encoding = None

    # Check if the detected encoding is valid and supported by Python
    if encoding is not None:
        try:
            codecs.lookup(encoding)
        except LookupError:
            encoding = None

    # Reset the file position to the beginning
    file.seek(0)

    return encoding


def is_plain_text_file(file_obj: BinaryIO) -> bool:
    """
    Determines if a file is plain text or binary based on its content.

    This function implements the plain text detection algorithm used in zlib,
    which categorizes a file as plain text if it contains at least one byte
    from the allow list (textual bytecodes) and no byte from the block list
    (undesired, non-textual bytecodes).

    The algorithm is based on the idea that most plain text files consist of
    printable ASCII characters and common control characters, while binary
    files tend to contain control characters, especially null bytes.

    More information about the algorithm can be found at:
    https://github.com/madler/zlib/blob/8678871f18f4dd51101a9db1e37791f975969079/doc/txtvsbin.txt

    Args:
        file_obj (BinaryIO): The file object to be checked.

    Returns:
        bool: True if the file is plain text, False otherwise.
    """
    allow_list = list(range(9, 11)) + list(range(13, 14)) + list(range(32, 256))
    # gray_list = [7, 8, 11, 12, 26, 27]
    block_list = list(range(0, 7)) + list(range(14, 32))

    allow_found = False

    file_obj.seek(0)
    while True:
        chunk = file_obj.read(4096)
        if not chunk:
            break

        for byte in chunk:
            if byte in allow_list:
                allow_found = True
            elif byte in block_list:
                return False

    return allow_found


@dataclass
class ExtractionResult:
    text_files: dict[str, str]
    file_limit_reached: bool
    size_limit_reached: bool
    total_files_count: int

    def render_template(self, repo_name: str, template_name: str) -> str:
        files = []
        for file_path, file_content in self.text_files.items():
            files.append({
                'path': file_path,
                'content': file_content,
            })

        context = {
            'repo_name': repo_name,
            'files': files,
        }
        rendered_template = render_to_string(template_name, context)
        return rendered_template


async def extract_text_files(
    zip_file: zipfile.ZipFile,
    max_files: int = 1000,
    max_total_size: int = 10 * 1024 * 1024,
) -> ExtractionResult:
    """
    Asynchronously extracts plain text files from a ZIP file.

    This function takes a `zipfile.ZipFile` object, an optional maximum number of
    files to extract, and an optional maximum total size of extracted text as input.
    It extracts the plain text files from the ZIP file in memory using asynchronous
    operations, while applying various security checks. The function returns an
    `ExtractionResult` object containing a dictionary mapping the file names to their
    contents, a boolean indicating whether the extraction was stopped due to reaching
    the file limit, and a boolean indicating whether the extraction was stopped due
    to reaching the size limit.

    Args:
        zip_file (zipfile.ZipFile): The ZIP file object containing the files to be
            extracted.
        max_files (int): The maximum number of files allowed to be extracted
            (default: 1000).
        max_total_size (int): The maximum total size (in bytes) of extracted text
            allowed (default: 10MB).

    Returns:
        ExtractionResult: An `ExtractionResult` object containing:
            - text_files (dict): A dictionary mapping the file names to their contents.
            - file_limit_reached (bool): A boolean indicating whether the extraction was
              stopped due to reaching the file limit.
            - size_limit_reached (bool): A boolean indicating whether the extraction was
              stopped due to reaching the size limit.

    Notes:
        - The function uses the `asyncio` event loop to perform the extraction
          asynchronously.
        - Only files that pass the `is_plain_text_file` check are considered as plain
          text files and extracted.
        - The function checks for explicit encoding information within the file using
          the `detect_internal_encoding` function.
        - If no explicit encoding information is found, the file is decoded using the
          default UTF-8 encoding.
        - The extraction stops if the number of extracted files reaches the specified
          `max_files` or
          if the total size of extracted text exceeds the specified `max_total_size`.
    """
    loop = asyncio.get_event_loop()

    def extract_files():
        text_files = {}
        total_size = 0
        file_limit_reached = False
        size_limit_reached = False
        total_files = len(zip_file.infolist())

        for member in zip_file.infolist():
            if len(text_files) >= max_files:
                file_limit_reached = True
                break

            with zip_file.open(member) as file:
                if is_plain_text_file(file):
                    encoding = detect_internal_encoding(file)
                    if encoding:
                        content = file.read().decode(encoding)
                    else:
                        content = file.read().decode("utf-8", errors="replace")

                    total_size += len(content)
                    if total_size > max_total_size:
                        size_limit_reached = True
                        break

                    text_files[member.filename] = content

        return ExtractionResult(text_files, file_limit_reached, size_limit_reached, total_files)

    extraction_result = await loop.run_in_executor(None, extract_files)
    return extraction_result
