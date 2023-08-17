const BOT = { id: 'bot', name: 'Bot', sa: true, permissions: ['bot'] };

var opt = {};

opt.secret = CONF.auth_secret;
opt.cookie = CONF.auth_cookie;
opt.expire = '3 minutes';
opt.cleaner = '5 minutes';
opt.strict = false;
opt.ddos = 10;

opt.onauthorize = function($) {

	var token = $.headers['x-token'];
	if (token) {

		if (token === CONF.token) {
			$.success(BOT);
		} else
			$.invalid();

		return true;
	}

};

opt.onread = async function(meta, next) {
	var session = DATA.read('tbl_session').id(meta.sessionid).where('userid', meta.userid).where('dtexpire>NOW()').promise();
	if (session) {
		var user = await DATA.read('tbl_user').fields('id,language,name,photo,email,notifications,permissions,sa').id(meta.userid).where('isdisabled=FALSE AND isremoved=FALSE').promise();
		if (user) {

			if (!user.language)
				user.language = '';

			if (!user.permissions)
				user.permissions = [];

			user.admin = user.sa || user.permissions.includes('admin');

			DATA.modify('tbl_user', { isonline: true, dtlogged: NOW }).id(meta.userid);
			DATA.modify('tbl_session', { isonline: true, dtlogged: NOW }).id(meta.sessionid);
			next(null, user);
		} else
			next(404);
	} else
		next(404);
};

opt.onfree = function(meta) {

	var mod = { isonline: false };

	DATA.modify('tbl_session', mod).query('isonline=TRUE').id(meta.sessions);

	if (meta.users && meta.users.length)
		DATA.modify('tbl_user', mod).query('isonline=TRUE').id(meta.users);
};

AUTH(opt);
MAIN.session = opt;

ON('ready', function() {
	DATA.query('UPDATE tbl_session SET isonline=FALSE WHERE isonline=TRUE');
	DATA.query('UPDATE tbl_user SET isonline=FALSE WHERE isonline=TRUE');
});

ON('configure', function() {
	opt.secret = CONF.auth_secret;
	opt.cookie = CONF.auth_cookie;
});

ON('service', function(counter) {

	if (counter % 1440 === 0)
		DATA.query("DELETE FROM tbl_session WHERE dtexpire<timezone('utc'::text, now())").error(ERROR('Clear expired sessions'));

});

LOCALIZE(req => req.query.language || (req.user ? req.user.language : CONF.language));