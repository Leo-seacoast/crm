import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 12;

/** Checks the login form on the server. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address" })),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(200, "Password is too long"),
  next: z.string().max(2000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
