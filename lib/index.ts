import 'source-map-support/register';

import PDFParser = require('pdf2json');
import { PdfData } from 'pdf2json';

import { find_text, find_match_indexes } from './pdf-parser';

/**
 * loads PDF by path
 * @param {string} path path to pdf
 * @returns {Promise<PdfData>}
 */
export function load_pdf(path: string): Promise<PdfData> {
  return new Promise((resolve, reject) => {
    let pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', reject);
    pdfParser.on('pdfParser_dataReady', resolve);

    pdfParser.loadPDF(path);
  });
}

/**
 * parse PDF
 * @param {string} path path to pdf
 */
export function parse_pdf(pdf_data: PdfData & { path?: string }): Install {
  let pdf_texts = pdf_data.formImage.Pages[0].Texts.filter(
    (i: any) => i != null,
  );

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
  };
  const line_item_indexes = find_match_indexes(pdf_texts, /^00\d0$/, {
    multiple: true,
  });
  console.log(line_item_indexes);
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

export interface Install {
  pdf: string;
  po: string;
  ship_to: string;
  address: string;
  line_items?: string[];
}
