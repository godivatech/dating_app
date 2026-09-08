const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'dating-app-media';
  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  console.log('Testing R2 Connection with:');
  console.log('Account ID:', accountId);
  console.log('Bucket Name:', bucketName);
  console.log('Endpoint:', endpoint);

  const s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || '',
    },
  });

  try {
    // 1. Test listing bucket
    console.log('\n1. Testing ListObjects in bucket...');
    const listRes = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 5 }));
    console.log('✅ Bucket accessible! Key count:', listRes.KeyCount ?? 0);

    // 2. Test Presigned URL Generation
    console.log('\n2. Testing Presigned Upload URL generation...');
    const testKey = `test-healthcheck-${Date.now()}.txt`;
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      ContentType: 'text/plain',
    });
    const presignedUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 300 });
    console.log('✅ Presigned URL generated successfully:');
    console.log(presignedUrl.substring(0, 80) + '...');

    // 3. Test Direct Put & Delete
    console.log('\n3. Testing PutObject and DeleteObject...');
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: 'r2-healthcheck-ok',
      ContentType: 'text/plain',
    }));
    console.log('✅ Test object uploaded successfully');

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }));
    console.log('✅ Test object deleted successfully');

    console.log('\n🎉 ALL CLOUDFLARE R2 CHECKS PASSED 100%!');
  } catch (error) {
    console.error('❌ R2 Verification Failed:', error.message || error);
  }
}

verifyR2();
