// Debug script to examine the JWT token from Scalekit
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const debugToken = async () => {
  try {
    console.log('🔍 Debugging Scalekit JWT token...\n');

    // Step 1: Get access token from Scalekit
    console.log('1️⃣ Requesting access token from Scalekit...');
    const tokenResponse = await fetch(`${process.env.SK_ENV_URL}/oauth/token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SK_CLIENT_ID}:${process.env.SK_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'usr:read'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token request failed:', tokenResponse.status, errorText);
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    console.log('✅ Access token received');
    console.log('Token type:', tokenData.token_type);
    console.log('Expires in:', tokenData.expires_in);
    console.log('Scope:', tokenData.scope);
    console.log('Full token:', accessToken);

    // Step 2: Decode JWT payload (without verification)
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format');
      return;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('\n🔍 JWT Payload:');
    console.log(JSON.stringify(payload, null, 2));

    // Step 3: Check what our server expects
    console.log('\n🎯 Our server expects:');
    console.log('Issuer:', process.env.SK_ENV_URL);
    console.log('Audience:', `http://localhost:${process.env.PORT || 3002}`);
    console.log('Required scopes:', ['usr:read']);

    // Step 4: Check if there's a mismatch
    console.log('\n🔍 Token Analysis:');
    console.log('Token issuer:', payload.iss);
    console.log('Token audience:', payload.aud);
    console.log('Token scopes:', payload.scope);
    console.log('Token client_id:', payload.client_id);
    console.log('Token expires:', new Date(payload.exp * 1000));

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
};

// Run the debug
debugToken(); 