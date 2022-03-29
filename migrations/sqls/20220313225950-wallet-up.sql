/* Replace with your SQL commands */

ALTER TABLE `wallet` ADD `userId` varchar(36) NOT NULL DEFAULT '';
ALTER TABLE `wallet` ADD `userPw` varchar(100) NOT NULL DEFAULT '';
ALTER TABLE `wallet` ADD `walletAddr` varchar(100) NOT NULL DEFAULT '';
ALTER TABLE `wallet` ADD `privateKey` varchar(100) NOT NULL DEFAULT '';
