import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email wajib diisi' })
    .trim()
    .email('Format alamat email tidak valid'),
  password: z
    .string({ required_error: 'Kata sandi wajib diisi' })
    .min(6, 'Kata sandi minimal 6 karakter'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email wajib diisi' })
    .trim()
    .email('Format alamat email tidak valid'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
