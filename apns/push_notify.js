var apn  = require("apn")

var apnError = function(err){
    console.log("APN Error:", err);
}

//com.sft.findmylove
var options = {
    'cert': 'apns/FindLove.pem',
    'key':  'apns/FindLove_key_nopass.pem',
    "passphrase": null,
    "gateway": "gateway.push.apple.com",
    "enhanced": true,
    "cacheLength": 5,
    'production': true,
    'fastMode':true
  };
options.errorCallback = apnError;

var feedBackOptions = {
    "batchFeedback": true,
    "interval": 300
};

var apnProvider, apnConnection, feedback;

module.exports = {

    init : function(){
        if (!apnProvider) {
            apnProvider = new apn.Provider(options);
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

        note = new apn.Notification();

        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        note.badge = 1;
        note.sound = "ping.aiff";
        note.alert = params.message;
        note.payload = params.payload;
        note.topic = "com.NhaDao.FindMyLove";

        if(apnProvider) {
            apnProvider.send(note, params.token).then( (result) => {
              // see documentation for an explanation of result
                console.log(result.failed);
            });
        }
    },

    sendMultipToken : function (params){
        var myDevice, note;

        //myDevice = new apn.Device(params.token);
        note = new apn.Notification();

        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        note.badge = 1;
        note.sound = "ping.aiff";
        note.alert = params.message;
        note.payload = params.payload;
        note.topic = "com.NhaDao.FindMyLove";

        if(apnProvider) {
            apnProvider.send(note, params.token).then( (result) => {
              // see documentation for an explanation of result
                console.log(result.failed);
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
