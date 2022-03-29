/* jshint -W079 */
const Promise = require("bluebird"),
    config = require("config"),
    log = require("metalogger")(),
    representor = require("kokua"),
    _ = require("lodash");

const { reject } = require("bluebird");
const Caver = require("caver-js");
const retry = require("retry");

// const socket = require("./socket");

class ContractService {
    constructor() {
        const AUTH_INFO = {
            accessKeyId: process.env.KAS_ACCESSKEY,
            secretAccessKey: process.env.KAS_ACCESSSECRET,
        };

        const option = {
            headers: [{
                    name: "Authorization",
                    value: "Basic " +
                        Buffer.from(
                            AUTH_INFO.accessKeyId + ":" + AUTH_INFO.secretAccessKey
                        ).toString("base64"),
                },
                {
                    name: "x-chain-id",
                    value: process.env.NODE_ENV === "production" ? "8217" : "1001",
                },
            ],
        };

        const httAbi = require("../constants/httContract");
        this.httAddr =
            process.env.NODE_ENV === "production" ?
            "0x001530b5e17e81a66d1e8d0c924f68ab794fcd9d" :
            "0xc2e8f25a7220521c220caf98b8e846ab746f53a8";

        this.cav = new Caver(
            new Caver.providers.HttpProvider(
                "https://node-api.klaytnapi.com/v1/klaytn",
                option
            )
        );
        this.GAS_LIMIT = 3000000;
        this.contract = new this.cav.klay.Contract(httAbi, this.httAddr);
    }

    async balanceOf(address) {
        const balance = await this.contract.methods.balanceOf(address).call();
        return this.parseUnit(balance, -18);
    }

    async getAccount(pk) {
        return await this.cav.klay.accounts.privateKeyToAccount(pk);
    }

    async isLocked(address) {
        return await this.contract.methods.lockedList(address).call();
    }

    async getTransferAbi(toAddr, amount) {
        return await this.contract.methods.transfer(toAddr, amount).encodeABI();
    }

    async transfer(ownerAcnt, toAddr, amount) {
        const encodeABI = this.getTransferAbi(toAddr, this.parseUnit(amount, 18));
        return await this.sendTxByFeeDeligator(ownerAcnt, encodeABI);
    }

    async sendTxByFeeDeligator(ownerAcnt, encodedAbi) {
        const operation = retry.operation();

        return new Promise((resolve, reject) => {
            operation.attempt(async function(currentAttempt) {
                let nonce = await this.cav.klay.getTransactionCount(ownerAcnt.address);

                const signedTx = await this.cav.klay.accounts.signTransaction({
                        type: "SMART_CONTRACT_EXECUTION",
                        from: ownerAcnt.address,
                        to: this.httAddr,
                        data: encodedAbi,
                        gas: this.GAS_LIMIT,
                        value: 0,

                        // gasPrice: gasPriceMore.numberToHex(),
                    },
                    ownerAcnt.privateKey
                );
                const result = await this.cav.klay.sendTransaction({
                    senderRawTransaction: signedTx,
                    feePayer: ownerAcnt.address,
                    // legacyKey: true,
                    nonce: nonce++,
                });

                if (result != null) {
                    resolve(result);
                } else {
                    reject(operation.mainError);
                }
            });
        });
    }

    async lockWallet(ownerAccount, targetAddress) {
        if (this.isLocked() == false) {
            const encodedAbi = await this.contract.methods
                .SetLockAddress(targetAddress)
                .encodeABI();
            return await this.sendTxByFeeDeligator(ownerAccount, encodedAbi);
        }

        return undefined;
    }

    parseUnit(amount, decimal) {
        const result =
            decimal > 0 ?
            this.cav.utils
            .toBN(10 ** decimal)
            .mul(this.cav.utils.toBN(Math.floor(amount)))
            .toString() :
            this.cav.utils.toBN(Math.floor(amount / 10 ** -decimal)).toString();
        return result;
    }
}

module.exports = ContractService;