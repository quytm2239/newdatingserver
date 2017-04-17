// ---------------------------------------------------------
// REGISTER (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------

module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();

	var jwt = require('jsonwebtoken');
	var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

	// http://localhost:1234/api/register
	rootRouter.post('/register', function(req, res) {

		var email_login 	= req.body.email_login;
		var password 		= req.body.password;
		var full_name 		= req.body.full_name;
		var gender 			= req.body.gender;
		var birthday 		= req.body.birthday;
		var province 		= req.body.province;
		var latitude 		= req.body.latitude;
		var longitude 		= req.body.longitude;
		var district 		= req.body.district;
		var country 		= req.body.country;
		var phone 			= req.body.phone;
		var profile_description	= req.body.profile_description;
		var user_status		= req.body.user_status;
		var avatar			= req.body.avatar;

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

		// Validate full_name
		if (!(utils.chkObj(full_name))) {
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_full_name,[]));
			return;
		}

		// Validate gender
		if (!(utils.chkObj(gender)) || isNaN(gender) || gender < 0 || gender > 5) {
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_gender,[]));
			return;
		}

		// Validate birthday
		if (!(utils.chkObj(birthday)) || !(utils.validateBirthday(birthday)))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_birthday,[]));
			return;
		} else {
			if (!(utils.checkAge(birthday))) {
				res.status(400).send(utils.responseConvention(errcode.code_invalid_age,[]));
				return;
			}
		}

		// Validate address
		// if (!(utils.chkObj(province)))
		// {
		// 	res.status(400).send(utils.responseConvention(errcode.code_null_invalid_address,[]));
		// 	return;
		// }

		// Validate coordinate
		if (!(utils.chkObj(latitude)) || !(utils.chkObj(longitude)) || !(utils.validateCoordinate(latitude,longitude)))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_lat_long,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in DB connection',[]));
				return;
			}

			// CHECK [email_login] if Duplicate or NOT Duplicate
			connection.query({
				sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
				timeout: 5000, // 5s
				values: [email_login]
			}, function(error, results, fields) {
				// error -> rollback
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.rollback(function() {
						console.log(error);
					});
					connection.release();
					return;
				}

				if (utils.chkObj(results) && results.length > 0) { // [email_login] is Duplicate
					res.status(400).send(utils.responseConvention(errcode.code_duplicate_email_login,[]));
					connection.release();
					return;
				}

				// CHECK [full_name] if Duplicate or NOT Duplicate
				connection.query({
					sql: 'SELECT * FROM `profile` WHERE `full_name` = ?',
					timeout: 5000, // 5s
					values: [full_name]
				}, function(error, results, fields) {
					// error -> rollback
					if (error) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
						connection.rollback(function() {
							console.log(error);
						});
						connection.release();
						return;
					}

					if (utils.chkObj(results) && results.length > 0) { // [full_name] is Duplicate
						res.status(400).send(utils.responseConvention(errcode.code_duplicate_full_name,[]));
						connection.release();
						return;
					}

					/* PASS CHECKING -> INSERT TO DB */
					/* Begin transaction */
					console.log('Transaction Start!');
					connection.beginTransaction(function(err) {
						if (err)
						{
							res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
							connection.release();
							return;
						}

						//--------------STEP 1: add to table[account]-------------------
						var insertedAccountId;
						connection.query({
							sql: 'INSERT INTO `account`(`email_login`, `password`, `login_status`,`password_status`,`account_type`)'
								+ 'VALUES (?,?,?,?,?)',
							timeout: 1000, // 1s
							values: [email_login, utils.hashPass(password), 0, 0, 0]
						}, function (error, results, fields) {

							if (error) {
								console.log('//--------------STEP 1: add to table[account]-------------------');
								res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
								connection.rollback(function() {
									console.log(error);
								});
								connection.release();
							}
							else
							{
								insertedAccountId = results.insertId; // store account.account_id is just inserted
						//--------------STEP 2: add to table [profile]------------------
								connection.query({
									sql: 'INSERT INTO `profile`'
										+'(`full_name`,`user_status`,`avatar`,`gender`,'
										+'`account_id`,`birthday`,`phone`,`profile_description`,'
										+'`district`,`province`,`country`,`latitude`,`longitude`,'
										+'`followers_id`,`following_id`,`total_followers`,`total_following`,'
										+'`likes_id`,`dislikes_id`,`total_likes`,`total_dislikes`,'
										+'`got_likes_id`,`got_dislikes_id`,`total_got_likes`,`total_got_dislikes`)'
										+' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
									timeout: 1000, // 1s
									values: [full_name,user_status,avatar,gender,
										 	insertedAccountId,birthday,phone,profile_description,
											district,province,country,latitude,longitude,
											null,null,0,0,
											null,null,0,0,
											null,null,0,0]
								}, function (error, results, fields) {

									if (error) {
										console.log('//--------------STEP 2: add to table [profile]------------------');
										res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
										connection.rollback(function() {
											console.log(error);
										});
										connection.release();
									} else {
										connection.query({
											sql: 'INSERT INTO `notification`(`account_id`, `profile_id`,`device_token`)'
												+ 'VALUES (?,?,?)',
											timeout: 1000, // 1s
											values: [insertedAccountId,results.insertId,'']
										}, function (error, results, fields) {
											if (error) {
												console.log('//--------------STEP 3: add to table [notification]------------------');
												res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
												connection.rollback(function() {
													console.log(error);
												});
												connection.release();
											} else {
												connection.commit(function(err) {
													if (err)
													{
														console.log('Transaction Failed.');
														res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
														connection.rollback(function() {
															console.log(error);
														});
														connection.release();
													}
													else
													{
														var path = app.get('upload_dir')
														utils.createAccountDir(path,insertedAccountId);
														console.log('Transaction Complete.');
														res.status(200).send(utils.responseConvention(errcode.code_success,[]));
														connection.release();
													}
								//--------------REGISTER SUCESSFULLY----------------------------
												});
											}
										});
									}
								});
							}
						});
					});
					/* End transaction */
				});
			});
		});
	});
};
