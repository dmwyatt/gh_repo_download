## What is this project?

This project allows you to download and view the contents of a GitHub repository as a
single text file.

## Why was this tool created?

This tool was created to make it easy to share context with LLM chatbots like ChatGPT,
Claude, and Gemini. By downloading a GitHub repository as a single text file, you can
easily provide the chatbot with the necessary context to understand and discuss the
contents of the repository.

Here are a few examples of how this tool can be useful when interacting with chatbots:

- Share the source code of a project with the chatbot to discuss implementation details or
  get suggestions for improvements.

- Provide the chatbot with a repository containing documentation or research papers to
  facilitate a conversation about the topics covered.

- Use the downloaded text file to give the chatbot context about a specific topic or
  domain, enabling more informed and relevant responses.

## Somewhat interesting stuff

Here's some stuff that is at least somewhat interesting about the project.

### Token counting

We provide a [token](https://platform.openai.com/tokenizer) count for the text file. The
interesting thing about this is that the token count is done in-browser via a packaging of
the python `tiktoken` library via WASM.

Counting tokens isn't exactly a trivial task. By doing it on the client we take a load off
the server. The tradeoff is that it's a bit more than 4MB to download.

### ZIP files

To download a given repo, we just slap `/archive/master.zip` onto the end of the URL. This
is basically the same as clicking the "Download ZIP" button on the GitHub page. See
[this issue](https://github.com/dmwyatt/gh_repo_download/issues/1) for improvements
someone could make to this.

### In-memory

We don't write the downloaded files to disk, nor do we extract the ZIP file to disk.
Everything is kept in memory for a couple of reasons:

- No static/media files to worry about. No storage needed. No cleaning up storage needed.
- Security implications of unzipping files from the internet. We don't have to think about
  handling relative paths or any other shenanigans that could be in the ZIP file.

A side effect of this is that we do a bit of non-standard handling of the POST/GET of the
form. We do the downloading and processing of the repo in the view that you get redirected
to after the form is submitted. The weird part is that the downloading and processing
might lead to some errors that are best displayed on the form page. So we store the
appropriate errors in the session and then redirect back to the form page which reads the
errors from the session and sends them to the template for display.

### Data URI

As a side effect of doing everything in-memory, we don't have an URL to download the
concatenated file from. Instead, we embed the file in the HTML on the results page as a
data URI. I was at first concerned about the size of the data URI, but it seems that you
can have a lot!

[According to MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs#length_limitations):

> Firefox version 97 and newer supports data URLs of up to 32MB (before 97 the limit was
> close to 256MB). Chromium objects to URLs over 512MB, and Webkit (Safari) to URLs over
> 2048MB.

Since we also have a "copy to clipboard" button, we just read the data URI in Javascript,
decode it, and copy it to the clipboard.

### Resource management

We do need to worry about downloading excessively large repos or delivering excessively
large text files.

- `downloader.repo_utils.download_repo` restricts the largest size of ZIP file we
  download,
- `downloader.file_utils.extract_text_files` limits the total number of files we'll
  process.
- `downloader.file_utils.extract_text_files` also limits the total size of text we'll
  deliver.

### Text files only (hopefully)

Since we're constructing data to give to a text-based LLM, we only want text files. The
first thought I had was to have a hard-coded list of file extensions that would be
considered text, but that's not very flexible and requires maintenance.

Instead, I use the algorithm the `zlib` library uses. You can see it in
`downloader.file_utils.is_plain_text_file`. The algorithm identifies a file as plain text
if it contains at least one byte from an allowed list (including typical text characters
like TAB, LF, CR, and the range SPACE to 255) and no bytes from a block list (comprising
mainly control characters outside common text usage, such as NUL to 6, and 14 to 31),
offering a straightforward method for text detection without necessitating the analysis of
the entire file or considering ambiguous byte values.

### File encoding

Once we've determined a file is a text file, we check it for encoding declarations like
XML's `<?xml version="1.0" encoding="UTF-8"?>` or Python's `# -*- coding: utf-8  -*-` and
use whatever we find there. If we don't find anything we just assume "UTF-8". See more
here: `downloader.file_utils.detect_internal_encoding`.

## Configurations

- The maximum size of repository that will be downloaded is in `settings.MAX_REPO_SIZE`.
- We'll stop after processing `settings.MAX_FILE_COUNT` files from the repo.
- We'll only deliver up to `settings.MAX_TEXT_SIZE` of text.

## How to Contribute

Thank you for your interest in contributing! Here are the steps to get started with
development:

### Step 1: Set Up Your Development Environment

#### Prerequisites

- Python 3.12 or later
- Node.js 20 or later

#### Fork and Clone the Repository

1. **Fork the Repository:** Begin by forking the project to your GitHub account.
1. **Clone Your Fork:** Clone your fork to your local environment:
   ```bash
   git clone https://github.com/your-username/gh_repo_download.git
   ```

#### Install Dependencies

For managing Python dependencies, you can choose between `uv` and `pip-tools`. `uv` is
much faster for installing dependencies, but you may be more comfortable with `pip-tools`.
`uv` installation instructions [here](https://github.com/astral-sh/uv#getting-started).

**Use a virtualenv!**

Select the one that best fits your workflow:

- **Using `uv`:**

  - Install `uv` if you haven't already.
  - Compile and sync dependencies:
    ```bash
    uv pip compile requirements.in dev-requirements.in -o requirements.txt
    uv pip sync requirements.txt
    ```

- **Using `pip-tools`:**

  - Install `pip-tools`:
    ```bash
    python3 -m pip install pip-tools
    ```
  - Compile and sync dependencies:
    ```bash
    pip-compile requirements.in dev-requirements.in -o requirements.txt
    pip-sync requirements.txt
    ```

For Node.js dependencies:

```bash
npm install
```

### Step 2: Run the local server(s)

#### Django

1. **Run the Server:**

   ```bash
    python manage.py runserver
   ```

#### Vite

1. **Run the Server:**

   ```bash
    npm run dev
   ```

### Step 2: Make Your Changes

1. Create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

1. Implement your changes, adhering to the project's code style and guidelines.

1. Test your changes thoroughly.

1. Commit and push your changes:

   ```bash
   git commit -am 'Add some feature'
   git push origin feature/your-feature-name
   ```

### Step 4: Submit Your Changes

1. Open a Pull Request (PR) from your branch to the main repository. Provide a detailed
   description of your changes and the impact they have.

### Development Guidelines

- Adhere to the coding standards (PEP 8 for Python; black for code formatting).
- Ensure new features or fixes are accompanied by tests.
- Update the documentation as necessary to reflect your changes.

### Getting Help

If you need assistance or have questions, feel free to open/continue
[an issue on GitHub](https://github.com/dmwyatt/gh_repo_download/issues).
