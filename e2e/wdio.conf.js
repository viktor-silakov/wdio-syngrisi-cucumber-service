const path = require('node:path');

const SyngrisiService = require(path.join(__dirname, '..', 'dist', 'index.js')).default;
const DEFAULT_RUN_NAME = process.env.SY_RUN_NAME || 'wdio-e2e-run';
const DEFAULT_RUN_IDENT = process.env.SY_RUN_IDENT || 'wdio-e2e-ident';

exports.config = {
    runner: 'local',
    automationProtocol: 'webdriver',
    specs: [
        path.join(__dirname, 'features/**/*.feature'),
    ],
    maxInstances: 1,
    hostname: process.env.CHROMEDRIVER_HOST || 'localhost',
    port: Number(process.env.CHROMEDRIVER_PORT || 9515),
    path: process.env.CHROMEDRIVER_PATH || '/',
    capabilities: [
        {
            browserName: 'chrome',
            'goog:chromeOptions': {
                args: ['--headless=new', '--disable-gpu', '--window-size=1366,768'],
            },
        },
    ],
    logLevel: process.env.LOG_LEVEL || 'info',
    baseUrl: process.env.BASE_URL || 'https://example.com',
    waitforTimeout: 15000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    framework: 'cucumber',
    reporters: [
        ['spec', { symbols: { passed: '[PASS]', failed: '[FAIL]' } }],
    ],
    cucumberOpts: {
        require: [
            path.join(__dirname, 'steps/**/*.steps.js'),
        ],
        timeout: 120000,
        failAmbiguousDefinitions: true,
        ignoreUndefinedDefinitions: false,
    },
    services: [
        [SyngrisiService, {
            endpoint: `http://${process.env.SYNGRISI_HOST || 'localhost'}:${process.env.SYNGRISI_PORT || '3000'}/`,
            apikey: process.env.SYNGRISI_API_KEY || '',
            project: process.env.SY_PROJECT || 'E2E Example Project',
            branch: process.env.SY_BRANCH || 'main',
            runname: process.env.SY_RUN_NAME || DEFAULT_RUN_NAME,
            runident: process.env.SY_RUN_IDENT || DEFAULT_RUN_IDENT,
            excludeTag: process.env.SY_EXCLUDE_TAG || '@novisual',
        }],
    ],
};
