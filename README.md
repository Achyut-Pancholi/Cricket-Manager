# GullyScore - Mobile-First Cricket Scoring App

GullyScore is a fast, responsive, and mobile-first web application designed specifically for gully cricket. It features a modern dark UI, smooth animations, and works offline via Service Workers and LocalStorage caching. It is ready to be connected to Firebase for real-time synchronization.

## Features Included
1. **Home Page**: Dashboard with recent matches and quick actions.
2. **Match Creation**: Set match name, overs, and venue.
3. **Player Registration**: Advanced player modal AND a quick inline add form.
4. **Team Shuffle**: Randomly distributes available players into Team A and Team B.
5. **Toss Screen**: Animated 3D coin toss with Heads/Tails selection.
6. **Live Score Screen**: Interactive keypad (0-6), Wicket, Wide, No-ball buttons, Undo functionality, and a dynamic over tracker.
7. **Match Summary**: Results display, Man of the Match, Best Bowler, and Scorecard.

## Tech Stack
- Pure HTML5, CSS3, Vanilla JS (No heavy frameworks, ultra-fast load times)
- Firebase Auth, Firestore, Realtime Database (SDKs included in `js/firebase-config.js`)
- Progressive Web App (PWA) configuration (`manifest.json` + `sw.js`)

## Local Setup
1. Simply serve the directory using any local web server. E.g., using Python:
   ```bash
   python -m http.server 8000
   ```
2. Navigate to `http://localhost:8000/index.html` on your mobile phone or browser emulator.
3. Add icons to `assets/icons/icon-192x192.png` and `assets/icons/icon-512x512.png` for PWA installation support.

## Firebase Integration Setup
To sync live scores across devices:
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Firestore Database**, **Realtime Database**, and **Anonymous Authentication**.
3. Open `js/firebase-config.js` and replace the `firebaseConfig` object with your project's configuration.
4. The app will automatically connect to Firebase, or gracefully fall back to `localStorage` offline mode if left unconfigured.

## Firebase Hosting Deployment
This project is pre-configured for Firebase Hosting.

1. Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```
2. Login to Firebase:
   ```bash
   firebase login
   ```
3. Initialize the project (Optional, as `firebase.json` is already provided):
   ```bash
   firebase init hosting
   ```
   *Make sure to select the correct Firebase project and keep `index.html` as the default rewrite if you want SPA-like routing (though this app uses multi-page for simplicity).*
   
4. Deploy to production:
   ```bash
   firebase deploy --only hosting
   ```
   
Your app will be live at `https://<YOUR-PROJECT-ID>.web.app`.
