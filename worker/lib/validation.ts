import { z } from 'zod';

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
export const MESSAGE_MAX = 8_000;
export const TITLE_MAX = 80;

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(EMAIL_MAX)
  .email('รูปแบบอีเมลไม่ถูกต้อง')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`)
  .max(PASSWORD_MAX, `รหัสผ่านต้องไม่เกิน ${PASSWORD_MAX} ตัวอักษร`);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  inviteCode: z.string().min(1, 'กรุณากรอกรหัสเชิญ').max(200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const chatSchema = z.object({
  conversationId: z.string().uuid().nullish(),
  content: z
    .string()
    .trim()
    .min(1, 'กรุณาพิมพ์ข้อความ')
    .max(MESSAGE_MAX, `ข้อความต้องไม่เกิน ${MESSAGE_MAX.toLocaleString()} ตัวอักษร`),
  provider: z.string().min(1).max(40),
  model: z.string().min(1).max(120),
});

export const renameSchema = z.object({
  title: z.string().trim().min(1, 'กรุณาระบุชื่อบทสนทนา').max(TITLE_MAX),
});

export const createConversationSchema = z.object({
  title: z.string().trim().max(TITLE_MAX).optional(),
  provider: z.string().min(1).max(40),
  model: z.string().min(1).max(120),
});

export type ChatInput = z.infer<typeof chatSchema>;

/** Turn a Zod failure into a short, user-safe Thai message. */
export function zodMessage(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message ?? 'ข้อมูลที่ส่งไม่ถูกต้อง';
}

export function titleFromContent(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'บทสนทนาใหม่';
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}
