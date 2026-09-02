import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'na-trave-fut-2026',
  appId: '1:761532592396:web:cdbebb4442a8c155325929',
  storageBucket: 'na-trave-fut-2026.firebasestorage.app',
  apiKey: 'AIzaSyC4xj5WegpyCUk-CZWyrGdobLSvcWDKFD4',
  authDomain: 'na-trave-fut-2026.firebaseapp.com',
  messagingSenderId: '761532592396',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
