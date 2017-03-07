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
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/uploaded_image'));
app.use(show_clientip);

requireFromRoot = (function(root) {
    return function(resource) {
        return require(root+"/"+resource);
    }
})(__dirname);

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

function getNumber(value) {
    if (isNaN(value)) {
        return parseInt(value);
    } else {
        return 0;
    }
}

var serverName = process.env.NAME || 'FindLove';
var redisClient = redis.createClient();
var array_room = [];
io.on('connection', function (socket) {
  socket.emit('my-name-is', serverName);

  var addedUser = false;

  // when the client emits 'add user', this listens and executes
  socket.on('join_chat', function (data) {
    if (addedUser) return;

    var master_id = data.master_id;
    var salve_id = data.salve_id;
    socket.username = data.user_name;

    var room_id = (getNumber(master_id) > getNumber(salve_id)) ? master_id + '_' + salve_id : salve_id + '_' + master_id;
    console.log(room_id);

    socket.room = room_id;
    socket.join(room_id);

    socket.emit('join_chat', 'SERVER', 'you have connected to ' + room_id);
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new_message', function (data) {
    var jsonData = {
        username: data.username ? data.username : socket.username;
        message: data.message;
    };
    redisClient.lpush(socket.room, JSON.stringify(jsonData));
    io.sockets["in"](socket.room).emit('new_message', jsonData);
  });

  socket.on('load_history', function (data){
      // Get the 100 most recent messages from Redis
      var messages = redisClient.lrange(socket.room, 0, 99, function(err, reply) {
        if(!err) {
          var result = [];
          // Loop through the list, parsing each item into an object
          for(var msg in reply) result.push(JSON.parse(reply[msg]));
          // Pass the message list to the view
          socket.emit('load_history', {
            message: result
          });
        } else {
            socket.emit('load_history', {
              message: []
          });
        }
      });
  });
  //https://www.ibm.com/developerworks/library/wa-bluemix-html5chat/

  // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
        io.sockets["in"](socket.room).emit('typing',{
            username: socket.username
        });
    });

  // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop_typing', function () {
        io.sockets["in"](socket.room).emit('stop_typing',{
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
