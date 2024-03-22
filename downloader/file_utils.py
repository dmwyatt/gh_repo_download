import asyncio
import codecs
import io
import logging
import re
import zipfile
from dataclasses import dataclass
from typing import BinaryIO, IO, TextIO

from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def find_encoding_declaration(decoded_content):
    # Regular expressions for encoding declarations
    encoding_patterns = {
        "Python": re.compile(r"coding[=:]\s*([-\w.]+)"),
        "Ruby": re.compile(r"coding[=:]\s*([-\w.]+)"),
        "XML": re.compile(r'<\?xml\s+.*encoding=["\']([-\w.]+)["\'].*\?>'),
        "HTML": re.compile(r'<meta\s+.*charset=["\']([-\w.]+)["\'].*>'),
        "Perl": re.compile(r'use\s+encoding\s+["\']([-\w.]+)["\']'),
        "CSS": re.compile(r'@charset\s+["\']([-\w.]+)["\']'),
        "LaTeX": re.compile(r"%\s*!TEX\s+encoding\s*=\s*([-\w.]+)"),
        "XHTML": re.compile(r'<\?xml\s+.*encoding=["\']([-\w.]+)["\'].*\?>'),
    }

    # Check for encoding declarations in the decoded content
    for file_type, pattern in encoding_patterns.items():
        match = pattern.search(decoded_content)
        if match:
            encoding = match.group(1)
            try:
                codecs.lookup(encoding)
                return file_type, encoding
            except LookupError:
                return file_type, None

    # No encoding declaration found
    return None, None


def _detect_internal_encoding(file_obj):
    # Read the first 1024 bytes of the file
    content = file_obj.read(1024)

    # Check for Byte Order Mark (BOM) and decode the content accordingly
    encoding = None
    for bom, bom_encoding in [
        (codecs.BOM_UTF32_LE, "utf-32-le"),
        (codecs.BOM_UTF32_BE, "utf-32-be"),
        (codecs.BOM_UTF16_LE, "utf-16-le"),
        (codecs.BOM_UTF16_BE, "utf-16-be"),
        (codecs.BOM_UTF8, "utf-8-sig"),
    ]:
        if content.startswith(bom):
            encoding = bom_encoding
            break

    if encoding:
        decoded_content = content.decode(encoding)
    else:
        try:
            decoded_content = content.decode("utf-8")
        except UnicodeDecodeError:
            # If UTF-8 decoding fails, degrade gracefully to ASCII with error ignoring
            decoded_content = content.decode("ascii", errors="ignore")

    file_type, encoding = find_encoding_declaration(decoded_content)

    if encoding:
        return file_type, encoding

    # If no encoding found, try decoding with EBCDIC variants to find encoding
    # declarations
    fallback_encodings = ["cp875", "cp1026", "cp1140"]
    for fallback_encoding in fallback_encodings:
        try:
            # Decode content using the fallback encoding
            decoded_content = content.decode(fallback_encoding)
            file_type, encoding = find_encoding_declaration(decoded_content)
            if encoding:
                return file_type, encoding
        except UnicodeDecodeError:
            # Decoding failed, try the next encoding
            continue

    # Return None if no encoding declaration is found after all attempts
    return None, None


def is_binary_mode(file):
    # Check for io.BytesIO (binary in-memory stream)
    if isinstance(file, io.BytesIO):
        return True
    # Check for io.StringIO (text in-memory stream)
    elif isinstance(file, io.StringIO):
        return False
    # Check for binary mode in regular file objects and buffered binary streams
    elif hasattr(file, "mode"):
        return "b" in file.mode
    # Check for buffered binary stream objects without 'mode' attribute
    elif isinstance(file, (io.BufferedReader, io.BufferedWriter)):
        return True
    # If none of the above, return False indicating not binary or unknown
    else:
        return False


def detect_internal_encoding(file):
    if not is_binary_mode(file):
        raise ValueError("File must be opened in binary mode")

    file.seek(0)
    file_type, encoding = _detect_internal_encoding(file)
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
            files.append(
                {
                    "path": file_path,
                    "content": file_content,
                }
            )

        context = {
            "repo_name": repo_name,
            "files": files,
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

        return ExtractionResult(
            text_files, file_limit_reached, size_limit_reached, total_files
        )

    extraction_result = await loop.run_in_executor(None, extract_files)
    return extraction_result
