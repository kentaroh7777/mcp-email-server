declare module 'node-imap' {
  import { EventEmitter } from 'events';

  interface ImapConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    tlsOptions?: object;
    authTimeout?: number;
    connTimeout?: number;
    keepalive?: boolean;
  }

  class Imap extends EventEmitter {
    constructor(config: ImapConfig);
    connect(): void;
    destroy(): void;
    openBox(boxName: string, readOnly: boolean, callback: (err: Error | null, box: any) => void): void;
    search(criteria: any[], callback: (err: Error | null, uids: number[]) => void): void;
    fetch(uids: number[], options: object): ImapFetch;
    end(): void;
    addFlags(uid: number, flags: string[], callback: (err: Error | null) => void): void;
  }

  class ImapFetch extends EventEmitter {
    on(event: 'message', listener: (message: ImapMessage, seqno: number) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'end', listener: () => void): this;
  }

  class ImapMessage extends EventEmitter {
    on(event: 'body', listener: (stream: any, info: any) => void): this;
    once(event: 'attributes', listener: (attrs: any) => void): this;
    once(event: 'end', listener: () => void): this;
  }

  export = Imap;
}
