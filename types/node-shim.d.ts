declare module 'node:http' {
  export interface IncomingMessage { url?: string; method?: string; [Symbol.asyncIterator](): AsyncIterator<unknown>; }
  export interface ServerResponse { writeHead(statusCode: number, headers?: Record<string, string>): void; end(chunk?: string): void; }
  export function createServer(listener: (request: IncomingMessage, response: ServerResponse) => void): { listen(port: number): void };
}
declare const Buffer: {
  isBuffer(value: unknown): boolean;
  from(value: unknown): { toString(encoding?: string): string };
  concat(chunks: unknown[]): { toString(encoding?: string): string };
};

declare const process: { env: Record<string, string | undefined> };
declare const console: { log(message?: unknown, ...optionalParams: unknown[]): void };
