import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';

export function register() {
  registerOTel({
    serviceName: 'kosuke-ai-app',
    traceExporter: new LangfuseExporter({
      // Configuration is read from environment variables by default:
      // LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_BASEURL
      debug: false,
      sampleRate: 1,
    }),
  });
}
