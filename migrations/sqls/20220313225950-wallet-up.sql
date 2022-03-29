/* Replace with your SQL commands */
CREATE TABLE `wallet` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(36) NOT NULL DEFAULT '',
  `userId` varchar(36) NOT NULL DEFAULT '',
  `userPw` varchar(100) NOT NULL DEFAULT '',
  `walletAddr` varchar(100) NOT NULL DEFAULT '',
  `privateKey` varchar(100) NOT NULL DEFAULT '',
  `created` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,

  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

