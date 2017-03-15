var socket = io();
var baseURL = 'https://findlove.cf:1235';

$(function() {
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

    socket.on('load_history', function (data) {
        console.log(data);
    });

    // $( "#btnLogin" ).click(function() {
    //     joinChat();
    // });
    //
    // function joinChat() {
    //     if (connected) {
    //         var master_id = '2';
    //         var salve_id = '1';
    //         var user_name = 'Trần Mạnh Quý';
    //
    //         var jsonJoin = {
    //             master_id : master_id,
    //             salve_id : salve_id,
    //             user_name : user_name
    //         };
    //         socket.emit('join_chat', jsonJoin);
    //     }
    // }
});
