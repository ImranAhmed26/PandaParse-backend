#!/usr/bin/env node

/**
 * Test script for Internal API endpoints
 * Usage: node src/scripts/test-internal-api.js
 */

const fetch = require('node-fetch');

const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal_aws_key_2024_secure_random_string_xyz789';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';

async function testInternalApi() {
  console.log('🔧 Testing Internal API endpoints...\n');

  try {
    // Test 1: Generate presigned URL
    console.log('1. Testing presigned URL generation...');
    const presignedResponse = await fetch(`${BASE_URL}/upload/internal/generate-url`, {
      method: 'POST',
      headers: {
        'X-API-Key': INTERNAL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'test-document.pdf',
        fileType: 'application/pdf',
        fileSize: 1024000,
        userId: 'test-user-123',
        workspaceId: 'test-workspace-456',
      }),
    });

    if (presignedResponse.ok) {
      const presignedData = await presignedResponse.json();
      console.log('✅ Presigned URL generated successfully');
      console.log(`   Key: ${presignedData.key}`);
      console.log(`   Expires in: ${presignedData.expiresIn} seconds\n`);

      // Test 2: Create upload record
      console.log('2. Testing upload record creation...');
      const uploadResponse = await fetch(`${BASE_URL}/upload/internal/records`, {
        method: 'POST',
        headers: {
          'X-API-Key': INTERNAL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: presignedData.key,
          fileName: 'test-document.pdf',
          fileType: 'application/pdf',
          fileSize: 1024000,
          userId: 'test-user-123',
          workspaceId: 'test-workspace-456',
        }),
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log('✅ Upload record created successfully');
        console.log(`   Upload ID: ${uploadData.id}`);
        console.log(`   Status: ${uploadData.status}\n`);

        // Test 3: Create document record
        console.log('3. Testing document creation...');
        const documentResponse = await fetch(`${BASE_URL}/documents/internal`, {
          method: 'POST',
          headers: {
            'X-API-Key': INTERNAL_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uploadId: uploadData.id,
            fileName: 'test-document.pdf',
            documentUrl: `https://bucket.s3.amazonaws.com/${presignedData.key}`,
            type: 'OTHER',
            userId: 'test-user-123',
            workspaceId: 'test-workspace-456',
          }),
        });

        if (documentResponse.ok) {
          const documentData = await documentResponse.json();
          console.log('✅ Document created successfully');
          console.log(`   Document ID: ${documentData.id}`);
          console.log(`   Status: ${documentData.status}\n`);

          // Test 4: Create job
          console.log('4. Testing job creation...');
          const jobResponse = await fetch(`${BASE_URL}/jobs/internal`, {
            method: 'POST',
            headers: {
              'X-API-Key': INTERNAL_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uploadId: uploadData.id,
              type: 'OTHER',
              userId: 'test-user-123',
            }),
          });

          if (jobResponse.ok) {
            const jobData = await jobResponse.json();
            console.log('✅ Job created successfully');
            console.log(`   Job ID: ${jobData.id}`);
            console.log(`   Status: ${jobData.status}\n`);

            // Test 5: Update job status
            console.log('5. Testing job status update...');
            const jobUpdateResponse = await fetch(
              `${BASE_URL}/jobs/internal/${jobData.id}/status`,
              {
                method: 'PATCH',
                headers: {
                  'X-API-Key': INTERNAL_API_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'processing',
                }),
              },
            );

            if (jobUpdateResponse.ok) {
              const updatedJob = await jobUpdateResponse.json();
              console.log('✅ Job status updated successfully');
              console.log(`   New status: ${updatedJob.status}\n`);
            } else {
              console.log('❌ Job status update failed');
              console.log(await jobUpdateResponse.text());
            }
          } else {
            console.log('❌ Job creation failed');
            console.log(await jobResponse.text());
          }
        } else {
          console.log('❌ Document creation failed');
          console.log(await documentResponse.text());
        }
      } else {
        console.log('❌ Upload record creation failed');
        console.log(await uploadResponse.text());
      }
    } else {
      console.log('❌ Presigned URL generation failed');
      console.log(await presignedResponse.text());
    }

    // Test 6: Test invalid API key
    console.log('6. Testing invalid API key...');
    const invalidResponse = await fetch(`${BASE_URL}/upload/internal/generate-url`, {
      method: 'POST',
      headers: {
        'X-API-Key': 'invalid-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        userId: 'test-user',
      }),
    });

    if (invalidResponse.status === 401) {
      console.log('✅ Invalid API key properly rejected');
    } else {
      console.log('❌ Invalid API key should have been rejected');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }

  console.log('\n🏁 Internal API testing completed!');
}

// Run the test
testInternalApi();
