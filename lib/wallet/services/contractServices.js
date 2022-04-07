/* jshint -W079 */
const Promise = require("bluebird"),
    config = require("config"),
    log = require("metalogger")(),
    representor = require("kokua"),
    _ = require("lodash");

const { reject } = require("bluebird");
const Caver = require("caver-js");
const retry = require("retry");
const delay = require("delay");

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
        this.KIP7Cont = new this.cav.klay.KIP7(this.httAddr);
        this.contract = new this.cav.klay.Contract(httAbi, this.httAddr);
    }

    async totalSupply() {
        const initialSupply = await this.KIP7Cont.totalSupply();
        return this.parseUnit(initialSupply, -18);
    }

    async symbol() {
        return await this.KIP7Cont.symbol();
    }

    async balanceOf(address) {
        const balance = await this.KIP7Cont.balanceOf(address);
        return this.parseUnit(balance, -18);
    }

    async createAccount(userId, userPw, authenticate) {
        return await this.cav.klay.accounts.create(
            userId,
            userPw,
            authenticate
        );
    }

    async getAccount(pk) {
        const tAcnt = await this.cav.klay.accounts.privateKeyToAccount(pk);
        const account = this.cav.klay.accounts.wallet.getAccount(tAcnt.address);

        if (account == undefined) {
            const wallet = this.cav.klay.accounts.wallet.add(pk);
            return wallet;
        }
        return account;
    }

    async isLocked(address) {
        return await this.contract.methods.lockedList(address).call();
    }

    transfer(ownerAcnt, toAddr, amount) {
        const cAmt = this.parseUnit(amount, 18);
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(function(currentAttempt) {
                log.info(`Attemp: ${currentAttempt}`);
                this.KIP7Cont.transfer(toAddr, cAmt, { from: ownerAcnt.address })
                    .then((receipt) => {
                        log.info(`Resolved`);
                        resolve(receipt);
                    }).catch((error) => {
                        log.error(error.message);
                        if (operation.retry(error)) {
                            return;
                        }
                    });
            }.bind(this));
        });
    }

    lockWallet(ownerAccount, targetAddress) {
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(async function(currentAttempt) {
                const isLocked = await this.isLocked(targetAddress);
                if (isLocked == false) {
                    const encodedAbi = await this.contract.methods
                        .SetLockAddress(targetAddress)
                        .encodeABI();
                    this.cav.klay.sendTransaction({
                            type: "SMART_CONTRACT_EXECUTION",
                            from: ownerAccount.address,
                            to: this.httAddr,
                            data: encodedAbi,
                            gas: this.GAS_LIMIT,
                            value: 0
                                // gasPrice: gasPriceMore.numberToHex(),
                        },
                        ownerAccount.privateKey
                    ).then((receipt) => {
                        resolve(receipt);
                    }).catch((error) => {
                        log.error(error.message);
                        if (operation.retry(error)) {
                            return;
                        }
                    });
                } else {
                    resolve(undefined);
                }
            }.bind(this));
        });
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