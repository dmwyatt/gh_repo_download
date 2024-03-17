import logging
import os
import re

from django.conf import settings
from django.template import loader

logger = logging.getLogger(__name__)


def is_plain_text_file(file_path):
    allow_list = list(range(9, 11)) + list(range(13, 14)) + list(range(32, 256))
    gray_list = [7, 8, 11, 12, 26, 27]
    block_list = list(range(0, 7)) + list(range(14, 32))

    allow_found = False
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(4096)
            if not chunk:
                break

            for byte in chunk:
                if byte in allow_list:
                    allow_found = True
                elif byte in block_list:
                    return False

    return allow_found


def is_safe_filename(filename):
    # Allowed characters in the filename
    allowed_chars = re.compile(r"^[a-zA-Z0-9_\-.]+$")

    # Check if the filename is empty
    if not filename:
        return False

    # Check if the filename exceeds the maximum length
    if len(filename) > settings.MAX_FILENAME_LENGTH:
        return False

    # Check if the filename contains only allowed characters
    if not allowed_chars.match(filename):
        return False

    # Check if the filename starts with a dot or hyphen
    if filename.startswith(".") or filename.startswith("-"):
        return False

    # Check if the filename contains consecutive dots or hyphens
    if ".." in filename or "--" in filename:
        return False

    # Check if the filename ends with a dot or hyphen
    if filename.endswith(".") or filename.endswith("-"):
        return False

    # Additional checks for specific file extensions
    # Example: Restrict certain file extensions
    restricted_extensions = settings.RESTRICTED_FILE_EXTENSIONS
    _, extension = os.path.splitext(filename)
    if extension.lower() in restricted_extensions:
        return False

    return True


def concat_files(extracted_dir: str, repo_name: str) -> tuple[str, int, int]:
    template = loader.get_template("repo_template.txt")
    concatenated_files = []
    total_file_count = 0
    for root, dirs, filenames in os.walk(extracted_dir):
        for filename in filenames:
            total_file_count += 1
            file_path = os.path.join(root, filename)
            if not is_safe_filename(filename):
                logger.warning(f"Skipping file with unsafe filename: {file_path}")
                continue
            if is_plain_text_file(file_path):
                with open(file_path, "r", encoding="utf-8") as file:
                    content = file.read().strip()
                    concatenated_files.append(
                        {
                            "path": os.path.relpath(file_path, extracted_dir),
                            "content": content,
                        }
                    )
                    logger.info(f"Processing file: {file_path}")
            else:
                logger.warning(f"Skipping non-text file: {file_path}")

    context = {"repo_name": repo_name, "files": concatenated_files}
    return template.render(context), total_file_count, len(concatenated_files)
