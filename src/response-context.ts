/**
 * ResponseContext provides a mutable interface for customizing response properties
 * before the final Response is constructed.
 *
 * The API mirrors the Response object for familiarity, but allows mutation
 * since the actual Response is built after the handler completes.
 *
 * @category Response
 *
 * @example
 * ```typescript
 * class UserHandler extends RouteHandler<Env, { id: string }> {
 *   async get(ctx: Context<Env, { id: string }>): Promise<any> {
 *     ctx.response.status = 201;
 *     ctx.response.headers.set('Set-Cookie', 'session=abc123');
 *     return { userId: ctx.params.id };
 *   }
 * }
 * ```
 */
export class ResponseContext {
    /**
     * HTTP status code for the response
     * @default 200
     */
    status: number = 200;

    /**
     * HTTP status text for the response
     * @default 'OK'
     */
    statusText: string = 'OK';

    /**
     * Headers to include in the response
     * Works like Response.headers - use .set(), .append(), .delete(), etc.
     */
    headers: Headers;

    constructor() {
        this.headers = new Headers();
    }

    /**
     * Reset the context to default values
     */
    reset(): void {
        this.status = 200;
        this.statusText = 'OK';
        this.headers = new Headers();
    }
}
