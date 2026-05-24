# KiddoPlay - Secure Video Streaming App

This project is built with **React (Vite)**, **Capacitor**, and **Firebase** to provide a secure video streaming experience for kids.

## 🏗️ Architecture

- **Frontend**: React + Vite + Tailwind CSS.
- **Mobile Wrapper**: Capacitor (Android).
- **Backend**: Express (simulating Firebase Cloud Functions) + Google Drive API.
- **Security**: All Google Drive credentials and logic are kept on the server. The frontend only sees proxy endpoints.

## 🚀 Deployment Guide

### 1. Google Cloud Setup
1. Create a Project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Create a **Service Account** and download the **JSON Key**.
4. Share your Google Drive folder with the Service Account email.

### 2. Vercel Setup
1. Connect your GitHub/GitLab/Bitbucket repository to [Vercel](https://vercel.com/).
2. In the Vercel project settings, go to **Environment Variables**.
3. Add the following variables:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: The full content of your JSON key file.
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID`: The ID of your root video folder.
4. Vercel will automatically detect the `api/` directory and deploy your serverless functions.

### 3. Local Development
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Create a `.env` file based on `.env.example` and fill in your credentials.
4. Start the dev server: `npm run dev`.

### 4. Android Build (Capacitor)
```bash
npm run build
npx cap add android
npx cap open android
```

## 📱 Features
- **Secure Streaming**: Videos are streamed through the backend to hide source URLs.
- **Kid-Friendly UI**: Large buttons, vibrant colors, and simple navigation.
- **Offline Ready**: Can be bundled as a native APK.
