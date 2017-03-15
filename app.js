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

var fs = require('fs');
var redis = require('redis');

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
      level:            'info',
      filename:         './all-logs.log',
      handleExceptions: true,
      json:             true,
      maxsize:          104857600, //100MB
      maxFiles:         10,
      colorize:         false
    }),
    new winston.transports.Console({
      level:            'debug',
      handleExceptions: true,
      json:             false,
      colorize:         true
    })
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
// app is express's app
// pool is mySql "pool" connection
// setting is defined in /config
routes = require('./routes')(app, pool, config);

//=============================== SOCKET CHAT ==================================
// var socket_app     = express();
// var server  = socket_app.listen(6969);
// var io      = require('socket.io').listen(server);

var serverName = process.env.NAME || 'FindLove';
var redisClient = redis.createClient();
var array_room = [];

var chatHisPage = 20;

function getChatHistory(room, beginIndex, firstLoad, callback) {
    var startLoc = firstLoad ? 0 : beginIndex;
    console.log('startLoc: ' + startLoc);
    console.log('firstLoad: ' + firstLoad);
    console.log('beginIndex: ' + beginIndex);
    var messages = redisClient.lrange(room, startLoc, firstLoad ? chatHisPage - 1 : startLoc + (chatHisPage - 1), function(err, reply) {
      if(!err) {
          var result = [];
            // Loop through the list, parsing each item into an object
            for(var msg in reply) result.push(JSON.parse(reply[msg]));
            // Pass the message list to the view
            // socket.emit('load_history', {
            //     beginIndex: startLoc.length >= chatHisPage ? startLoc : null,
            //     message: result
            // });
            var result = {
                beginIndex: result.length >= chatHisPage ? startLoc + chatHisPage : null,
                message: result
            };
            callback && callback(result);
        } else {
            var result = {
                beginIndex: null,
                message: result
            };
            callback && callback(result);
        }
    });
}

io.on('connection', function (socket) {
  socket.emit('my-name-is', serverName);

  var addedUser = false;

  // when the client emits 'add user', this listens and executes
  socket.on('join_chat', function (data) {
    if (addedUser) return;

    var master_id = data.master_id;
    var salve_id = data.salve_id;
    socket.username = data.user_name;
    var room_id = (master_id > salve_id) ? master_id + '_' + salve_id : salve_id + '_' + master_id;
    console.log(room_id);
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
        socket.emit('load_history', {
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
        time: mSecondsTime
    };
    redisClient.lpush(socket.room, JSON.stringify(jsonData));
    io.sockets["in"](socket.room).emit('new_message', jsonData);
  });

  socket.on('load_history', function (data){
        // Get the 100 most recent messages from Redis
        var beginIndex = data.begin_index;

        //console.log('startLoc: ' + startLoc);
        //console.log('firstLoad: ' + firstLoad);
        //console.log('beginIndex: ' + beginIndex);

        getChatHistory(socket.room, beginIndex, false, function(result){
            socket.emit('load_history', {
                history: result
            });
        });

        // var messages = redisClient.lrange(socket.room, beginIndex, -1, function(err, reply) {
        //     if(!err) {
        //         var result = [];
        //         // Loop through the list, parsing each item into an object
        //         for(var msg in reply) result.push(JSON.parse(reply[msg]));
        //         // Pass the message list to the view
        //         socket.emit('load_history', {
        //             message: result
        //         });
        //     } else {
        //         socket.emit('load_history', {
        //             message: []
        //         });
        //     }
        // });
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
