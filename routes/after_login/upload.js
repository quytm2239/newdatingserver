// ---------------------------------------------------------
// UPLOAD (this is authenticated)
// ---------------------------------------------------------

// UPLOAD AVATAR
module.exports = function(app, pool, config){
	var url = require('url'),
		express = require('express'),
		rootRouter = express.Router();

    var utils = app.get('utils');
	var errcode = app.get('errcode');
	app.use(config.api_path,rootRouter);

    var crypto = require('crypto');
    var mime = require('mime');
    var multer  =   require('multer');
    // Storage option can be changed - check Multer docs

    rootRouter.post('/avatar', function(req, res) {
		console.log('=========================================================');

        var account_id = req.decoded['account']['account_id'];
        var storage = multer.diskStorage({
            destination: function(req, file, cb) {
                var path = app.get('upload_dir')
                cb(null, path + '/' + account_id + '/avatar')
            },
            filename: function (req, file, cb) {
              crypto.pseudoRandomBytes(16, function (err, raw) {
                //cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
                cb(null, Date.now() + '.' + mime.extension(file.mimetype));
              });
            }
        });

        var upload = multer({storage: storage}).single('file');

        console.log('Start upload image.....');
        upload(req, res, function(err) {
            if(err) {
				res.status(500).send(utils.responsePhotos(errcode.code_upload_error,err,[]));
	            return;
            }

			if (utils.chkObj(req.file) == false) {
				res.status(400).send(utils.responsePhotos(
					errcode.code_null_invalid_upload_file,
					errcode.errorMessage(errcode.code_null_invalid_upload_file),
					[])
				);
				return;
			}

            console.log('Complete upload image.....');
            var img_url = 'http://178.62.102.5:1234/' + account_id + '/avatar/' + req.file.filename;
            console.log(img_url);
            //----------------------------- save in DB -------------------------
            pool.getConnection(function(err, connection) {
                if (err) {
                    res.status(500).send(utils.responsePhotos(errcode.code_db_error,'Error in database connection',[]));
                    return;
                }

                //------------------- UPDATE PROFILE's AVATAR ------------------
                connection.query({
                    sql: 'UPDATE `profile` SET `avatar`= ? WHERE `account_id` = ?',
                    timeout: 1000, // 1s
                    values:[img_url,account_id]
                }, function (error, results, fields) {
                    connection.release();
                    if (error) {
                        res.status(500).send(utils.responsePhotos(errcode.code_db_error,error,[]));
                    } else {
						res.status(200).send(utils.responsePhotos(
							errcode.code_success,
							errcode.errorMessage(errcode.code_success),
							[img_url])
						);
                    }
                });
            });
            //------------------------------------------------------------------
        });
    });

	// UPLOAD PHOTOS
	rootRouter.post('/photos', function(req, res) {

		var account_id = req.decoded['account']['account_id'];
		var storage = multer.diskStorage({
			destination: function(req, file, cb) {
				var path = app.get('upload_dir')
				cb(null, path + '/' + account_id + '/photos')
			},
			filename: function (req, file, cb) {
			  crypto.pseudoRandomBytes(16, function (err, raw) {
				//cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
				cb(null, Date.now() + '.' + mime.extension(file.mimetype));
			  });
			}
		});

		var upload = multer({storage: storage}).array('file',5);

		console.log('=========================================================');
		console.log('Start upload image.....');
		upload(req, res, function(err) {
			if(err) {
			  	console.log(err);
			  	res.status(500).send(utils.responsePhotos(errcode.code_upload_error,err,[]));
			  	return;
			}

			if (utils.chkObj(req.files) == false || (utils.chkObj(req.files) && req.files.length == 0)) {
				res.status(400).send(utils.responsePhotos(
					errcode.code_null_invalid_upload_file,
					errcode.errorMessage(errcode.code_null_invalid_upload_file),
					[])
				);
				return;
			}
			console.log('Complete upload image.....');
			var img_url_concat = '';
			for (i = 0; i < req.files.length; i++) {
				var img_url = 'http://178.62.102.5:1234/' + account_id + '/photos/' + (req.files[i]).filename;
				img_url_concat = img_url_concat + (i > 0 ? '|' : '') + img_url;
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
	});

	function processSendAPS(listFollowersId_Notification,profileData){
		pushNotify = app.get('pushNotify');
		pushNotify.init();
		//use valid device token to get it working
		for (i == 0;i < listFollowersId_Notification.length;i++){
			if (utils.chkObj(listFollowersId_Notification[i]['device_token'])) {
				var JSONPayload = {
				     "profile" : profileData
				}
				pushNotify.send({token:listFollowersId_Notification[i]['device_token'], message:Subject + 'has uploaded new photo!', payload: JSONPayload});
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
};
