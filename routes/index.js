// Divide all of your modules in different files and
// require them here
// app is express's app
// pool is mySql "pool" connection
// setting is defined in /config
var bef_path = './before_login';
var aft_path = './after_login';
var check_token = require('./../middleware/check_token');

module.exports = function(app, pool, config){
	// before login
	require(bef_path + '/register')(app, pool, config);
	require(bef_path + '/loginFB')(app, pool, config);
	require(bef_path + '/login')(app, pool, config);
	require(bef_path + '/forgot')(app, pool, config);

	app.use(check_token);
	// after login
	require(aft_path + '/notify')(app, pool, config);
	require(aft_path + '/change_pass')(app, pool, config);
	require(aft_path + '/profile')(app, pool, config);
	require(aft_path + '/upload')(app, pool, config);
};
