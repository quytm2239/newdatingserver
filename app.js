/*------------------------------------------------------------------------------
*-------------------------[Get all necessary modules]---------------------------
*-----------------------------------------------------------------------------*/
var rootDir = __dirname;

var express = require('express'),
    app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);

var bodyParser = require('body-parser');
var morgan = require('morgan');
var mysql = require('mysql');
var winston = require('winston');

var schedule = require('node-schedule');

var fs = require('fs');
var redis = require('redis');
// var readChunk = require('read-chunk');
// var fileType = require('file-type');

var https = require('https');
var privateKey  = fs.readFileSync('/etc/letsencrypt/live/findlove.cf/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/findlove.cf/fullchain.pem', 'utf8');

var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, app);

// get our predefined file
var config = require('./config');
var errcode = require('./errcode');
var utils = require('./utils');
var show_clientip = require('./middleware/show_clientip');

// create instance of "pool" mySql connection
var pool = mysql.createPool(config.db_config);

// plug config and module
app.set('port', config.PORT || process.env.port || 1234);
app.set('super_secret', config.super_secret); // secret variable
app.set('utils',utils);
app.set('errcode',errcode);
app.set('upload_dir',__dirname + '/uploaded_image');

// Add headers
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin',  '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Pass to next layer of middleware
    next();
});

// setup parser for request body content
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));
app.use(express.static(__dirname));
app.use(express.static(__dirname + '/html'));
app.use(express.static(__dirname + '/node_module'));
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/uploaded_image'));
app.use(show_clientip);

//=========================== write log to file ================================
var logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level:            'debug',
      filename:         './all-logs.log',
      handleExceptions: true,
      json:             false,
      maxsize:          104857600, //100MB
      maxFiles:         10,
      colorize:         false
    })
    // ,
    // new winston.transports.Console({
    //   level:            'debug',
    //   handleExceptions: true,
    //   json:             false,
    //   colorize:         true
    // })
  ],
  exitOnError: false
});

logger.stream = {
  write: function(message, encoding){
    logger.info(message);
  }
};

app.use(morgan(
	'{"remote_addr": ":remote-addr", "date": ":date[clf]", "method": ":method", "url": ":url", "http_version": ":http-version", "status": ":status", "result_length": ":res[content-length]", "user_agent": ":user-agent", "response_time": ":response-time"}', {stream: logger.stream}));
//=========================== write log to file ================================

// http.createServer(app).listen(app.get('port'), function(){
//   console.log('Express server listening on port ' + app.get('port'));
// });

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

httpsServer.listen(1235, function(){
  console.log('Express server listening on port 1235');
});

// app is express's app
// pool is mySql "pool" connection
// setting is defined in /config
routes = require('./routes')(app, pool, config);

//=============================== SOCKET CHAT ==================================
// var socket_app     = express();
// var server  = socket_app.listen(6969);
// var io      = require('socket.io').listen(server);

var baseImgUrl = 'https://findlove.cf/';
var serverName = process.env.NAME || 'FindLove';
var redisClient = redis.createClient();
var array_room = [];

var chatHisPage = 20;

function getChatHistory(room, beginIndex, firstLoad, callback) {
    var startLoc = firstLoad ? 0 : beginIndex;
    var messages = redisClient.lrange(room, startLoc, firstLoad ? chatHisPage - 1 : startLoc + (chatHisPage - 1), function(err, reply) {
        var result = [];
        if(!err) {
            // Loop through the list, parsing each item into an object
            for(var msg in reply) result.push(JSON.parse(reply[msg]));
            var results = {
                beginIndex: result.length >= chatHisPage ? startLoc + chatHisPage : null,
                message: result
            };
            callback && callback(results);
        } else {
            var results = {
                beginIndex: null,
                message: result
            };
            callback && callback(results);
        }
    });
}
/*
// sending to sender-client only
socket.emit('message', "this is a test");

// sending to all clients, include sender
io.emit('message', "this is a test");

// sending to all clients except sender
socket.broadcast.emit('message', "this is a test");

// sending to all clients in 'game' room(channel) except sender
socket.broadcast.to('game').emit('message', 'nice game');

// sending to all clients in 'game' room(channel), include sender
io.in('game').emit('message', 'cool game');

// sending to sender client, only if they are in 'game' room(channel)
socket.to('game').emit('message', 'enjoy the game');

// sending to all clients in namespace 'myNamespace', include sender
io.of('myNamespace').emit('message', 'gg');

// sending to individual socketid
socket.broadcast.to(socketid).emit('message', 'for your eyes only');
*/

