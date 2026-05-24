import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { allowCors } from '../../cors.js';

const getDriveClient = () => {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable');
  }
  try {
    const credentials = JSON.parse(json);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  } catch (e: any) {
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${e.message}`);
  }
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

    const drive = getDriveClient();
    
    // 1. Fetch file metadata first to get size and mimeType
    const fileMetadata = await drive.files.get({
      fileId: fileId as string,
      fields: 'size, mimeType, name'
    });

    const fileSize = parseInt(fileMetadata.data.size || '0');
    const mimeType = fileMetadata.data.mimeType || 'video/mp4';
    const range = req.headers.range;

    if (range && fileSize > 0) {
      // Parse Range header: "bytes=start-end"
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      const response = await drive.files.get(
        { fileId: fileId as string, alt: 'media' },
        { 
          responseType: 'stream',
          headers: { Range: `bytes=${start}-${end}` }
        }
      );
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      });

      // @ts-ignore
      response.data.pipe(res);
    } else {
      const response = await drive.files.get(
        { fileId: fileId as string, alt: 'media' },
        { responseType: 'stream' }
      );
      
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });

      // @ts-ignore
      response.data.pipe(res);
    }
  } catch (error: any) {
    console.error('Streaming error:', error);
    // If it's a 416 Range Not Satisfiable, handle it
    if (error.code === 416) {
      return res.status(416).send('Requested Range Not Satisfiable');
    }
    res.status(500).json({ error: error.message });
  }
}

export default allowCors(handler);
