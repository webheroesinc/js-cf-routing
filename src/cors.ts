/**
 * CORS utilities for Cloudflare Workers
 * @module cors
 */

/**
 * Configuration options for CORS behavior
 *
 * @category Types
 */
export interface CorsConfig {
    /**
     * Allowed origins for CORS requests.
     * - If not set, Access-Control-Allow-Origin header is not added by default
     * - Use '*' to allow all origins (not compatible with credentials: true)
     * - Use an array of specific origins for restricted access
     */
    origins?: string | string[];

    /**
     * Allowed HTTP methods for CORS requests.
     * @default 'GET, POST, PUT, DELETE, OPTIONS'
     */
    methods?: string;

    /**
     * Allowed headers for CORS requests.
     * @default 'Content-Type, X-API-Key, X-App-Id, Authorization'
     */
    headers?: string;

    /**
     * Max age for preflight request caching in seconds.
     * @default '86400' (24 hours)
     */
    maxAge?: string;

    /**
     * Whether to allow credentials (cookies, authorization headers).
     * Note: Cannot be true when origins is '*'
     * @default false
     */
    credentials?: boolean;
}

/**
 * Default CORS headers for all responses
 *
 * Note: Access-Control-Allow-Origin is not included by default because:
 * 1. Using '*' with credentials is rejected by browsers
 * 2. The correct origin depends on the request and security requirements
 *
 * Use CorsConfig to properly configure CORS for your use case.
 *
 * @category Utilities
 */
export const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-App-Id, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
};

/**
 * Build CORS headers from a CorsConfig object and optional request origin
 *
 * @param config - CORS configuration options
 * @param requestOrigin - The origin from the incoming request (used for dynamic origin matching)
 * @returns A record of CORS headers
 *
 * @category Utilities
 */
export function buildCorsHeaders(
    config: CorsConfig,
    requestOrigin?: string | null
): Record<string, string> {
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': config.methods ?? 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
            config.headers ?? 'Content-Type, X-API-Key, X-App-Id, Authorization',
        'Access-Control-Max-Age': config.maxAge ?? '86400',
    };

    // Handle origins
    if (config.origins) {
        if (config.origins === '*') {
            headers['Access-Control-Allow-Origin'] = '*';
        } else if (Array.isArray(config.origins)) {
            // Check if request origin is in allowed list
            if (requestOrigin && config.origins.includes(requestOrigin)) {
                headers['Access-Control-Allow-Origin'] = requestOrigin;
                headers['Vary'] = 'Origin';
            }
        } else {
            // Single specific origin
            headers['Access-Control-Allow-Origin'] = config.origins;
        }
    }

    // Only add credentials header if explicitly enabled and origin is set
    if (config.credentials && headers['Access-Control-Allow-Origin']) {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
}

/**
 * Helper function to add CORS headers to any response
 *
 * Preserves any existing CORS headers set by the handler - only adds
 * default CORS headers if they are not already present.
 *
 * @param response - The response to add CORS headers to
 * @param config - Optional CORS configuration to use instead of defaults
 * @param requestOrigin - The origin from the incoming request
 * @returns A new response with CORS headers added
 *
 * @category Utilities
 *
 * @example
 * ```typescript
 * const response = new Response('Hello');
 * const corsResponse = addCorsHeaders(response);
 * ```
 */
export function addCorsHeaders(
    response: Response,
    config?: CorsConfig,
    requestOrigin?: string | null
): Response {
    const newHeaders = new Headers(response.headers);
    const headersToApply = config ? buildCorsHeaders(config, requestOrigin) : corsHeaders;

    Object.entries(headersToApply).forEach(([key, value]) => {
        // Only set the header if it's not already present
        if (!newHeaders.has(key)) {
            newHeaders.set(key, value);
        }
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

/**
 * Creates a CORS handler middleware
 *
 * @param corsHeadersConfig - CORS headers to include in responses
 * @returns A function that adds CORS headers to responses
 *
 * @category Utilities
 *
 * @example
 * ```typescript
 * const customCorsHeaders = {
 *   'Access-Control-Allow-Origin': 'https://example.com',
 *   'Access-Control-Allow-Methods': 'GET, POST'
 * };
 *
 * const corsHandler = createCorsHandler(customCorsHeaders);
 * const response = await corsHandler(request, async (req) => {
 *   return new Response('Hello');
 * });
 * ```
 */
export function createCorsHandler(corsHeadersConfig: Record<string, string>) {
    return function handleCors(
        request: Request,
        handler: (request: Request) => Promise<Response>
    ): Promise<Response> {
        // Handle CORS preflight requests (OPTIONS)
        if (request.method === 'OPTIONS') {
            return Promise.resolve(
                new Response(null, {
                    status: 204, // No content
                    headers: corsHeadersConfig,
                })
            );
        }

        // Process the request with the handler
        return handler(request).then((response) => {
            // Add CORS headers to the response, preserving existing ones
            const newHeaders = new Headers(response.headers);

            // Add CORS headers only if not already present
            Object.entries(corsHeadersConfig).forEach(([key, value]) => {
                if (!newHeaders.has(key)) {
                    newHeaders.set(key, value);
                }
            });

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        });
    };
}
