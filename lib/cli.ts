#!/usr/bin/env node

import 'source-map-support/register';

import * as FS from 'fs-extra';
import * as Path from 'path';
import * as Commander from 'commander';
import { Command } from 'commander';
import { PdfData } from 'pdf2json';
import Chalk from 'chalk';
const Package = require(`../package.json`);

import { load_pdf, parse_pdf } from './index';
import { installs_to_csv } from './output';

process.on('unhandledRejection', error => {
  // console.error(error);
  throw error;
  // process.exit(1);
});

(async () => {
  const program: Command & {
    pdf_path: string | string[];
    csv_path: string;
  } = Commander.version(Package.version)
    .arguments('<pdf-path> [csv-path]')
    .action((pdf_path: string, csv_path: string) => {
      program.pdf_path = pdf_path;
      if (program.pdf_path.includes(':')) {
        program.pdf_path = program.pdf_path.split(':');
      }
      program.csv_path = csv_path || 'installs.csv';
    }) as Command & {
    pdf_path: string | string[];
    csv_path: string;
  };

  program.parse(process.argv);

  await read_pdfs(program.pdf_path, program.csv_path);
})();

async function read_pdfs(pdf_path: string | string[], csv_path: string) {
  let files: string[];

  if (!Array.isArray(pdf_path)) {
    if ((await FS.stat(pdf_path)).isDirectory()) {
      files = (await FS.readdir(pdf_path))
        .filter(file => file.endsWith('.pdf'))
        .map(file => Path.join(pdf_path, file));
    } else {
      files = [pdf_path];
    }
  } else {
    files = pdf_path;
  }

  console.log(`Found ${files.length} files`);

  const pdf_data: (PdfData & { path: string })[] = (await Promise.all(
    files.map(file =>
      load_pdf(file)
        .then(pdf => ({ path: file, ...pdf }))
        .catch(err => {
          console.error(Chalk.redBright(err.parserError));
          console.error(Chalk.redBright(`Failed to parse "${file}"`));
        }),
    ),
  )).filter((data): data is PdfData & { path: string } => data != null);

  const installs = pdf_data.map(data => parse_pdf(data));

  // console.log(installs);
  const csv = installs_to_csv(installs);
  await FS.writeFile(csv_path, csv);
  console.log(`Wrote CSV to ${csv_path}`);
}
