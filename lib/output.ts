import { Parser, json2csv } from 'json2csv';

import { Install } from './index';

/**
 * converts installs to CSV string
 * @param {Install[]} installs
 * @returns {string}
 */
export function installs_to_csv(installs: Install[]): string {
  const options: json2csv.Options<Install> = {
    fields: [
      { label: 'PDF', value: 'pdf' },
      { label: 'PO', value: 'po' },
      { label: 'Ship To', value: 'ship_to' },
      { label: 'Address', value: 'address' },
    ],
  };
  const parser = new Parser(options);

  installs.forEach(install => {
    csv += `"${install.pdf}","${install.po}","${install.ship_to}","${
      install.address
    }"\n`;
  });

  return csv;
}
