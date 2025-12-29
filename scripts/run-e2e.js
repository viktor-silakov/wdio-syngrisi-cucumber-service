const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { MongoClient } = require('mongodb');

const CHROMEDRIVER_PORT = process.env.CHROMEDRIVER_PORT ?? '9515';
const CHROMEDRIVER_LOG_DIR = path.resolve(process.env.CHROMEDRIVER_LOG_DIR || 'logs');
const WDIO_CONFIG = path.resolve(__dirname, '../e2e/wdio.conf.js');
const MONGO_HOST = process.env.SYNG_MONGO_HOST || 'localhost';
const MONGO_PORT = process.env.SYNG_MONGO_PORT || '27017';
const SY_PORT = process.env.SYNG_SY_PORT || '3700';
const SY_API_KEY = process.env.SYNG_SY_API_KEY || 'demo-key';
const SY_DB_URI = process.env.SYNGRISI_DB_URI || `mongodb://localhost:${MONGO_PORT}/SyngrisiDb`;
const SY_HOST = 'localhost';
const SY_PROJECT = process.env.SY_PROJECT || 'E2E Example Project';
const SY_BRANCH = process.env.SY_BRANCH || 'main';
const SY_RUN_NAME = process.env.SY_RUN_NAME || 'wdio-e2e-run';
const SY_RUN_IDENT = process.env.SY_RUN_IDENT || 'wdio-e2e-ident';
const SY_EXCLUDE_TAG = process.env.SY_EXCLUDE_TAG || '@novisual';

fs.mkdirSync(CHROMEDRIVER_LOG_DIR, { recursive: true });
const chromedriverLog = fs.createWriteStream(path.join(CHROMEDRIVER_LOG_DIR, 'chromedriver.log'), { flags: 'a' });
const syngrisiLog = fs.createWriteStream(path.join(CHROMEDRIVER_LOG_DIR, 'syngrisi.log'), { flags: 'a' });

const chromedriverBin = path.join(
    __dirname,
    '..',
    'node_modules',
    '.bin',
    `chromedriver${process.platform === 'win32' ? '.cmd' : ''}`
);

let wdioProcess;
let chromedriverProcess;
let syngrisiProcess;
let shuttingDown = false;

function waitForPort(host, port, timeout = 15000) {
    const deadline = Date.now() + timeout;
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const socket = net.createConnection({ host, port }, () => {
                socket.destroy();
                resolve();
            });
            socket.once('error', () => {
                socket.destroy();
                if (Date.now() > deadline) {
                    reject(new Error(`Port ${host}:${port} did not become available within ${timeout}ms`));
                } else {
                    setTimeout(attempt, 250);
                }
            });
        };
        attempt();
    });
}

function spawnCommand(command, args, options = {}) {
    return spawn(command, args, options);
}

async function ensureMongoReachable() {
    console.log(`[e2e] waiting for local MongoDB at ${MONGO_HOST}:${MONGO_PORT}`);
    await waitForPort(MONGO_HOST, Number(MONGO_PORT), 15000);
}

async function resetSyngrisiDatabase() {
    const client = new MongoClient(SY_DB_URI, { maxPoolSize: 1 });
    try {
        await client.connect();
        console.log(`[e2e] dropping database from ${SY_DB_URI}`);
        await client.db().dropDatabase();
    } finally {
        await client.close();
    }
}

function clearSnapshotsImages() {
    const snapshotsDir = path.resolve(process.cwd(), '.snapshots-images');
    if (fs.existsSync(snapshotsDir)) {
        fs.rmSync(snapshotsDir, { recursive: true, force: true });
        console.log(`[e2e] removed stale snapshots directory ${snapshotsDir}`);
    }
}

