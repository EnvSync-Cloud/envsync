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
  VITE_API_BASE_URL: z.string().url().default('http://localhost:4000'),
} satisfies EnvRecords);

function getEnv() {
  try {
    return envSchema.parse(import.meta.env);
  } catch (e) {
    console.warn("Env validation failed, using defaults:", e);
    return {
      VITE_API_BASE_URL: "http://localhost:4000",
    } as z.infer<typeof envSchema>;
  }
}

export const env = getEnv();
export type Env = z.infer<typeof envSchema>;