io.on('connection', function (socket) {
  socket.emit('my-name-is', serverName);

  var addedUser = false;

  socket.on('join_chat', function (data) {
    if (addedUser) return;

    var master_id = data.master_id;
    var salve_id = data.salve_id;
    socket.username = data.user_name;
    var room_id = (master_id > salve_id) ? master_id + '_' + salve_id : salve_id + '_' + master_id;
    console.log(data.user_name + 'has joined room: ' +room_id);
    socket.room = room_id;
    socket.join(room_id);

    var room = io.sockets.adapter.rooms[room_id];

    var jsonData = {
        master_id : master_id,
        salve_id : salve_id,
        user_name : data.user_name,
        total_online : room.length
    };

    io.sockets["in"](socket.room).emit('join_chat', jsonData);

    getChatHistory(socket.room, 0, true, function(result){
        socket.emit('first_load_history', {
            history: result
        });
    });
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new_message', function (data) {
    var mSecondsTime = new Date().getTime();

    var jsonData = {
        master_id: data.master_id,
        salve_id: data.salve_id,
        avatar: data.avatar,
        username: data.username ? data.username : socket.username,
        message: data.message,
        time: mSecondsTime,
        image_url: data.image_url ? data.image_url : ''
    };
    redisClient.lpush(socket.room, JSON.stringify(jsonData));
    if (data.image_url && data.image_url.length > 0) {
        socket.broadcast.to(socket.room).emit('new_message', jsonData);
    } else {
        io.sockets["in"](socket.room).emit('new_message', jsonData);
    }
  });

  socket.on('load_history', function (data){
        var beginIndex = data.begin_index;

        getChatHistory(socket.room, beginIndex, false, function(result){
            socket.emit('load_history', {
                history: result
            });
        });
  });
  //https://www.ibm.com/developerworks/library/wa-bluemix-html5chat/

  // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
        // io.sockets["in"](socket.room).emit('typing',{
        //     username: socket.username
        // });

        socket.emit('typing', {
            username: socket.username
        });
    });

  // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop_typing', function () {
        // io.sockets["in"](socket.room).emit('stop_typing',{
        //     username: socket.username
        // });

        socket.emit('stop_typing', {
            username: socket.username
        });
    });

  // when the user disconnects.. perform this
    socket.on('disconnect', function () {
        io.sockets["in"](socket.room).emit('user_left',{
            username: socket.username,
            numUsers: 1
        });
        console.log(socket.username + ' has left room: ' + socket.room);
    });
});

// CRON JOB to calculate RANK
/**
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, OPTIONAL)
*/

const Rank = {
    FOLLOWER: 1,
    FOLLOWER_MALE: 2,
    FOLLOWER_FEMALE: 3,
    LIKE: 4,
    LIKE_MALE: 5,
    LIKE_FEMALE: 6
}

var j = schedule.scheduleJob('0 0 0 * * *', function(){
    console.log('----------------->*<[Start calculate ranking]>*<-----------------');
    calculateRank();
});

//calculateRank();

