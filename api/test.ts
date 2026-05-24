export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  res.status(200).json({ 
    message: 'API is working!',
    env: {
      hasGoogleJson: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
      googleJsonLength: process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.length || 0,
      hasDriveRoot: !!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    }
  });
}
