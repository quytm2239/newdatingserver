var apn  = require("apn")

var apnError = function(err){
    console.log("APN Error:", err);
}

//com.sft.findmylove
var options = {
    'cert': 'apns/apns-dev-cert.pem',
    'key':  'apns/apns-dev-key-noenc.pem',
    "passphrase": null,
    "gateway": "gateway.sandbox.push.apple.com",
    "port": 2195,
    "enhanced": true,
    "cacheLength": 5
  };
options.errorCallback = apnError;

var feedBackOptions = {
    "batchFeedback": true,
    "interval": 300
};

var appProvider, apnConnection, feedback;

module.exports = {
    init : function(){
        if (!appProvider && !apnConnection) {
            appProvider = new apn.Provider(options);
            // apnConnection = new apn.Connection();

            // feedback = new apn.Feedback(feedBackOptions);
            // feedback.on("feedback", function(devices) {
            //     devices.forEach(function(item) {
            //         //TODO Do something with item.device and item.time;
            //     });
            // });
        }
    },

    send : function (params){
        var myDevice, note;

        //myDevice = new apn.Device(params.token);
        note = new apn.Notification();

        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        note.badge = 1;
        note.sound = "ping.aiff";
        note.alert = params.message;
        note.payload = params.payload;

        if(appProvider) {
            apnProvider.send(note, params.token).then( (result) => {
              // see documentation for an explanation of result
            });
        }
    }
}

/*usage
pushNotify = require("./pushNotify");
pushNotify.init();
//use valid device token to get it working
pushNotify.send({token:'', message:'Test message', from: 'sender'});

{
     "aps" : { "alert" : "This is the alert text", "badge" : 1, "sound" : "default" },
     "server" : { "serverId" : 1, "name" : "Server name")
}
*/
