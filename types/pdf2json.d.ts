declare module 'pdf2json' {
  import { Stream } from 'stream';

  namespace PDFParser {
    interface PdfData {
      formImage: FormImage;
      /** Get all textual content */
      getRawTextContent: () => string;
      /** Get all input field information */
      getAllFieldTypes: () => any[];
    }

    interface ParserError extends Error {
      parserError: string;
    }

    interface FormImage {
      /**
       * The main text identifier for the PDF document. If `Id.AgencyId` present,
       * it'll be same, otherwise it'll be set as document title
       */
      Agency: string;
      /** pdf2json version number */
      Transcoder: string;
      /** The XML meta data embedded in PDF document */
      Id: {
        /** @default 'unknown' */
        AgencyId: string | 'unknown';
        /** @default 'unknown' */
        Name: string | 'unknown';
        /** @default false */
        MC: boolean;
        /** @default -1 */
        Max: number;
        /**
         * Parent name
         * @default 'unknown'
         */
        Parent: string | 'unknown';
      };
      /**
       * Describes each page in the PDF, including sizes, lines, fills and texts
       * within the page.
       */
      Pages: Page[];
      /** The PDF page width in page unit */
      Width: number;
    }

    interface Page {
      /** The height of the page in page unit */
      Height: number;
      /**
       * Each object with in `Boxsets` can be either checkbox or radio button, the
       * only difference is that radio button object will have more than one
       * element in 'boxes' array, it indicates it's a radio button group.
       */
      Boxsets?: {
        id: Id;
        boxes: Field[];
      }[];
      /**
       * Horizontal line array
       */
      HLines: Box[];
      /**
       * Vertical line array
       */
      VLines: VLine[];
      /** Array contains parsed object for text input */
      Fields?: Field[];
      /** Array of rectangular areas with solid color fills, same as lines */
      Fills: Fill[];
      /**
       * An array of text blocks with position, actual text and styling
       * information
       */
      Texts: TextBlock[];
    }

    interface Box {
      /** Relative x coordinate */
      x: number;
      /** Relative y coordinate */
      y: number;
      /** Width in page unit */
      w: number;
      /** Length in page unit */
      l: number;
    }

    interface TextBlock extends Box {
      /** TODO: is length never specified? if so, it should be of type `void` or something */
      l: never;
      /**
       * A color index in color dictionary, same `clr` field as in `Fill` object.
       * If a color can be found in color dictionary, `oc` field will be added to
       * the field as 'original color' value.
       * TODO: this probably works like the `clr` field in `Fills`
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
        /**
         * Style index from style dictionary
         * If style is not in dictionary, then -1
         */
        S: number;
        /** Text style, if not in style dictionary */
        TS?: StyleDictionary;
        /**
         * Text rotation angle in degrees.
         * Only when angle != 0
         */
        RA?: number;
      }[];
      /** Space width of font */
      sw: number;
    }

    interface Fill extends Box {
      /** Height */
      h: number;
      /** TODO: is length never specified? if so, it should be of type `void` or something */
      l: never;
      /**
       * References a color with index in color dictionary.
       * If color is not in dictionary, then will be -1.
       */
      clr: number;
      /** Color, if not in dictionary (maybe always hexadecimal?) */
      oc?: string;
    }

    interface VLine extends Box {
      /**
       * v0.4.3 added Line color support. Default is 'black', other wise set in
       * `'clr'` if found in color dictionary, or `'oc'` field if not found in
       * dictionary
       * TODO: this probably works like the `clr` field in `Fills`
       */
      clr?: number | string | 'oc' | any;
      /** This may or may not be a thing. IDK. read the docs? */
      oc?: any;
      /**
       * v0.4.4 added dashed line support. Default is 'solid', if line style is
       * dashed line, {dsh:1} is added to line object
       */
      dsh?: number | string | any;
    }

    interface Field {
      [key: string]: any;
      x: number;
      y: number;
      w: number;
      h: number;
      /** Value, only available when the text input box has value */
      V?: string;
      /**
       * Style index from style dictionary
       * If style is not in dictionary, then -1
       */
      style: number;
      /**
       * Alt text, for accessibility, added only when available from PDF stream.
       */
      TU?: string;
      TI: number;
      /**
       * Attribute mask
       * v0.2.2 added support for "field attribute mask", it'd be common for
       * all fields, form author can set it in Acrobat Pro's Form Editing mode:
       * if a field is ReadOnly, it's AM field will be set as `0x00000400`,
       * otherwise AM will be set as 0.
       *
       * Another supported field attributes is "required": when form author
       * mark a field is "required" in Acrobat, the parsing result for `AM`
       * will be set as `0x00000010`.
       */
      AM: number;
      mxL?: number;
      id: Id;
      T: {
        Name: 'alpha' | 'link' | string;
        TypeInfo?: { [key: string]: any };
      };
      /** Drop down list options */
      PL?: {
        /** Labels */
        V?: string[];
        /** Values */
        D?: string[];
      };
      FL?: {
        [key: string]: any;
        form?: Id;
      };
    }

    interface Id {
      Id: string;
      EN?: number;
    }

    type StyleDictionary = [
      /** Font face */
      number,
      /** Font size */
      number,
      /** bold (boolean 0 or 1) */
      number,
      /** italic (boolean 0 or 1) */
      number
    ];
  }

  class PDFParser extends Stream {
    on(
      event: 'pdfParser_dataReady',
      listener: (pdf_data: PDFParser.PdfData) => void,
    ): this;
    on(
      event: 'pdfParser_dataError',
      listener: (err_data: PDFParser.ParserError) => void,
    ): this;

    loadPDF(pdfFilePath: string): void;
    parseBuffer(buffer: Buffer): void;
  }

  export = PDFParser;
}
