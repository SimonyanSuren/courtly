import { type ConfigFactoryKeyHost, registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Declares one configuration namespace: the environment variables it reads, validated with Zod,
 * and the typed value it gives consumers. Each capability defines its own next to its code.
 * ConfigModule.forRoot({ load }) builds every namespace at startup, so an invalid variable stops
 * the start with an error that names it. Inject one with
 * `@Inject(httpConfig.KEY) config: ConfigType<typeof httpConfig>`.
 */
export function defineConfig<TEnv extends z.ZodObject, TConfig extends Record<string, unknown>>(
  namespace: string,
  env: TEnv,
  build: (variables: z.output<TEnv>) => TConfig,
): (() => TConfig) & ConfigFactoryKeyHost<TConfig> {
  return registerAs(namespace, (): TConfig => {
    const result = env.safeParse(process.env);

    if (!result.success) {
      throw new Error(`Invalid ${namespace} configuration:\n${z.prettifyError(result.error)}`);
    }

    return build(result.data);
  });
}
