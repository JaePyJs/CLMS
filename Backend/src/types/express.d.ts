// Type shim to bridge Express 4 -> Express 5 style imports
declare module 'express' {
  export { Request, Response, NextFunction } from 'express-serve-static-core';
  export { Application, Router } from 'express';
}
