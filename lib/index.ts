import 'source-map-support/register';

import PDFParser = require('pdf2json');
import { PdfData, TextBlock } from 'pdf2json';
import * as dedent from 'dedent';

import { find_text, find_match_indexes } from './pdf-parser';

/**
 * loads PDF by path
 * @param {string} path path to pdf
 * @returns {Promise<PdfData>}
 */
export function load_pdf(path: string): Promise<FullPdfData> {
  return new Promise((resolve, reject) => {
    let pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', reject);
    pdfParser.on('pdfParser_dataReady', data => {
      resolve({ path, ...data });
    });

    pdfParser.loadPDF(path);
  });
}

/**
 * parse PDF
 * @param {string} path path to pdf
 */
export function parse_pdf(pdf_data: FullPdfData): Install {
  let pdf_texts: TextBlock[] = (<TextBlock[]>[])
    .concat(...pdf_data.formImage.Pages.map(page => page.Texts))
    .filter(i => i != null);

  const line_item_numbers_indexes = find_match_indexes(pdf_texts, /^00\d0$/, {
    multiple: true,
  });
  console.log(
    `"${pdf_data.path}" has ${line_item_numbers_indexes.length} line items`,
  );
  console.log(line_item_numbers_indexes.map(i => pdf_texts[i].R[0].T));

  const line_items_indexes = find_match_indexes(pdf_texts, /3PI-INSTALL-.+/i);
  if (line_items_indexes.length !== line_item_numbers_indexes.length) {
    // TODO: evaluate if I really want to `throw` an error here.
    throw new Error(dedent`
      Failed to find all line items.
        Found ${
          line_item_numbers_indexes.length
        } line item markers, but only found ${
      line_items_indexes.length
    } actual items
    `);
  }

  console.log(line_items_indexes.map(i => pdf_texts[i].R[0].T));

  console.log(`Install info:`);
  console.log(extract_install_info(pdf_data));

  const line_items: LineItem[] = [];

  for (const i in line_item_numbers_indexes) {
    const name_short = pdf_texts[line_items_indexes[i]].R[0].T.replace(
      '3PI-INSTALL-',
      '',
    );
    line_items.push({
      id: parseInt(pdf_texts[line_item_numbers_indexes[i]].R[0].T, 10),
      name_short,
      name: item_abbr_to_name(name_short),
      full_content: '',
    });
  }

  const data: Install = {
    pdf: pdf_data.path || 'N/A',
    po: find_text(pdf_texts, 'PO Number', /\d{4,}/) || 'N/A',
    ship_to:
      find_text(pdf_texts, 'Ship To', /^(.+?)\n\d/s, {
        content_match_max_elements: 3,
      }) || 'N/A',
    address:
      find_text(pdf_texts, 'Ship To', /^\d+.*? .*\d{4,}/s, {
        content_match_max_elements: 3,
      }) || 'N/A',
    line_items,
  };
  // data.line_items = find_text(
  //   pdf_texts,
  //   'Ship To',
  //   /^\d+.*? .*\d+/s, {
  //   content_match_max_elements: 3,
  // });
  // TODO: install info and notes line item
  // TODO: pull location from install info and notes section

  // console.log('PO #:', data.po);
  // console.log('Ship To:', data.ship_to);
  // console.log('Address:', data.address);

  return data;
}

/**
 * Extracts all line item text from the "Installation Information & Notes" box
 * @param pdf_data
 * @returns Array of strings of line item notes
 */
function extract_install_info(pdf_data: FullPdfData): string[] {
  // TODO: What about text that overflows the box?

  const texts: TextBlock[] = [];
  let overall_height: number = 0;

  for (let i = 0; i < pdf_data.formImage.Pages.length; i++) {
    const page = pdf_data.formImage.Pages[i];
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
    // console.log(bounding_fill);
    // Find box of `VLines` and `HLines` of similar width to `bounding_fill`
    const left = page.VLines.reduce((val, line) => {
      return Math.abs(line.x - bounding_fill.x) <
        Math.abs(val.x - bounding_fill.x)
        ? line
        : val;
    }, page.VLines[0]);
    const right = page.VLines.reduce((val, line) => {
      return Math.abs(line.x - (bounding_fill.x + bounding_fill.w)) <
        Math.abs(val.x - (bounding_fill.x + bounding_fill.w))
        ? line
        : val;
    }, page.VLines[0]);
    // console.log(left, right);
    // Store box's bounds
    const bounding_box: Box = {
      x: left.x,
      y: left.y + bounding_fill.h,
      w: right.x - left.x,
      h: left.l - bounding_fill.h,
    };
    // console.log(bounding_box);
    // --End--

    // --Start-- Filter for text contained in install info box
    const page_texts = page.Texts.filter(text =>
      box_contains_point(bounding_box, text),
    );
    console.log(page_texts.length);
    // --End--

    // --Start-- Merge each page's texts
    overall_height += i > 0 ? pdf_data.formImage.Pages[i - 1].Height : 0;
    texts.push(...page_texts.map(text => ({
      ...text,
      y: text.y + overall_height,
    })));
    // --End--
  }


  // --Start-- Split text up in to line items
  const line_item_numbers_indexes = find_match_indexes(texts, /^00\d0$/);
  console.log('line_item_numbers_indexes');
  console.log(line_item_numbers_indexes);
  // --End--

  return [];
}

/**
 * Gets product name by abbreviation
 * Returns abbreviation if no matching name found
 * @param abbr Product abbreviation
 * @returns Full product name
 */
function item_abbr_to_name(abbr: string): string {
  switch (abbr.toLowerCase()) {
    case 'sma':
      return 'Single monitor arm';
    case 'akp':
      return 'Adjustable keyboard platform';
    case 'dwf':
      return 'Dual WorkFit';
    case 'swf':
      return 'Single WorkFit';
    case '2smtbl':
      return 'Small table (2)';
    case '2lgtbl':
      return 'Large table (2)';
    default:
      return abbr;
  }
}

function box_contains_point(box: Box, point: Point): boolean {
  return (
    box.x <= point.x &&
    box.y <= point.y &&
    box.x + box.w >= point.x &&
    box.y + box.h >= point.y
  );
}

export interface Install {
  pdf: string;
  po: string;
  ship_to: string;
  address: string;
  line_items?: LineItem[];
}

export interface LineItem {
  /** Line item number. usually a multiple of 10 */
  id: number;
  /** Abbreviated name of item */
  name_short: string;
  /** Full name of item */
  name: string;
  /** Address to actually deliver to */
  location?: string;
  /** End user's contact info */
  end_user?: Person[];
  /** Contact's contact info */
  contact?: Person[];
  /** End user's supervisor's contact info */
  supervisor?: Person[];
  /** Full line item description content */
  full_content: string;
}

export interface Person {
  name?: string;
  phones?: string[];
  emails?: string[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  w: number;
  h: number;
}

export type FullPdfData = PdfData & { path: string };
