$(function() {
    var socket = io();
    var connected = false;

    socket.on('my-name-is', function (data) {
          connected = true;
          // Display the welcome message
          var message = "Welcome to Socket.IO Chat";
          console.log(data + ', ' + message);
    });

    socket.on('join_chat', function (data) {
        console.log(data);
    });

    $( "#btnLogin" ).click(function() {
        alert( "Handler for .click() called." );
        joinChat();
    });

    function joinChat() {
        if (connected) {
            var master_id = '2';
            var salve_id = '1';
            var user_name = 'Tran Duong Nhien';

            var jsonJoin = {
                master_id : master_id,
                salve_id : master_id,
                user_name : master_id
            };
            socket.emit('join_chat', jsonJoin);
        }
    }
});
