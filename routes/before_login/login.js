// ---------------------------------------------------------
// LOGIN (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------

module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();
	var jwt = require('jsonwebtoken');
	var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

	// http://localhost:1234/api/login
	rootRouter.post('/login', function(req, res) {
		console.log('/login: ' + req.body.email_login);

		var email_login = req.body.email_login;
		var password 	= req.body.password;

		// Validate email_login
		if (!(utils.chkObj(email_login)) || !(utils.validateEmail(email_login)))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_email,[]));
			return;
		}

		// Validate password
		if (!(utils.chkObj(password))) {
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_password,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
				return;
			}
			connection.query({
				sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
				timeout: 2000, // 2s
				values: [email_login]
			}, function(error, results, fields) {

				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.release();
					return;
				}

				if (results == null || results.length == 0) {
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_email,[]));
				} else {
					// found username -> check if password matches
					if (utils.isExactPass(password,results[0]['password']) == false) {
						res.status(400).send(utils.responseConvention(errcode.code_not_match_password,[]));
					} else { // match -> create token
						var account_data = results[0];
						// Get profile
						connection.query({
							sql: 'SELECT * FROM `profile` WHERE `account_id` = ?',
							timeout: 2000, // 2s
							values: [results[0]['account_id']]
						}, function(error, results, fields) {
							connection.release();
							if (error) {
								res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
								return;
							}
							var tokenData = {
								'account': account_data,
								'profile': results[0]

							}

							var token = jwt.sign(tokenData, config.super_secret, {
								expiresIn: 86400 // expires in 24 hours
							});

							res.json({
								status: errcode.code_success,
								message: errcode.errorMessage(errcode.code_success),
								data: account_data,
								token: token
							});
						});
					}
				}
			});
		});
	});
};
