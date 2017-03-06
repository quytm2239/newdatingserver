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

//================================
var serverName = process.env.NAME || 'QuyTMServer';
var redisClient = redis.createClient();
io.on('connection', function (socket) {
  socket.emit('my-name-is', serverName);

  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
	console.log('---> SENDER: ' + socket.username + ', "' + data +'"');
    // REDIS
    redisClient.lpush('messages', JSON.stringify(data));
    redisClient.ltrim('messages', 0, 99);

    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });
  //https://www.ibm.com/developerworks/library/wa-bluemix-html5chat/
  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
	console.log('--->' + username + ' has joined, total: ' + numUsers + ' joined');
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
	  console.log('--->' + socket.username + ' has left, total: ' + numUsers + ' joined');
    }
  });
});
