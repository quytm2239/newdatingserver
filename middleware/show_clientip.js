// ---------------------------------------------------------
// Route middleware to show client's IP address
// --------------------------------------------------------

module.exports = function(req, res, next) {
	console.log('Request from: ' + req.connection.remoteAddress + ' on ' + new Date());
	next();
};
