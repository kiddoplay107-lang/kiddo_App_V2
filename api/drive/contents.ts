import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { allowCors } from '../cors.js';

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
    const { folderId } = req.query;
    const drive = getDriveClient();
    const targetFolderId = (folderId as string) || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!targetFolderId) {
      return res.status(400).json({ error: 'Missing folderId and GOOGLE_DRIVE_ROOT_FOLDER_ID' });
    }

    // Fetch both folders and videos in one list call for better performance
    const response = await drive.files.list({
      q: `'${targetFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/') and trashed = false`,
      fields: 'files(id, name, mimeType, thumbnailLink)',
      orderBy: 'name',
    });

    const files = response.data.files || [];
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const videos = files.filter(f => f.mimeType && f.mimeType.includes('video/'));

    res.status(200).json({
      folders,
      videos,
      currentFolderId: targetFolderId
    });
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}

export default allowCors(handler);
