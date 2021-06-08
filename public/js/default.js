FUNC.updategroups = function(item) {
	var is = false;
	for (var m of item.groups) {
		var tmp = common.groups.findItem('id', m);
		if (!tmp) {
			common.groups.push({ id: m, name: m, count :1 });
			is = true;
		}
	}
	is && UPD('common.groups');
};

FUNC.updateroles = function(item) {
	var is = false;
	for (var m of item.roles) {
		var tmp = common.roles.findItem('id', m);
		if (!tmp) {
			common.roles.push({ id: m, name: m, count :1 });
			is = true;
		}
	}
	is && UPD('common.groups');
};

(function() {
	var REG_ESTIMATE = /\{\d+\s(minutes|minute|min|m|hours|hour|h)\}/g;
	var REG_USERS = /<.*?>/g;
	var REG_USER = /<|>/g;
	var REG_TAG = /#[a-z0-9]+/g;
	var REG_DATE = /(@date|\(|\))/g;
	var REG_MINUTES = /\[\d+\s(minutes|minute|min|m)\]/g;
	var REG_HOURS = /\[\d+\s(hours|hour|hod|h)\]/g;
	var REG_PRICE = /\[[0-9\.\,]+(\s[A-Z]{3})?\]/g;

	FUNC.note_stats = function(body) {

		var regExpire = /@date\(.*?\)/g;
		var lines = body.split('\n');
		var stats = {};
		var tmp;

		stats.working = 0;
		stats.pending = 0;
		stats.complete = 0;
		stats.canceled = 0;
		stats.postponed = 0;
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
				var min = +(minutes + '').parseInt();
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
					stats.minutes += tmp[j].parseInt();
			}

			tmp = content.match(REG_HOURS);
			if (tmp) {
				for (var j = 0; j < tmp.length; j++)
					stats.minutes += tmp[j].parseInt() * 60;
			}

			tmp = content.match(REG_PRICE);
			if (tmp) {
				for (var j = 0; j < tmp.length; j++)
					stats.prices += tmp[j].substring(1, tmp[j].length - 1).parseFloat();
			}
		}

		stats.tags = Object.keys(stats.tags);
		stats.users = Object.keys(stats.users);

		return stats;
	};

})();

FUNC.note_clean = function(body) {

	var lines = body.split('\n');
	var builder = [];
	var tasks_ok = [];
	var tasks_no = [];
	var tasks_pr = [];
	var tasks_hi = [];
	var tasks_pe = [];

	function flush() {
		tasks_pr.length && builder.push(tasks_pr.join('\n'));
		tasks_hi.length && builder.push(tasks_hi.join('\n'));
		tasks_pe.length && builder.push(tasks_pe.join('\n'));
		tasks_ok.length && builder.push(tasks_ok.join('\n'));
		tasks_no.length && builder.push(tasks_no.join('\n'));
		tasks_ok = [];
		tasks_no = [];
		tasks_pr = [];
		tasks_hi = [];
		tasks_pe = [];
	}

	for (var i = 0, length = lines.length; i < length; i++) {
		var line = lines[i];
		var raw = line.trim();
		if (raw.charCodeAt(0) !== 45 || raw.substring(0, 3) === '---') {
			flush();
			builder.push(line.replace(/\n|\r/g, '').rtrim());
		} else if (raw.lastIndexOf('@done') !== -1)
			tasks_ok.push(line.replace(/\n|\r/g, '').rtrim());
		else if (raw.lastIndexOf('@canceled') !== -1)
			tasks_no.push(line.replace(/\n|\r/g, '').rtrim());
		else if (raw.lastIndexOf('@priority') !== -1)
			tasks_pr.push(line.replace(/\n|\r/g, '').rtrim());
		else if (raw.lastIndexOf('@high') !== -1)
			tasks_hi.push(line.replace(/\n|\r/g, '').rtrim());
		else
			tasks_pe.push(line.replace(/\n|\r/g, '').rtrim());
	}

	flush();
	return builder.join('\n');
};

FUNC.note_clear = function(body) {

	var lines = body.split('\n');
	var builder = [];

	for (var i = 0, length = lines.length; i < length; i++) {
		var line = lines[i];
		var raw = line.trim();

		if (raw.charCodeAt(0) !== 45 || raw.substring(0, 3) === '---') {
			builder.push(line);
			continue;
		}

		if (raw.lastIndexOf('@done') !== -1)
			continue;

		if (raw.lastIndexOf('@postponed') !== -1)
			continue;

		if (raw.lastIndexOf('@canceled') !== -1)
			continue;

		builder.push(line);
	}

	return builder.join('\n');
};

