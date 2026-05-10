/** @type { import('@opennextjs/cloudflare').config } */
const config = {
  ui: { key: 'value' },
  github: {
    autoRetry: true,
    autoRetryInSeconds: 5,
  },
  logger: { level: 'debug' },
  buildCommand: 'npm run build',
  outputDirectory: '.next',
};
export default config;