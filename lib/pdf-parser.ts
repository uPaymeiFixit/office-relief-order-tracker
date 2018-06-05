import 'source-map-support/register';

import { TextBlock } from 'pdf2json';

/**
 * Finds PDF item indexes matching pattern
 * @param {object[]} pdf_texts array of null-filtered text blocks from `pdf2json`
 * @param {string|RegExp} name_match
 * @param {number} $0.start_at
 * @param {boolean=true} $0.multiple whether to only run until first match
 * @returns {number[]} index of matches
 */
export function find_match_indexes(
  pdf_texts: TextBlock[],
  name_match: string | RegExp,
  { start_at = 0, multiple = true } = {},
): number[] {
  const indexes: number[] = [];

  for (let i = 0; i < pdf_texts.length; i++) {
    if (decodeURIComponent(pdf_texts[i].R[0].T).match(name_match) != null) {
      indexes.push(i);
      if (!multiple) break;
    }
  }

  return indexes;
}

/**
 * Finds text matching pattern, following a label
 * @param {object[]} pdf_texts array of null-filtered text blocks from `pdf2json`
 * @param {string|RegExp} name_match
 * @param {string|RegExp} content_match
 * @param {number} $0.content_match_max_elements max number of elements after
 *  `name_match` to search through
 * @param {number} $0.start_at index of `pdf_texts` array to start searching from
 * @returns {string} returns the matched string if found, undefined if not found
 */
export function find_text(
  pdf_texts: TextBlock[],
  name_match: string | RegExp,
  content_match: string | RegExp,
  { content_match_max_elements = 1, start_at = 0 } = {},
): string | undefined {
  if (typeof name_match === 'string')
    name_match = new RegExp(`^${name_match}$`, 'i');
  // The function call appears to be 1-indexed, but usage needs it to be 0-indexed
  content_match_max_elements--;

  const [name_index] = find_match_indexes(pdf_texts, name_match, {
    start_at,
    multiple: false,
  });
  for (let i = 0; i + content_match_max_elements < pdf_texts.length; i++) {
    const match_against = decodeURIComponent(
      pdf_texts
        .slice(
          name_index + 1 + i,
          name_index + 3 + i + content_match_max_elements,
        )
        .reduce((acc, curr) => (acc += `${curr.R[0].T}\n`), ''),
    );

    const match = match_against.match(content_match);
    if (match != null) {
      return match[1] != null ? match[1] : match[0];
    }
  }
}
