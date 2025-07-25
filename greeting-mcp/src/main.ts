import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import cors from 'cors';
import express from 'express';
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

// Apply to all MCP endpoints
app.use('/', authMiddleware);

setupTransportRoutes(app, server);
logger.info('Transport routes set up successfully');

registerTools(server);
logger.info('Registered tools successfully');

app.listen(PORT, () => logger.info(`MCP server running on http://localhost:${PORT}`));