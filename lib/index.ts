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
  extract_install_info(pdf_data).forEach((raw_info, i) => {
    // console.log(`LINE ITEM #${i + 1}\n`, raw_info);

    const name_short_match = raw_info.match(/3PI-INSTALL-(.+)$/im);
    const name_short = name_short_match != null ? name_short_match[1] : 'N/A';

    raw_info.toLowerCase().indexOf('location');

    const location = install_info_text_match(raw_info, 'Location:');
    // const end_user_raw = install_info_text_match(raw_info, /end[\/-]user:/);
    const end_user_raw = install_info_text_match(
      raw_info,
      /(End user contact info:?)|(END-USER.*?:?)/i,
    );
    const end_user = Person.Parse(end_user_raw || '');
    const contact_raw = install_info_text_match(
      raw_info,
      /(^contact:?(?:\nrtwc:)?)/im,
    );
    const contact = Person.Parse(contact_raw || '');

    line_items.push({
      id: i + 1,
      name_short,
      name: item_abbr_to_name(name_short),
      full_content: raw_info,
      location,
      end_user: [end_user],
      contact: [contact],
    });
  });

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
 * Searches text for install information
 * @param install_info Install info text - usually from
 *  `pdf-parser:extract_install_info`
 * @param search The content to search for to start the match
 */
function install_info_text_match(
  install_info: string,
  search: string | RegExp,
): string | undefined {
  let index_start: number;
  let index_end: number | undefined = undefined;

  let search_start: number;

  if (typeof search === 'string') {
    search_start = install_info.indexOf(search) + search.length;
    if (search_start === -1) {
      return undefined;
    }
  } else {
    const search_matches = install_info.match(search);
    if (search_matches != null) {
      search_start = (search_matches.index || 0) + search_matches[0].length;
    } else {
      return undefined;
    }
  }

  const search_start_matches = install_info
    .slice(search_start)
    .match(/^\n+/);
  if (search_start_matches == null) {
    index_start = search_start;
  } else {
    index_start =
      search_start +
      (search_start_matches.index || 0) +
      search_start_matches[0].length;
  }
  const end_matches = install_info
    .slice(search_start)
    .match(/(?:={3,})|(?:^.*:$)/im);
  const length = end_matches ? end_matches.index || -1 : -1;
  if (length !== -1) {
    index_end = search_start + length;
  }

  return install_info.slice(index_start, index_end);
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
    case 'chair':
      return 'Chair';
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

export class Person {
  name?: string;
  phones?: string[];
  emails?: string[];

  constructor({ name, phones, emails }: Person = {}) {
    this.name = name;
    this.phones = phones;
    this.emails = emails;
  }

  static Parse(text: string): Person {
    const emails = text.match(/(\S+)@((?:\S+\.)+\S+)/g) || [];
    const phones = text.match(/(\d{3,3}).*?(\d{3,3}).*?(\d{4,4})/g) || [];
    let name: string;
    if (text.match(/.+\n.+/) != null) {
      name = text.slice(0, text.indexOf('\n'));
    } else {
      // TODO: figure out how to slice out just user's name
      name = text.trim();
    }
    return new Person({
      name,
      emails,
      phones: phones.map<string>(phone => phone.replace(/\D/g, '')),
    });
  }
}

export type FullPdfData = PdfData & { path: string };
