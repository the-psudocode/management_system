import config from '../config/index.js';
import { runBillingDate } from '../modules/billing/routes.js';
import { asDateOnly } from '../modules/billing/calculations.js';

function businessDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return asDateOnly(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

export function startBillingScheduler() {
  if (!config.billingWorkerEnabled) return () => {};
  let timer;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const nextRun = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      config.billingRunUtcHour,
      config.billingRunUtcMinute,
      0,
      0,
    ));
    if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);

    timer = setTimeout(async () => {
      try {
        const result = await runBillingDate(businessDate(new Date()));
        console.info(`[Billing] Scheduled run completed. Created ${result.createdCount} invoice(s); skipped ${result.skipped.length}.`);
      } catch (error) {
        console.error('[Billing] Scheduled run failed:', error?.message || 'Unexpected error');
      } finally {
        scheduleNext();
      }
    }, nextRun.getTime() - now.getTime());
  };

  scheduleNext();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
