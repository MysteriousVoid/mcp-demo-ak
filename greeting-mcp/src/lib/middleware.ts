import { jwtVerify, createRemoteJWKSet } from 'jose';
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
                clientId: string;
                scopes: string[];
                expiresAt?: number;
                resource?: URL;
                extra?: Record<string, unknown>;
            };
        }
    }
}

// Configure JWKS endpoint from your Scalekit instance
const JWKS = createRemoteJWKSet(
  new URL(`${config.skEnvUrl}/.well-known/jwks`)
);

// WWW-Authenticate header for 401 responses
const WWW_AUTHENTICATE_HEADER = [
  'Bearer error="unauthorized"',
  'error_description="Authorization required"',
  `resource_metadata="http://localhost:${config.port}/.well-known/oauth-protected-resource"`
].join(', ');

const validateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];

  if (!token) {
    return res
      .set('WWW-Authenticate', WWW_AUTHENTICATE_HEADER)
      .status(401)
      .json({
        error: 'unauthorized',
        error_description: 'Bearer token required'
      });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.skEnvUrl,
      audience: `http://localhost:${config.port}` // Your MCP server identifier
    });

    // Attach token claims to request for downstream use
    req.auth = {
      token: token,
      clientId: payload.client_id as string,
      scopes: (payload.scope as string)?.split(' ') || [],
      expiresAt: payload.exp as number,
      resource: new URL(`http://localhost:${config.port}`),
      extra: {
        userId: payload.sub as string
      }
    };

    next();
  } catch (error) {
    console.error('Token validation failed:', error instanceof Error ? error.message : String(error));
    return res
      .set('WWW-Authenticate', WWW_AUTHENTICATE_HEADER)
      .status(401)
      .json({
        error: 'invalid_token',
        error_description: 'Bearer token is invalid or expired'
      });
  }
};

const requireScope = (requiredScope: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userScopes = req.auth?.scopes || [];

    if (!userScopes.includes(requiredScope)) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Required scope: ${requiredScope}`,
        scope: requiredScope
      });
    }

    next();
  };
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

        // Apply token validation
        await validateToken(req, res, next);

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
        return res
            .set('WWW-Authenticate', WWW_AUTHENTICATE_HEADER)
            .status(401)
            .json({
                error: 'invalid_token',
                error_description: 'Bearer token is invalid or expired'
            });
    }
}