function calculateRank() {

    var all_success = 0;
    var STR_FOLLOWER_RANK = '';
    var STR_FOLLOWER_MALE_RANK = '';
    var STR_FOLLOWER_FEMALE_RANK = '';
    var STR_LIKE_RANK = '';
    var STR_LIKE_MALE_RANK = '';
    var STR_LIKE_FEMALE_RANK = '';

    pool.getConnection(function(err, connection) {
        if (err) {
            console.log('Error in database connection');
            return;
        }

        //----->* FOLLOWER *<----//
        connection.query({
            sql: 'SELECT * FROM `profile` WHERE `total_followers` > 0 ORDER BY `total_followers` DESC, `update_follower_time` ASC LIMIT 50',
            timeout: 2000, // 2s
            values: []
        }, function(error, results, fields) {
            if (error) {
                console.log(error);
                connection.release();
            }
            if (results.length == 0 || results == null) { // not found record
                console.log('Empty Profile table!');
                all_success ++;
                console.log('all_success: ' + all_success);
                if (all_success == 6) {
                    connection.release();

                    console.log('SEND MAIL');
                    var data = {
                        follower : STR_FOLLOWER_RANK,
                        follower_male : STR_FOLLOWER_MALE_RANK,
                        follower_female : STR_FOLLOWER_FEMALE_RANK,
                        like : STR_LIKE_RANK,
                        like_male : STR_LIKE_MALE_RANK,
                        like_female : STR_LIKE_FEMALE_RANK
                    };
                    utils.sendMailNewRank(data);
                }
            } else { // found record
                var rankStr = '';
                for (i = 0; i < results.length; i++) {
                    rankStr = rankStr + (i > 0 ? '|' : '') + results[i]['profile_id'];
                }
                connection.query({
                    sql: 'UPDATE `rank` SET `last_rank` = ? WHERE rank_id = ?',
                    timeout: 2000, // 2s
                    values: [rankStr,Rank.FOLLOWER]
                }, function(error, results, fields) {
                    if (error == null) {
                        console.log('Success calculate FOLLOWER RANK!');
                        all_success ++;
                        STR_FOLLOWER_RANK = rankStr;
                        console.log('all_success: ' + all_success);
                        if (all_success == 6) {
                            console.log('SEND MAIL');
                            var data = {
                                follower : STR_FOLLOWER_RANK,
                                follower_male : STR_FOLLOWER_MALE_RANK,
                                follower_female : STR_FOLLOWER_FEMALE_RANK,
                                like : STR_LIKE_RANK,
                                like_male : STR_LIKE_MALE_RANK,
                                like_female : STR_LIKE_FEMALE_RANK
                            };
                            utils.sendMailNewRank(data);
                        }
                    }
                });
            }
        });

        //----->* FOLLOWER_MALE *<----//
        connection.query({
            sql: 'SELECT * FROM `profile`'
            + ' WHERE `gender` = 0 AND `total_followers` > 0 '
            + ' ORDER BY `total_followers` DESC, `update_follower_time` ASC LIMIT 50',
            timeout: 2000, // 2s
            values: []
        }, function(error, results, fields) {
            if (error) {
                console.log('Error in FOLLOWER_MALE query!');
                connection.release();
            }
            if (results.length == 0 || results == null) { // not found record
                console.log('Empty Profile table!');
                all_success ++;
                console.log('all_success: ' + all_success);
                if (all_success == 6) {
                    connection.release();

                    console.log('SEND MAIL');
                    var data = {
                        follower : STR_FOLLOWER_RANK,
                        follower_male : STR_FOLLOWER_MALE_RANK,
                        follower_female : STR_FOLLOWER_FEMALE_RANK,
                        like : STR_LIKE_RANK,
                        like_male : STR_LIKE_MALE_RANK,
                        like_female : STR_LIKE_FEMALE_RANK
                    };
                    utils.sendMailNewRank(data);
                }
            } else { // found record
                var rankStr = '';
                for (i = 0; i < results.length; i++) {
                    rankStr = rankStr + (i > 0 ? '|' : '') + results[i]['profile_id'];
                }
                connection.query({
                    sql: 'UPDATE `rank` SET `last_rank` = ? WHERE rank_id = ?',
                    timeout: 2000, // 2s
                    values: [rankStr,Rank.FOLLOWER_MALE]
                }, function(error, results, fields) {
                    if (error == null) {
                        console.log('Success calculate FOLLOWER_MALE RANK!');
                    }
                    all_success ++;
                    STR_FOLLOWER_MALE_RANK = rankStr;
                    console.log('all_success: ' + all_success);
                    if (all_success == 6) {
                        console.log('SEND MAIL');
                        var data = {
                            follower : STR_FOLLOWER_RANK,
                            follower_male : STR_FOLLOWER_MALE_RANK,
                            follower_female : STR_FOLLOWER_FEMALE_RANK,
                            like : STR_LIKE_RANK,
                            like_male : STR_LIKE_MALE_RANK,
                            like_female : STR_LIKE_FEMALE_RANK
                        };
                        utils.sendMailNewRank(data);
                    }
                });
            }
        });

        //----->* FOLLOWER_FEMALE *<----//
        connection.query({
            sql: 'SELECT * FROM `profile`'
            + ' WHERE `gender` = 1 AND `total_followers` > 0 '
            + ' ORDER BY `total_followers` DESC, `update_follower_time` ASC LIMIT 50',
            timeout: 2000, // 2s
            values: []
        }, function(error, results, fields) {
            if (error) {
                console.log('Error in FOLLOWER_FEMALE query!');
                connection.release();
            }
            if (results.length == 0 || results == null) { // not found record
                console.log('Empty Profile table!');
                all_success ++;
                console.log('all_success: ' + all_success);
                if (all_success == 6) {
                    connection.release();

                    console.log('SEND MAIL');
                    var data = {
                        follower : STR_FOLLOWER_RANK,
                        follower_male : STR_FOLLOWER_MALE_RANK,
                        follower_female : STR_FOLLOWER_FEMALE_RANK,
                        like : STR_LIKE_RANK,
                        like_male : STR_LIKE_MALE_RANK,
                        like_female : STR_LIKE_FEMALE_RANK
                    };
                    utils.sendMailNewRank(data);
                }
            } else { // found record
                var rankStr = '';
                for (i = 0; i < results.length; i++) {
                    rankStr = rankStr + (i > 0 ? '|' : '') + results[i]['profile_id'];
                }
                connection.query({
                    sql: 'UPDATE `rank` SET `last_rank` = ? WHERE rank_id = ?',
                    timeout: 2000, // 2s
                    values: [rankStr,Rank.FOLLOWER_FEMALE]
                }, function(error, results, fields) {
                    if (error == null) {
                        console.log('Success calculate FOLLOWER_FEMALE RANK!');
                    }
                    all_success ++;
                    STR_FOLLOWER_FEMALE_RANK = rankStr;
                    console.log('all_success: ' + all_success);
                    if (all_success == 6) {
                        console.log('SEND MAIL');
                        var data = {
                            follower : STR_FOLLOWER_RANK,
                            follower_male : STR_FOLLOWER_MALE_RANK,
                            follower_female : STR_FOLLOWER_FEMALE_RANK,
                            like : STR_LIKE_RANK,
                            like_male : STR_LIKE_MALE_RANK,
                            like_female : STR_LIKE_FEMALE_RANK
                        };
                        utils.sendMailNewRank(data);
                    }
                });
            }
        });

        //----->* LIKE *<----//
        connection.query({
            sql: 'SELECT * FROM `profile` WHERE `total_got_likes` > 0 ORDER BY `total_got_likes` DESC, `update_got_like_time` ASC LIMIT 50',
            timeout: 2000, // 2s
            values: []
        }, function(error, results, fields) {
            if (error) {
                console.log('Error in LIKE query!');
                connection.release();
            }
            if (results.length == 0 || results == null) { // not found record
                console.log('Empty Profile table!');
                all_success ++;
                console.log('all_success: ' + all_success);
                if (all_success == 6) {
                    connection.release();

                    console.log('SEND MAIL');
                    var data = {
                        follower : STR_FOLLOWER_RANK,
                        follower_male : STR_FOLLOWER_MALE_RANK,
                        follower_female : STR_FOLLOWER_FEMALE_RANK,
                        like : STR_LIKE_RANK,
                        like_male : STR_LIKE_MALE_RANK,
                        like_female : STR_LIKE_FEMALE_RANK
                    };
                    utils.sendMailNewRank(data);
                }

            } else { // found record
                var rankStr = '';
                for (i = 0; i < results.length; i++) {
                    rankStr = rankStr + (i > 0 ? '|' : '') + results[i]['profile_id'];
                }
                connection.query({
                    sql: 'UPDATE `rank` SET `last_rank` = ? WHERE rank_id = ?',
                    timeout: 2000, // 2s
                    values: [rankStr,Rank.LIKE]
                }, function(error, results, fields) {
                    if (error == null) {
                        console.log('Success calculate LIKE RANK!');
                    }
                    all_success ++;
                    STR_LIKE_RANK = rankStr;
                    console.log('all_success: ' + all_success);
                    if (all_success == 6) {
                        console.log('SEND MAIL');
                        var data = {
                            follower : STR_FOLLOWER_RANK,
                            follower_male : STR_FOLLOWER_MALE_RANK,
                            follower_female : STR_FOLLOWER_FEMALE_RANK,
                            like : STR_LIKE_RANK,
                            like_male : STR_LIKE_MALE_RANK,
                            like_female : STR_LIKE_FEMALE_RANK
                        };
                        utils.sendMailNewRank(data);
                    }
                });
            }
        });

        //----->* LIKE_MALE *<----//
        connection.query({
            sql: 'SELECT * FROM `profile`'
            + ' WHERE `gender` = 0 AND `total_got_likes` > 0'
            + ' ORDER BY `total_got_likes` DESC, `update_got_like_time` ASC LIMIT 50',
            timeout: 2000, // 2s
            values: []
        }, function(error, results, fields) {
            if (error) {
                console.log('Error in LIKE_MALE query!');
                connection.release();
            }
            if (results.length == 0 || results == null) { // not found record
                console.log('Empty Profile table!');
                all_success ++;
                console.log('all_success: ' + all_success);
                if (all_success == 6) {
                    console.log('SEND MAIL');
                    var data = {
                        follower : STR_FOLLOWER_RANK,
                        follower_male : STR_FOLLOWER_MALE_RANK,
                        follower_female : STR_FOLLOWER_FEMALE_RANK,
                        like : STR_LIKE_RANK,
                        like_male : STR_LIKE_MALE_RANK,
                        like_female : STR_LIKE_FEMALE_RANK
                    };
                    utils.sendMailNewRank(data);
                    connection.release();
                }
            } else { // found record
                var rankStr = '';
                for (i = 0; i < results.length; i++) {
                    rankStr = rankStr + (i > 0 ? '|' : '') + results[i]['profile_id'];
                }
                connection.query({
                    sql: 'UPDATE `rank` SET `last_rank` = ? WHERE rank_id = ?',
                    timeout: 2000, // 2s
                    values: [rankStr,Rank.LIKE_MALE]
                }, function(error, results, fields) {
                    if (error == null) {
                        console.log('Success calculate LIKE_MALE RANK!');
                    }
                    all_success ++;
                    STR_LIKE_MALE_RANK = rankStr;
                    console.log('all_success: ' + all_success);
                    if (all_success == 6) {
                        console.log('SEND MAIL');
                        var data = {
                            follower : STR_FOLLOWER_RANK,
                            follower_male : STR_FOLLOWER_MALE_RANK,
                            follower_female : STR_FOLLOWER_FEMALE_RANK,
                            like : STR_LIKE_RANK,
                            like_male : STR_LIKE_MALE_RANK,
                            like_female : STR_LIKE_FEMALE_RANK
                        };
                        utils.sendMailNewRank(data);
                    }
                });
            }
        });

        //----->* LIKE_FEMALE *<----//
        connection.query({
            sql: 'SELECT * FROM `profile`'
            + ' WHERE `gender` = 1 AND `total_got_likes` > 0'
            + ' ORDER BY `total_got_likes` DESC, `update_got_like_time` ASC LIMIT 50',
            timeout: 2000, // 2s
            values: []
        }, function(error, results, fields) {
            if (error) {
                console.log('Error in LIKE_FEMALE query!');
                connection.release();
            }
            if (results.length == 0 || results == null) { // not found record
                console.log('Empty Profile table!');
                all_success ++;
                console.log('all_success: ' + all_success);
                if (all_success == 6) {
                    connection.release();

                    console.log('SEND MAIL');
                    var data = {
                        follower : STR_FOLLOWER_RANK,
                        follower_male : STR_FOLLOWER_MALE_RANK,
                        follower_female : STR_FOLLOWER_FEMALE_RANK,
                        like : STR_LIKE_RANK,
                        like_male : STR_LIKE_MALE_RANK,
                        like_female : STR_LIKE_FEMALE_RANK
                    };
                    utils.sendMailNewRank(data);
                }
            } else { // found record
                var rankStr = '';
                for (i = 0; i < results.length; i++) {
                    rankStr = rankStr + (i > 0 ? '|' : '') + results[i]['profile_id'];
                }
                connection.query({
                    sql: 'UPDATE `rank` SET `last_rank` = ? WHERE rank_id = ?',
                    timeout: 2000, // 2s
                    values: [rankStr,Rank.LIKE_FEMALE]
                }, function(error, results, fields) {
                    if (error == null) {
                        console.log('Success calculate LIKE_FEMALE RANK!');
                    }
                    all_success ++;
                    STR_LIKE_FEMALE_RANK = rankStr;
                    if (all_success == 6) {
                        console.log('SEND MAIL');
                        var data = {
                            follower : STR_FOLLOWER_RANK,
                            follower_male : STR_FOLLOWER_MALE_RANK,
                            follower_female : STR_FOLLOWER_FEMALE_RANK,
                            like : STR_LIKE_RANK,
                            like_male : STR_LIKE_MALE_RANK,
                            like_female : STR_LIKE_FEMALE_RANK
                        };
                        utils.sendMailNewRank(data);
                    }
                });
            }
        });
    });
}
