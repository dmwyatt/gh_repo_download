import codecs
import io

import pytest

from downloader.file_utils import detect_internal_encoding

FILE_ENCODING_MAPPING = {
    "python": {
        "content": "# -*- coding: utf-8 -*-\n\nprint('Hello, World!')\n",
        "encoding": "utf-8",
    },
    "ruby": {
        "content": "# encoding: utf-8\n\nputs 'Hello, World!'\n",
        "encoding": "utf-8",
    },
    "xml": {
        "content": '<?xml version="1.0" encoding="UTF-8"?>\n<root>Hello, World!</root>\n',
        "encoding": "UTF-8",
    },
    "html": {
        "content": '<html>\n<head>\n<meta charset="utf-8">\n</head>\n<body>Hello, World!</body>\n</html>\n',
        "encoding": "utf-8",
    },
    "perl": {
        "content": "use encoding 'utf-8';\n\nprint 'Hello, World!\\n';\n",
        "encoding": "utf-8",
    },
    "css": {
        "content": '@charset "utf-8";\n\nbody {\n  color: blue;\n}\n',
        "encoding": "utf-8",
    },
    "latex": {
        "content": "% !TEX encoding = UTF-8\n\n\\documentclass{article}\n\\begin{document}\nHello, World!\n\\end{document}\n",
        "encoding": "UTF-8",
    },
    "xhtml": {
        "content": '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<meta charset="utf-8"/>\n</head>\n<body>Hello, World!</body>\n</html>\n',
        "encoding": "UTF-8",
    },
}


def create_file_with_encoding(file_type):
    content = FILE_ENCODING_MAPPING[file_type]["content"]
    file = io.BytesIO(content.encode(FILE_ENCODING_MAPPING[file_type]["encoding"]))
    return file


@pytest.mark.parametrize("file_type", FILE_ENCODING_MAPPING.keys())
def test_detect_internal_encoding_with_valid_encoding_declarations(file_type):
    file_with_encoding = create_file_with_encoding(file_type)
    expected_encoding = FILE_ENCODING_MAPPING[file_type]["encoding"]
    detected_encoding = detect_internal_encoding(file_with_encoding)
    assert detected_encoding == expected_encoding


FILE_WITHOUT_ENCODING_MAPPING = {
    "python": "print('Hello, World!')\n",
    "ruby": "puts 'Hello, World!'\n",
    "xml": "<root>Hello, World!</root>\n",
    "html": "<html>\n<body>Hello, World!</body>\n</html>\n",
    "perl": "print 'Hello, World!\\n';\n",
    "css": "body {\n  color: blue;\n}\n",
    "latex": "\\documentclass{article}\n\\begin{document}\nHello, World!\n\\end{document}\n",
    "xhtml": '<html xmlns="http://www.w3.org/1999/xhtml">\n<body>Hello, World!</body>\n</html>\n',
}


def create_file_without_encoding(file_type):
    content = FILE_WITHOUT_ENCODING_MAPPING[file_type]
    file = io.BytesIO(content.encode("utf-8"))
    return file


@pytest.mark.parametrize("file_type", FILE_WITHOUT_ENCODING_MAPPING.keys())
def test_detect_internal_encoding_with_no_encoding_declarations(file_type):
    file_without_encoding = create_file_without_encoding(file_type)
    detected_encoding = detect_internal_encoding(file_without_encoding)
    assert detected_encoding is None


def test_detect_internal_encoding_with_invalid_encoding_declarations():
    detected_encoding = detect_internal_encoding(
        io.BytesIO(b"# -*- coding: invalid -*-\n\nprint('Hello, World!')\n")
    )
    assert detected_encoding is None


def test_detect_internal_encoding_with_empty_file():
    detected_encoding = detect_internal_encoding(io.BytesIO(b""))
    assert detected_encoding is None


