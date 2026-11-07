import fs from 'fs';
import path from 'path';

interface ExportData {
  posts_stats: Array<{
    post_id: string;
    likes: number;
    dislikes: number;
    views: number;
  }>;
  reactions: Array<{
    user_id: string;
    post_id: string;
    type: 'like' | 'dislike';
    updated_at: number;
  }>;
  subscribers: Array<{
    email: string;
    created_at: number;
  }>;
  push_subscriptions: Array<{
    id: string;
    subscription: string;
    created_at: number;
  }>;
  users: Array<{
    uid: string;
    pen_name?: string;
  }>;
}

function parseFirestoreField(field: any): any {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return parseInt(field.integerValue, 10);
  if (field.doubleValue !== undefined) return parseFloat(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.arrayValue !== undefined) {
    return (field.arrayValue.values || []).map(parseFirestoreField);
  }
  if (field.mapValue !== undefined) {
    const obj: any = {};
    const fields = field.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      obj[key] = parseFirestoreField(fields[key]);
    }
    return obj;
  }
  return null;
}

async function fetchFirestoreCollection(collectionName: string, config: any): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${collectionName}?pageSize=300&key=${config.apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429 || errorText.includes('Quota') || errorText.includes('quota') || errorText.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(`QUOTA_EXHAUSTED: Firestore read quota limit reached for collection "${collectionName}". Error: ${errorText}`);
    }
    throw new Error(`Failed to fetch ${collectionName}: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.documents || [];
}

async function runExport() {
  console.log('--- Current News: Firestore to Cloudflare D1 Exporter ---');

  let fbConfig: any = {};
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || fbConfig.projectId || 'gen-lang-client-0638643565';
  const firestoreDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID || fbConfig.firestoreDatabaseId || 'ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4';
  const apiKey = process.env.VITE_FIREBASE_API_KEY || fbConfig.apiKey || '';

  const exportData: ExportData = {
    posts_stats: [],
    reactions: [],
    subscribers: [],
    push_subscriptions: [],
    users: [],
  };

  const exportPath = path.join(process.cwd(), 'scripts', 'firestore-export.json');

  try {
    console.log(`Querying Firestore (${projectId})...`);

    // 1. Export subscribers
    try {
      console.log('Fetching subscribers...');
      const subDocs = await fetchFirestoreCollection('subscribers', { projectId, firestoreDatabaseId, apiKey });
      for (const d of subDocs) {
        const fields = d.fields || {};
        const email = parseFirestoreField(fields.email) || d.name.split('/').pop();
        const createdAtRaw = parseFirestoreField(fields.createdAt);
        const createdAt = createdAtRaw ? new Date(createdAtRaw).getTime() : Date.now();
        if (email) {
          exportData.subscribers.push({ email: email.toLowerCase().trim(), created_at: createdAt });
        }
      }
      console.log(`Exported ${exportData.subscribers.length} subscribers.`);
    } catch (err: any) {
      if (err.message?.includes('QUOTA_EXHAUSTED')) {
        console.warn(`[Quota Warning] ${err.message}. Skipping collection export.`);
      } else {
        console.warn('Subscribers export warning:', err.message);
      }
    }

    // 2. Export reactions
    try {
      console.log('Fetching reactions...');
      const reactionDocs = await fetchFirestoreCollection('reactions', { projectId, firestoreDatabaseId, apiKey });
      for (const d of reactionDocs) {
        const fields = d.fields || {};
        const userId = parseFirestoreField(fields.userId);
        const postId = parseFirestoreField(fields.postId);
        const type = parseFirestoreField(fields.type) || 'like';
        const updatedAtRaw = parseFirestoreField(fields.updatedAt);
        const updatedAt = updatedAtRaw ? new Date(updatedAtRaw).getTime() : Date.now();
        if (userId && postId && (type === 'like' || type === 'dislike')) {
          exportData.reactions.push({ user_id: userId, post_id: postId, type, updated_at: updatedAt });
        }
      }
      console.log(`Exported ${exportData.reactions.length} reactions.`);
    } catch (err: any) {
      if (err.message?.includes('QUOTA_EXHAUSTED')) {
        console.warn(`[Quota Warning] ${err.message}. Skipping collection export.`);
      } else {
        console.warn('Reactions export warning:', err.message);
      }
    }

    // 3. Export users / pen names
    try {
      console.log('Fetching users...');
      const userDocs = await fetchFirestoreCollection('users', { projectId, firestoreDatabaseId, apiKey });
      for (const d of userDocs) {
        const fields = d.fields || {};
        const uid = parseFirestoreField(fields.uid) || d.name.split('/').pop();
        const penName = parseFirestoreField(fields.penName) || parseFirestoreField(fields.pen_name);
        if (uid) {
          exportData.users.push({ uid, pen_name: penName || undefined });
        }
      }
      console.log(`Exported ${exportData.users.length} users.`);
    } catch (err: any) {
      if (err.message?.includes('QUOTA_EXHAUSTED')) {
        console.warn(`[Quota Warning] ${err.message}. Skipping collection export.`);
      } else {
        console.warn('Users export warning:', err.message);
      }
    }

    // 4. Export push_subscriptions
    try {
      console.log('Fetching push_subscriptions...');
      const pushDocs = await fetchFirestoreCollection('push_subscriptions', { projectId, firestoreDatabaseId, apiKey });
      for (const d of pushDocs) {
        const fields = d.fields || {};
        const id = d.name.split('/').pop();
        const endpoint = parseFirestoreField(fields.endpoint);
        const keys = parseFirestoreField(fields.keys) || {};
        const createdAtRaw = parseFirestoreField(fields.createdAt);
        const createdAt = createdAtRaw ? new Date(createdAtRaw).getTime() : Date.now();
        if (id && endpoint) {
          exportData.push_subscriptions.push({
            id,
            subscription: JSON.stringify({ endpoint, keys }),
            created_at: createdAt,
          });
        }
      }
      console.log(`Exported ${exportData.push_subscriptions.length} push subscriptions.`);
    } catch (err: any) {
      if (err.message?.includes('QUOTA_EXHAUSTED')) {
        console.warn(`[Quota Warning] ${err.message}. Skipping collection export.`);
      } else {
        console.warn('Push subscriptions export warning:', err.message);
      }
    }

    // 5. Export post stats (likes, dislikes, views)
    try {
      console.log('Fetching posts for stats...');
      const postDocs = await fetchFirestoreCollection('posts', { projectId, firestoreDatabaseId, apiKey });
      for (const d of postDocs) {
        const fields = d.fields || {};
        const id = d.name.split('/').pop();
        const likes = parseFirestoreField(fields.likes) || 0;
        const dislikes = parseFirestoreField(fields.dislikes) || 0;
        const views = parseFirestoreField(fields.views) || 0;
        if (id) {
          exportData.posts_stats.push({ post_id: id, likes, dislikes, views });
        }
      }
      console.log(`Exported stats for ${exportData.posts_stats.length} posts.`);
    } catch (err: any) {
      if (err.message?.includes('QUOTA_EXHAUSTED')) {
        console.warn(`[Quota Warning] ${err.message}. Skipping collection export.`);
      } else {
        console.warn('Posts stats export warning:', err.message);
      }
    }

    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`Export written successfully to: ${exportPath}`);
  } catch (globalErr: any) {
    console.error('Export encountered error:', globalErr.message);
  }

  // Provide CLI helper info for importing into Cloudflare D1
  console.log('\n--- Next Steps to Import into Cloudflare D1 ---');
  console.log('To import this export into Cloudflare D1:');
  console.log('1. Obtain an ID token for an admin account (e.g. you@example.com)');
  console.log('2. Send a POST request to your Worker:');
  console.log('   curl -X POST https://api.currentnews.blog/import \\');
  console.log('     -H "Authorization: Bearer <ADMIN_FIREBASE_ID_TOKEN>" \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     --data-binary @scripts/firestore-export.json');
}

runExport();
