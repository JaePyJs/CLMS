const truthy = (v?: string) => ['true', '1', 'yes', 'y', 'on'].includes(String(v || '').toLowerCase());

export const queuesDisabled = truthy(process.env.DISABLE_QUEUES);
export const emailDisabled = truthy(process.env.DISABLE_EMAIL);
export const disableScheduledTasks = truthy(process.env.DISABLE_SCHEDULED_TASKS);
export const rateLimiterDisabled = truthy(process.env.DISABLE_RATE_LIMITER);

export const getGateStatus = () => ({
  queuesDisabled,
  emailDisabled,
  disableScheduledTasks,
  rateLimiterDisabled,
});