function startSyngrisiServer() {
    return new Promise((resolve, reject) => {
        const env = {
            ...process.env,
            SYNGRISI_HOST: SY_HOST,
            SYNGRISI_PORT: SY_PORT,
            SYNGRISI_DB_URI: SY_DB_URI,
            SYNGRISI_API_KEY: SY_API_KEY,
            SYNGRISI_TEST_MODE: 'true',
            SYNGRISI_ENABLE_SCHEDULERS_IN_TEST_MODE: 'true',
            PORT: SY_PORT,
            SYNGRISI_APP_PORT: SY_PORT,
        };
        const proc = spawnCommand('npx', ['@syngrisi/syngrisi', 'start'], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        syngrisiProcess = proc;
        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
        proc.stdout.pipe(syngrisiLog);
        proc.stderr.pipe(syngrisiLog);

        const timeout = setTimeout(() => {
            reject(new Error('Syngrisi server did not report readiness in time'));
        }, 20000);

        const onData = () => {
            clearTimeout(timeout);
            proc.stdout.off('data', onData);
            proc.stderr.off('data', onData);
            resolve(proc);
        };

        const watchForReady = (chunk) => {
            const text = chunk.toString();
            if (text.includes('Syngrisi version')) {
                onData();
            }
        };

        proc.stdout.on('data', watchForReady);
        proc.stderr.on('data', watchForReady);
        proc.once('error', reject);
        proc.once('exit', (code) => {
            clearTimeout(timeout);
            reject(new Error(`Syngrisi process exited (${code}) before ready`));
        });
    });
}

function startChromedriver() {
    const chromedriver = spawnCommand(chromedriverBin, [`--port=${CHROMEDRIVER_PORT}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    chromedriver.stdout.pipe(process.stdout);
    chromedriver.stderr.pipe(process.stderr);
    chromedriver.stdout.pipe(chromedriverLog);
    chromedriver.stderr.pipe(chromedriverLog);

    const readyPatterns = [/Starting ChromeDriver/, /ChromeDriver was started successfully/];

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('chromedriver did not become ready in time'));
        }, 15000);

        const onData = (chunk) => {
            const text = String(chunk);
            if (readyPatterns.some((pattern) => pattern.test(text))) {
                clearTimeout(timeout);
                chromedriver.stdout.off('data', onData);
                chromedriver.stderr.off('data', onData);
                resolve(chromedriver);
            }
        };

        chromedriver.stdout.on('data', onData);
        chromedriver.stderr.on('data', onData);
        chromedriver.once('error', reject);
        chromedriver.once('exit', (code) => reject(new Error(`chromedriver exited (${code}) before ready`)));
    });
}

function compileService() {
    const compile = spawnCommand('npm', ['run', 'compile'], {
        stdio: 'inherit',
    });
    return once(compile, 'close').then(([code]) => {
        if (code !== 0) {
            throw new Error('compile script failed');
        }
    });
}

async function cleanup(exitCode = 0) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    if (wdioProcess && !wdioProcess.killed) {
        wdioProcess.kill('SIGINT');
    }
    if (chromedriverProcess && !chromedriverProcess.killed) {
        chromedriverProcess.kill('SIGINT');
    }
    if (syngrisiProcess && !syngrisiProcess.killed) {
        syngrisiProcess.kill('SIGINT');
    }
    chromedriverLog.end();
    syngrisiLog.end();
    process.exit(exitCode);
}

process.on('SIGINT', () => cleanup(130));
process.on('SIGTERM', () => cleanup(0));
process.on('uncaughtException', (err) => {
    console.error('[e2e] uncaught exception', err);
    cleanup(1);
});

async function startWDIO() {
    const env = {
        ...process.env,
        CHROMEDRIVER_PORT: CHROMEDRIVER_PORT,
        SYNGRISI_HOST: SY_HOST,
        SYNGRISI_PORT: SY_PORT,
        SYNGRISI_API_KEY: SY_API_KEY,
        SY_PROJECT,
        SY_BRANCH,
        SY_RUN_NAME,
        SY_RUN_IDENT,
        SY_EXCLUDE_TAG,
        BASE_URL: process.env.BASE_URL || 'https://example.com',
    };
    wdioProcess = spawnCommand('npx', ['wdio', 'run', WDIO_CONFIG], {
        stdio: 'inherit',
        env,
    });

    wdioProcess.once('close', (code) => cleanup(code ?? 0));
    wdioProcess.once('error', (err) => {
        console.error('[e2e] WDIO failed', err);
        cleanup(1);
    });
}

async function main() {
    try {
        await compileService();
    } catch (err) {
        console.error('[e2e] Service compilation failed', err);
        cleanup(1);
        return;
    }

    try {
        await ensureMongoReachable();
    } catch (err) {
        console.error('[e2e] MongoDB is not reachable locally', err);
        cleanup(1);
        return;
    }

    try {
        await resetSyngrisiDatabase();
        clearSnapshotsImages();
    } catch (err) {
        console.error('[e2e] Failed to reset Syngrisi state', err);
        cleanup(1);
        return;
    }

    try {
        syngrisiProcess = await startSyngrisiServer();
    } catch (err) {
        console.error('[e2e] Failed to start Syngrisi server', err);
        cleanup(1);
        return;
    }

    try {
        await waitForPort('localhost', Number(SY_PORT), 20000);
    } catch (err) {
        console.error('[e2e] Syngrisi port unavailable', err);
        cleanup(1);
        return;
    }

    try {
        chromedriverProcess = await startChromedriver();
    } catch (err) {
        console.error('[e2e] Failed to start chromedriver', err);
        cleanup(1);
        return;
    }

    await startWDIO();
}

main().catch((err) => {
    console.error('[e2e] Unexpected error', err);
    cleanup(1);
});
