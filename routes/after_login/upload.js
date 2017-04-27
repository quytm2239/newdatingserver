// ---------------------------------------------------------
// UPLOAD (this is authenticated)
// ---------------------------------------------------------
var baseImgUrl = 'https://findlove.cf/';
// UPLOAD AVATAR
module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();

    var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

    // var crypto = require('crypto');
    // var mime = require('mime');
    // var multer  =   require('multer');
    // // Storage option can be changed - check Multer docs

    rootRouter.post('/avatar', function(req, res) {
		// BUSBOY ============>>>>>>>>>>>>>
		// load module
		var path = require('path');
		var inspect = require('util').inspect;
		var Busboy = require('busboy');
		var fs = require('fs');

		var account_id = req.decoded['account']['account_id'];
		var full_path = app.get('upload_dir') + '/' + account_id + '/avatar'

		var busboy = new Busboy({ headers: req.headers });
		var saveTo = '';
		var img_url = '';
		var files = [];
		var fstream;

		busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
			//console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
			saveTo = path.join(full_path, path.basename(filename));
			//console.log(saveTo);
			var img_url = baseImgUrl + account_id + '/avatar/' + filename;
			files.push(img_url);

			fstream = fs.createWriteStream(saveTo);
			file.pipe(fstream);
			// fstream.on('close', function(){
			// 	console.log('file ' + filename + ' uploaded');
			// 	files.push(baseImgUrl + account_id + '/avatar/' + filename);
			// });

		});

		busboy.on('finish', function() {
			// update to database
			pool.getConnection(function(err, connection) {
				if (err) {
					res.status(500).send(utils.responsePhotos(errcode.code_db_error,'Error in database connection',[]));
					return;
				}
				//------------------- UPDATE PROFILE's AVATAR ------------------
				connection.query({
					sql: 'UPDATE `profile` SET `avatar`= ? WHERE `account_id` = ?',
					timeout: 1000, // 1s
					values:[files[0],account_id]
				}, function (error, results, fields) {
					connection.release();
					if (error) {
						res.status(500).send(utils.responsePhotos(errcode.code_db_error,error,[]));
					} else {
						res.status(200).send(utils.responsePhotos(
							errcode.code_success,
							errcode.errorMessage(errcode.code_success),
							files)
						);
					}
				});
			});
		});
		// PROCESS
		req.pipe(busboy);
    });

	// UPLOAD PHOTOS
	rootRouter.post('/photos', function(req, res) {

		// BUSBOY ============>>>>>>>>>>>>>
		// load module
		var path = require('path');
		var inspect = require('util').inspect;
		var Busboy = require('busboy');
		var fs = require('fs');

		var account_id = req.decoded['account']['account_id'];
		var full_path = app.get('upload_dir') + '/' + account_id + '/photos'

		var busboy = new Busboy({ headers: req.headers });
		var saveTo = '';
		var img_url = '';
		var files = [];
		var fstream;

		busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
			//console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
			saveTo = path.join(full_path, path.basename(filename));
			//console.log(saveTo);
			var img_url = baseImgUrl + account_id + '/photos/' + filename;
			files.push(img_url);

			fstream = fs.createWriteStream(saveTo);
			file.pipe(fstream);
			// fstream.on('close', function(){
			// 	console.log('file ' + filename + ' uploaded');
			// 	files.push(baseImgUrl + account_id + '/photos/' + filename);
			// });

		});

		busboy.on('finish', function() {
			// update to database
			console.log('Complete upload image.....');
			var img_url_concat = '';
			for (i = 0; i < files.length; i++) {
				img_url_concat = img_url_concat + (i > 0 ? '|' : '') + files[i];
			}
			//----------------------------- save in DB -------------------------
			pool.getConnection(function(err, connection) {
				if (err) {
					res.status(500).send(utils.responsePhotos(errcode.code_db_error,'Error in database connection',[]));
					return;
				}
				var sqlQuery = '';
				//------------------- UPDATE USER's PHOTOS ------------------
				connection.query({
					sql: 'SELECT * FROM dating.photos WHERE `account_id` = ?',
					timeout: 5000, // 5s
					values:[account_id]
				}, function (error, results, fields) {

					if (error) {
						res.status(500).send(utils.responsePhotos(errcode.code_db_error,error,[]));
					} else if (results.length == 0) { // Does not upload photos, yet
						sqlQuery = 'INSERT INTO `photos`(`img_origin`,`account_id`) VALUES(?,?)';
					} else {  // Uploaded photos, before
						sqlQuery = 'UPDATE `photos` SET `img_origin` = ? WHERE `account_id` = ?';
						img_url_concat = results[0]['img_origin'] + '|' + img_url_concat;
					}
					connection.query({
						sql: sqlQuery,
						timeout: 1000, // 1s
						values:[img_url_concat,account_id]
					}, function (error, results, fields) {

						if (error) {
							res.status(500).send(utils.responsePhotos(errcode.code_db_error,error,[]));
							connection.release();
						} else {

							connection.query({
								sql: 'SELECT * FROM `profile` WHERE `account_id` = ?',
								timeout: 1000, // 1s
								values:[account_id]
							}, function (error, results, fields) {
								if (error) {
									connection.release();
									return;
								}
								if (utils.chkObj(results)) {
									// PROCESS REMOVE FIRST '|' & LAST '|'
									var followers_str = results[0]['followers_id'];
									if (utils.chkObj(followers_str)) {
										followers_str = followers_str.substr(1, followers_str.length - 2);
										var arrayFollowersId = followers_str.split('|');

										var profile_data = results[0];
										connection.query({
											sql: 'SELECT * FROM `notification` WHERE `profile_id` in (' + arrayFollowersId + ')',
											timeout: 1000, // 1s
											values:[]
										}, function (error, results, fields) {
											connection.release();
											if (utils.chkObj(results)) {
												processSendAPS(results,profile_data);
											}
										});
									}
								}
							});

							res.status(200).json({
								status: errcode.code_success,
								message: errcode.errorMessage(errcode.code_success),
								photos: img_url_concat.split('|')
							});

						}
					});
				});
			});
			//------------------------------------------------------------------
		});
		// PROCESS
		req.pipe(busboy);
	});

	function processSendAPS(listFollowersId_Notification,profileData){
		var push_notify = require('./../../apns/push_notify');
		push_notify.init();
		//use valid device token to get it working

		for (i = 0 ; i < listFollowersId_Notification.length ; i++){
			var device_token = listFollowersId_Notification[i]['device_token'];
			if (utils.chkObj(device_token)) {
				var JSONPayload = {
				     "profile" : profileData
				}
				console.log('device_token: ' + device_token);
				push_notify.send({token:device_token, message: profileData['full_name'] + ' has uploaded new photo!', payload: JSONPayload});
			}
		}
	}

	// GET PHOTOS
	rootRouter.get('/photos', function(req, res) {
		// check header or url parameters or post parameters for token
		var account_id = req.query['account_id'];
		var input_acc_id = account_id ? account_id : req.decoded['account']['account_id'];
		var page_size = req.query['page_size'];
		var page = req.query['page'];

		if (!(utils.chkObj(page_size)) || isNaN(page_size))
		{
			res.status(400).send(utils.responsePhotos(
				errcode.code_null_invalid_page_size,
				errcode.errorMessage(errcode.code_null_invalid_page_size),
				[])
			);
			return;
		}

		if (!(utils.chkObj(page)) || isNaN(page) || ( isNaN(page) == false && page <= 0))
		{
			res.status(400).send(utils.responsePhotos(
				errcode.code_null_invalid_page,
				errcode.errorMessage(errcode.code_null_invalid_page),[])
			);
			return;
		}

		var limit = page_size;
		var offset = (page - 1) * page_size;

		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responsePhotos(errcode.code_db_error,'Error in database connection',[]));
				return;
			}
			//------------------- GET USER's PHOTOS ------------------
			connection.query({
				sql: 'SELECT * FROM `photos` WHERE `account_id` = ? LIMIT ' + limit + ' OFFSET ' + offset,
				timeout: 2000, // 2s
				values:[input_acc_id]
			}, function (error, results, fields) {
				connection.release();
				if (error) {
					res.status(500).send(utils.responsePhotos(errcode.code_success,error,[]));
				} else if (results.length == 0) {
					res.status(200).send(utils.responsePhotos(
						errcode.code_success,
						errcode.errorMessage(errcode.code_success),
						[])
					);
				} else {
					var arrayPhotos = utils.chkObj(results[0]['img_origin']) ? (results[0]['img_origin']).split('|') : [];
					if (arrayPhotos.length > 0) {
						arrayPhotos.reverse();
					}
					res.status(200).send(utils.responsePhotos(
						errcode.code_success,
						errcode.errorMessage(errcode.code_success),
						arrayPhotos)
					);
				}
			});
		});
		//------------------------------------------------------------------
	});

	// upload chat image
	rootRouter.post('/chat', function(req, res) {
		// load module
		var path = require('path');
		var inspect = require('util').inspect;
		var Busboy = require('busboy');
		var fs = require('fs');

		var account_id = req.decoded['account']['account_id'];
		var full_path = app.get('upload_dir') + '/' + account_id + '/chat'

		var busboy = new Busboy({ headers: req.headers });
		var saveTo = '';
		var img_url = '';
		var files = [];
		var fstream;

		busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
		  	//console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
			saveTo = path.join(full_path, path.basename(filename));
			var img_url = baseImgUrl + account_id + '/chat/' + filename;
			files.push(img_url);

			fstream = fs.createWriteStream(saveTo);
			file.pipe(fstream);
			// fstream.on('close', function(){
			// 	console.log('file ' + filename + ' is STORED SUCESSFULLY!');
			// });
		});
		// busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
		//   	console.log('Field [' + fieldname + ']: value: ' + inspect(val));
		// });
		busboy.on('finish', function() {
			console.log('FINISH --> uploaded');
			//console.log(files);
			res.status(200).send(utils.responsePhotos(
				errcode.code_success,
				errcode.errorMessage(errcode.code_success),
				files)
			);
		});
		req.pipe(busboy);
	});
};
