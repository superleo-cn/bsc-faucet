import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err?.message === 'invalid_address') {
    return res.status(400).json({ error: 'invalid_address' });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }
  res.status(500).json({ error: 'internal' });
}
