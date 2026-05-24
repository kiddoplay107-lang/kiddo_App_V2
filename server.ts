import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Light-weight health check route for fast ping / wake-up
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Google Drive Auth
  const getDriveClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  };

  // API Routes
  app.get('/api/drive/folders', async (req, res) => {
    try {
      const drive = getDriveClient();
      const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      
      const q = rootId 
        ? `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        : "mimeType = 'application/vnd.google-apps.folder' and trashed = false";

      const response = await drive.files.list({
        q,
        fields: 'files(id, name)',
        orderBy: 'name',
      });

      res.json(response.data.files);
    } catch (error: any) {
      console.error('Drive API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/drive/contents/:folderId?', async (req, res) => {
    try {
      const { folderId } = req.params;
      const drive = getDriveClient();
      const targetFolderId = folderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

      if (!targetFolderId) {
        return res.status(400).json({ error: 'Missing folderId and GOOGLE_DRIVE_ROOT_FOLDER_ID' });
      }

      const response = await drive.files.list({
        q: `'${targetFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/') and trashed = false`,
        fields: 'files(id, name, mimeType, thumbnailLink)',
        orderBy: 'name',
      });

      const files = response.data.files || [];
      const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      const videos = files.filter(f => f.mimeType && f.mimeType.includes('video/'));

      res.json({
        folders,
        videos,
        currentFolderId: targetFolderId
      });
    } catch (error: any) {
      console.error('Drive API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/drive/videos/:folderId', async (req, res) => {
    try {
      const { folderId } = req.params;
      const drive = getDriveClient();
      
      const response = await drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'files(id, name, thumbnailLink)',
        orderBy: 'name',
      });

      res.json(response.data.files);
    } catch (error: any) {
      console.error('Drive API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/drive/stream/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const drive = getDriveClient();

      // Get file metadata first
      const fileMeta = await drive.files.get({
        fileId,
        fields: 'size, mimeType'
      });

      const fileSize = parseInt(fileMeta.data.size || '0');
      const mimeType = fileMeta.data.mimeType || 'video/mp4';
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const response = await drive.files.get(
          { fileId, alt: 'media' },
          { 
            responseType: 'stream',
            headers: {
              Range: `bytes=${start}-${end}`
            }
          }
        );

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeType,
        });

        response.data.pipe(res);
      } else {
        const response = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );

        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
        });

        response.data.pipe(res);
      }
    } catch (error: any) {
      console.error('Drive Stream Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
