/**
 * Standardized API response helpers
 * Ensures consistent response format across all endpoints
 */

export class ApiResponse {
  static success<T>(data: T, status: number = 200): Response {
    return new Response(JSON.stringify(data), { 
      status,
      headers: { "Content-Type": "application/json" }
    });
  }

  static created<T>(data: T): Response {
    return this.success(data, 201);
  }

  static noContent(): Response {
    return new Response(null, { status: 204 });
  }

  static error(message: string, status: number = 500): Response {
    return new Response(JSON.stringify({ error: message }), { 
      status,
      headers: { "Content-Type": "application/json" }
    });
  }

  static unauthorized(message: string = "Unauthorized"): Response {
    return this.error(message, 401);
  }

  static forbidden(message: string = "Forbidden"): Response {
    return this.error(message, 403);
  }

  static notFound(resource: string = "Resource"): Response {
    return this.error(`${resource} not found`, 404);
  }

  static badRequest(message: string): Response {
    return this.error(message, 400);
  }

  static validationError(errors: any): Response {
    return new Response(JSON.stringify({ error: errors }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
