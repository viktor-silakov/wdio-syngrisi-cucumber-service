/* eslint-disable require-jsdoc */
const syngrisi = require('@syngrisi/wdio-sdk');

// Provides a single place to instantiate the Syngrisi WDIODriver,
// making the dependency easier to mock during tests.
export default function createSyngrisiDriver(driverOptions) {
    return new syngrisi.WDIODriver(driverOptions);
}
