import logger from '../src/utils/logger';

logger.info('Logger info test entry', { test: true });
logger.error('Logger error test entry', { testError: true });

console.log('Logger test completed');