FUNC.note_print = function(note) {
	var body = Tangular.helpers.encode(note.body).replace(/\t/g, '    ');

	body = body.replace(/~.*?~/g, function(text) {
		return '<s>' + text.replace(/~/g, '') + '</s>';
	}).replace(/\*.*?\*/g, function(text) {
		return '<u>' + text.replace(/\*/g, '') + '</u>';
	}).replace(/\{.*?\}/g, function(text) {
		return '<b style="color:#2A7FBD">' + text + '</b>';
	});

	var lines = body.split('\n');
	var output = [];
	var skip = false;

	for (var i = 0, length = lines.length; i < length; i++) {
		var line = lines[i];
		var raw = line.trim();

		if (skip) {
			output.push(line);
			continue;
		}

		if (raw.substring(0, 3) === '```') {
			output.push(line);
			if (skip)
				skip = false;
			else
				skip = true;
			continue;
		}

		if (raw.substring(0, 2) === '@ ') {
			line = '<span style="font-size:20px;font-weight:bold;color:#000">' + line + '</span>';
			output.push(line);
			continue;
		}

		if (raw.substring(0, 2) === '# ') {
			line = '<span style="font-size:16px;font-weight:bold;color:#5066C2">' + line + '</span>';
			output.push(line);
			continue;
		}

		if (raw.substring(0, 3) === '// ') {
			line = '<span style="color:#a50">' + line + '</span>';
			output.push(line);
			continue;
		}

		if (raw.substring(0, 2) === '= ') {
			var trimmed = line.trim();
			var plus = line.substring(0, line.length - trimmed.length);
			line = plus + '<span style="border:2px solid #000;padding:2px;color:#000">' + trimmed + '</span>';
			output.push(line);
			continue;
		}

		if (raw.charCodeAt(0) !== 45) {
			output.push(line);
			continue;
		}

		if (line.indexOf('@done') !== -1)
			line = '<span style="color:#74A944">' + line.replace('-', '&#10003;') + '</span>';
		else if (line.indexOf('@canceled') !== -1)
			line = line.replace('-', '<s style="color:#B03A2F">-') + '</s>';
		else if (line.indexOf('@priority') !== -1)
			line = line.replace('-', '<span style="color:#E58281">-') + '</span>';
		else if (line.indexOf('@high') !== -1)
			line = line.replace('-', '<span style="color:black">-') + '</span>';

		output.push('<span style="color:gray">' + line + '</span>');
	}

	var val = '<!DOCTYPE html><html><head><title>Todomator: ' + note.name + '</title><meta charset="utf-8" /></head><body style="font-family:monospace;font-size:14px;line-height:20px;padding:20px"><pre style="white-space:pre-wrap">' + output.join('\n') + '</pre><br /><br /><div style="border-top:1px solid #E0E0E0;padding:20px 0 15px;font:normal normal 11px Arial">Estimated time: <b>' + Math.ceil(note.stats.estimate / 60) + ' h</b>, Time: <b>' + Math.ceil(note.stats.minutes / 60) + ' h</b>, Tasks: ' + note.stats.tasks + ', Pending: ' + note.stats.pending + ', Completed: ' + note.stats.complete + ', Canceled: ' + note.stats.canceled + '</div></body></html>';
	var w = window.open();
	w.document.write(val);
	w.document.close();
	setTimeout(function() {
		w.print();
	}, 1500);
};

FUNC.usertheme = function() {
	if (user.theme === 2) {
		var h = NOW.getHours();
		var isdark = h > 18 || h < 8;
		if (isdark !== common.darkmode) {
			$('body').tclass('ui-dark', isdark);
			common.darkmode = isdark;
		}
	}
};

FUNC.refreshuser = function() {

	switch (user.numberformat) {
		case 0:
			DEF.thousandsseparator = ' ';
			DEF.decimalseparator = '.';
			break;
		case 1:
			DEF.thousandsseparator = ' ';
			DEF.decimalseparator = ',';
			break;
		case 2:
			DEF.thousandsseparator = ',';
			DEF.decimalseparator = '.';
			break;
		case 3:
			DEF.thousandsseparator = '.';
			DEF.decimalseparator = ',';
			break;
	}

	ENV('dateformat', user.dateformat);

	if (user.theme === 2)
		FUNC.usertheme();
	else
		$('body').tclass('ui-dark', user.theme === 1);

};

FUNC.refreshsort = function() {

	var compare_archive = function(a, b) {
		if (a.isarchived)
			return b.isarchived ? 0 : 1;
		else if (b.isarchived)
			return -1;
		return 0;
	};

	var compare_favorite = function(a, b) {
		if (a.isfavorited)
			return b.isfavorited ? 0 : -1;
		else if (b.isfavorited)
			return 1;
		return 0;
	};

	var compare_priority = function(a, b) {

		if (a.countpriorities) {
			if (b.countpriorities)
				return a.countpriorities > b.countpriorities ? -1 : a.countpriorities === b.countpriorities ? 0 : 1;
			return -1;
		} else if (b.countpriorities)
			return 1;

		return 0;
	};

	var compare_date = function(a, b) {
		var tmpa = +a.date.format('yyyyMMdd');
		var tmpb = +b.date.format('yyyyMMdd');
		return tmpa > tmpb ? -1 : tmpa === tmpb ? 0 : 1;
	};

	var compare_created = function(a, b) {
		var tmpa = +a.dtcreated.format('yyyyMMddHHmmss');
		var tmpb = +b.dtcreated.format('yyyyMMddHHmmss');
		return tmpa > tmpb ? -1 : tmpa === tmpb ? 0 : 1;
	};

	common.docs.sort(function(a, b) {

		var tmp = compare_archive(a, b);
		if (tmp)
			return tmp;

		tmp = compare_favorite(a, b);
		if (tmp)
			return tmp;

		tmp = compare_priority(a, b);
		if (tmp)
			return tmp;

		tmp = compare_date(a, b);
		if (tmp)
			return tmp;

		return compare_created(a, b);
	});

	UPD('common.docs');

};

(function() {

	var can = null;
	var is = false;
	var cb = null;

	$(W).on('mousemove mouseleave', function() {
		can = true;
		cb && cb();
	}).on('blur', function() {
		can = true;
		cb && cb();
	});

	FUNC.save = function(callback, force) {
		can = null;
		is = true;
		cb = function() {
			clearTimeout2('save');
			if (force || (can && is))
				callback();
			can = false;
			is = false;
			cb = null;
		};
		return cb;
	};

})();

String.prototype.rtrim = String.prototype.trimEnd;