ENCODINGS = [
    "ascii",
    "utf-8",
    "latin-1",
    "iso8859-1",
    "iso8859-2",
    "iso8859-3",
    "iso8859-4",
    "iso8859-5",
    "iso8859-6",
    "iso8859-7",
    "iso8859-8",
    "iso8859-9",
    "iso8859-10",
    "iso8859-11",
    "iso8859-13",
    "iso8859-14",
    "iso8859-15",
    "iso8859-16",
    "cp437",
    "cp720",
    "cp737",
    "cp775",
    "cp850",
    "cp852",
    "cp855",
    "cp856",
    "cp857",
    "cp858",
    "cp860",
    "cp861",
    "cp862",
    "cp863",
    "cp864",
    "cp865",
    "cp866",
    "cp869",
    "cp874",
    "cp875",
    "cp932",
    "cp949",
    "cp950",
    "cp1006",
    "cp1026",
    "cp1125",
    "cp1140",
    "cp1250",
    "cp1251",
    "cp1252",
    "cp1253",
    "cp1254",
    "cp1255",
    "cp1256",
    "cp1257",
    "cp1258",
    "euc_jp",
    "euc_jis_2004",
    "euc_jisx0213",
    "euc_kr",
    "gb2312",
    "gbk",
    "gb18030",
    "hz",
    "iso2022_jp",
    "iso2022_jp_1",
    "iso2022_jp_2",
    "iso2022_jp_2004",
    "iso2022_jp_3",
    "iso2022_jp_ext",
    "iso2022_kr",
    "latin_1",
    "iso8859_2",
    "iso8859_3",
    "iso8859_4",
    "iso8859_5",
    "iso8859_6",
    "iso8859_7",
    "iso8859_8",
    "iso8859_9",
    "iso8859_10",
    "iso8859_11",
    "iso8859_13",
    "iso8859_14",
    "iso8859_15",
    "iso8859_16",
    "johab",
    "koi8_r",
    "koi8_t",
    "koi8_u",
    "kz1048",
    "mac_cyrillic",
    "mac_greek",
    "mac_iceland",
    "mac_latin2",
    "mac_roman",
    "mac_turkish",
    "ptcp154",
    "shift_jis",
    "shift_jis_2004",
    "shift_jisx0213",
    "utf_32_be",
    "utf_32_le",
    "utf_16_be",
    "utf_16_le",
    "utf_7",
    "utf_8_sig",
]

CODING_FORMAT = "# -*- coding: {} -*-\n\nprint('Hello, World!')\n"


def create_file_with_encoding2(encoding):
    content = CODING_FORMAT.format(encoding).encode(encoding)

    if encoding == "utf_16_le":
        content = codecs.BOM_UTF16_LE + content
    elif encoding == "utf_16_be":
        content = codecs.BOM_UTF16_BE + content
    elif encoding == "utf_32_le":
        content = codecs.BOM_UTF32_LE + content
    elif encoding == "utf_32_be":
        content = codecs.BOM_UTF32_BE + content

    file = io.BytesIO(content)
    return file


@pytest.mark.parametrize("encoding", ENCODINGS)
def test_detect_internal_encoding_with_different_encodings(encoding):
    file_with_encoding = create_file_with_encoding2(encoding)
    detected_encoding = detect_internal_encoding(file_with_encoding)
    assert detected_encoding == encoding


CONTENT = "# -*- coding: utf-8 -*-\n\nprint('Hello, World!')\n"


def create_file_in_text_mode():
    file = io.StringIO(CONTENT)
    return file


def create_file_in_binary_mode():
    file = io.BytesIO(CONTENT.encode("utf-8"))
    return file


def test_detect_internal_encoding_with_text_mode():
    file_in_text_mode = create_file_in_text_mode()
    with pytest.raises(ValueError):
        detected_encoding = detect_internal_encoding(file_in_text_mode)


def test_detect_internal_encoding_with_binary_mode():
    file_in_binary_mode = create_file_in_binary_mode()
    detected_encoding = detect_internal_encoding(file_in_binary_mode)
    assert detected_encoding == "utf-8"


def create_file_at_beginning():
    file = io.BytesIO(CONTENT.encode("utf-8"))
    return file


def create_file_at_middle():
    file = io.BytesIO(CONTENT.encode("utf-8"))
    file.seek(len(CONTENT) // 2)
    return file


def create_file_at_end():
    file = io.BytesIO(CONTENT.encode("utf-8"))
    file.seek(0, io.SEEK_END)
    return file


def test_detect_internal_encoding_at_beginning():
    file_at_beginning = create_file_at_beginning()
    detected_encoding = detect_internal_encoding(file_at_beginning)
    assert detected_encoding == "utf-8"


def test_detect_internal_encoding_at_middle():
    file_at_middle = create_file_at_middle()
    detected_encoding = detect_internal_encoding(file_at_middle)
    assert detected_encoding == "utf-8"


def test_detect_internal_encoding_at_end():
    file_at_end = create_file_at_end()
    detected_encoding = detect_internal_encoding(file_at_end)
    assert detected_encoding == "utf-8"
