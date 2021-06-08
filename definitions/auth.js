MAIN.sessions = {};

AUTH(function($) {
	var cookie = $.cookie(CONF.cookie);

	if (!cookie || cookie.length < 30) {
		$.invalid();
		return;
	}

	var obj = DECRYPTREQ($, cookie, CONF.secret_session);
	if (!obj || !obj.id) {
		$.cookie(CONF.cookie, '', '-1 day');
		$.invalid();
		return;
	}

	var session = MAIN.sessions[obj.id];
	if (session) {
		$.success(session);
		return;
	}

	var response = DB.sessions.findItem('id', obj.id);
	if (response) {
		var user = DB.users.findItem('id', response.userid);
		if (user && !user.inactive) {
			var session = {};
			session.id = user.id;
			session.sessionid = response.id;
			session.theme = user.theme;
			session.photo = user.photo;
			session.name = user.name;
			session.email = user.email;
			session.languageid = user.languageid;
			session.countryid = user.countryid;
			session.currencyid = user.currencyid;
			session.dateformat = user.dateformat;
			session.numberformat = user.numberformat;
			session.timeformat = user.timeformat;
			session.version = user.version;
			session.datefirst = user.datefirst;
			session.expire = NOW.add('30 minutes');
			session.sa = user.sa;
			session.groups = user.groups;
			session.roles = user.roles;
			session.position = user.position;
			session.json = function() {
				return { id: this.id, photo: this.photo, name: this.name, languageid: this.languageid, countryid: this.countryid, currencyid: this.currencyid, dtexpire: this.dtexpire, dateformat: this.dateformat, numberformat: this.numberformat, datefirst: this.datefirst, timeformat: this.timeformat, theme: this.theme, sa: this.sa, roles: this.roles, groups: this.groups, position: this.position };
			};

			response.dtlogged = NOW;
			response.isonline = true;
			response.ua = $.ua;
			response.ip = $.ip;

			user.dtlogged = NOW;
			user.isonline = true;

			MAIN.sessions[obj.id] = session;
			$.success(session);
			FUNC.save('users', 'sessions');
		} else {
			$.cookie(CONF.cookie, '', '-1 day');
			$.invalid();
		}
	} else {
		$.cookie(CONF.cookie, '', '-1 day');
		$.invalid();
	}
});

ON('service', function(counter) {

	// Session cleaner
	if (counter % 720 === 0) {
		var removed = DB.sessions.remove(item => item.dtexpire < NOW || (item.dtlogged && item.dtlogged.add('5 days') < NOW));
		if (removed.length !== DB.sessions.length) {
			DB.sessions = removed;
			FUNC.save('sessions');
		}
	}

	if (counter % 5 === 0) {
		var users = {};
		var is = false;
		for (var key in MAIN.sessions) {
			if (MAIN.sessions[key].expire < NOW) {
				users[MAIN.sessions[key].id] = 1;
				delete MAIN.sessions[key];
				is = true;
			}
		}

		if (is) {
			for (var item of DB.users) {
				if (users[item.id])
					item.isonline = false;
			}
			FUNC.save('users');
		}
	}

});