// The authenticated local Bun dashboard mounts this build at /mobile/.
export const isHostedFinanceApp = typeof location !== 'undefined'
  && /^https?:$/.test(location.protocol)
  && ['localhost', '127.0.0.1'].includes(location.hostname)
  && location.pathname === '/mobile/'
