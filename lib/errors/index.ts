export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required to access this resource') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action in this organization') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(message: string = 'Validation failed', errors?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists or conflicts with current state') {
    super(message, 409, 'CONFLICT');
  }
}

export class DatabaseError extends AppError {
  constructor(_message: string = 'A database error occurred') {
    // Sanitize database message to prevent leaking internal PostgreSQL details
    super('An internal database error occurred. Please contact support.', 500, 'DATABASE_ERROR');
  }
}

export function sanitizeError(error: unknown): { message: string; code: string; statusCode: number } {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (
      msg.includes('live call') ||
      msg.includes('Cannot delete') ||
      msg.includes('Not allowed to update') ||
      msg.includes('not found') ||
      msg.includes('insufficient') ||
      msg.includes('Permission') ||
      msg.includes('Forbidden')
    ) {
      return {
        message: msg,
        code: 'ACTION_FAILED',
        statusCode: 400,
      };
    }
  }

  return {
    message: 'An unexpected system error occurred.',
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
  };
}
