module.exports={
    code_db_error: 1000,
    code_upload_error: 1001,
    code_success: 200,
    code_null_invalid_email: 2001,
    code_null_invalid_password: 2002,
    code_null_invalid_full_name: 2003,
    code_null_invalid_user_status: 2004,
    code_null_invalid_gender: 2005,
    code_null_invalid_avatar: 2006,
    code_null_invalid_birthday: 2007,
    code_null_invalid_lat_long: 2008,
    code_null_invalid_address: 2009,
    code_null_invalid_phone: 2010,
    code_null_invalid_profile_description: 2011,
    code_duplicate_email_login: 2012,
    code_duplicate_full_name: 2013,
    code_wrong_old_password: 2014,
    code_not_exist_email: 2015,
    code_not_exist_profile: 2016,
    code_not_exist_status: 2017,
    code_not_match_password: 2018,
    code_null_invalid_page_size: 2019,
    code_null_invalid_page: 2020,
    code_null_invalid_upload_file: 2021,
    code_null_invalid_followed_profile_id: 2022,
    code_not_exist_followed_profile_id: 2023,
    code_not_allow_follow_profile_id: 2024,
    code_not_allow_follow_unfollow_self: 2025,
    code_not_allow_unfollow_profile_id: 2026,

    errorMessage: function (code) {
    	var mess;
    	switch (code) {
        case module.exports.code_upload_error:
            mess = "Files is not uploaded successfully!";
            break;
    	case module.exports.code_success:
    		mess = "Sucessfully!";
    		break;
    	case module.exports.code_null_invalid_email:
    		mess = "Email is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_password:
    		mess = "Password is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_full_name:
    		mess = "full_name is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_user_status:
    		mess = "user_status is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_gender:
    		mess = "gender is blank or not valid (number is valid, 0 - Male, 1 - Female, All - all gender).";
    		break;
    	case module.exports.code_null_invalid_avatar:
    		mess = "avatar is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_birthday:
    		mess = "birthday is blank/null or not valid. (yyyy-mm-dd)";
    		break;
    	case module.exports.code_null_invalid_lat_long:
    		mess = "latitude & longitude is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_address:
    		mess = "province is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_phone:
    		mess = "phone is blank/null or not valid.";
    		break;
    	case module.exports.code_null_invalid_profile_description:
    		mess = "profile_description is blank/null or not valid.";
    		break;
    	case module.exports.code_duplicate_email_login:
    		mess = "email_login already exist";
    		break;
    	case module.exports.code_duplicate_full_name:
    		mess = "full_name already exist";
    		break;
    	case module.exports.code_wrong_old_password:
    		mess = "old_password is wrong";
    		break;
    	case module.exports.code_not_exist_email:
    		mess = "email does not exist";
    		break;
    	case module.exports.code_not_exist_profile:
    		mess = "profile does not exist";
    		break;
    	case module.exports.code_not_exist_status:
    		mess = "status does not exist";
    		break;
    	case module.exports.code_not_match_password:
    		mess = "password does not match/wrong password";
    		break;
    	case module.exports.code_null_invalid_page_size:
    		mess = "page_size is blank/null or not valid. (number required)";
    		break;
    	case module.exports.code_null_invalid_page:
    		mess = "page is blank/null or not valid. (number required)";
    		break;
        case module.exports.code_null_invalid_upload_file:
            mess = "upload file is blank/null or not valid.";
            break;
        case module.exports.code_null_invalid_followed_profile_id:
            mess = "followed profile_id is blank/null or not valid.(number required)";
            break;
        case module.exports.code_not_exist_followed_profile_id:
            mess = "followed profile_id does not exist.";
            break;
        case module.exports.code_not_allow_follow_profile_id:
            mess = "you are following this profile.";
            break;
        case module.exports.code_not_allow_follow_unfollow_self:
            mess = "you can not follow/unfollow your profile.";
            break;
        case module.exports.code_not_allow_unfollow_profile_id:
            mess = "you does not follow this profile, can not unfollow.";
            break;
        }
    	return mess;
    }
};
