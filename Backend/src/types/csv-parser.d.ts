import { Transform } from 'stream';

declare namespace CsvParser {
  interface Options {
    separator?: string;
    newline?: string;
    maxRowBytes?: number;
    skipLines?: number;
    strict?: boolean;
    headers?: readonly string[] | boolean;
    mapHeaders?: (params: { header: string; index: number }) => string;
    mapValues?: (params: {
      header: string;
      index: number;
      value: string;
    }) => unknown;
  }
  type CsvParserStream = Transform;
}

declare function csvParser(
  options?: CsvParser.Options,
): CsvParser.CsvParserStream;

declare module 'csv-parser' {
  export = csvParser;
}
