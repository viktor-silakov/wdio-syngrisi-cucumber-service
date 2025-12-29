import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import utils from '../src/utils.js';

const startTestSessionMock = vi.fn();
const checkMock = vi.fn();
const getBaselinesMock = vi.fn();
const stopTestSessionMock = vi.fn();
const createDriverMock = vi.fn(() => ({
    startTestSession: startTestSessionMock,
    check: checkMock,
    getBaselines: getBaselinesMock,
    stopTestSession: stopTestSessionMock,
}));

vi.mock('../src/syngrisi-driver-factory.js', () => ({
    __esModule: true,
    default: createDriverMock,
}));

const { default: SyngrisiCucumberService } = await import('../src/syngrisi-service.js');
const { default: SyngrisiLaunchService } = await import('../src/syngrisi-launch-service.js');

describe('SyngrisiLaunchService - WDIO 9.6.0 onPrepare + @syngrisi/syngrisi@3.1.3 contract', () => {
    let runNameSpy;
    let runIdentSpy;

    beforeEach(() => {
        runNameSpy = vi.spyOn(utils, 'generateRunName');
        runIdentSpy = vi.spyOn(utils, 'generateRunIdent');
    });

    afterEach(() => {
        runNameSpy.mockRestore();
        runIdentSpy.mockRestore();
        delete process.env.SYNGRISY_RUN_NAME;
        delete process.env.SYNGRISY_RUN_INDENT;
    });

    it('exposes WDIO 9.6.0 onPrepare hook that seeds env vars expected by @syngrisi/syngrisi@3.1.3', async () => {
        runNameSpy.mockReturnValue('wdio-9.6-run');
        runIdentSpy.mockReturnValue('wdio-9.6-ident');

        const launchService = new SyngrisiLaunchService({}, [], {});
        await launchService.onPrepare({}, []);

        expect(runNameSpy).toHaveBeenCalledTimes(1);
        expect(runIdentSpy).toHaveBeenCalledTimes(1);
        expect(process.env.SYNGRISY_RUN_NAME).toBe('wdio-9.6-run');
        expect(process.env.SYNGRISY_RUN_INDENT).toBe('wdio-9.6-ident');
    });
});

describe('SyngrisiCucumberService integration with WDIO 9.6.0 + @syngrisi/syngrisi@3.1.3 API', () => {
    let browserCommands;
    let browserStub;

    beforeEach(() => {
        createDriverMock.mockClear();
        startTestSessionMock.mockReset().mockResolvedValue({ _id: 'session-id' });
        checkMock.mockReset().mockResolvedValue({
            status: 'passed',
            _id: 'check-id',
            actualSnapshotId: 'baseline-id',
        });
        getBaselinesMock.mockReset().mockResolvedValue({ results: [] });
        stopTestSessionMock.mockReset().mockResolvedValue(undefined);

        browserCommands = {};
        browserStub = {
            addCommand: vi.fn((name, fn) => {
                browserCommands[name] = fn;
            }),
        };
        global.browser = browserStub;
    });

    afterEach(() => {
        delete global.browser;
        delete process.env.SYNGRISY_RUN_NAME;
        delete process.env.SYNGRISY_RUN_INDENT;
        browserCommands = {};
    });

    it('registers WDIO 9.6.0-style commands and opens a Syngrisi session matching @syngrisi/syngrisi@3.1.3 params', async () => {
        const serviceOptions = {
            endpoint: 'https://syngrisi.example/',
            apikey: 'sekret',
            app: 'My App',
            project: 'My App',
            branch: 'main',
            runname: 'WDIO_Run',
            runident: 'WDIO_IDENT',
        };

        const service = new SyngrisiCucumberService(serviceOptions, {}, {});
        const world = {
            gherkinDocument: { feature: { name: 'Feature 1' } },
            pickle: { name: 'Scenario 1', tags: [{ name: '@visual' }] },
        };

        await service.beforeScenario(world);

        expect(createDriverMock).toHaveBeenCalledTimes(1);
        expect(startTestSessionMock).toHaveBeenCalledTimes(1);
        const [sessionArg] = startTestSessionMock.mock.calls[0];
        expect(sessionArg.params.app).toBe('My App');
        expect(sessionArg.params.branch).toBe('main');
        expect(sessionArg.params.test).toBe('Scenario 1');
        expect(sessionArg.params.run).toBe('WDIO_Run');
        expect(sessionArg.params.runident).toBe('WDIO_IDENT');
        expect(sessionArg.params.tags).toEqual(['@visual']);
        expect(browserStub.addCommand).toHaveBeenCalledTimes(2);

        await browserCommands.syngrisiCheck('check-foo', Buffer.from('abc'), { viewport: '1024x768' }, null);
        expect(checkMock).toHaveBeenCalledTimes(1);
        expect(checkMock.mock.calls[0][0]).toMatchObject({
            checkName: 'check-foo',
            params: { viewport: '1024x768' },
        });
    });

    it('syngrisiIsBaselineExist returns hashes consistent with @syngrisi/syngrisi@3.1.3 baseline schema', async () => {
        const service = new SyngrisiCucumberService({
            endpoint: 'https://syngrisi.example/',
            apikey: 'sec',
            project: 'Project',
            branch: 'develop',
        }, {}, {});

        process.env.SYNGRISY_RUN_NAME = 'env-run';
        process.env.SYNGRISY_RUN_INDENT = 'env-ident';
        const world = {
            gherkinDocument: { feature: { name: 'Some feature' } },
            pickle: { name: 'Scenario 2', tags: [] },
        };
        await service.beforeScenario(world);

        const screenshot = Buffer.from('image-bytes');
        const expectedHash = createHash('sha512').update(screenshot).digest('hex');
        getBaselinesMock.mockResolvedValue({
            results: [
                { imghash: expectedHash, name: 'Scenario 2' },
            ],
        });

        const response = await browserCommands.syngrisiIsBaselineExist('Scenario 2', screenshot, { branch: 'develop' });
        expect(getBaselinesMock).toHaveBeenCalledWith({
            params: expect.objectContaining({
                name: 'Scenario 2',
                branch: 'develop',
            }),
        });
        expect(response.exists).toBe(true);
        expect(response.results[0].imghash).toBe(expectedHash);

        await service.afterScenario({ pickle: { name: 'Scenario 2', tags: [] } });
        expect(stopTestSessionMock).toHaveBeenCalledTimes(1);
    });
});
