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
	// ALL PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/allProfile', function(req, res) {

		// var latitude = req.query['latitude'];
		// var longitude = req.query['longitude'];
		var province = req.query['province'];
		var min_age = req.query['min_age'];
		var max_age = req.query['max_age'];

		var page_size = req.query['page_size'];
		var page = req.query['page'];

		var gender = req.query['gender'];
		// if ( !(utils.chkObj(latitude)) || !(utils.chkObj(longitude )) )
		// {
		// 	res.status(400).send(utils.responseConvention(errcode.code_null_invalid_lat_long,[]));
		// 	return;
		// }

		if (!(utils.chkObj(page_size)) || isNaN(page_size))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
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

		var needQueryMinAge = false;
		if (utils.chkObj(min_age))
		{
			if (isNaN(min_age)){
				if (min_age < 18){
					res.status(400).send(utils.responseConvention(errcode.code_invalid_min_age,[]));
					return;
				}
			} else {
				needQueryMinAge = true;
			}
		}

		var needQueryMaxAge = false;
		if (utils.chkObj(max_age))
		{
			if (isNaN(max_age)){
				if (max_age > 80){
					res.status(400).send(utils.responseConvention(errcode.code_invalid_max_age,[]));
					return;
				}
			} else {
				needQueryMaxAge = true;
			}
		}

		var limit = page_size;
		var offset = (page - 1) * page_size;

		// var distanceStr = '111.1111 * DEGREES(ACOS(COS(RADIANS(latitude))'
		// + ' * COS(RADIANS(' + latitude + '))'
		// + ' * COS(RADIANS(longitude - ' + longitude + ')) + SIN(RADIANS(latitude))'
		// + ' * SIN(RADIANS(' + latitude + '))))';

		var sqlQuery = 'SELECT * FROM `profile`'
		+ ' WHERE true'
		+ (needQueryGender ? ' AND `gender` = ' + gender : '')
		+ (needQueryMinAge ? ' AND TIMESTAMPDIFF(YEAR,birthday,CURDATE()) >= ' + min_age : '')
		+ (needQueryMaxAge ? ' AND TIMESTAMPDIFF(YEAR,birthday,CURDATE()) <= ' + max_age : '')
		+ (utils.chkObj(province) ? ' AND `province` = ' + province : '')
		+ ' ORDER BY created_by DESC'
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

				var array_followers_id = [];
				var array_following_id = [];

				if (utils.chkObj(results)) {
					if (utils.chkObj(results[0]['followers_id'])) {
						var followers_str = results[0]['followers_id'];
						followers_str = followers_str.substr(1, followers_str.length - 2);
						array_followers_id = followers_str.split('|');
					}

					if (utils.chkObj(results[0]['following_id'])) {
						var following_str = results[0]['following_id'];
						following_str = following_str.substr(1, following_str.length - 2);
						array_following_id = following_str.split('|');
					}
				}

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
		+ ' WHERE ' + distanceStr + ' <= 25000 AND `profile_id` != ' + req.decoded['profile']['profile_id']
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

				var array_followers_id = [];
				var array_following_id = [];

				if (utils.chkObj(results)) {
					if (utils.chkObj(results[0]['followers_id'])) {
						var followers_str = results[0]['followers_id'];
						followers_str = followers_str.substr(1, followers_str.length - 2);
						array_followers_id = followers_str.split('|');
					}


					if (utils.chkObj(results[0]['following_id'])) {
						var following_str = results[0]['following_id'];
						following_str = following_str.substr(1, following_str.length - 2);
						array_following_id = following_str.split('|');
					}
				}

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

