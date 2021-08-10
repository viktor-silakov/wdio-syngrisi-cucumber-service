import logger from '@wdio/logger';
import faker from 'faker';

const log = logger('wdio-syngrisi-cucumber-service')

export default class SyngrisiLaunchService {
    constructor(serviceOptions, capabilities, config) {
    }

    async onPrepare(config, capabilities) {
        // use env to share variables between this "launch" service and "worker" service
        log.debug('generate run name and ident')
        process.env['SYNGRISY_RUN_NAME'] = this.generateRunName();
        process.env['SYNGRISY_RUN_INDENT'] = this.generateRunIdent();
        log.debug(`runname: '${process.env['SYNGRISY_RUN_NAME']}'`);
        log.debug(`runident: '${process.env['SYNGRISY_RUN_INDENT']}'`);
    }

    generateRunName(runName = faker.lorem.slug(5) + '_' + faker.datatype.uuid()) {
        return faker.lorem.sentence(4)
            .replace('.', '');
    }

    generateRunIdent() {
        return faker.datatype.uuid();
    }
}
