import asyncio
import codecs
import io
import logging
import re
import zipfile
from contextlib import contextmanager
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


def detect_internal_encoding_from_bytes(
    bytes_content: bytes,
) -> tuple[str, str] | tuple[None, None]:
    """
    Determines the encoding from the bytes content, if an encoding declaration is present.

    Args:
        bytes_content: Bytes to be assessed for an encoding declaration.

    Returns:
        A tuple containing the file type and the declared encoding found within the content.
        If no encoding declaration is found, returns a tuple with None values.
    """
    encoding = None
    for bom, bom_encoding in [
        (codecs.BOM_UTF32_LE, "utf-32-le"),
        (codecs.BOM_UTF32_BE, "utf-32-be"),
        (codecs.BOM_UTF16_LE, "utf-16-le"),
        (codecs.BOM_UTF16_BE, "utf-16-be"),
        (codecs.BOM_UTF8, "utf-8-sig"),
    ]:
        if bytes_content.startswith(bom):
            encoding = bom_encoding
            break

    if encoding:
        decoded_content = bytes_content.decode(encoding)
    else:
        try:
            decoded_content = bytes_content.decode("utf-8")
        except UnicodeDecodeError:
            decoded_content = bytes_content.decode("ascii", errors="ignore")

    file_type, encoding = find_encoding_declaration(decoded_content)

    if encoding:
        return file_type, encoding

    fallback_encodings = ["cp875", "cp1026", "cp1140"]
    for fallback_encoding in fallback_encodings:
        try:
            decoded_content = bytes_content.decode(fallback_encoding)
            file_type, encoding = find_encoding_declaration(decoded_content)
            if encoding:
                return file_type, encoding
        except UnicodeDecodeError:
            continue

    return None, None


@contextmanager
def seek_to_start(file_obj):
    file_obj.seek(0)

    try:
        # Before entering the context, no action is needed.
        yield file_obj
    finally:
        # When exiting the context, seek back to the start of the file.
        file_obj.seek(0)


def is_plain_text_file(file_obj: IO[bytes]) -> tuple[bool, bytes]:
    """
    Checks whether a file is a plain text or a binary file by analyzing its contents.

    The function utilizes an algorithm used in zlib to infer the file type. It classifies
    a file as plain text if it contains at least one byte from the allowed list,
    representing textual bytecodes, and does not contain any byte from the blocked list,
    which consists of undesired, non-textual bytecodes. The rationale behind the
    algorithm is that most plain text files are composed of printable ASCII characters
    and common control characters, whereas binary files are likely to contain control
    characters, including null bytes.

    A thorough explanation of the algorithm can be located at:
    https://github.com/madler/zlib/blob/8678871f18f4dd51101a9db1e37791f975969079/doc/txtvsbin.txt

    Args:
        file_obj (IO[bytes]): The file object to be checked.

    Returns:
        tuple[bool, bytes]: A tuple containing two items:
            - A boolean that indicates if the file is plain text (True) or binary (False).
            - A byte string of the first chunk of the file.

    Raises:
        IOError: If there's a problem in reading the file.

    Note:
        The algorithm considers an empty file as a binary.
    """
    allow_list = list(range(9, 11)) + list(range(13, 14)) + list(range(32, 256))
    # gray_list = [7, 8, 11, 12, 26, 27]
    block_list = list(range(0, 7)) + list(range(14, 32))

    allow_found = False

    with seek_to_start(file_obj) as file_obj:
        #    Check if the file is empty and return True immediately if it is
        first_byte = file_obj.read(1)
        if not first_byte:
            return False, b""  # Return False for an empty file

        on_first_chunk = True
        first_chunk = None

        while True:
            chunk = file_obj.read(4095 if on_first_chunk else 4096)
            if not chunk:
                break

            if on_first_chunk:
                chunk = first_byte + chunk
                on_first_chunk = False
                first_chunk = chunk

            for byte in chunk:
                if byte in allow_list:
                    allow_found = True
                elif byte in block_list:
                    return False, first_chunk

        return allow_found, first_chunk


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
    exclude_files: list[str] = None,
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
        exclude_files (list): A list of file paths to be excluded from extraction.

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
    if exclude_files is None:
        exclude_files = []
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
            if member.filename in exclude_files:
                logger.info(f"Excluding file: {member.filename}")
                total_files -= 1
                continue

            with zip_file.open(member, "r") as file:
                is_plain_text, first_chunk = is_plain_text_file(file)
                if is_plain_text:
                    _, encoding = detect_internal_encoding_from_bytes(first_chunk)
                    if encoding:
                        try:
                            content = file.read().decode(encoding)
                        except LookupError:
                            content = file.read().decode("utf-8", errors="replace")
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
