export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, expose = true) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

export const errors = {
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ'),
  forbidden: (message = 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'ไม่พบข้อมูล') => new AppError(404, 'NOT_FOUND', message),
  badRequest: (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  rateLimited: (message = 'เรียกใช้งานบ่อยเกินไป กรุณาลองใหม่ภายหลัง') =>
    new AppError(429, 'RATE_LIMITED', message),
  payloadTooLarge: () => new AppError(413, 'PAYLOAD_TOO_LARGE', 'ข้อมูลที่ส่งมีขนาดใหญ่เกินกำหนด'),
  server: (message = 'เกิดข้อผิดพลาดภายในระบบ') => new AppError(500, 'INTERNAL_ERROR', message),
};

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}
