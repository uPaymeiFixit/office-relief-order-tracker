#!/usr/bin/env node

import 'source-map-support/register';

import * as FS from 'fs-extra';
import * as Path from 'path';
import * as Commander from 'commander';
import { Command } from 'commander';
import Chalk from 'chalk';
import * as Ora from 'ora';
const Package = require(`../package.json`);

import { load_pdf, parse_pdf, FullPdfData } from './index';
import { installs_to_csv, write_csv } from './output';

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

  const read_spinner = Ora('Loading PDFs').start();
  const pdf_data: FullPdfData[] = (await Promise.all(
    files.map(file =>
      load_pdf(file).catch(err => {
        if (
          err.parserError ===
          'An error occurred while parsing the PDF: InvalidPDFException'
        ) {
          console.error(Chalk.redBright(`Failed to parse "${file}"`));
        } else {
          console.error(Chalk.redBright(err.parserError));
        }
      }),
    ),
  )).filter((data): data is FullPdfData => data != null);
  read_spinner.succeed();

  const parse_spinner = Ora('Parsing PDFs').start();
  const installs = pdf_data.map(data => parse_pdf(data));
  parse_spinner.succeed();

  const csv = installs_to_csv(installs);
  await write_csv(csv_path, csv);
  console.log(`Wrote CSV to ${csv_path}`);
}
