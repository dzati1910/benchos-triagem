process.env.NODE_ENV ||= 'test';
process.env.PORT ||= '3001';
process.env.DATABASE_URL ||= 'postgresql://benchos:benchos_dev_pass@localhost:5432/benchos_test?schema=public';
process.env.JWT_SECRET ||= 'benchos-test-secret-min-16-chars';
process.env.JWT_EXPIRES_IN ||= '7d';
