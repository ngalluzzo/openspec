import { z } from "zod";

export const authContextSchema = z.object({
	sub: z.string().min(1).optional(),
	provider: z.string().min(1).optional(),
	expiresAt: z.string().min(1).optional(),
	permissions: z.array(z.string().min(1)).optional(),
	claims: z.record(z.string(), z.unknown()).optional(),
	roles: z.array(z.string().min(1)).optional(),
	tenantId: z.string().min(1).optional(),
	scope: z.array(z.string().min(1)).optional(),
});

export type AuthContext = z.infer<typeof authContextSchema>;
