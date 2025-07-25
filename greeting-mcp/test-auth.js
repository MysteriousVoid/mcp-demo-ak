// Test script to validate OAuth token flow with Scalekit
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const testMCPAuth = async () => {
  try {
    console.log('🔐 Testing OAuth token flow with Scalekit...\n');

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
    console.log('✅ Access token received:', {
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope
    });

    const accessToken = tokenData.access_token;
    console.log('🔑 Token preview:', accessToken.substring(0, 20) + '...\n');

    // Step 2: Test MCP server with token
    console.log('2️⃣ Testing MCP server with token...');
    
    // First, test the tools/list method
    const listResponse = await fetch('http://localhost:3002/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('❌ MCP tools/list failed:', listResponse.status, errorText);
      return;
    }

    const listData = await listResponse.json();
    console.log('✅ MCP tools/list response:', JSON.stringify(listData, null, 2));

    // Step 3: Test the greet_user tool
    console.log('\n3️⃣ Testing greet_user tool...');
    const toolResponse = await fetch('http://localhost:3002/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'greet_user',
          arguments: {
            name: 'Test User'
          }
        }
      })
    });

    if (!toolResponse.ok) {
      const errorText = await toolResponse.text();
      console.error('❌ MCP tools/call failed:', toolResponse.status, errorText);
      return;
    }

    const toolData = await toolResponse.json();
    console.log('✅ MCP tools/call response:', JSON.stringify(toolData, null, 2));

    console.log('\n🎉 OAuth flow test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testMCPAuth(); 