import z, { ZodTypeAny } from 'zod';

export type JWT = `Bearer ${string}`;
export type TEnvKey = `VITE_${string}`;

/**
 * Function type with arguments and return type
 * @param P - Arguments
 * @param R - Return type
 */
export type Function<P = unknown, R = unknown> = (props: P) => R;
/**
 * Async function type with arguments and return type
 * @param P - Arguments
 * @param R - Return type
 */
export type AsyncFunction<P = unknown, R = unknown> = Function<P, Promise<R>>;

type EnvRecords = Record<TEnvKey, ZodTypeAny>;

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8600'),
} satisfies EnvRecords);

export const env = envSchema.parse(import.meta.env);
export type Env = z.infer<typeof envSchema>;