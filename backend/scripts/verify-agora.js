require('dotenv').config();
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const appId = process.env.AGORA_APP_ID;
const appCertificate = process.env.AGORA_APP_CERTIFICATE;

console.log('--- Verifying Agora Configuration ---');
console.log('App ID:', appId ? `${appId.slice(0, 6)}...${appId.slice(-4)}` : 'MISSING');
console.log('App Certificate:', appCertificate ? `${appCertificate.slice(0, 6)}...${appCertificate.slice(-4)}` : 'MISSING');

if (!appId || !appCertificate) {
  console.error('FAILED: Agora credentials missing from environment.');
  process.exit(1);
}

const channelName = 'spark_verify_channel';
const uid = 1001;
const role = RtcRole.PUBLISHER;
const expireSeconds = 3600;
const currentTimestamp = Math.floor(Date.now() / 1000);
const privilegeExpiredTs = currentTimestamp + expireSeconds;

try {
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    role,
    expireSeconds,
    privilegeExpiredTs
  );

  console.log('\nSUCCESS! Generated Real Agora RTC Token:');
  console.log('Token Prefix:', token.slice(0, 15) + '...');
  console.log('Token Length:', token.length);
  console.log('Channel:', channelName);
  console.log('UID:', uid);
  console.log('Expires At (Unix):', privilegeExpiredTs);
  console.log('\nAgora RTC credentials are fully valid and operational!');
  process.exit(0);
} catch (error) {
  console.error('\nFAILED to generate token:', error.message);
  process.exit(1);
}
