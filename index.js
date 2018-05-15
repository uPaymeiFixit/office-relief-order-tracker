let PDFParser = require("pdf2json");
const fs = require('fs');
const Path = require('path');

process.on('unhandledRejection', error => {
  console.log(error);
  process.exit(1);
});

const args = {
  pdf_path: process.argv[2] || 'samples',
  csv_path: process.argv[3] || 'installs.csv',
};

let files;
try {
  files = fs.readdirSync(args.pdf_path)
    .filter(file => file.endsWith('.pdf'))
    .map(file => Path.join(args.pdf_path, file));
} catch (err) {
  files = [args.pdf_path];
}
console.log(`Found ${files.length} files`);
const promises = [];
for (let i = 0; i < files.length; i++) {
  // console.log(`\nFILE ${i}`);
  promises.push(parse_pdf(files[i]));
}
Promise.all(promises).then(installs => {
  // console.log(installs);
  const csv = installs_to_csv(installs);
  fs.writeFileSync(args.csv_path, csv);
  console.log(`Wrote CSV to ${args.csv_path}`);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * converts installs to CSV string
 * @param {Install[]} installs - 
 * @returns {string}
 */
function installs_to_csv (installs) {
  let csv = '';

  // Object.keys(installs[0])
  //   .forEach((key, i, keys) => ret += `${key}${i + 1 != keys.length ? ',' : '\n'}`);
  csv += `PDF,PO,Ship To,Address\n`;

  installs.forEach(install => {
    csv += `"${install.pdf}","${install.po}","${install.ship_to}","${install.address}"\n`;
  });

  return csv;
}

/**
 * Finds text matching pattern, following a label
 * @param {object[]} $0.pdf_texts - array of null-filtered text blocks from `pdf2json`
 * @param {string|RegExp} $0.name_match - 
 * @param {number} $0.start_at - 
 * @param {boolean=true} $0.multiple - whether to only run until first match
 * @returns {number[]} index of matches
 */
function findMatchIndexes ({
  pdf_texts, name_match, start_at = 0, multiple = true
} = {}) {
  const indexes = [];

  while (true) {
    const start_search_index = (indexes[indexes.length - 1] || start_at - 1) + 1;
    if (multiple = true && indexes.length > 0 && start_search_index === 0)
      console.log('Uh oh!');

    // console.log('Starting at', start_search_index);
    const index = pdf_texts.slice(start_search_index)
      .findIndex(i => decodeURIComponent(i.R[0].T).match(name_match) != null);
    console.log(`Found ${name_match} at ${index}`);
    if (index < 0) break;
    indexes.push(index + (indexes[indexes.length - 1] || start_at - 1) + 1);
    if (!multiple) break;
  }

  return indexes;
}

/**
 * Finds text matching pattern, following a label
 * @param {object[]} $0.pdf_texts - array of null-filtered text blocks from `pdf2json`
 * @param {string|RegExp} $0.name_match - 
 * @param {string|RegExp} $0.content_match - 
 * @param {number} $0.content_match_max_elements - 
 * @param {number} $0.start_at - 
 * @returns {string}
 */
function findText ({
  pdf_texts, name_match, content_match,
  content_match_max_elements = 1, start_at = 0
} = {}) {
  if (typeof name_match === 'string') name_match = new RegExp(`^${name_match}$`, 'i');
  content_match_max_elements--;

  const [name_index] = findMatchIndexes({pdf_texts, name_match, start_at, multiple: false});
  for (let i = 0; i + content_match_max_elements < pdf_texts.length; i++) {
    const match_against = decodeURIComponent(pdf_texts
      .slice(name_index + 1 + i, name_index + 3 + i + content_match_max_elements)
      .reduce((acc, curr) => acc += `${curr.R[0].T}\n`, '')
    );

    const match = match_against.match(content_match);
    if (match != null) {
      return match[1] != null ? match[1] : match[0];
    }
  }
}

/**
 * Parses install info out of PDF
 * @param {string} path - path to pdf
 * @returns {Promise<Install>}
 */
function parse_pdf (path) {
  return new Promise((resolve, reject) => {
    let pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", errData => {
      console.error(`Encountered error parsing "${path}"`);
      console.error(errData.parserError);
      reject(errData);
    });
    pdfParser.on("pdfParser_dataReady", pdfData => {
      let pdf_texts = pdfData.formImage.Pages[0].Texts
        .filter(i => i != null);

      const data = {
        po: null,
        ship_to: null,
        address: null,
      };

      data.pdf = Path.basename(path);
      data.po = findText({
        pdf_texts: pdf_texts,
        name_match: 'PO Number',
        content_match: /\d{4,}/,
      });
      data.ship_to = findText({
        pdf_texts: pdf_texts,
        name_match: 'Ship To',
        content_match: /^(.+?)\n\d/s,
        content_match_max_elements: 3,
      });
      data.address = findText({
        pdf_texts: pdf_texts,
        name_match: 'Ship To',
        content_match: /^\d+.*? .*\d{4,}/s,
        content_match_max_elements: 3,
      });
      const line_item_indexes = findMatchIndexes({
        pdf_texts,
        name_match: /^00\d0$/,
        multiple: true
      });
      console.log(line_item_indexes);
      data.line_items = findText({
        pdf_texts: pdf_texts,
        name_match: 'Ship To',
        content_match: /^\d+.*? .*\d+/s,
        content_match_max_elements: 3,
      });
      // TODO: install info and notes line item
      // TODO: pull location from install info and notes section

      // console.log('PO #:', data.po);
      // console.log('Ship To:', data.ship_to);
      // console.log('Address:', data.address);

      resolve(data);
    });

    pdfParser.loadPDF(path);
  });
}


// let sample_1 = "/Users/josh/Downloads/Install\ Information\ -\ 4500154918.pdf";
// let sample_2 = "/Users/josh/Downloads/Purchase\ Order\ -\ 4500153217.pdf";

// pdfParser.loadPDF(sample_2);


function printAll (pdf_data) {
  for (i in pdf_data.formImage.Pages[0].Texts) {
    let r = pdf_data.formImage.Pages[0].Texts[i];
    if (r != undefined) {
      console.log(i + ": " + r.R[0].T);
    } else {
      console.log(i + ":");
    }
  }
}


String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};
