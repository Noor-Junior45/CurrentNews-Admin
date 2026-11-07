import type { Request, Response } from 'express';

const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "blog.currentnews.app",
      sha256_cert_fingerprints: [
        "31:7B:5C:4E:4C:23:10:B2:AD:1C:5D:31:95:63:EF:C7:8A:9D:87:2C:35:67:DB:8D:5C:4D:41:4A:94:63:66:B0"
      ]
    }
  }
];

export default function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  
  return res.status(200).json(ASSET_LINKS);
}
