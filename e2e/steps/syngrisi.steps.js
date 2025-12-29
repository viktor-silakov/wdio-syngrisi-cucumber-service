const { Given, When, Then } = require('@wdio/cucumber-framework');

let lastCheckResponse;

Given('I visit the target page', async () => {
    await browser.url('/');
});

When('I send the snapshot named {string}', async (name) => {
    const screenshot = await browser.takeScreenshot();
    const buffer = Buffer.from(screenshot, 'base64');
    lastCheckResponse = await browser.syngrisiCheck(name, buffer, {
        viewport: '1366x768',
        browserName: 'chrome',
    });
});

Then('Syngrisi returns a response with an identifier', () => {
    if (!lastCheckResponse) {
        throw new Error('syngrisiCheck did not return a response');
    }
    if (!lastCheckResponse._id && !lastCheckResponse.id) {
        throw new Error('Syngrisi response is missing identifier fields');
    }
});
