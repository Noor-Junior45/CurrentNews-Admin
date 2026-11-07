import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  const pubId = 'pub-5865716270182311';
  return res.status(200).send(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
}
