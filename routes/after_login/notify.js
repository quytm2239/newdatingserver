// ---------------------------------------------------------
// DEVICE TOKEN (this is authenticated)
// ---------------------------------------------------------

module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();

    var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

    rootRouter.post('/deviceToken', function(req, res) {
        // get account_id from request.token
    	var account_id = req.decoded['account']['account_id'];
        var profile_id = req.decoded['profile']['profile_id'];
    	var device_token = req.body.device_token;

    	if (utils.chkObj(device_token) == false) {
    		res.status(400).send(utils.responseConvention(errcode.code_null_invalid_device_token,[]));
    		return;
    	}

    	pool.getConnection(function(err, connection) {
    		if (err) {
    			res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
    			return;
    		}
    		//------------------------ CHANGE PASSWORD -----------------------------
    		connection.query({
    			sql: 'SELECT * FROM `notification` WHERE `device_token` = ?',
    			timeout: 1000, // 1s
    			values: [device_token]
    		}, function(error, results, fields) {

                if (error) {
                    res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
                    connection.release();
                    return;
                }

    			if (utils.chkObj(results) == false) { // Not found -> INSERT
    				connection.release();
                    connection.query({
                        sql: 'INSERT INTO `notification`(`account_id`,`profile_id`,`device_token`)'
                            + 'VALUES (?,?,?)',
                        timeout: 1000, // 1s
                        values: [account_id,profile_id,device_token]
                    }, function (error, results, fields) {
                        connection.release();
                        if (error) {
                            res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
                        } else {
                            res.status(200).send(utils.responseConvention(errcode.code_success,[]));
                        }
                    });
    			} else { // Found update -> UPDATE
    				connection.query({
    					sql: 'UPDATE `notification` SET `device_token`= ? WHERE `account_id` = ?',
    					timeout: 1000, // 1s
    					values: [device_token, account_id]
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
