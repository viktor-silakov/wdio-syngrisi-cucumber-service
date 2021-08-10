import logger from '@wdio/logger'

const log = logger('wdio-syngrisi-cucumber-service');


export default class SyngrisiCucumberService {
    constructor(serviceOptions, capabilities, config) {
        this.options = serviceOptions
        log.debug(`init the syngrisi driver with options: ${JSON.stringify(this.options)}`)
        const syngrisi = require('@syngrisi/syngrisi-wdio-sdk');
        this.vDriver = new syngrisi.syngrisiDriver({ url: this.options.endpoint });
    }

    /**
     * this browser object is passed in here for the first time
     */
    before(config, spec, browser) {
        this.browser = browser;
    }

    after(exitCode, config, capabilities) {
    }

    beforeTest(test, context) {
        // TODO: something before each Mocha/Jasmine test run
    }

    beforeScenario(world) {
        const feature = world.gherkinDocument.feature;
        const scenario = world.pickle;
        if (this.options.tag && !scenario.tags.map((x) => x.name).includes(this.options.tag)) {
            log.debug(`beforeScenario: the option tag for visual scenario is not empty (${this.options.tag}), but scenario is not contains such tags`);
            return;
        }
        const params = {
            app: this.options.app,
            branch: this.options.branch,
            tags: scenario.tags ? scenario.tags.map(x => x.name) : [],
            test: scenario.name,
            suite: feature.name,
            run: this.options.runname || process.env['SYNGRISY_RUN_NAME'],
            runident: this.options.runident || process.env['SYNGRISY_RUN_INDENT'],
        }
        log.debug(`start syngrisi session with params: '${JSON.stringify(params)}', apikey: ${this.options.apikey}`);

        this.vDriver.startTestSession(params, this.options.apikey);

        const $this = this;
        this.browser.addCommand('syngrisiCheck', async function (checkName, imageBuffer, domDump = null) {
            return $this.vDriver.checkSnapshoot(checkName, imageBuffer, domDump, $this.options.apikey);
        })
    }

    afterScenario(world, result) {
        const scenario = world.pickle;
        if (this.options.tag && !scenario.tags.map((x) => x.name).includes(this.options.tag)) {
            log.debug(`afterScenario: the option tag for visual scenario is not empty (${this.options.tag}), but scenario is not contains such tags`);
            return;
        }
        log.debug(`stop session with api key: '${this.options.apikey}'`);
        this.vDriver.stopTestSession(this.options.apikey);
    }
}
