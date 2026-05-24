# 🚀 Turning KiddoPlay into an Android APK

This project is built with **React** and **Capacitor**. Follow these steps to generate your APK for the Play Store.

## 1. Export the Code
1. In AI Studio, click the **Gear Icon (⚙️)** in the bottom-left sidebar.
2. Select **"Export to ZIP"**.
3. Extract the ZIP file on your computer.

## 2. Setup Your Local Environment
Make sure you have **Node.js** and **Android Studio** installed on your computer.

1. Open a terminal in the project folder.
2. Run: `npm install`
3. Run: `npm run build`

## 3. Add Android Platform
1. Run: `npx cap add android`
2. Run: `npx cap copy`
3. Run: `npx cap open android` (This opens Android Studio).

## 4. Build the APK in Android Studio
1. In Android Studio, wait for the project to sync.
2. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. Your APK will be generated in `android/app/build/outputs/apk/debug/`.

## ⚠️ Important: The Backend
This app uses a **Node.js server** (`server.ts`) to talk to Google Drive. 
- For a standalone APK, you must deploy `server.ts` to a hosting provider (like **Google Cloud Run**).
- Update the API calls in `App.tsx` to point to your deployed server URL instead of `/api/`.

## 🔑 Play Store Deployment
To deploy to the Play Store, you will need to:
1. Create a **Google Play Console** account ($25 one-time fee).
2. Generate a **Signed App Bundle (.aab)** in Android Studio (Build > Generate Signed Bundle / APK).
