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
	rootRouter.get('/profile', function(req, res) {

		// check header or url parameters or post parameters for token
		var profile_id = req.body.profile_id || req.param('profile_id') || req.headers['profile_id'];
		var account_id = req.decoded['account_id'];
		var sqlQuery = '';

		if (utils.chkObj(profile_id)) { // contain profile_id in request
			sqlQuery = 'SELECT * FROM `profile` WHERE profile_id = ?'
		} else {
			sqlQuery = 'SELECT * FROM `profile` WHERE account_id = ?'
		}

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in connection database',[]));
				return;
			}
			connection.query({
				sql: sqlQuery,
				timeout: 1000, // 1s
				values: [utils.chkObj(profile_id) ? profile_id : account_id]
			}, function(error, results, fields) {
				connection.release();
				if (results.length == 0 || results == null) { // not found record
					res.status(400).send(utils.responseConvention(errcode.code_not_exist_profile,[]));
				} else { // found record
					res.status(200).send(utils.responseConvention(errcode.code_success,results));
				}
			});
		});
	});

	// ---------------------------------------------------------
	// UPDATE PROFILE (this is authenticated)
	// ---------------------------------------------------------

	// http://localhost:1234/api/profile
	rootRouter.put('/profile', function(req, res) {

		var user_status 		= req.body.user_status;
		var avatar 				= req.body.avatar;
		var gender 				= req.body.gender;
		var birthday 			= req.body.birthday;
		var phone 				= req.body.phone;
		var profile_description = req.body.profile_description;

		if (
			!(utils.chkObj(user_status)) && !(utils.chkObj(avatar)) && !(utils.chkObj(gender))
			 && !(utils.chkObj(birthday)) && !(utils.chkObj(phone)) && !(utils.chkObj(profile_description))
			)
		{
			console.log('User does not modify profile, no query!');
			res.status(200).send(utils.responseConvention(errcode.code_success,[]));
			return;
		}

		// STEP 4: Validate birthday
		if (utils.chkObj(birthday) && utils.validateBirthday(birthday) == false)
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_birthday,[]));
			return;
		}

		// STEP 5: Validate phone
		if (utils.chkObj(phone) && validatePhone(phone) == false)
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_phone,[]));
			return;
		}

		/*
		// STEP 1: Validate status
		if (utils.chkObj(user_status) && user_status == '')
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_user_status,[]));
			return;
		}

		// STEP 2: Validate avatar
		if (utils.chkObj(avatar) && avatar == '')
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_avatar,[]));
			return;
		}

		// STEP 3: Validate gender
		if (utils.chkObj(gender) && gender == '')
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_gender,[]));
			return;
		}

		// STEP 4: Validate birthday
		if (utils.chkObj(birthday) && (birthday == '' || utils.validateBirthday(birthday) == false))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_birthday,[]));
			return;
		}

		// STEP 5: Validate phone
		if (utils.chkObj(phone) && (phone == '' || validatePhone(phone) == false))
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_phone,[]));
			return;
		}

		// STEP 6: Validate profile_description
		if (utils.chkObj(profile_description) && profile_description == '')
		{
			res.status(400).send(utils.responseConvention(errcode.code_null_invalid_profile_description,[]));
			return;
		}
		*/
		// get account_id from request.token
		var account_id = req.decoded['account_id'];

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in connection database',[]));
				return;
			}

			//------------------------- UPDATE PROFILE -----------------------------
			connection.query({
				sql: 'SELECT * FROM `profile` WHERE `account_id` = ?',
				timeout: 1000, // 1s
				values: [account_id]
			}, function(error, results, fields) {
				if (error) {
					connection.release();
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
				} else {
					connection.query({
						sql: 'UPDATE `profile` SET '
						+ '`user_status`= ?,`avatar`= ?,`gender`= ?,`birthday`= ?,'
						+ '`phone`= ?,`profile_description`= ?'
						+ ' WHERE `account_id` = ?',
						timeout: 1000, // 1s
						values:
						[
							utils.chkObj(user_status) ? user_status 					: results[0]['user_status'],
							utils.chkObj(avatar) ? avatar 							: results[0]['avatar'],
							utils.chkObj(gender) ? gender 							: results[0]['gender'],
							utils.chkObj(birthday) ? birthday 						: results[0]['birthday'],
							utils.chkObj(phone) ? phone 								: results[0]['phone'],
							utils.chkObj(profile_description) ? profile_description 	: results[0]['profile_description'],
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
				}
			});
		});
	});

	// ---------------------------------------------------------
	// AROUND PROFILE (this is authenticated)
	// ---------------------------------------------------------

	// http://localhost:1234/api/aroundProfile
	rootRouter.get('/aroundProfile', function(req, res) {

		var latitude = req.body.latitude || req.param('latitude') || req.headers['latitude'];
		var longitude = req.body.longitude || req.param('longitude') || req.headers['longitude'];
		var page_size = req.body.page_size || req.param('page_size') || req.headers['page_size'];
		var page = req.body.page || req.param('page') || req.headers['page'];

		var gender = req.body.gender || req.param('gender') || req.headers['gender'];

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

		if (utils.chkObj(gender))
		{
			if (isNaN(gender))
			{
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_gender,[]));
				return;
			}
			else if (gender != 0 && gender != 1)
			{
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_gender,[]));
				return;
			}
		}
		var limit = page_size;
		var offset = (page - 1) * page_size;

		var distanceStr = '111.1111 * DEGREES(ACOS(COS(RADIANS(latitude))'
		+ ' * COS(RADIANS(' + latitude + '))'
		+ ' * COS(RADIANS(longitude - ' + longitude + ')) + SIN(RADIANS(latitude))'
		+ ' * SIN(RADIANS(' + latitude + '))))';

		var sqlQuery = 'SELECT * ,' + distanceStr + 'AS distance'
		+ ' FROM `profile`'
		+ ' WHERE ' + distanceStr + ' <= 10'
		+ ((utils.chkObj(gender) && !(isNaN(gender))) ? ' AND `gender` = ' + gender : '')
		+ ' ORDER BY distance ASC'
		+ ' LIMIT ' + limit + ' OFFSET ' + offset;

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in connection database',[]));
				return;
			}
			connection.query({
				sql: sqlQuery,
				timeout: 10000, // 10s
				values: []
			}, function(error, results, fields) {
				connection.release();
				if (results.length == 0 || results == null) {
					res.status(204).send(utils.responseConvention(errcode.code_success,[]));
				} else {
					res.status(200).send(utils.responseConvention(errcode.code_success,results));
				}
			});
		});
	});
};
