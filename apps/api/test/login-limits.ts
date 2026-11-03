// Runs before each test file. The specs log in many times from one address; limits this high keep
// them from being refused. test/login-throttle.spec.ts sets its own low limits.
process.env.LOGIN_ATTEMPTS_PER_IP ??= '10000';
process.env.LOGIN_ATTEMPTS_PER_EMAIL ??= '10000';
