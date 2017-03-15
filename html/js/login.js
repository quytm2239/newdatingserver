var apiLogin = '/api/login';

$(function() {

    function callAPILogin(email_login, password, callback)
    {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200)
                callback(this.responseText);
        }
        xhttp.open("POST", baseURL + apiLogin, true);
        xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhttp.send("email_login="+ email_login + "&" + "password=" + password);
    }

    $( "#btnLogin" ).click(function() {
        login();
    });

    function login() {
        var email_login = $("#inputLoginID").val();
        var password = $("#inputPassword").val();
        console.log(email_login + ' ' + password);

        callAPILogin(email_login,password,function(responseText){
            console.log(responseText);
        });
    }
});
