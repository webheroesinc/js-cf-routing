/**
 * CORS utilities for Cloudflare Workers
 * @module cors
 */

/**
 * Default CORS headers for all responses
 *
 * Includes permissive settings for cross-origin requests.
 *
 * @category Utilities
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-App-Id, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    'Access-Control-Allow-Credentials': 'true',
};

/**
 * Helper function to add CORS headers to any response
 *
 * @param response - The response to add CORS headers to
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
export function addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
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
 * @param corsHeaders - CORS headers to include in responses
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
export function createCorsHandler(corsHeaders: Record<string, string>) {
    return function handleCors(
        request: Request,
        handler: (request: Request) => Promise<Response>
    ): Promise<Response> {
        // Handle CORS preflight requests (OPTIONS)
        if (request.method === 'OPTIONS') {
            return Promise.resolve(
                new Response(null, {
                    status: 204, // No content
                    headers: corsHeaders,
                })
            );
        }

        // Process the request with the handler
        return handler(request).then((response) => {
            // Add CORS headers to the response
            const newHeaders = new Headers(response.headers);

            // Add all CORS headers
            Object.entries(corsHeaders).forEach(([key, value]) => {
                newHeaders.set(key, value);
            });

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        });
    };
}
