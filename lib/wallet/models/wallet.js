const db = require("datastore");
const log = require('metalogger')();
const Promise = require('bluebird');

class Wallet {

    async getWallet() {
        const conn = await db.conn();
        let wallet = [{}];
        if (conn) {
            wallet = await conn.query('select `uuid`, `last_updated`, `walletAddr` from wallet');
        }
        return wallet;
    }

    async saveWallet(userId, userPw, walletAddr, pk) {
        const conn = await db.conn();

        if (conn) {
            const insertValue = {
                userId: userId,
                userPw: userPw,
                walletAddr: walletAddr,
                privateKey: pk
            };
            await conn.query("INSERT INTO wallet SET ?", insertValue);
        }
        return true;
    }

    async isExistWallet(addr) {
        const conn = await db.conn();
        let wallet = [{}];
        if (conn) {
            wallet = await conn.query(`SELECT count(*) FROM wallet WHERE walletAddr="${addr}"`);
            log.info(`wallet addr: ${addr}: ${wallet[0]['count(*)']}`);
        }

        return wallet[0]['count(*)'] > 0 ? true : false;
    }
}

module.exports = Wallet;