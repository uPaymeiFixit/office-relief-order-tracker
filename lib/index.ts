import 'source-map-support/register';

import PDFParser = require('pdf2json');
import { PdfData, TextBlock } from 'pdf2json';
import * as dedent from 'dedent';

import {
  find_text,
  find_match_indexes,
  extract_install_info,
} from './pdf-parser';

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
  // console.log(
  //   `"${pdf_data.path}" has ${line_item_numbers_indexes.length} line items`,
  // );
  // console.log(line_item_numbers_indexes.map(i => pdf_texts[i].R[0].T));

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

  // console.log(line_items_indexes.map(i => pdf_texts[i].R[0].T));

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
  // TODO: install info and notes line item
  // TODO: pull location from install info and notes section

  return data;
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

export type FullPdfData = PdfData & { path: string };
