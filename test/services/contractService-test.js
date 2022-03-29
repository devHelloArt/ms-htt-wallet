const request = require("supertest");
const assert = require("chai").assert;
const sinon = require("sinon");
const fh = require("../support/fixture-helper.js");
const log = require("metalogger")();

const ContractService = require("wallet/services/contractServices");

describe("contract service test", () => {
    const testService = new ContractService();
    const testPk =
        "0xf93f24d688b3df3a6192194fb82b2010fce5d31e2a5dff16b86c0e549cce41db";
    const testAddrs = [
        "0x5b7171534bd972951cf39ba93e49f88595e508ff",
        "0xfef53d325656d035042c72c2b60e322f923dbc62",
        "0x3dc7ec9ef47703663f28c31727c1068bcf19db37",
        "0xb7edab3d97f6cf656fe989f4918c36bd30aa6662",
    ];

    it("Contract Service Check Initial Supply", async() => {
        assert.equal(
            await testService.balanceOf("0x119a593af04a29ed65aa334c1deb8ed5ad188e2d"),
            20000000000
        );
    });

    it("Contract Service - Transfer Token Test", async(done) => {
        const testOwner = testService.getAccount(testPk);
        const testToAddr = testAddrs[0];
        const testAmountOfToken = 500;

        const beforeBalance = await testService.balanceOf(testToAddr);
        await testService.transfer(testOwner, testToAddr, testAmountOfToken);
        const afterBalance = await testService.balanceOf(testToAddr);

        assert.equal(
            500,
            beforeBalance + testAmountOfToken,
            `Balance is not equeal Result : ${afterBalance}, Before : ${beforeBalance}`
        );
        done();
    });
});