export type TracesSamplerContext = {
  name: string;
  inheritOrSampleWith: (fallbackRate: number) => number;
};

export function defaultTracesSampleRate(): number {
  return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
}

export function isLowValueTraceName(name: string): boolean {
  return /health|monitoring|favicon/i.test(name);
}

export function tracesSampler({ name, inheritOrSampleWith }: TracesSamplerContext): number {
  if (isLowValueTraceName(name)) {
    return 0;
  }

  return inheritOrSampleWith(defaultTracesSampleRate());
}

export function parameterizePath(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/[A-Za-z0-9_-]{10,}/g, "/:id")
    .replace(/\/\d+/g, "/:id");
}

export function parameterizeSpanName(name: string): string {
  return name.replace(/\/[A-Za-z0-9_-]{10,}/g, "/:id").replace(/\/\d+/g, "/:id");
}
