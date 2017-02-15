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
              console.log(err);
              return;
            }

			if (utils.chkObj(req.file) == false) {
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_upload_file,[]));
				return;
			}

            console.log('Complete upload image.....');
            var img_url = 'http://178.62.102.5:1234/' + account_id + '/avatar/' + req.file.filename;
            console.log(img_url);
            //----------------------------- save in DB -------------------------
            pool.getConnection(function(err, connection) {
                if (err) {
                    res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in connection database',[]));
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
                        res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
                    } else {
                        res.status(200).send(utils.responseConvention(errcode.code_success,
                            [{
                                photos : [img_url]
                            }]
                        ));
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
			  return;
			}

			if (utils.chkObj(req.files) == false || (utils.chkObj(req.files) && req.files.length == 0)) {
				res.status(400).send(utils.responseConvention(errcode.code_null_invalid_upload_file,[]));
				return;
			}

			console.log('Complete upload image.....');
			var img_url_concat = '';
			for (i = 0; i < req.files.length; i++) {
				var img_url = 'http://178.62.102.5:1234/' + account_id + '/photos/' + (req.files[i]).filename;
				img_url_concat = img_url_concat + (i > 0 ? '|' : '') + img_url;
			}
			console.log(img_url_concat);
			//----------------------------- save in DB -------------------------
			pool.getConnection(function(err, connection) {
				if (err) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in connection database',[]));
					return;
				}
				var sqlQuery = '';
				//------------------- UPDATE USER's PHOTOS ------------------
				connection.query({
					sql: 'SELECT * FROM dating.photos WHERE `account_id` = ?',
					timeout: 5000, // 5s
					values:[account_id]
				}, function (error, results, fields) {

					if (error || utils.chkObj(results) == false) {
						res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
					} else if (results.length == 0) {
						sqlQuery = 'INSERT INTO `photos`(`img_origin`,`account_id`) VALUES(?,?)';
					} else {
						sqlQuery = 'UPDATE `photos` SET `img_origin` = ? WHERE `account_id` = ?';
						img_url_concat = results[0]['img_origin'] + '|' + img_url_concat;
					}
					connection.query({
						sql: sqlQuery,
						timeout: 1000, // 1s
						values:[img_url_concat,account_id]
					}, function (error, results, fields) {
						connection.release();
						if (error) {
							res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
						} else {
							var array_str = img_url_concat;
							res.status(200).send(utils.responseConvention(errcode.code_success,
								[{
									photos: array_str.split('|')
								}]
							));
						}
					});
				});
			});
			//------------------------------------------------------------------
		});
	});

	// GET PHOTOS
	rootRouter.get('/photos', function(req, res) {
		// check header or url parameters or post parameters for token
		var account_id = req.query['account_id'];
		var input_acc_id = account_id ? account_id : req.decoded['account']['account_id'];
		//----------------------------- save in DB -------------------------
		pool.getConnection(function(err, connection) {
			if (err) {
				res.status(500).send(utils.responseWithMessage(errcode.code_db_error,'Error in connection database',[]));
				return;
			}
			//------------------- UPDATE USER's PHOTOS ------------------
			connection.query({
				sql: 'SELECT * FROM dating.photos WHERE `account_id` = ?',
				timeout: 2000, // 2s
				values:[input_acc_id]
			}, function (error, results, fields) {
				connection.release();
				if (error || utils.chkObj(results) == false) {
					res.status(500).send(utils.responseWithMessage(errcode.code_db_error,error,[]));
				} else if (results.length == 0) {
					res.status(200).send(utils.responseConvention(errcode.code_success,[]));
				} else {
					var array_str = results[0]['img_origin'];
					res.status(200).send(utils.responseConvention(errcode.code_success,
						[{
							photos: array_str.split('|')
						}]
					));
				}
			});
		});
		//------------------------------------------------------------------
	});
};
