import { createGatewayApp } from "@pand/gateway";
import config from "../../../pand.config.js";

const gateway = createGatewayApp({
  config,
});

const originalFetch = gateway.fetch.bind(gateway);
gateway.fetch = (request: Request, ...args: any[]) => {
  const origin = request.headers.get("origin");
  if (
    process.env.NODE_ENV !== "production" &&
    origin &&
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin) &&
    process.env.BETTER_AUTH_URL
  ) {
    const headers = new Headers(request.headers);
    headers.set("origin", process.env.BETTER_AUTH_URL);
    const rewritten = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
      duplex: "half",
    });
    return originalFetch(rewritten, ...args);
  }
  return originalFetch(request, ...args);
};

export const app = gateway;
export default app;
