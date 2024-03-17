import 'vite/modulepreload-polyfill';
import { get_encoding } from 'tiktoken';

function decodeDataURI(element) {
  // Check if the element is valid and has the required attribute
  if (!element || !element.getAttribute || !element.hasAttribute('href')) {
    throw new Error('Invalid element: Element must have an href attribute.');
  }

  const dataURI = element.getAttribute('href');
  if (!dataURI.startsWith('data:')) {
    throw new Error('Invalid element: href attribute does not contain a valid data URI.');
  }

  // Extract and decode the content from the data URI
  const content = dataURI.split(',')[1];
  const decodedContent = decodeURIComponent(content);

  return decodedContent;
}

function countTokens(text) {
  const encoding = get_encoding('cl100k_base');
  const tokens = encoding.encode(text);
  const tokenCount = tokens.length;

  encoding.free(); // Ensure resources are freed after use

  return tokenCount;
}

function main() {
  // Get the data URI from the <a> element
  const downloadLink = document.querySelector('a[download]');
  const decodedContent = decodeDataURI(downloadLink);

  // Count the tokens
  const tokenCount = countTokens(decodedContent);

  // get the span with the id of cl100k_base_token_count
  const tokenCountSpan = document.getElementById('cl100k_base_token_count');
  tokenCountSpan.textContent = tokenCount;
}

main();
