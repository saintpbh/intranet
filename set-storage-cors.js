/**
 * Firebase Storage CORS 설정 스크립트
 * 실행: node set-storage-cors.js (프로젝트 루트에서)
 */
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const keyPath = path.join(__dirname, 'server', 'firebase-service-account.json');

const storage = new Storage({
  projectId: 'prok-ga',
  keyFilename: keyPath,
});

async function setCors() {
  const bucketName = 'prok-ga.firebasestorage.app';
  const bucket = storage.bucket(bucketName);
  
  const corsConfig = [
    {
      origin: ['https://prok-ga.web.app', 'https://prok-ga.firebaseapp.com', 'http://localhost:5173', 'http://localhost:3000'],
      method: ['GET', 'HEAD', 'OPTIONS'],
      maxAgeSeconds: 3600,
      responseHeader: ['Content-Type', 'Content-Length', 'Content-Encoding', 'Range'],
    },
  ];

  try {
    await bucket.setCorsConfiguration(corsConfig);
    console.log(`✅ CORS configuration set on ${bucketName}`);
    
    const [metadata] = await bucket.getMetadata();
    console.log('Current CORS:', JSON.stringify(metadata.cors, null, 2));
  } catch (err) {
    console.error('❌ Failed to set CORS:', err.message);
  }
}

setCors();
