/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts (both dev and production)
 * Perfect for initializing cron jobs and other server-side setup
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server (not in edge runtime or client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and initialize cron jobs
    const { initializeCronJobs } = await import('./src/lib/init/cron-init');
    initializeCronJobs();
  }
}
