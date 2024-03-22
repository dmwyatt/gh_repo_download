import asyncio
import codecs
import io
import logging
import re
import zipfile
from dataclasses import dataclass
from typing import Any, BinaryIO, IO, TextIO

from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def find_encoding_declaration(
    decoded_content: str,
) -> tuple[str, str] | tuple[str, None] | tuple[None, None]:
    """
    Searches for and verifies encoding declarations within a given string.

    The function scans the input string for encoding declarations specific to several
    file types. If a valid encoding declaration is found, the file type and the
    encoding are returned. If the encoding declaration is found but is invalid,
    the function returns the file type and None. If no encoding declaration is
    detected, the function returns (None, None).

    Supported file types include:
    - Python
    - Ruby
    - XML
    - HTML
    - Perl
    - CSS
    - LaTeX
    - XHTML

    Args:
        decoded_content (str): The input string to scan for encoding declarations.

    Returns:
        A tuple (file_type, encoding) where 'file_type' is the file type of the found
        encoding declaration, or None if no declaration was found. 'encoding' is the
        found encoding if it's valid, or None if it's invalid or not found.

    Example:
        >>> find_encoding_declaration('# coding: utf-8')
        ('Python', 'utf-8')

        >>> find_encoding_declaration('# coding: unknown_encoding')
        ('Python', None)

        >>> find_encoding_declaration('Hello, World!')
        (None, None)
    """
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


def _detect_internal_encoding(file_obj: IO[bytes]) -> tuple[str, str] | tuple[None, None]:
    """
    Retrieves the declared encoding from the initial content of a binary file, if present.

    This function assesses the first 1024 bytes of the specified file to potentially
    ascertain an encoding declaration. It does not guarantee the discovered encoding
    matches the actual file encoding.

    Args:
        file_obj: The binary file handle whose encoding is to be found.

    Returns:
        A tuple containing the file type and the declared encoding found within the
        content. If no encoding declaration is found, returns a tuple with None values.

    Raises:
        UnicodeDecodeError: If the content decoding fails for all attempted encoding
            types.

    Note:
        This function implements fallback encodings ('utf-8', 'ascii', 'cp875',
        'cp1026', 'cp1140') if an encoding declaration is not identified. The
        returned encoding is based solely on any encoding declaration found within
        the decoded content, and might not align with the actual encoding of the file.

    Example:
        >>> import io
        >>> file = io.BytesIO(b'<?xml version="1.0" encoding="utf-8"?>\\n<root>Some data here</root>')
        >>> _detect_internal_encoding(file)
        ('XML', 'utf-8')
    """
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


def is_binary_mode(file_obj: Any) -> bool:
    if isinstance(file_obj, (io.BufferedIOBase, bytes, bytearray,
                             memoryview)):  # Check if it has buffer interface - binary in python
        return True
    elif isinstance(file_obj, (str,
                               io.TextIOBase)):  # Check if it's a string or a TextIOWrapper - textual data in python
        return False
    else:
        # If the type of file is not determined yet (it's not part of standard Python types)
        # then we check the nature of the buffer (at its base) if it's available
        try:
            return isinstance(file_obj.buffer, io.BufferedIOBase)
        except AttributeError:
            return False

def detect_internal_encoding(file: IO[bytes]) -> str:
    """
    Detects and returns the declared encoding of a binary file based on its content.

    This function is designed to work with files opened in binary mode. It reads the
    beginning of the file to identify any declared encoding information. The main
    purpose is to facilitate the discovery of file encoding to guide further processing
    tasks, such as reading or parsing the file content accurately.

    Args:
        file (IO[bytes]): A file object opened in binary mode. The function seeks
        to the beginning of the file before processing and resets the read pointer
        to the start after completion.

    Returns:
        str: The declared encoding found within the file, if any. If the function
        cannot identify a declared encoding, it returns `None`. This does not
        necessarily mean the file is without encoding, just that no declaration was
        found within the initial content examined.

    Raises:
        ValueError: If the provided file is not opened in binary mode. This function
        relies on binary access to the file data for its operation.

    Example:
        >>> import io
        >>> file = io.BytesIO(b'# -*- coding: utf-8 -*-\\nprint("Hello, world!")')
        >>> detect_internal_encoding(file)
        'utf-8'

    Note:
        For a detailed understanding of how encoding detection is performed, refer to
        the docstring of `_detect_internal_encoding`.
    """
    if not is_binary_mode(file):
        raise ValueError("File must be opened in binary mode")

    file.seek(0)
    file_type, encoding = _detect_internal_encoding(file)
    file.seek(0)
    return encoding


def is_plain_text_file(file_obj: IO[bytes]) -> bool:
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

    Note:
        Empty files are considered plain text by this function. If you want to
        treat empty files as binary, check the file size before calling this function.
    """
    allow_list = list(range(9, 11)) + list(range(13, 14)) + list(range(32, 256))
    # gray_list = [7, 8, 11, 12, 26, 27]
    block_list = list(range(0, 7)) + list(range(14, 32))

    allow_found = False

    file_obj.seek(0)

    # Check if the file is empty and return True immediately if it is
    first_byte = file_obj.read(1)
    if not first_byte:
        return True  # Return True for an empty file

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

            with zip_file.open(member, "r") as file:
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
