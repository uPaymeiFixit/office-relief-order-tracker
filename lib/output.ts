import { Install } from './index';

/**
 * converts installs to CSV string
 * @param {Install[]} installs
 * @returns {string}
 */
export function installs_to_csv(installs: Install[]): string {
  let csv = '';

  // Object.keys(installs[0])
  //   .forEach((key, i, keys) => ret += `${key}${i + 1 != keys.length ? ',' : '\n'}`);
  csv += `PDF,PO,Ship To,Address\n`;

  installs.forEach(install => {
    csv += `"${install.pdf}","${install.po}","${install.ship_to}","${
      install.address
    }"\n`;
  });

  return csv;
}