//==============================================================================
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
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_profile_id,[]));
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
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile_id,[]));
					return;
				}
				// Found, get list followers_id
				var current_followers_id = utils.chkObj(results[0]['followers_id']) ? results[0]['followers_id'] : '';

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

					// Found, get list in String
					var current_following_id = utils.chkObj(results[0]['following_id']) ? results[0]['following_id'] : '';

					//=================CHECK LIKE/DISLIKE OR NOT================
					var isInFollowing = utils.chkObj(current_following_id) ? current_following_id.includes('|' + profile_id + '|') : false;

					// CAN FOLLOW OR NOT?
					if (isInFollowing) {
						res.status(400).send(utils.responseConvention(errcode.code_not_allow_follow_profile_id,[]));
						return;
					}
					//==========================================================
					//=================>> [PROCESS FOLLOW] <<=====================
					// UPDATE FOR ACTOR FOLLOW/UNFOLLOW: REQ_PROFILE_ID
					var new_following_id = '';
					new_following_id = (utils.chkObj(current_following_id) ? current_following_id : '|') + profile_id + '|';

					// UPDATE FOR WHO GOT FOLLOW/UNFOLLOW: PROFILE_ID
					var new_followers_id = '';
					new_followers_id = (utils.chkObj(current_followers_id) ? current_followers_id : '|') + req_profile_id + '|';

					// UPDATE total_followers, total_following
					sub_followers_str = utils.chkObj(new_followers_id) ? new_followers_id.substr(1, new_followers_id.length - 2) : '';
					var total_followers = utils.chkObj(sub_followers_str) ? sub_followers_str.split('|').length : 0;

					sub_following_str = utils.chkObj(new_following_id) ? new_following_id.substr(1, new_following_id.length - 2) : '';
					var total_following = utils.chkObj(sub_following_str) ? sub_following_str.split('|').length : 0;

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
						var update_follower_time = new Date().getTime();
						connection.query({
							sql: 'UPDATE `profile` SET `followers_id` = ?,`total_followers` = ?,`update_follower_time` = ? WHERE `profile_id` = ?',
							timeout: 1000, // 1s
							values: [new_followers_id,total_followers,update_follower_time,profile_id]
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
									sql: 'UPDATE `profile` SET `following_id` = ?,`total_following` = ? WHERE `profile_id` = ?',
									timeout: 1000, // 1s
									values: [new_following_id,total_following,req_profile_id]
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
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_profile_id,[]));
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
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile_id,[]));
					return;
				}
				// Found, get list followers_id
				var current_followers_id = utils.chkObj(results[0]['followers_id']) ? results[0]['followers_id'] : '';

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

					// Found, get list in String
					var current_following_id = utils.chkObj(results[0]['following_id']) ? results[0]['following_id'] : '';

					//=================CHECK LIKE/DISLIKE OR NOT================
					var isNotInFollowing = (utils.chkObj(current_following_id) ? current_following_id.includes('|' + profile_id + '|') : false) == false;

					// CAN UNFOLLOW OR NOT?
					if (isNotInFollowing) {
						res.status(400).send(utils.responseConvention(errcode.code_not_allow_unfollow_profile_id,[]));
						return;
					}
					//==========================================================
					//===============>> [PROCESS UNFOLLOW] <<===================
					// UPDATE FOR ACTOR FOLLOW/UNFOLLOW: REQ_PROFILE_ID
					var new_following_id = '';
					if (utils.chkObj(current_following_id)) {
						var needReplaceStr = '|' + profile_id + '|';
						var replaceStr = (current_following_id == needReplaceStr) ? '' : '|';
						new_following_id = current_following_id.replace(needReplaceStr,replaceStr);
					}

					// UPDATE FOR WHO GOT FOLLOW/UNFOLLOW: PROFILE_ID
					var new_followers_id = '';
					if (utils.chkObj(current_followers_id)) {
						var needReplaceStr = '|' + req_profile_id + '|';
						var replaceStr = (current_followers_id == needReplaceStr) ? '' : '|';
						new_followers_id = current_followers_id.replace(needReplaceStr,replaceStr);
					}

					// UPDATE total_followers, total_following
					sub_followers_str = utils.chkObj(new_followers_id) ? new_followers_id.substr(1, new_followers_id.length - 2) : '';
					var total_followers = utils.chkObj(sub_followers_str) ? sub_followers_str.split('|').length : 0;

					sub_following_str = utils.chkObj(new_following_id) ? new_following_id.substr(1, new_following_id.length - 2) : '';
					var total_following = utils.chkObj(sub_following_str) ? sub_following_str.split('|').length : 0;

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
						var update_follower_time = new Date().getTime();
						connection.query({
							sql: 'UPDATE `profile` SET `followers_id` = ?,`total_followers` = ?,`update_follower_time` = ? WHERE `profile_id` = ?',
							timeout: 1000, // 1s
							values: [new_followers_id,total_followers,update_follower_time,profile_id]
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
									sql: 'UPDATE `profile` SET `following_id` = ?,`total_following` = ? WHERE `profile_id` = ?',
									timeout: 1000, // 1s
									values: [new_following_id,total_following,req_profile_id]
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
						// PROCESS REMOVE FIRST '|' & LAST '|'
						var followers_str = results[0]['followers_id'];
						followers_str = followers_str.substr(1, followers_str.length - 2);
						var arrayFollowersId = followers_str.split('|');

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
					if (utils.chkObj(results[0]['following_id'])) {
						// PROCESS REMOVE FIRST '|' & LAST '|'
						var following_str = results[0]['following_id'];
						following_str = following_str.substr(1, following_str.length - 2);
						var arrayFollowingId = following_str.split('|');

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

//==============================================================================
function processSendAPS(list_Notification,profileData,action){
	var push_notify = require('./../../apns/push_notify');
	push_notify.init();
	//use valid device token to get it working
	var device_token = list_Notification[0]['device_token'];
	if (utils.chkObj(device_token)) {
		var JSONPayload = {
			 "profile" : profileData
		}
		push_notify.send({token:device_token, message: profileData['full_name'] + ' has ' + action + ' your profile!', payload: JSONPayload});
	}
}
//==============================================================================
	// ---------------------------------------------------------
	// LIKE PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.post('/like', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.body.profile_id;
		var req_profile_id = req.decoded['profile']['profile_id'];
		var sqlQuery = '';

		// Validate profile_id which is followed
		if (
			utils.chkObj(profile_id) == false || (utils.chkObj(profile_id) && isNaN(profile_id))
		)
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_profile_id,[]));
			return;
		}

		// Validate error: like self or not
		if (profile_id == req_profile_id) {
			res.status(400).send(utils.responseConvention(errcode.code_not_allow_like_dislike_self,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}

			// who got like/dislike
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
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile_id,[]));
					return;
				}

				// Found, get list in String
				var current_got_likes_id = utils.chkObj(results[0]['got_likes_id']) ? results[0]['got_likes_id'] : '';
				var current_got_dislikes_id =  utils.chkObj(results[0]['got_dislikes_id']) ? results[0]['got_dislikes_id'] : '';

				// Get info of req_profile_id follow this profile_id
				// Actor of action
				connection.query({
					sql: 'SELECT * FROM `profile` WHERE `profile_id` = ?',
					timeout: 1000, // 1s
					values: [req_profile_id]
				}, function(error, results, fields) {

					if (error) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
						return;
					}

					var req_profile_data = results[0];
					var act_like_full_name = results[0]['full_name'];
					var act_like_avatar = results[0]['avatar'];
					// Found, get list in String
					var current_likes_id = results[0]['likes_id'];
					var current_dislikes_id = results[0]['dislikes_id'];

					//=================CHECK LIKE/DISLIKE OR NOT================
					var isInLike = utils.chkObj(current_likes_id) ? current_likes_id.includes('|' + profile_id + '|') : false;
					//var isInDisLike = utils.chkObj(current_dislikes_id) ? current_dislikes_id.includes('|' + profile_id + '|') : false;

					// CAN LIKE OR NOT?
					if (isInLike) {
						res.status(400).send(utils.responseConvention(errcode.code_not_allow_like_profile_id,[]));
						return;
					}
					//==========================================================
					//=================>> [PROCESS LIKE] <<=====================
					// UPDATE FOR ACTOR LIKE/DISLIKE: REQ_PROFILE_ID
					var new_likes_id = '';
					var new_dislikes_id = '';
					new_likes_id = (utils.chkObj(current_likes_id) ? current_likes_id : '|') + profile_id + '|';
					if (utils.chkObj(current_dislikes_id)) {
						var needReplaceStr = '|' + profile_id + '|';
						var replaceStr = (current_dislikes_id == needReplaceStr) ? '' : '|';
						new_dislikes_id = current_dislikes_id.replace(needReplaceStr,replaceStr);
					}

					// UPDATE FOR WHO GOT LIKE/DISLIKE: PROFILE_ID
					var new_got_likes_id = '';
					var new_got_dislikes_id = '';

					new_got_likes_id = (utils.chkObj(current_got_likes_id) ? current_got_likes_id : '|') + req_profile_id + '|';
					if (utils.chkObj(current_got_dislikes_id)) {
						var needReplaceStr = '|' + req_profile_id + '|';
						var replaceStr = (current_got_dislikes_id == needReplaceStr) ? '' : '|';
						new_got_dislikes_id = current_got_dislikes_id.replace(needReplaceStr,replaceStr);
					}

					// UPDATE total_got_like, total_got_dislike
					sub_got_like_str = utils.chkObj(new_got_likes_id) ? new_got_likes_id.substr(1, new_got_likes_id.length - 2) : '';
					var total_got_likes = utils.chkObj(sub_got_like_str) ? sub_got_like_str.split('|').length : 0;

					sub_got_dislike_str = utils.chkObj(new_got_dislikes_id) ? new_got_dislikes_id.substr(1, new_got_dislikes_id.length - 2) : '';
					var total_got_dislikes = utils.chkObj(sub_got_dislike_str) ? sub_got_dislike_str.split('|').length : 0;

					// UPDATE total_likes, total_dislikes
					sub_like_str = utils.chkObj(new_likes_id) ? new_likes_id.substr(1, new_likes_id.length - 2) : '';
					var total_likes = utils.chkObj(sub_like_str) ? sub_like_str.split('|').length : 0;

					sub_dislike_str = utils.chkObj(new_dislikes_id) ? new_dislikes_id.substr(1, new_dislikes_id.length - 2) : '';
					var total_dislikes = utils.chkObj(sub_dislike_str) ? sub_dislike_str.split('|').length : 0;

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

						//---------STEP 1: update new_got_likes_id,new_got_dislikes_id] to table[profile] of got like profile----------
						var insertedAccountId;
						var update_got_like_time = new Date().getTime();
						connection.query({
							sql: 'UPDATE `profile` SET `got_likes_id` = ?,`got_dislikes_id` = ?, `total_got_likes` = ?, `total_got_dislikes` = ?, `update_got_like_time` = ?'
							+ ' WHERE `profile_id` = ?',
							timeout: 1000, // 1s
							values: [new_got_likes_id,new_got_dislikes_id,total_got_likes,total_got_dislikes,update_got_like_time,profile_id]
						}, function (error, results, fields) {

							if (error) {
								console.log('//---------STEP 1: update new_got_likes_id,new_got_dislikes_id] to table[profile] of got like profile----------');
								res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
								connection.rollback(function() {
									console.log(error);
								});
								connection.release();
							}
							else
							{
						//---------STEP 2: update [new_likes_id, new_dislikes_id] of table[profile] of like profile----------
								connection.query({
									sql: 'UPDATE `profile` SET `likes_id` = ?,`dislikes_id` = ?,`total_likes` = ?,`total_dislikes` = ? WHERE `profile_id` = ?',
									timeout: 1000, // 1s
									values: [new_likes_id,new_dislikes_id,total_likes,total_dislikes,req_profile_id]
								}, function (error, results, fields) {

									if (error) {
										console.log('//---------STEP 2: update [new_likes_id, new_dislikes_id] of table[profile] of like profile----------');
										res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
										connection.rollback(function() {
											console.log(error);
											connection.release();
										});
									} else {
										connection.query({
											sql: 'INSERT INTO `alert`(`profile_id`,`make_alert_id`,`alert_content`,`avatar`) VALUES(?,?,?,?)',
											timeout: 1000, // 1s
											values: [profile_id,req_profile_id,act_like_full_name + ' has liked you!',act_like_avatar]
										}, function (error, results, fields) {
											if (error) {
												console.log('//---------STEP 2: update [new_likes_id, new_dislikes_id] of table[profile] of like profile----------');
												res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
												connection.rollback(function() {
													console.log(error);
													connection.release();
												});
											} else {
												connection.commit(function(err) {
													if (err)
													{
														console.log('Transaction Failed.');
														res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
														connection.rollback(function() {
															console.log(error);
															connection.release();
														});
													}
													else
													{
														connection.query({
															sql: 'SELECT * FROM `notification` WHERE `profile_id` = ?',
															timeout: 1000, // 1s
															values:[profile_id]
														}, function (error, results, fields) {
															connection.release();
															if (utils.chkObj(results)) {
																processSendAPS(results,req_profile_data,'liked');
															}
														});

														res.status(200).send(utils.responseConvention(errcode.code_success,[]));
														console.log('Transaction Complete.');
													}
								//--------------LIKE SUCESSFULLY----------------------------
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

	// ---------------------------------------------------------
	// DISLIKE PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.post('/dislike', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.body.profile_id;
		var req_profile_id = req.decoded['profile']['profile_id'];
		var sqlQuery = '';

		// Validate profile_id which is followed
		if (
			utils.chkObj(profile_id) == false || (utils.chkObj(profile_id) && isNaN(profile_id))
		)
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_profile_id,[]));
			return;
		}

		// Validate error: like self or not
		if (profile_id == req_profile_id) {
			res.status(400).send(utils.responseConvention(errcode.code_not_allow_like_dislike_self,[]));
			return;
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}

			// who got like/dislike
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
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile_id,[]));
					return;
				}
				// Found, get list in String
				var current_got_likes_id = utils.chkObj(results[0]['got_likes_id']) ? results[0]['got_likes_id'] : '';
				var current_got_dislikes_id =  utils.chkObj(results[0]['got_dislikes_id']) ? results[0]['got_dislikes_id'] : '';

				// Get info of req_profile_id follow this profile_id
				// Actor of action
				connection.query({
					sql: 'SELECT * FROM `profile` WHERE `profile_id` = ?',
					timeout: 1000, // 1s
					values: [req_profile_id]
				}, function(error, results, fields) {

					if (error) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
						return;
					}

					var req_profile_data = results[0];
					var act_dislike_full_name = results[0]['full_name'];
					var act_dislike_avatar = results[0]['avatar'];
					// Found, get list in String
					var current_likes_id = results[0]['likes_id'];
					var current_dislikes_id = results[0]['dislikes_id'];

					//=================CHECK LIKE/DISLIKE OR NOT================
					var isInDisLike = utils.chkObj(current_dislikes_id) ? current_dislikes_id.includes(profile_id) : false;

					// CAN DISLIKE OR NOT?
					if (isInDisLike) {
						res.status(400).send(utils.responseConvention(errcode.code_not_allow_dislike_profile_id,[]));
						return;
					}
					//==========================================================
					//================>> [PROCESS DISLIKE] <<===================
					// UPDATE FOR ACTOR LIKE/DISLIKE: REQ_PROFILE_ID
					var new_likes_id = '';
					var new_dislikes_id = '';
					new_dislikes_id = (utils.chkObj(current_dislikes_id) ? current_dislikes_id : '|') + profile_id + '|';
					if (utils.chkObj(current_likes_id)) {
						var needReplaceStr = '|' + profile_id + '|';
						var replaceStr = (current_likes_id == needReplaceStr) ? '' : '|';
						new_likes_id = current_likes_id.replace(needReplaceStr,replaceStr);
					}

					// UPDATE FOR WHO GOT LIKE/DISLIKE: PROFILE_ID
					var new_got_likes_id = '';
					var new_got_dislikes_id = '';

					new_got_dislikes_id = (utils.chkObj(current_got_dislikes_id) ? current_got_dislikes_id : '|') + req_profile_id + '|';
					if (utils.chkObj(current_got_likes_id)) {
						var needReplaceStr = '|' + req_profile_id + '|';
						var replaceStr = (current_got_likes_id == needReplaceStr) ? '' : '|';
						new_got_likes_id = current_got_likes_id.replace(needReplaceStr,replaceStr);
					}

					// UPDATE total_got_like, total_got_dislike
					sub_got_like_str = utils.chkObj(new_got_likes_id) ? new_got_likes_id.substr(1, new_got_likes_id.length - 2) : '';
					var total_got_likes = utils.chkObj(sub_got_like_str) ? sub_got_like_str.split('|').length : 0;

					sub_got_dislike_str = utils.chkObj(new_got_dislikes_id) ? new_got_dislikes_id.substr(1, new_got_dislikes_id.length - 2) : '';
					var total_got_dislikes = utils.chkObj(sub_got_dislike_str) ? sub_got_dislike_str.split('|').length : 0;

					// UPDATE total_likes, total_dislikes
					sub_like_str = utils.chkObj(new_likes_id) ? new_likes_id.substr(1, new_likes_id.length - 2) : '';
					var total_likes = utils.chkObj(sub_like_str) ? sub_like_str.split('|').length : 0;

					sub_dislike_str = utils.chkObj(new_dislikes_id) ? new_dislikes_id.substr(1, new_dislikes_id.length - 2) : '';
					var total_dislikes = utils.chkObj(sub_dislike_str) ? sub_dislike_str.split('|').length : 0;

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

						//---------STEP 1: update new_got_likes_id,new_got_dislikes_id] to table[profile] of got like profile----------
						var insertedAccountId;
						var update_got_like_time = new Date().getTime();
						connection.query({
							sql: 'UPDATE `profile` SET `got_likes_id` = ?,`got_dislikes_id` = ?, `total_got_likes` = ?, `total_got_dislikes` = ?, `update_got_like_time` = ?'
							+ ' WHERE `profile_id` = ?',
							timeout: 1000, // 1s
							values: [new_got_likes_id,new_got_dislikes_id,total_got_likes,total_got_dislikes,update_got_like_time,profile_id]
						}, function (error, results, fields) {

							if (error) {
								console.log('//---------STEP 1: update new_got_likes_id,new_got_dislikes_id] to table[profile] of got like profile----------');
								res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
								connection.rollback(function() {
									console.log(error);
								});
								connection.release();
							}
							else
							{
						//---------STEP 2: update [new_likes_id, new_dislikes_id] of table[profile] of like profile----------
								connection.query({
									sql: 'UPDATE `profile` SET `likes_id` = ?, `dislikes_id` = ?,`total_likes` = ?, `total_dislikes` = ? WHERE `profile_id` = ?',
									timeout: 1000, // 1s
									values: [new_likes_id,new_dislikes_id,total_likes,total_dislikes,req_profile_id]
								}, function (error, results, fields) {

									if (error) {
										console.log('//---------STEP 2: update [new_likes_id, new_dislikes_id] of table[profile] of like profile----------');
										res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
										connection.rollback(function() {
											console.log(error);
											connection.release();
										});
									} else {
										connection.query({
											sql: 'INSERT INTO `alert`(`profile_id`,`make_alert_id`,`alert_content`,`avatar`) VALUES(?,?,?,?)',
											timeout: 1000, // 1s
											values: [profile_id,req_profile_id,act_dislike_full_name + ' has disliked you!',act_dislike_avatar]
										}, function (error, results, fields) {
											if (error) {
												console.log('//---------STEP 2: update [new_likes_id, new_dislikes_id] of table[profile] of like profile----------');
												res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
												connection.rollback(function() {
													console.log(error);
													connection.release();
												});
											} else {
												connection.commit(function(err) {
													if (err)
													{
														console.log('Transaction Failed.');
														res.status(500).send(utils.responseWithMessage(errcode.code_db_error,err,[]));
														connection.rollback(function() {
															console.log(error);
															connection.release();
														});
													}
													else
													{
														connection.query({
															sql: 'SELECT * FROM `notification` WHERE `profile_id` = ?',
															timeout: 1000, // 1s
															values:[profile_id]
														}, function (error, results, fields) {
															connection.release();
															if (utils.chkObj(results)) {
																processSendAPS(results,req_profile_data,'disliked');
															}
														});

														res.status(200).send(utils.responseConvention(errcode.code_success,[]));
														console.log('Transaction Complete.');
													}
								//--------------LIKE SUCESSFULLY----------------------------
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

	// ---------------------------------------------------------
	// GET LIST OF LIKE PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/like', function(req, res) {

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

					if (utils.chkObj(results[0]['got_likes_id'])) {
						// PROCESS REMOVE FIRST '|' & LAST '|'
						var got_likes_str = results[0]['got_likes_id'];
						got_likes_str = got_likes_str.substr(1, got_likes_str.length - 2);
						var arrayGotLikeId = got_likes_str.split('|');

						console.log('arrayGotLikeId:' + arrayGotLikeId);
						if (utils.chkObj(arrayGotLikeId) == false) {
							res.status(200).send(utils.responseConvention(errcode.code_success,[]));
							connection.release();
						} else {
							connection.query({
								sql: 'SELECT * FROM `profile` WHERE profile_id IN (' + arrayGotLikeId + ')'
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
	// GET LIST OF DISLIKE PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/dislike', function(req, res) {

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
					if (utils.chkObj(results[0]['got_dislikes_id'])) {
						// PROCESS REMOVE FIRST '|' & LAST '|'
						var got_dislikes_str = results[0]['got_dislikes_id'];
						got_dislikes_str = got_dislikes_str.substr(1, got_dislikes_str.length - 2);
						var arrayGotDislikeId = got_dislikes_str.split('|');
						if (utils.chkObj(arrayGotDislikeId) == false) {
							res.status(200).send(utils.responseConvention(errcode.code_success,[]));
							connection.release();
						} else {
							connection.query({
								sql: 'SELECT * FROM `profile` WHERE `profile_id` IN (' + arrayGotDislikeId + ')'
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

	const Rank = {
	    FOLLOWER: 1,
	    FOLLOWER_MALE: 2,
	    FOLLOWER_FEMALE: 3,
	    LIKE: 4,
	    LIKE_MALE: 5,
	    LIKE_FEMALE: 6
	}

	// ---------------------------------------------------------
	// GET TOPLIKE PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/toplike', function(req, res) {

		// check header or url parameters or post parameters for token
		// var profile_id = req.query['profile_id'];
		// var req_profile_id = req.decoded['profile']['profile_id'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];
		var gender = req.query['gender'];

		// var getOtherProfile = false;
		// if (utils.chkObj(profile_id) && isNaN(profile_id) == false)  {
		// 	getOtherProfile = true
		// }

		// if (!(utils.chkObj(page_size)) || isNaN(page_size))
		// {
		// 	res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
		// 	return;
		// }
		//
		// if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		// {
		// 	res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
		// 	return;
		// }
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
				sql: 'SELECT * FROM `profile`'
				+ ' WHERE `total_got_likes` > 0'
				+ (needQueryGender ? ' AND `gender` = ' + gender : '')
				+ ' ORDER BY `total_got_likes` DESC, `update_got_like_time` ASC LIMIT 50',
				timeout: 2000, // 2s
				values: []
			}, function(error, results, fields) {

				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.release();
				}
				if (results.length == 0 || results == null) { // not found record
					//res.status(200).send(utils.responseConvention(errcode.code_success,[]));
					res.status(200).send({
						status: errcode.code_success,
						message: errcode.errorMessage(errcode.code_success),
						data: [],
						last_rank: []
					});
					connection.release();
				} else { // found record
					var rankId = needQueryGender ? gender == 0 ? Rank.LIKE_MALE : Rank.LIKE_FEMALE : Rank.LIKE;
					var topLikeData = results;
					connection.query({
						sql: 'SELECT * FROM `rank` WHERE `rank_id` = ?',
						timeout: 2000, // 2s
						values: [rankId]
					}, function(error, results, fields) {
						connection.release();
						var last_rank_arr = utils.chkObj(results) && utils.chkObj(results[0]['last_rank']) ? results[0]['last_rank'].split('|') : [];
						var array_profile_id = [];
						for (i = 0; i < last_rank_arr.length; i++) {
							array_profile_id.push(parseInt(last_rank_arr[i]));
						}
						res.status(200).send({
				            status: errcode.code_success,
				            message: errcode.errorMessage(errcode.code_success),
				            data: topLikeData,
							last_rank: array_profile_id
				        });
					});
				}
			});
		});
	});

	// ---------------------------------------------------------
	// GET TOPFOLLOWER PROFILE (this is authenticated)
	// ---------------------------------------------------------
	rootRouter.get('/topfollower', function(req, res) {

		// check header or url parameters or post parameters for token
		// var profile_id = req.query['profile_id'];
		// var req_profile_id = req.decoded['profile']['profile_id'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];
		var gender = req.query['gender'];

		// var getOtherProfile = false;
		// if (utils.chkObj(profile_id) && isNaN(profile_id) == false)  {
		// 	getOtherProfile = true
		// }

		// if (!(utils.chkObj(page_size)) || isNaN(page_size))
		// {
		// 	res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
		// 	return;
		// }
		//
		// if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		// {
		// 	res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
		// 	return;
		// }
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
				sql: 'SELECT * FROM `profile`'
				+ ' WHERE `total_followers` > 0'
				+ (needQueryGender ? ' AND `gender` = ' + gender : '')
				+ ' ORDER BY `total_followers` DESC, `update_follower_time` ASC LIMIT 50',
				timeout: 2000, // 2s
				values: []
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.release();
				}
				if (results.length == 0 || results == null) { // not found record
					//res.status(200).send(utils.responseConvention(errcode.code_success,[]));
					res.status(200).send({
						status: errcode.code_success,
						message: errcode.errorMessage(errcode.code_success),
						data: [],
						last_rank: []
					});
					connection.release();
				} else { // found record
					var rankId = needQueryGender ? gender == 0 ? Rank.FOLLOWER_MALE : Rank.FOLLOWER_FEMALE : Rank.FOLLOWER;
					var topFollowerData = results;
					connection.query({
						sql: 'SELECT * FROM `rank` WHERE `rank_id` = ?',
						timeout: 2000, // 2s
						values: [rankId]
					}, function(error, results, fields) {
						connection.release();
						var last_rank_arr = utils.chkObj(results) && utils.chkObj(results[0]['last_rank']) ? results[0]['last_rank'].split('|') : [];
						var array_profile_id = [];
						for (i = 0; i < last_rank_arr.length; i++) {
							array_profile_id.push(parseInt(last_rank_arr[i]));
						}
						res.status(200).send({
				            status: errcode.code_success,
				            message: errcode.errorMessage(errcode.code_success),
				            data: topFollowerData,
							last_rank: array_profile_id
				        });
					});
				}
			});
		});
	});

//==============================================================================
// ---------------------------------------------------------
// GET LIST OF LIKE PROFILE (this is authenticated)
// ---------------------------------------------------------
	rootRouter.get('/alert', function(req, res) {

		// check header or url parameters or post parameters for token
		var req_profile_id = req.decoded['profile']['profile_id'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];

		if (!(utils.chkObj(page_size)) || isNaN(page_size) || ( isNaN(page) == false && page <= 0))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page_size,[]));
			return;
		}

		if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_page,[]));
			return;
		}

		var limit = page_size;
		var offset = (page - 1) * page_size;

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			connection.query({
				sql: 'SELECT * FROM `alert` WHERE profile_id = ?'
				+ ' ORDER BY `created_by` DESC'
				+ ' LIMIT ' + limit + ' OFFSET ' + offset,
				timeout: 1000, // 1s
				values: [req_profile_id]
			}, function(error, results, fields) {
				if (error) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					connection.release();
					return;
				}
				connection.release();
				if (results.length == 0 || results == null) { // not found record
					res.status(200).send(utils.responseConvention(errcode.code_success,[]));
				} else { // found record
					res.status(200).send(utils.responseConvention(errcode.code_success,results));
				}
			});
		});
	});
};
