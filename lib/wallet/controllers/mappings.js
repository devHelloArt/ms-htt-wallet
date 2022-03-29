const { spieler, check, matchedData, sanitize } = require('spieler')();

const router = require('express').Router({ mergeParams: true });
const actions = require('./actions');

const log = require("metalogger")();

const addUserValidator = spieler([

    check('password', 'passwords must be at least 5 chars long and contain one number')
    .exists()
    .isLength({ min: 5 })
    .matches(/\d/)
]);

router.get('/', actions.getWallet);
router.post('/create_account', actions.createAccount);
router.get('/balanceof', actions.balanceof);

router.post("/transferAdmin", actions.transferAdmin);
router.post("/lockWallet", actions.lockWallet);

module.exports = router;