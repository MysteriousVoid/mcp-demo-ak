import { Scalekit, TokenValidationOptions } from '@scalekit-sdk/node';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config/config.js';
import { TOOLS } from '../tools/index.js';
import { logger } from './logger.js';

// Extend Express Request interface to include auth property matching MCP SDK AuthInfo
declare global {
    namespace Express {
        interface Request {
            auth?: {
                token: string;
                userId: string;
                scopes: string[];
                clientId: string;
                expiresAt: number;
            };
        }
    }
}

const scalekit = new Scalekit(config.skEnvUrl, config.skClientId, config.skClientSecret);

// your resource id that you configure in the scalekit dashboard
const RESOURCE_ID = `http://localhost:${config.port}`;

// your resource metadata endpoint that you can copy from the scalekit dashboard
const resource_metadata_endpoint = `http://localhost:${config.port}/.well-known/oauth-protected-resource`;

export const WWWHeader = {
    HeaderKey: 'WWW-Authenticate',
    HeaderValue: `Bearer realm="OAuth", resource_metadata="${resource_metadata_endpoint}"`
};

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Allow public access to well-known endpoints
        if (req.path.includes('.well-known')) {
            return next();
        }

        // Allow initial MCP handshake without authentication
        if (req.path === '/' && req.method === 'POST' && req.body?.method === 'initialize') {
            return next();
        }

        // Apply authentication to all MCP requests
        const authHeader = req.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : null;

        if (!token) {
            throw new Error('Missing or invalid Bearer token');
        }

        // Validate token using Scalekit SDK
        const tokenInfo = await scalekit.validateToken(token, { audience: [RESOURCE_ID] }) as any;
        
        // Attach token claims to request for downstream use
        req.auth = {
            token: token,
            userId: tokenInfo.sub || '',
            scopes: tokenInfo.scope?.split(' ') || [],
            clientId: tokenInfo.client_id || '',
            expiresAt: tokenInfo.exp || 0
        };

        // For tool calls, validate required scopes
        const isToolCall = req.body?.method === 'tools/call';
        if (isToolCall) {
            const toolName = req.body?.params?.name as keyof typeof TOOLS;
            if (toolName && (toolName in TOOLS)) {
                const requiredScopes = TOOLS[toolName].requiredScopes;
                const userScopes = req.auth?.scopes || [];
                
                if (!requiredScopes.every(scope => userScopes.includes(scope))) {
                    logger.warn('Insufficient scopes', { requiredScopes, userScopes });
                    return res.status(403).json({
                        error: 'insufficient_scope',
                        error_description: `Required scopes: ${requiredScopes.join(', ')}`,
                        scope: requiredScopes.join(' ')
                    });
                }
            }
        }

        logger.info('Authentication successful');
        next();
    } catch (err) {
        logger.error('Unauthorized request', { error: err instanceof Error ? err.message : String(err) });
        return res.status(401).set(WWWHeader.HeaderKey, WWWHeader.HeaderValue).end();
    }
}