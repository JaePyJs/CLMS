// Global type declarations for missing @types packages
declare module 'cors';
declare module 'compression';
declare module 'bcryptjs';
declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
  }
  function sign(payload: string | object | Buffer, secretOrPrivateKey: string, options?: SignOptions): string;
  function verify(token: string, secretOrPublicKey: string, callback?: (err: Error, decoded: any) => void): any;
}
declare module 'ws' {
  export class WebSocketServer {
    constructor(options?: any);
    on(event: string, callback: (...args: any[]) => void): void;
  }
  export interface WebSocket {
    send(data: any): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(): void;
    readyState: number;
    on(event: string, callback: (...args: any[]) => void): void;
    once(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback?: (...args: any[]) => void): void;
  }
  const WebSocket: {
    prototype: WebSocket;
    new(): WebSocket;
  };
  export default WebSocket;
}
declare module 'socket.io' {
  export interface Socket {
    id: string;
    emit(event: string, data: any): void;
    on(event: string, callback: (...args: any[]) => void): void;
    disconnect(): void;
    connected: boolean;
    handshake: any;
    join(room: string): void;
    leave(room: string): void;
  }
  export class Server {
    constructor(httpServer: any, options?: any);
    on(event: string, callback: (...args: any[]) => void): void;
    to(room: string): any;
    emit(event: string, data: any): void;
  }
}
declare module 'socket.io-client' {
  export interface Socket {
    id: string;
    emit(event: string, data: any): void;
    on(event: string, callback: (...args: any[]) => void): void;
    disconnect(): void;
    connected: boolean;
    handshake: any;
    join(room: string): void;
    leave(room: string): void;
  }
}
