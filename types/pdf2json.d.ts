declare module 'pdf2json' {
  namespace PDFParser {
    interface PdfData {
      formImage: FormImage;
      /** Get all textual content */
      getRawTextContent: () => string;
      /** Get all input field information */
      getAllFieldTypes: () => any[];
    }

    interface ParserError extends Error {
      parserError: any;
    }

    interface FormImage {
      /**
       * The main text identifier for the PDF document. If `Id.AgencyId` present,
       * it'll be same, otherwise it'll be set as document title
       */
      Agency: any;
      /** pdf2json version number */
      Transcoder: any;
      /** The XML meta data embedded in PDF document */
      Id: {
        /** @default 'unknown' */
        AgencyId: any | 'unknown';
        /** @default 'unknown' */
        Name: any | 'unknown';
        /** @default false */
        MC: boolean;
        /** @default -1 */
        Max: number;
        /**
         * Parent name
         * @default 'unknown'
         */
        Parent: any | 'unknown';
      };
      /**
       * Describes each page in the PDF, including sizes, lines, fills and texts
       * within the page.
       */
      Pages: Page[];
      /** The PDF page width in page unit */
      Width: any;
    }

    interface Page {
      /** The height of the page in page unit */
      Height: any;
      /**
       * Horizontal line array
       */
      HLines: LinePosition[];
      /**
       * Vertical line array
       */
      VLine: (LinePosition & {
        /**
         * v0.4.3 added Line color support. Default is 'black', other wise set in
         * `'clr'` if found in color dictionary, or `'oc'` field if not found in
         * dictionary
         */
        clr?: number | string | 'oc' | any;
        /** This may or may not be a thing. IDK. read the docs? */
        oc?: any;
        /**
         * v0.4.4 added dashed line support. Default is 'solid', if line style is
         * dashed line, {dsh:1} is added to line object
         */
        dsh?: number | string | any;
      })[];
      Fills: {
        x: number;
        y: number;
        w: number;
        h: number;
        /** References a color with index in color dictionary */
        clr: number | string | any;
      }[];
      /**
       * An array of text blocks with position, actual text and styling
       * information
       */
      Texts: TextBlock[];
    }

    interface LinePosition {
      /** Relative x coordinate */
      x: number;
      /** Relative y coordinate */
      y: number;
      /** Width in page unit */
      w: number;
      /** Length in page unit */
      l: number;
    }

    interface TextBlock {
      x: number;
      y: number;
      /**
       * A color index in color dictionary, same `clr` field as in `Fill` object.
       * If a color can be found in color dictionary, `oc` field will be added to
       * the field as 'original color' value.
       */
      clr: number | string | any;
      /** This may or may not be a thing. IDK. read the docs? */
      oc?: any;
      /** Text alignment */
      A: 'left' | 'center' | 'right';
      /** Array of text run */
      R: {
        /** Actual text */
        T: string;
        /** Style index from style dictionary */
        S: number | string | any;
        /** TODO: figure out what this is. Maybe it's location? */
        TS: number[];
      }[];
    }
  }

  class PDFParser {
    on(
      event: 'pdfParser_dataReady',
      listener: (pdf_data: PDFParser.PdfData) => void,
    ): PDFParser;
    on(
      event: 'pdfParser_dataError',
      listener: (err_data: PDFParser.ParserError) => void,
    ): PDFParser;

    loadPDF(pdfFilePath: string): void;
  }

  export = PDFParser;
}
