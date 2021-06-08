const REG_ESTIMATE = /\{\d+\s(minutes|minute|min|m|hours|hour|h)\}/g;
const REG_USERS = /<.*?>/g;
const REG_USER = /<|>/g;
const REG_TAG = /#[a-z0-9]+/g;
const REG_DATE = /(@date|\(|\))/g;
const REG_MINUTES = /\[\d+\s(minutes|minute|min|m)\]/g;
const REG_HOURS = /\[\d+\s(hours|hour|hod|h)\]/g;
const REG_PRICE = /\[[0-9\.\,]+(\s[A-Z]{3})?\]/g;

ON('ready', function() {
	EMIT('config');
});

FUNC.stats = function(body) {

	var regExpire = /@date\(.*?\)/g;
	var lines = body.split('\n');
	var stats = {};
	var tmp;

	stats.working = 0;
	stats.pending = 0;
	stats.postponed = 0;
	stats.complete = 0;
	stats.canceled = 0;
	stats.priorities = 0;
	stats.tasks = 0;
	stats.prices = 0;
	stats.minutes = 0;
	stats.estimate = 0;
	stats.expire = null;
	stats.tags = {};
	stats.users = {};

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		var c = line.substring(0, 1);
		var content = line.substring(1).trim();
		var minutes = content.match(REG_ESTIMATE);
		if (minutes) {
			var ishour = (minutes + '').indexOf('h') !== -1;
			var min = +(minutes + '').parseInt2();
			if (ishour)
				min *= 60;
			stats.estimate += min;
		}

		if (c !== '-' && c !== '+')
			continue;

		if (content.substring(0, 3) === '---')
			continue;

		var is = false;

		if (c !== '+') {

			stats.tasks++;

			if (content.indexOf('@done') !== -1) {
				is = true;
				stats.complete++;
			}

			if (content.indexOf('@canceled') !== -1) {
				is = true;
				stats.canceled++;
			}

			if (content.indexOf('@postponed') !== -1) {
				is = true;
				stats.postponed++;
			}

			if (content.indexOf('@working') !== -1)
				stats.working++;
		}

		var users = line.match(REG_USERS);
		if (users) {
			for (var j = 0; j < users.length; j++) {
				var un = (users[j] + '').replace(REG_USER, '');
				if (stats.users[un])
					stats.users[un]++;
				else
					stats.users[un] = 1;
			}
		}

		var tags = line.match(REG_TAG);
		if (tags) {
			for (var j = 0; j < tags.length; j++) {
				var tag = (tags[j] + '').substring(1).trim();
				if (stats.tags[tag])
					stats.tags[tag]++;
				else
					stats.tags[tag] = 1;
			}
		}

		if (!is && c !== '+') {

			if (content.indexOf('@priority') !== -1 || content.indexOf('@important') !== -1)
				stats.priorities++;

			stats.pending++;
			var expire = content.match(regExpire);
			if (expire) {
				expire = (expire + '').replace(REG_DATE, '').parseDate();
				if (stats.expire) {
					if (stats.expire > expire)
						stats.expire = expire;
				} else
					stats.expire = expire;
			}
		}

		tmp = content.match(REG_MINUTES);
		if (tmp) {
			for (var j = 0; j < tmp.length; j++)
				stats.minutes += tmp[j].parseInt2();
		}

		tmp = content.match(REG_HOURS);
		if (tmp) {
			for (var j = 0; j < tmp.length; j++)
				stats.minutes += tmp[j].parseInt2() * 60;
		}

		tmp = content.match(REG_PRICE);
		if (tmp) {
			for (var j = 0; j < tmp.length; j++)
				stats.prices += tmp[j].substring(1, tmp[j].length - 1).parseFloat2();
		}
	}

	stats.tags = Object.keys(stats.tags);
	stats.users = Object.keys(stats.users);

	return stats;
};

FUNC.makesession = function($, userid, callback, note) {
	var model = {};
	model.id = UID();
	model.userid = userid;
	model.ua = $.ua;
	model.ip = $.ip;
	model.dtcreated = NOW;
	model.dtexpire = NOW.add('1 month');
	model.note = note;
	DB.sessions.push(model);
	FUNC.save('sessions');
	$.cookie(CONF.cookie, ENCRYPTREQ($, { id: model.id, dtcreated: model.dtcreated }, CONF.secret_session), '1 month', { httponly: true, security: 'lax' });
	callback();
};

FUNC.notallowed = function(doc, user) {

	if (doc.isprivate && doc.userid !== user.id)
		return true;

	if (doc.roles && doc.roles.length) {
		if (!user.roles || !user.roles.length)
			return true;
		for (var m of doc.roles) {
			if (user.roles.indexOf(m) === -1)
				return true;
		}
	}

	if (doc.groups && doc.groups.length) {
		if (!user.groups || !user.groups.length)
			return true;
		for (var m of doc.groups) {
			if (user.groups.indexOf(m) === -1)
				return true;
		}
	}

};