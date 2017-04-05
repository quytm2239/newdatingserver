// ---------------------------------------------------------
// Utilities function
// ---------------------------------------------------------

var nodemailer = require('nodemailer');
var passwordHash = require('password-hash');
var errcode = require('./../errcode');
var fs = require("fs");

module.exports =
{
    getDistance: function (lat1,lon1,lat2,lon2)
    {
        var R = 6371; // Radius of the earth in km (mean radius)
        var dLat = deg2rad(lat2-lat1);  // deg2rad below
        var dLon = deg2rad(lon2-lon1);
        var a =
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
          Math.sin(dLon/2) * Math.sin(dLon/2)
          ;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        var d = R * c; // Distance in km
        return d;
    },
    deg2rad: function (deg)
    {
      return deg * (Math.PI/180)
    },
    responseConvention: function (code,data)
    {
        var JSONobj = {
            status: code,
            message: errcode.errorMessage(code),
            data: data
        };
        return JSONobj;
    },
    responseWithMessage: function (code,message,data)
    {
        var JSONobj = {
    		status: code,
    		message: message,
    		data: data
    	};
    	return JSONobj;
    },
    responsePhotos: function (code,message,photos)
    {
        var JSONobj = {
            status: code,
            message: message,
            photos: photos
        };
        return JSONobj;
    },
    chkObj: function (obj)
    {
        if ((obj === undefined || obj === null || obj.length == 0) == false) {
    		return true;
    	}
    	return false;
    },
    hashPass: function (orginialPass)
    {
        return passwordHash.generate(orginialPass);
    },
    isExactPass: function (inputPass,passToCheck)
    {
        return passwordHash.verify(inputPass, passToCheck);
    },
    validateEmail: function (email)
    {
        var regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return regex.test(email);
    },
    validateBirthday: function (birthDay)
    {
    	var regex = /^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/;

    	if (regex.test(birthDay)) {
    		var res = birthDay.split("-");
    		var year = res[0];
    		var month = res[1];
    		var day = res[2];

    		if (month < 1 || month > 12 || day <= 0) {
    			return false;
    		}

    		switch (month) {
    			case '01': case '03': case '05': case '07':
    			case '08': case '10': case '12':
    				if (day > 31) return false;
    			break;

    			case '02':
    				if (year%4 == 0 && day > 29)  { return false; }
    				if (year%4 != 0 && day > 28)  { return false; }
    			break;

    			case '04': case '06': case '09': case '11':
    				if (day > 30) return false;
    			break;
    		}
    		return true;

    	} else {
    		return false;
    	}
    },
    checkAge: function (birthDay)
    {
        var res = birthDay.split("-");
        var birth_year = res[0];
        var birth_month = res[1];
        var birth_day = res[2];

        today_date = new Date();
        today_year = today_date.getFullYear();
        today_month = today_date.getMonth();
        today_day = today_date.getDate();
        age = today_year - birth_year;

        if ( today_month < (birth_month - 1))
        {
            age--;
        }
        if (((birth_month - 1) == today_month) && (today_day < birth_day))
        {
            age--;
        }

        if (age < 18 || age > 80) {
            return false;
        }
        return true;
    },
    validatePhone: function (phone)
    {
    	var regex = /^[0-9]{10,11}$/;
    	return regex.test(phone);
    },
    validateCoordinate: function (latitude,longitude)
    {
    	if (
    		(isNaN(latitude) == false || isNaN(longitude) == false)
    		&&
    		(latitude <= 90.0 && latitude >= -90.0) || (longitude >= - 180.0 && longitude <= 180.0)
    		) {
    		return true;
    	}
    	return false;
    },
    getAge: function (birthDayStr)
    {
    	var birthDay = new Date(birthDayStr);
        var diff = new Date().getTime() - birthDay.getTime();
    	return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    },
    sendMailResetPass: function (emailLogin, resetPass)
    {
        var transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'findlove.noreply@gmail.com', // Your email id
                pass: 'thucgu12' // Your password
            }
        });

    	var text = 'Your new pass of ' + emailLogin + ' is: ' + resetPass;

    	var mailOptions = {
    		from: 'noreply_dating@gmail.com', // sender address
    		to: emailLogin, // list of receivers
    		subject: 'Dating Reset password', // Subject line
    		text: text
    	};

    	transporter.sendMail(mailOptions, function(error, info){
    		if(error){
    			console.log(error);
    		}else{
    			console.log('Message sent: ' + info.response);
    		};
    	});
    },
    sendMailNewRank: function (data)
    {
        var string = JSON.stringify(data);
        var transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'findlove.noreply@gmail.com', // Your email id
                pass: 'thucgu12' // Your password
            }
        });

        var text = 'New Ranking Data - ' + Date() + '\n' + string;
        console.log(text);
        var mailOptions = {
            from: 'noreply_dating@gmail.com', // sender address
            to: 'quytm2239@gmail.com', // list of receivers
            subject: 'Dating New Ranking Data', // Subject line
            text: text
        };

        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                console.log(error);
            }else{
                console.log('Message sent: ' + info.response);
            };
        });
    },
    createDir: function (base_path,account_id,sub_path) {
        console.log("Going to create directory in " + base_path + " for account_id: " + account_id);
        fs.mkdir(base_path + '/' + account_id + '/' + sub_path,function(err){
            if (err) {
                console.error(err);
            } else {
                console.log("Directory created successfully!");
            }
        });
    },
    removeDir: function (base_path,account_id,sub_path) {
        console.log("Going to remove directory in " + base_path + " for account_id: " + account_id);
        fs.rmdir(base_path + '/' + account_id + (module.exports.chkObj(sub_path) ? '/' + sub_path : ''),function(err){
            if (err) {
                return console.error(err);
            }
           console.log("Going to read directory " + base_path);

            fs.readdir(base_path,function(err, files){
                if (err) {
                    return console.error(err);
                }
                files.forEach( function (file){
                    console.log( file );
                });
            });
        });
    },
    createAccountDir: function (base_path,account_id,sub_path) {
        fs.mkdir(base_path + '/' + account_id + (module.exports.chkObj(sub_path) ? '/' + sub_path : ''),function(err){
            if (err) {
                console.error(err);
            } else {
                module.exports.createDir(base_path,account_id,'avatar');
                module.exports.createDir(base_path,account_id,'photos');
                module.exports.createDir(base_path,account_id,'chat');
            }
        });
    },
}
