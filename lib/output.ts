import * as FS from 'fs-extra';
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

  return parser.parse(installs);
}

export async function write_csv(csv_path: string, csv: string): Promise<void> {
  await FS.writeFile(csv_path, csv);
}
