import { Request, Response } from 'express';
import { config } from '../config/config.js';

export const oauthProtectedResourceHandler = (req: Request, res: Response) => {
    res.json({
        "authorization_servers": [
            `${config.skEnvUrl}/resources/${config.mcpServerId}`
        ],
        "bearer_methods_supported": [
            "header"
        ],
        "resource": `http://localhost:${config.port}`,
        "resource_documentation": `http://localhost:${config.port}/docs`,
        "scopes_supported": ["usr:read"]
    });
};