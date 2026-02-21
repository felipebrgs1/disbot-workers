import { z } from "zod";

const runtimeConfigSchema = z.object({
	DISCORD_PUBLIC_KEY: z.string().min(1, "DISCORD_PUBLIC_KEY is required"),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

type RuntimeEnv = {
	DISCORD_PUBLIC_KEY: string;
};

export function readRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
	return runtimeConfigSchema.parse({
		DISCORD_PUBLIC_KEY: env.DISCORD_PUBLIC_KEY,
	});
}
