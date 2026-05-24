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
    res.status(200).json(response.data.files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export default allowCors(handler);
