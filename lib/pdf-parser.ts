import 'source-map-support/register';

import { TextBlock } from 'pdf2json';

import { FullPdfData } from './index';
import { Box, box_contains_point, offset_box } from './utils/box';

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

/**
 * Extracts line item text from the "Installation Information & Notes" boxes
 * @param pdf_data
 * @returns Array of strings of line item notes
 */
export function extract_install_info(pdf_data: FullPdfData): string[] {
  let texts: TextBlock[] = [];
  let overall_height: number = 0;

  for (const page of pdf_data.formImage.Pages) {
    // --Start-- Find install info box bounds
    // Find "Installation Information & Notes" in Texts
    const install_info_text =
      page.Texts[
        find_match_indexes(page.Texts, /Installation Information/i, {
          multiple: false,
        })[0]
      ];
    if (install_info_text == null) {
      throw new Error(`Could not find "Installation Information" text`);
    }
    // Find Fill that surrounds "Installation Information & Notes"
    const bounding_fill = page.Fills.reduce((val, fill) => {
      if (box_contains_point(fill, install_info_text)) {
        if (val == null || val.w * val.h > fill.w * fill.h) return val;
        else return fill;
      } else return val;
    });
    if (bounding_fill == null) {
      throw new Error('Could not find installation `Fill`');
    }
    // console.log(bounding_fill);
    // Find box of `VLines` and `HLines` of similar width to `bounding_fill`
    // TODO: This fails to find the correct line if it runs bottom to top
    const left = page.VLines.reduce((val, line) => {
      return Math.pow(bounding_fill.x - line.x, 2) +
        Math.pow(bounding_fill.y + bounding_fill.h - line.y, 2) <
        Math.pow(bounding_fill.x - val.x, 2) +
          Math.pow(bounding_fill.y + bounding_fill.h - val.y, 2)
        ? line
        : val;
    }, page.VLines[0]);
    const right = page.VLines.reduce((val, line) => {
      return Math.pow(bounding_fill.x + bounding_fill.w - line.x, 2) +
        Math.pow(bounding_fill.y + bounding_fill.h - line.y, 2) <
        Math.pow(bounding_fill.x + bounding_fill.w - val.x, 2) +
          Math.pow(bounding_fill.y + bounding_fill.h - val.y, 2)
        ? line
        : val;
    }, page.VLines[0]);
    // console.log(left, right);
    // Store box's bounds
    // TODO: instead of doing a dumb offset, make bounding boxes around text and compare that
    const bounding_box: Box = offset_box(
      new Box(
        left.x,
        left.y + bounding_fill.h,
        right.x - left.x,
        left.l - bounding_fill.h,
      ),
      0.15,
    );
    // console.log(bounding_box);
    // --End--

    // --Start-- Filter for text contained in install info box
    const page_texts = page.Texts.filter(text =>
      box_contains_point(bounding_box, text),
    );
    // console.log(page_texts.length);
    // --End--

    // --Start-- Merge each page's texts
    texts.push(
      ...page_texts.map(text => ({
        ...text,
        y: text.y + overall_height,
      })),
    );
    overall_height += page.Height;
    // --End--
  }

  // --Start-- Sort `texts` by position
  texts = texts.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  // --End--

  // --Start-- Split text up in to line items
  const line_item_numbers_indexes = find_match_indexes(texts, /^3PI-INSTALL-/);
  // console.log('line_item_numbers_indexes');
  // console.log(line_item_numbers_indexes);
  // --End--

  const line_items_texts: TextBlock[][] = [];
  for (let i = 0; i < line_item_numbers_indexes.length; i++) {
    line_items_texts.push(
      texts.slice(
        line_item_numbers_indexes[i],
        line_item_numbers_indexes[i + 1],
      ),
    );
  }

  return line_items_texts.map(texts =>
    texts.reduce<string>((val, text, i, arr) => {
      if (i === 0) {
        return decodeURIComponent(text.R[0].T);
      } else if (arr[i - 1].y < arr[i].y) {
        return `${val}\n${decodeURIComponent(text.R[0].T)}`;
      } else {
        return `${val} ${decodeURIComponent(text.R[0].T)}`;
      }
    }, ''),
  );
}
