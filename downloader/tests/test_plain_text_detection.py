import io

from downloader.file_utils import is_plain_text_file


def test_plain_text_file():
    text_content = b"Hello, world!\nThis is a plain text file."
    file_obj = io.BytesIO(text_content)
    assert is_plain_text_file(file_obj) == (True, text_content)


def test_binary_file():
    binary_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x02\x00\x00\x00\x02\x08\x02\x00\x00\x00\xfd\xd4\x9as\x00\x00\x00\x16IDATx\x9cc\xfc\xcf\xc0\xc0\xc0\xc0\xc0\xc4\xc0\xc0\xc0\xc0\xc0\x00\x00\r\x1d\x01\x03j\xc2\x9b\xe9\x00\x00\x00\x00IEND\xaeB`\x82"
    file_obj = io.BytesIO(binary_content)
    assert is_plain_text_file(file_obj) == (False, binary_content)


def test_empty_file():
    file_obj = io.BytesIO(b"")
    assert is_plain_text_file(file_obj) == (False, b"")


def test_large_text_file():
    large_text = b"A" * 10**6  # 1 MB of ASCII character 'A'
    file_obj = io.BytesIO(large_text)
    assert is_plain_text_file(file_obj)[0] == True
