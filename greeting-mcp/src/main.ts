import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import cors from 'cors';
import express from 'express';
import fetch from 'node-fetch';
import { config } from './config/config.js';
import { oauthProtectedResourceHandler } from './lib/auth.js';
import { logger } from './lib/logger.js';
import { authMiddleware } from './lib/middleware.js';
import { setupTransportRoutes } from './lib/transport.js';
import { registerTools } from './tools/index.js';

const PORT = config.port;
const server = new McpServer({ name: config.serverName, version: config.serverVersion });

const app = express();

app.use(cors({origin: ['*'],credentials: true,}));
app.use(express.json());

// Required: OAuth Protected Resource Metadata endpoint
app.get('/.well-known/oauth-protected-resource', oauthProtectedResourceHandler);

// Optional: Proxy authorization server metadata for legacy clients
app.get('/.well-known/oauth-authorization-server', async (req, res) => {
  try {
    const response = await fetch(
      `${config.skEnvUrl}/${config.mcpServerId}/.well-known/oauth-authorization-server`
    );
    const metadata = await response.json();
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch authorization server metadata' });
  }
});

// Apply to all MCP endpoints
app.use('/', authMiddleware);

setupTransportRoutes(app, server);
logger.info('Transport routes set up successfully');

registerTools(server);
logger.info('Registered tools successfully');

app.listen(PORT, () => logger.info(`MCP server running on http://localhost:${PORT}`));