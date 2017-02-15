// ---------------------------------------------------------
// FORGOT (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------

module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();
		var utils = app.get('utils');

	var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

	// http://localhost:1234/api/forgot
	rootRouter.post('/forgot', function(req, res) {

		var email_login = req.body.email_login;

		// Validate email_login
		if (!(utils.chkObj(email_login)) || !(utils.validateEmail(email_login)))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_email,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_email,'Error in database connection',[]));
				return;
			}

			connection.query({
				sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
				timeout: 1000, // 1s
				values: [email_login]
			}, function(error, results, fields) {

				if (results == null || results.length == 0) { // email_login not found
					connection.release();
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_email,[]));
				} else { // found -> update new random password
					var randomPassword = Math.random().toString(36).slice(-8);

					connection.query({
						sql: 'UPDATE `account` '
						+ 'SET `password`= ?'
						+ ' WHERE `account_id` = ?',
						timeout: 1000, // 1s
						values: [utils.hashPass(randomPassword), results[0]['account_id']]
					}, function (error, results, fields) {
						connection.release();
						if (error) {
							res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
						} else {
							utils.sendMailResetPass(email_login,randomPassword);
							res.status(200).send(utils.responseConvention(errcode.code_success,[]));
						}
					});
				}
			});
		});
	});
};
