import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const ACCOUNT_ID = envVars.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = envVars.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = envVars.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = envVars.CLOUDFLARE_R2_BUCKET_NAME;
const PUBLIC_DOMAIN = envVars.CLOUDFLARE_R2_PUBLIC_DOMAIN;

console.log('Cloudflare R2 Configuration:');
console.log('  Account ID:', ACCOUNT_ID);
console.log('  Bucket Name:', BUCKET_NAME);
console.log('  Public Domain:', PUBLIC_DOMAIN);
console.log('  Access Key ID:', ACCESS_KEY_ID?.substring(0, 10) + '...');
console.log('');

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
  console.error('Missing required R2 credentials in .env file');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const TEST_KEY = '_test/r2-connection-test.txt';
const timestamp = new Date().toISOString();
const testContent = `R2 connection test - ${timestamp}`;

async function runTest() {
  console.log('Starting Cloudflare R2 connection test...\n');

  // Step 1: Upload test file
  try {
    console.log(`[1/4] Uploading test file to ${BUCKET_NAME}/${TEST_KEY}...`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: TEST_KEY,
        Body: testContent,
        ContentType: 'text/plain',
      })
    );
    console.log('✓ Upload successful\n');
  } catch (error) {
    console.error('✗ Upload failed:', error);
    process.exit(1);
  }

  // Step 2: Read file back via S3 API
  try {
    console.log('[2/4] Reading file back via S3 API...');
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: TEST_KEY,
      })
    );
    const bodyString = await response.Body?.transformToString();
    if (bodyString === testContent) {
      console.log('✓ Read successful - content matches\n');
    } else {
      console.error('✗ Read successful but content mismatch');
      console.error('  Expected:', testContent);
      console.error('  Got:', bodyString);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Read failed:', error);
    process.exit(1);
  }

  // Step 3: Test public URL
  if (PUBLIC_DOMAIN) {
    try {
      console.log(`[3/4] Testing public URL: https://${PUBLIC_DOMAIN}/${TEST_KEY}...`);
      const publicResponse = await fetch(`https://${PUBLIC_DOMAIN}/${TEST_KEY}`);
      if (publicResponse.ok) {
        const publicContent = await publicResponse.text();
        if (publicContent === testContent) {
          console.log('✓ Public URL accessible - content matches\n');
        } else {
          console.error('✗ Public URL accessible but content mismatch');
          console.error('  Expected:', testContent);
          console.error('  Got:', publicContent);
        }
      } else {
        console.error('✗ Public URL not accessible:', publicResponse.status, publicResponse.statusText);
        console.error('  This may be expected if the bucket is not configured for public access\n');
      }
    } catch (error) {
      console.error('✗ Public URL test failed:', error);
      console.error('  This may be expected if the bucket is not configured for public access\n');
    }
  } else {
    console.log('[3/4] Skipping public URL test (no PUBLIC_DOMAIN configured)\n');
  }

  // Step 4: Delete test file
  try {
    console.log('[4/4] Deleting test file...');
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: TEST_KEY,
      })
    );
    console.log('✓ Delete successful\n');
  } catch (error) {
    console.error('✗ Delete failed:', error);
    process.exit(1);
  }

  console.log('=================================');
  console.log('✓ All R2 tests passed successfully!');
  console.log('=================================');
}

runTest().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
