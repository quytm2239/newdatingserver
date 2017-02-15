// ---------------------------------------------------------
// Route middleware to authenticate and check token
// --------------------------------------------------------
/* /.. is back to 1 level parrent directory */
var config = require('./../config');
var jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.headers['token'];

    // decode token
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, config.super_secret, function(err, decoded) {
            if (err) {
                return res.status(400).send({
                    status: 4031,
                    message: 'Token is not valid!',
					data: []
                });
            } else {

                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.status(403).send({
            status: 403,
            message: 'No token provided.',
			data: []
        });
    }
};
