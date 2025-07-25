import { Request, Response } from 'express';
import { config } from '../config/config.js';

export const oauthProtectedResourceHandler = (req: Request, res: Response) => {
    res.json({
        resource: `http://localhost:${config.port}`,
        authorization_servers: [config.skEnvUrl],
        bearer_methods_supported: ['header'],
        resource_documentation: `http://localhost:${config.port}/docs`,
        scopes_supported: [
            'usr:read'
        ]
    });
};