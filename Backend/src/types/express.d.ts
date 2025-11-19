// Type shim to bridge Express 4 -> Express 5 style imports
declare module 'express' {
  import { Application, Request, Response, NextFunction } from 'express-serve-static-core';

  const app: Application;
  export = app;
  export { Request, Response, NextFunction };
  export { Application, Router } from 'express';
}
