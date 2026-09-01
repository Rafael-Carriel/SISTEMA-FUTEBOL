import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'fut-da-galera-irati',
  appId: '1:196753166611:web:ae5343f3fc54d38a798ae6',
  storageBucket: 'fut-da-galera-irati.firebasestorage.app',
  apiKey: 'AIzaSyDTTyB6GlqCHAkqzt8sQ5bJVQ1Ea-Oucx4',
  authDomain: 'fut-da-galera-irati.firebaseapp.com',
  messagingSenderId: '196753166611',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
