import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=59');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'www.currentnews.blog';
    const siteUrl = `${protocol}://${host.includes('localhost') ? host : 'www.currentnews.blog'}`;
    
    // Configuration extracted dynamically
    const config = {
      projectId: "gen-lang-client-0638643565",
      firestoreDatabaseId: "ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4"
    };

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery`;
    
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "posts" }],
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
        limit: 20
      }
    };

    const response = await fetch(firestoreUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryBody)
    });

    if (!response.ok) {
      throw new Error(`Firestore REST query returned HTTP status ${response.status}`);
    }

    const queryResult = await response.json();
    
    // XML safety/escaping helper
    const escapeXml = (unsafe: string) => {
      return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // Raw Firestore REST Value mapping helper
    const parseFirestoreFields = (fields: any) => {
      const result: any = {};
      if (!fields) return result;
      for (const key of Object.keys(fields)) {
        const valObj = fields[key];
        if ('stringValue' in valObj) {
          result[key] = valObj.stringValue;
        } else if ('timestampValue' in valObj) {
          result[key] = valObj.timestampValue;
        } else if ('integerValue' in valObj) {
          result[key] = parseInt(valObj.integerValue, 10);
        } else if ('booleanValue' in valObj) {
          result[key] = valObj.booleanValue;
        } else if ('mapValue' in valObj) {
          result[key] = parseFirestoreFields(valObj.mapValue.fields);
        } else {
          result[key] = Object.values(valObj)[0];
        }
      }
      return result;
    };

    const items: any[] = [];
    if (Array.isArray(queryResult)) {
      for (const item of queryResult) {
        if (item.document) {
          const fields = parseFirestoreFields(item.document.fields);
          const id = item.document.name.split("/").pop();
          items.push({ id, ...fields });
        }
      }
    }

    // Build XML conformant RSS channel data
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Current News - Independent Ledger</title>
  <link>${siteUrl}</link>
  <description>Serving the public interest with transparent, accurate, and autonomous journalism.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

    const slugify = (text: string) => {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    };

    for (const item of items) {
      const title = item.title || 'Untitled Dispatch';
      const rawContent = item.content || '';
      const author = item.authorName || 'Chronicle Staff Report';
      const category = item.category || 'General';
      const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : new Date().toUTCString();
      const slug = slugify(title);
      const postLink = slug ? `${siteUrl}/post/${item.id}/${slug}` : `${siteUrl}/post/${item.id}`;

      xml += `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(postLink)}</link>
    <guid isPermaLink="false">${escapeXml(item.id)}</guid>
    <pubDate>${pubDate}</pubDate>
    <author>${escapeXml(author)}</author>
    <category>${escapeXml(category)}</category>
    <description><![CDATA[${rawContent}]]></description>
  </item>
`;
    }

    xml += `</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);

  } catch (err: any) {
    console.error('RSS endpoint generation breakdown:', err);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Unable to serve the RSS feed document: ${err.message}`);
  }
}
