/**
 * `next/cache`, for a process that is not Next.
 *
 * The worker shares the application's domain code, and that code calls
 * `revalidatePath` after it writes — correctly, because in the web container
 * there is a rendered page cache to invalidate. In the worker there is not:
 * it serves no HTTP and holds no cache, and the web container's cache entries
 * expire on their own `revalidate` window.
 *
 * Bundling the real module instead drags Next's whole server runtime —
 * including its OpenTelemetry tracer — into a plain Node bundle, where it does
 * not resolve. esbuild is pointed here instead (see the `worker:build` script),
 * so the calls compile to nothing and the web app keeps the real behaviour.
 */

export function revalidatePath(_path: string, _type?: 'page' | 'layout'): void {}

export function revalidateTag(_tag: string): void {}

export function unstable_noStore(): void {}
