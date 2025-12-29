# WDIO Syngrisi Cucumber Service

The service helps integrate [WebdriverIO](https://webdriver.io/) test framework
and [Syngrisi](https://github.com/viktor-silakov/syngrisi) visual testing tool.

## Installation

```bash
npm i wdio-syngrisi-cucumber-service
```

## Configuration

In order to use the service with WebdriverIO test runner add these settings to services array:

```js
// wdio.conf.js
export.config = {
    // ...
    services: [
        ['syngrisi-cucumber',
            {
                // syngrisi server endpoint
                endpoint: `http://localhost:3000/`,
                // syngrisi API key
                apikey: process.env['SYNGRISI_API_KEY'] || '',
                // project name
                project: 'My Project',
                // the tested branch
                branch: 'master',
                // run name (will be auto generated if not present)
                runname: process.env['RUN_NAME'],
                // run name (will be auto generated if not present)
                runident: process.env['RUN_IDENT'],
                // tag for visual regression scenarios
                // for all scenarios with this tag the service will create session on syngrisi
                // if tag is empty the visual session will be created for all scenarios
                // tag: '@visual',
                // the scenarios with `excludeTag` tag will be skipped 
                // excludeTag: '@novisual'
            }
        ],
    ],
    // ...
};
```

## Usage

After all the preparations, you can use the `browser.syngrisiCheck(checkName, imageBuffer)` method in which:

* `checkName` - the name of the check in Syngrisi
* `imageBuffer` - the screenshot image buffer

## Full end-to-end tests

The repository ships a suite of e2e specifications that run WebdriverIO 9.6.0 together with the `syngrisi-cucumber` service against a real Syngrisi instance. To exercise the full flow, simply run:

```bash
npm run e2e
```

The helper script `scripts/run-e2e.js` takes care of:

1. Compiling the service (`npm run compile`) so that `dist/index.js` is available for `e2e/wdio.conf.js`.
2. Waiting for your local MongoDB instance to accept connections at `localhost:27017` (override via `SYNG_MONGO_HOST`/`SYNG_MONGO_PORT`). The script will abort if the port is closed, so start MongoDB manually before running the tests.
3. Launching Syngrisi via `npx @syngrisi/syngrisi start` on `http://localhost:3700/` with `SYNGRISI_DB_URI`, `SYNGRISI_API_KEY=demo-key`, `SYNGRISI_TEST_MODE=true`, and `SYNGRISI_ENABLE_SCHEDULERS_IN_TEST_MODE=true`. Output is mirrored into `logs/syngrisi.log`.
4. Starting a local `chromedriver` on port `9515` and streaming its output into `logs/chromedriver.log`.
5. Running `wdio run e2e/wdio.conf.js` with the prepared environment so the service injects `SyngrisiService` and the feature `e2e/features/syngrisi.feature` exercises `browser.syngrisiCheck`.

The script exposes the following overridable environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHROMEDRIVER_PORT` | `9515` | ChromeDriver listen port |
| `CHROMEDRIVER_LOG_DIR` | `logs` | Directory for chromedriver and syngrisi logs |
| `SYNG_MONGO_HOST` | `localhost` | MongoDB hostname that is expected to be running locally |
| `SYNG_MONGO_PORT` | `27017` | MongoDB port that the script checks before starting other services |
| `SYNG_SY_PORT` | `3700` | Syngrisi REST API port |
| `SYNG_SY_API_KEY` | `demo-key` | Syngrisi API key |
| `SYNGRISI_DB_URI` | `mongodb://localhost:27017/SyngrisiDb` | Connection string used by Syngrisi |
| `BASE_URL` | `https://example.com` | Base URL used by `e2e/wdio.conf.js` (`browser.url('/')`) |
| `SY_PROJECT`, `SY_BRANCH` | `E2E Example Project`, `main` | Parameters for the Syngrisi project created by the service |
| `SY_RUN_NAME`, `SY_RUN_IDENT` | `wdio-e2e-run`, `wdio-e2e-ident` | Run identifiers exported by `SyngrisiLaunchService` |
| `SY_EXCLUDE_TAG` | `@novisual` | Feature tag that prevents visual checks from running |

Before running the suite, make sure you have MongoDB running locally (e.g., `mongod --config /usr/local/etc/mongod.conf` or `brew services start mongodb-community`). The script will fail immediately if the port specified by `SYNG_MONGO_HOST`/`SYNG_MONGO_PORT` is closed. It also drops the database pointed to by `SYNGRISI_DB_URI` and removes the `.snapshots-images` directory, so any existing Syngrisi state under those paths will be erased.

Features assume Syngrisi is reachable at `http://localhost:${process.env.SYNG_SY_PORT || '3700'}/`. On CI or other hosts you can override `SYNGRISI_HOST`, `SYNG_SY_PORT`, `SYNGRISI_API_KEY`, `BASE_URL`, and the `SY_*` variables that are forwarded into the service via `e2e/wdio.conf.js`.

The `logs/` directory is already listed in `.gitignore`, so generated artifacts won’t be committed.
