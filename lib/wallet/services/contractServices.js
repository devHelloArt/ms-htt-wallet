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
const { TxHistoryApi } = require("caver-js-ext-kas/src/rest-client");

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
        const number = new Number(initialSupply);
        return this.parseUnit(number.toLocaleString('fullwide', { useGrouping: false }), -18);
    }

    async symbol() {
        return await this.KIP7Cont.symbol();
    }

    async balanceOf(address) {
        const balance = await this.KIP7Cont.balanceOf(address);
        const number = new Number(balance);
        return this.parseUnit(number.toLocaleString('fullwide', { useGrouping: false }), -18);
    }

    async createAccount(userId, userPw, authenticate) {
        return await this.cav.klay.accounts.create(userId, userPw, authenticate);
    }

    async setAccount(pk) {
        const tAcnt = await this.cav.klay.accounts.privateKeyToAccount(pk);
        const account = this.cav.klay.accounts.wallet.getAccount(tAcnt.address);

        if (account == undefined) {
            this.cav.klay.accounts.wallet.add(pk);
            return true;
        }

        return false;
    }

    async getAccount(pk) {
        const tAcnt = await this.cav.klay.accounts.privateKeyToAccount(pk);
        let account = this.cav.klay.accounts.wallet.getAccount(tAcnt.address);

        if (account == undefined) {
            await this.setAccount(pk);
            account = this.cav.klay.accounts.wallet.getAccount(tAcnt.address);
        }
        return account;
    }

    async isLocked(address) {
        return await this.contract.methods.lockedList(address).call();
    }

    approve(acnt, toAddr, amount) {
        const cAmt = this.parseUnit(amount, 18);
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(
                async function(currentAttempt) {
                    log.info(`Attemp: ${currentAttempt}`);
                    const encodedAbi = await this.contract.methods
                        .approve(toAddr, cAmt)
                        .encodeABI();

                    const { rawTransaction: senderRawTransaction } =
                    await this.cav.klay.accounts.signTransaction({
                            type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
                            from: acnt.address,
                            to: this.httAddr,
                            data: encodedAbi,
                            gas: this.GAS_LIMIT,
                            value: 0,
                            // gasPrice: gasPriceMore.numberToHex(),
                        },
                        acnt.privateKey
                    );

                    const feePayerAcnt = await this.getAccount(
                        process.env.FEE_DELEGATE_PRIV_KEY
                    );

                    this.cav.klay
                        .sendTransaction({
                            senderRawTransaction: senderRawTransaction,
                            feePayer: feePayerAcnt.address,
                        })
                        .then((receipt) => {
                            resolve(receipt);
                        })
                        .catch((error) => {
                            log.error(error.message);
                            if (operation.retry(error)) {
                                return;
                            }
                        });
                }.bind(this)
            );
        });
    }

    transfer(ownerAcnt, toAddr, amount) {
        const cAmt = this.parseUnit(amount, 18);
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(
                async function(currentAttempt) {
                    log.info(`Attemp: ${currentAttempt}`);
                    const encodedAbi = await this.contract.methods
                        .transfer(toAddr, cAmt)
                        .encodeABI();

                    const { rawTransaction: senderRawTransaction } =
                    await this.cav.klay.accounts.signTransaction({
                            type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
                            from: ownerAcnt.address,
                            to: this.httAddr,
                            data: encodedAbi,
                            gas: this.GAS_LIMIT,
                            value: 0,
                            // gasPrice: gasPriceMore.numberToHex(),
                        },
                        ownerAcnt.privateKey
                    );

                    const feePayerAcnt = await this.getAccount(
                        process.env.FEE_DELEGATE_PRIV_KEY
                    );

                    this.cav.klay
                        .sendTransaction({
                            senderRawTransaction: senderRawTransaction,
                            feePayer: feePayerAcnt.address,
                        })
                        .then((receipt) => {
                            resolve(receipt);
                        })
                        .catch((error) => {
                            log.error(error.message);
                            if (operation.retry(error)) {
                                return;
                            }
                        });
                }.bind(this)
            );
        });
    }

    transferFrom(fromAcnt, fromAddr, toAddr, amount) {
        const cAmt = this.parseUnit(amount, 18);
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(
                async function(currentAttempt) {
                    log.info(`Attemp: ${currentAttempt}`);
                    const encodedAbi = await this.contract.methods
                        .transferFrom(fromAddr, toAddr, cAmt)
                        .encodeABI();

                    const { rawTransaction: senderRawTransaction } =
                    await this.cav.klay.accounts.signTransaction({
                            type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
                            from: fromAcnt.address,
                            to: this.httAddr,
                            data: encodedAbi,
                            gas: this.GAS_LIMIT,
                            value: 0,
                            // gasPrice: gasPriceMore.numberToHex(),
                        },
                        fromAcnt.privateKey
                    );

                    const feePayerAcnt = await this.getAccount(
                        process.env.FEE_DELEGATE_PRIV_KEY
                    );

                    this.cav.klay
                        .sendTransaction({
                            senderRawTransaction: senderRawTransaction,
                            feePayer: feePayerAcnt.address,
                        })
                        .then((receipt) => {
                            resolve(receipt);
                        })
                        .catch((error) => {
                            log.error(error.message);
                            if (operation.retry(error)) {
                                return;
                            }
                        });
                }.bind(this)
            );
        });
    }

    lockWallet(targetAddress) {
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(
                async function(currentAttempt) {
                    const isLocked = await this.isLocked(targetAddress);
                    if (isLocked == false) {
                        const ownerAcnt = await this.getAccount(process.env.OWNER_PRIV_KEY);

                        const encodedAbi = await this.contract.methods
                            .SetLockAddress(targetAddress)
                            .encodeABI();

                        const { rawTransaction: senderRawTransaction } =
                        await this.cav.klay.accounts.signTransaction({
                                type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
                                from: ownerAcnt.address,
                                to: this.httAddr,
                                data: encodedAbi,
                                gas: this.GAS_LIMIT,
                                value: 0,
                                // gasPrice: gasPriceMore.numberToHex(),
                            },
                            ownerAcnt.privateKey
                        );

                        const feePayerAcnt = await this.getAccount(
                            process.env.FEE_DELEGATE_PRIV_KEY
                        );

                        this.cav.klay
                            .sendTransaction({
                                senderRawTransaction: senderRawTransaction,
                                feePayer: feePayerAcnt.address,
                            })
                            .then((receipt) => {
                                resolve(receipt);
                            })
                            .catch((error) => {
                                log.error(error.message);
                                if (operation.retry(error)) {
                                    return;
                                }
                            });
                    } else {
                        resolve(undefined);
                    }
                }.bind(this)
            );
        });
    }

    unlockWallet(targetAddr) {
        const operation = retry.operation();
        return new Promise((resolve, reject) => {
            operation.attempt(
                async function(currentAttempt) {
                    const isLocked = await this.isLocked(targetAddr);
                    if (isLocked == true) {
                        const ownerAcnt = await this.getAccount(process.env.OWNER_PRIV_KEY);
                        log.info(`Owner Load Done`);
                        log.info(`targetAddr : ${targetAddr}`);
                        const encodedAbi = await this.contract.methods
                            .UnLockAddress(targetAddr)
                            .encodeABI();
                        log.info(`Encoded Done`);

                        const { rawTransaction: senderRawTransaction } =
                        await this.cav.klay.accounts.signTransaction({
                                type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
                                from: ownerAcnt.address,
                                to: this.httAddr,
                                data: encodedAbi,
                                gas: this.GAS_LIMIT,
                                value: 0,
                                // gasPrice: gasPriceMore.numberToHex(),
                            },
                            ownerAcnt.privateKey
                        );

                        const feePayerAcnt = await this.getAccount(
                            process.env.FEE_DELEGATE_PRIV_KEY
                        );

                        this.cav.klay
                            .sendTransaction({
                                senderRawTransaction: senderRawTransaction,
                                feePayer: feePayerAcnt.address,
                            })
                            .then((receipt) => {
                                resolve(receipt);
                            })
                            .catch((error) => {
                                log.error(error.message);
                                if (operation.retry(error)) {
                                    return;
                                }
                            });
                    } else {
                        resolve(undefined);
                    }
                }.bind(this)
            );
        });
    }

    parseUnit(amount, decimal) {
        const result =
            decimal > 0 ?
            this.cav.utils
            .toBN(10 ** decimal)
            .mul(this.cav.utils.toBN(Math.floor(amount)))
            .toString() :
            this.cav.utils
            .toBN(amount)
            .div(this.cav.utils.toBN(10 ** -decimal))
            .toString();

        return result;
    }
}

module.exports = ContractService;