// ---------------------------------------------------------
// CHANGE PASSWORD (this is authenticated)
// ---------------------------------------------------------

module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();

    var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

    rootRouter.put('/changePass', function(req, res) {

    	var old_password = req.body.old_password;
    	var new_password = req.body.new_password;

    	if (!(utils.chkObj(old_password)) || !(utils.chkObj(new_password))) {
    		res.status(400).send(utils.responseConvention(errcode.code_null_invalid_password,[]));
    		return;
    	}

    	// get account_id from request.token
    	var account_id = req.decoded['account']['account_id'];

    	pool.getConnection(function(err, connection) {
    		if (err) {
    			res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
    			return;
    		}
    		//------------------------ CHANGE PASSWORD -----------------------------
    		connection.query({
    			sql: 'SELECT * FROM `account` WHERE `account_id` = ?',
    			timeout: 1000, // 1s
    			values: [account_id]
    		}, function(error, results, fields) {
    			if (utils.isExactPass(old_password,results[0]['password']) == false) { // old_password does not match
    				connection.release();
    				res.status(400).send(utils.responseConvention(errcode.code_wrong_old_password,[]));
    			} else { // Old_password matched -> update new pass
    				connection.query({
    					sql: 'UPDATE `account` SET `password`= ? WHERE `account_id` = ?',
    					timeout: 1000, // 1s
    					values: [utils.hashPass(new_password), account_id]
    				}, function (error, results, fields) {
    					connection.release();
    					if (error) {
    						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
    					} else {
    						res.status(200).send(utils.responseConvention(errcode.code_success,[]));
    					}
    				});
    			}
    		});
    	});
    });

};
