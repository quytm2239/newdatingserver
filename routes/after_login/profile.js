// ---------------------------------------------------------
// GET PROFILE (this is authenticated)
// ---------------------------------------------------------

module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();

	var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

	// ---------------------------------------------------------
	// GET PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/profile', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.query['profile_id'];
		var getOtherProfile = false;
		if (utils.chkObj(profile_id) && isNaN(profile_id) == false)  {
			getOtherProfile = true
		}
		var input_profile_id = getOtherProfile ? profile_id : req.decoded['profile']['profile_id'];

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE profile_id = ?',
				timeout: 1000, // 1s
				values: [input_profile_id]
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
				} else if (results.length == 0 || results == null) { // not found record
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile,[]));
				} else { // found record
					var profile_data = results[0];
					var total_followers = total_followers = utils.chkObj(results[0]['followers_id']) ? (results[0]['followers_id'].split('|')).length : 0;
					connection.query({
						sql: 'SELECT * FROM `photos` WHERE account_id = ?',
						timeout: 1000, // 1s
						values: [results[0]['account_id']]
					}, function(error, results, fields) {
						connection.release();
						if (error) {
							res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
							return;
						} else {
							// Have record and field: img_origin is not empty -> get length
							var total_photos = (utils.chkObj(results) && utils.chkObj(results[0]['img_origin'])) ? (results[0]['img_origin'].split('|')).length : 0;
							res.status(200).send({
								status: errcode.code_success,
								message: errcode.errorMessage(errcode.code_success),
								data: [profile_data],
								total_followers: total_followers,
								total_photos: total_photos
							});
						}
					});
				}
			});
		});
	});

	// ---------------------------------------------------------
	// UPDATE PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.put('/profile', function(req, res) {

		var user_status 		= req.body.user_status;
		var phone 				= req.body.phone;
		var profile_description = req.body.profile_description;

		if (
			!(utils.chkObj(user_status)) && !(utils.chkObj(phone)) && !(utils.chkObj(profile_description))
			)
		{
			console.log('User does not modify profile, no query!');
			res.status(200).send(utils.responseConvention(errcode.code_success,[]));
			return;
		}

		// get account_id from request.token
		var account_id = req.decoded['account']['account_id'];

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}

			//------------------------- UPDATE PROFILE -----------------------------
			connection.query({
				sql: 'UPDATE `profile` SET '
				+ '`user_status`= ?,`phone`= ?,`profile_description`= ?'
				+ ' WHERE `account_id` = ?',
				timeout: 1000, // 1s
				values:
				[
					(utils.chkObj(user_status)) ? user_status 					: '',
					(utils.chkObj(phone)) ? phone 								: '',
					(utils.chkObj(profile_description)) ? profile_description 	: '',
					account_id
				]
			}, function (error, results, fields) {
				connection.release();
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
				} else {
					res.status(200).send(utils.responseConvention(errcode.code_success,[]));
				}
			});
		});
	});

	// ---------------------------------------------------------
	// AROUND PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/aroundProfile', function(req, res) {

		var latitude = req.query['latitude'];
		var longitude = req.query['longitude'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];

		var gender = req.query['gender'];
		if ( !(utils.chkObj(latitude)) || !(utils.chkObj(longitude )) )
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_lat_long,[]));
			return;
		}

		if (!(utils.chkObj(page_size)) || isNaN(page_size))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
			return;
		}

		if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
			return;
		}
		var needQueryGender = false;
		if (utils.chkObj(gender))
		{
			if (isNaN(gender)){
				if (gender.length > 0 && gender != 'all'){
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
				return;
				}
			} else if ((gender != 0 && gender != 1)) {
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
				return;
			} else if (gender != 'all' && (gender == 0 || gender == 1)) {
				needQueryGender = true;
			}
		}
		var limit = page_size;
		var offset = (page - 1) * page_size;

		var distanceStr = '111.1111 * DEGREES(ACOS(COS(RADIANS(latitude))'
		+ ' * COS(RADIANS(' + latitude + '))'
		+ ' * COS(RADIANS(longitude - ' + longitude + ')) + SIN(RADIANS(latitude))'
		+ ' * SIN(RADIANS(' + latitude + '))))';

		var sqlQuery = 'SELECT * ,ROUND(' + distanceStr + ',6) '+ 'AS distance'
		+ ' FROM `profile`'
		+ ' WHERE ' + distanceStr + ' <= 10 AND `profile_id` != ' + req.decoded['profile']['profile_id']
		+ (needQueryGender ? ' AND `gender` = ' + gender : '')
		+ ' ORDER BY distance ASC'
		+ ' LIMIT ' + limit + ' OFFSET ' + offset;

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE `profile_id` = ' + req.decoded['profile']['profile_id'],
				timeout: 1000, // 1s
				values: []
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					return;
				}
				var array_followers_id = (utils.chkObj(results[0]['followers_id'])) ? results[0]['followers_id'].split('|') :[];
				var array_following_id = (utils.chkObj(results[0]['following_id'])) ? results[0]['following_id'].split('|') :[];

				connection.query({
					sql: sqlQuery,
					timeout: 10000, // 10s
					values: []
				}, function(error, results, fields) {
					connection.release();
					if (error) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
						return;
					}
					var aroundProfile = utils.chkObj(results) ? results : [];
					res.status(200).send({
						status: errcode.code_success,
						message: errcode.errorMessage(errcode.code_success),
						data: aroundProfile,
						follower_id: array_followers_id,
						following_id: array_following_id
					});
				});
			});
		});
	});

	// ---------------------------------------------------------
	// FOLLOW PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.post('/follow', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.body.profile_id || req.param('profile_id') || req.headers['profile_id'];
		var req_profile_id = req.decoded['profile']['profile_id'];
		var sqlQuery = '';

		// Validate profile_id which is followed
		if (
			utils.chkObj(profile_id) == false || (utils.chkObj(profile_id) && isNaN(profile_id))
		)
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_followed_profile_id,[]));
			return;
		}

		// Validate error: follow self or not
		if (profile_id == req_profile_id) {
			res.status(400).send(utils.responseConvention(errcode.code_not_allow_follow_unfollow_self,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			// check for who is follower of this profile_id
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE profile_id = ?',
				timeout: 1000, // 1s
				values: [profile_id]
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
					return;
				}
				// Profile not found
				if (utils.chkObj(results) == false) {
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_followed_profile_id,[]));
					return;
				}
				// Found, get list followers_id
				var current_followers_id = results[0]['followers_id'];

				// Get info of req_profile_id follow this profile_id
				connection.query({
					sql: 'SELECT * FROM `profile` WHERE `profile_id` = ?',
					timeout: 1000, // 1s
					values: [req_profile_id]
				}, function(error, results, fields) {

					if (error) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
						return;
					}

					// Found, get list following_id
					var current_following_id = results[0]['following_id'];

					//=================CHECK FOLLOWED OR NOT====================
					var isAllowFollow = true;
					// CHECK IF REQUEST_ACC_ID FOLLOWED THIS PROFILE OR NOT YET
					if (utils.chkObj(current_followers_id)) {
						if (current_followers_id.length > 0) {
							var array_followers_id = current_followers_id.split('|');
							if (array_followers_id.length > 0) {
								for (i = 0; i < array_followers_id.length; i++) {
									if (array_followers_id[i] == req_profile_id) {
										isAllowFollow = false;
										break;
									}
								}
							}
						}
					}
					// CAN FOLLOW OR NOT?
					if (isAllowFollow == false) {
						res.status(400).send(utils.responseConvention(errcode.code_not_allow_follow_profile_id,[]));
						return;
					}
					//==========================================================

					// UPDATE FOR FOLLOWING: PROFILE_ID
					var new_following_id = '';
					new_following_id = new_following_id + (utils.chkObj(current_following_id) ? current_following_id + '|' : '') + profile_id;

					// UPDATE FOR FOLLOWERS:
					var new_followers_id = '';
					new_followers_id = new_followers_id + (utils.chkObj(current_followers_id) ? current_followers_id + '|' : '') + req_profile_id;

					/* PASS CHECKING -> UPDATE TO DB */
					/* Begin transaction */
					console.log('Transaction Start!');
					connection.beginTransaction(function(err) {
						if (err)
						{
							res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
							connection.release();
							return;
						}

						//---------STEP 1: update [followers_id] to table[profile] of followed profile----------
						var insertedAccountId;
						connection.query({
							sql: 'UPDATE `profile` SET `followers_id` = ? WHERE `profile_id` = ?',
							timeout: 1000, // 1s
							values: [new_followers_id ,profile_id]
						}, function (error, results, fields) {

							if (error) {
								console.log('//---------STEP 1: update to table[profile] of followed profile----------');
								res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
								connection.rollback(function() {
									console.log(error);
								});
								connection.release();
							}
							else
							{
						//---------STEP 2: update to table[profile] of following profile----------
								connection.query({
									sql: 'UPDATE `profile` SET `following_id` = ? WHERE `profile_id` = ?',
									timeout: 1000, // 1s
									values: [new_following_id,req_profile_id]
								}, function (error, results, fields) {

									if (error) {
										console.log('//---------STEP 2: update to table[profile] of following profile----------');
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
												res.status(200).send(utils.responseConvention(errcode.code_success,[]));
												console.log('Transaction Complete.');
												connection.release();
											}
						//--------------FOLLOW SUCESSFULLY----------------------------
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

	// ---------------------------------------------------------
	// UNFOLLOW PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.post('/unfollow', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.body.profile_id || req.param('profile_id') || req.headers['profile_id'];
		var req_profile_id = req.decoded['profile']['profile_id'];
		var account_id = req.decoded['account']['account_id'];
		var sqlQuery = '';

		// Validate request's profile_id
		if (
			utils.chkObj(profile_id) == false || (utils.chkObj(profile_id) && isNaN(profile_id))
		)
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_followed_profile_id,[]));
			return;
		}

		// Validate error: unfollow self or not
		if (profile_id == req_profile_id) {
			res.status(400).send(utils.responseConvention(errcode.code_not_allow_follow_unfollow_self,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			// Get info of profile_id
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE profile_id = ?',
				timeout: 1000, // 1s
				values: [profile_id]
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
					return;
				}
				// Not fount profile of profile_id
				if (utils.chkObj(results) == false) {
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_followed_profile_id,[]));
					return;
				}
				// Found, get list followers_id
				var current_followers_id = results[0]['followers_id'];

				// Get info of req_profile_id
				connection.query({
					sql: 'SELECT * FROM `profile` WHERE `profile_id` = ?',
					timeout: 1000, // 1s
					values: [req_profile_id]
				}, function(error, results, fields) {

					if (error) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
						return;
					}

					// Get list following_id
					var current_following_id = results[0]['following_id'];

					//==========================================================
					var isFollower = false;
					// CHECK IF REQUEST_ACC_ID FOLLOWED THIS PROFILE OR NOT YET
					if (utils.chkObj(current_followers_id)) {
						var array_followers_id = current_followers_id.split('|');
						if (utils.chkObj(array_followers_id.length)) {
							for (i = 0; i < array_followers_id.length; i++) {
								if (array_followers_id[i] == req_profile_id) {
									isFollower = true;
									break;
								}
							}
						}
					}
					// IS FOLLOWER OR NOT?
					if (isFollower == false) {
						res.status(400).send(utils.responseConvention(errcode.code_not_allow_unfollow_profile_id,[]));
						return;
					}
					//==========================================================

					// UPDATE FOR FOLLOWERS:
					var new_followers_id = '';

					if (utils.chkObj(current_followers_id)) {
						var array_followers_id = current_followers_id.split('|');
						if (utils.chkObj(array_followers_id.length)) {
							for (i = 0; i < array_followers_id.length; i++) {
								if (array_followers_id[i] != req_profile_id) {
									new_followers_id = new_followers_id + (i > 0 ? '|' : '') + array_followers_id[i];
								}
							}
						}
					}

					// UPDATE FOR FOLLOWING: PROFILE_ID
					var new_following_id = (current_following_id.length > 0) ? '' : profile_id;

					if (utils.chkObj(current_following_id)) {
						var array_following_id = current_following_id.split('|');
						if (utils.chkObj(array_following_id)) {
							for (i = 0; i < array_following_id.length; i++) {
								if (array_following_id[i] != profile_id) {
									new_following_id = new_following_id + (i > 0 ? '|' : '') + array_following_id[i];
								}
							}
						}
					}

					/* PASS CHECKING -> UPDATE TO DB */
					/* Begin transaction */
					console.log('Transaction Start!');
					connection.beginTransaction(function(err) {
						if (err)
						{
							res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
							connection.release();
							return;
						}

						//---------STEP 1: update [followers_id] to table[profile] of followed profile----------
						var insertedAccountId;
						connection.query({
							sql: 'UPDATE `profile` SET `followers_id` = ? WHERE `profile_id` = ?',
							timeout: 1000, // 1s
							values: [new_followers_id ,profile_id]
						}, function (error, results, fields) {

							if (error) {
								console.log('//---------STEP 1: update to table[profile] of followed profile----------');
								res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
								connection.rollback(function() {
									console.log(error);
								});
								connection.release();
							}
							else
							{
						//---------STEP 2: update to table[profile] of following profile----------
								connection.query({
									sql: 'UPDATE `profile` SET `following_id` = ? WHERE `profile_id` = ?',
									timeout: 1000, // 1s
									values: [new_following_id,req_profile_id]
								}, function (error, results, fields) {

									if (error) {
										console.log('//---------STEP 2: update to table[profile] of following profile----------');
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
												res.status(200).send(utils.responseConvention(errcode.code_success,[]));
												console.log('Transaction Complete.');
												connection.release();
											}
						//--------------UNFOLLOW SUCESSFULLY----------------------------
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

	// ---------------------------------------------------------
	// GET FOLLOWER PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/follower', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.query['profile_id'];
		var req_profile_id = req.decoded['profile']['profile_id'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];
		var gender = req.query['gender'];

		var getOtherProfile = false;
		if (utils.chkObj(profile_id) && isNaN(profile_id) == false)  {
			getOtherProfile = true
		}

		if (!(utils.chkObj(page_size)) || isNaN(page_size))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
			return;
		}

		if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
			return;
		}
		var needQueryGender = false;
		if (utils.chkObj(gender))
		{
			if (isNaN(gender)){
				if (gender.length > 0 && gender != 'all'){
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
				return;
				}
			} else if ((gender != 0 && gender != 1)) {
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
				return;
			} else if (gender != 'all' && (gender == 0 || gender == 1)) {
				needQueryGender = true;
			}
		}
		var limit = page_size;
		var offset = (page - 1) * page_size;

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE profile_id = ?',
				timeout: 1000, // 1s
				values: [getOtherProfile ? profile_id : req_profile_id]
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.release();
					return;
				}
				if (results.length == 0 || results == null) { // not found record
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile,[]));
					connection.release();
				} else { // found record
					if (utils.chkObj(results[0]['followers_id'])) {
						var arrayFollowersId = results[0]['followers_id'].split('|');
						if (arrayFollowersId.length == 0) {
							res.status(200).send(utils.responseConvention(errcode.code_success,[]));
							connection.release();
						} else {
							connection.query({
								sql: 'SELECT * FROM `profile` WHERE profile_id IN (' + arrayFollowersId + ')'
								+ (needQueryGender ? ' WHERE `gender` = ' + gender : '')
								+ ' ORDER BY `created_by` DESC'
								+ ' LIMIT ' + limit + ' OFFSET ' + offset,
								timeout: 1000, // 1s
								values: []
							}, function(error, results, fields) {
								connection.release();
								if (error) {
									res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
									return;
								}
								if (results.length == 0 || results == null) { // not found record
									res.status(200).send(utils.responseConvention(errcode.code_success,[]));
								} else { // found record
									res.status(200).send(utils.responseConvention(errcode.code_success,results));
								}
							});
						}
					} else {
						res.status(200).send(utils.responseConvention(errcode.code_success,[]));
						connection.release();
					}
				}
			});
		});
	});

	// ---------------------------------------------------------
	// GET FOLLOWING PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/following', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.query['profile_id'];
		var req_profile_id = req.decoded['profile']['profile_id'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];
		var gender = req.query['gender'];

		var getOtherProfile = false;
		if (utils.chkObj(profile_id) && isNaN(profile_id) == false)  {
			getOtherProfile = true
		}

		if (!(utils.chkObj(page_size)) || isNaN(page_size))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
			return;
		}

		if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
			return;
		}
		var needQueryGender = false;
		if (utils.chkObj(gender))
		{
			if (isNaN(gender)){
				if (gender.length > 0 && gender != 'all'){
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
				return;
				}
			} else if ((gender != 0 && gender != 1)) {
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
				return;
			} else if (gender != 'all' && (gender == 0 || gender == 1)) {
				needQueryGender = true;
			}
		}
		var limit = page_size;
		var offset = (page - 1) * page_size;

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE profile_id = ?',
				timeout: 1000, // 1s
				values: [getOtherProfile ? profile_id : req_profile_id]
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.release();
					return;
				}
				if (results.length == 0 || results == null) { // not found record
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile,[]));
					connection.release();
				} else { // found record
					if (utils.chkObj(results[0]['followers_id'])) {
						var arrayFollowersId = results[0]['followers_id'].split('|');
						if (arrayFollowingId.length == 0) {
							res.status(200).send(utils.responseConvention(errcode.code_success,[]));
							connection.release();
						} else {
							connection.query({
								sql: 'SELECT * FROM `profile` WHERE `profile_id` IN (' + arrayFollowingId + ')'
								+ (needQueryGender ? ' WHERE `gender` = ' + gender : '')
								+ ' ORDER BY `created_by` DESC'
								+ ' LIMIT ' + limit + ' OFFSET ' + offset,
								timeout: 1000, // 1s
								values: []
							}, function(error, results, fields) {
								connection.release();
								if (error) {
									res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
									return;
								}
								if (results.length == 0 || results == null) { // not found record
									res.status(200).send(utils.responseConvention(errcode.code_success,[]));
								} else { // found record
									res.status(200).send(utils.responseConvention(errcode.code_success,results));
								}
							});
						}
					} else {
						res.status(200).send(utils.responseConvention(errcode.code_success,[]));
						connection.release();
					}
				}
			});
		});
	});
};
