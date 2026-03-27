const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey) {
            privateKey = privateKey.replace(/^"|"$/g, '').replace(/^'|'$/g, '').replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            })
        });
        console.log('Firebase Admin Initialized successfully.');
    } catch (error) {
        console.error('Firebase Admin Initialization Error:', error.message);
    }
}

const db = admin.firestore();

module.exports = { admin, db };
