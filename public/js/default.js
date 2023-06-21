Thelpers.markdown2 = function(val) {
	var opt = {};
	opt.html = function(line) {
		return line.replace(/(^|\s|:|.|,)?@[a-z0-9]+(.|,|\s|:|$)/gi, function(text) {

			var last = text.substring(text.length - 1);

			if (last !== '.' && last !== ',' && last !== ' ')
				last = '';

			var first = text.substring(0, 1);
			if (first === '@')
				first = '';

			for (var m of DEF.cl.user) {
				if (m.search.indexOf(text.trim().substring(1).toLowerCase()) !== -1)
					return first + '<span class="user">' + (m.photo ? '<img src="{0}" loading="lazy" />'.format(m.photo) : '') + m.name + '</span>' + last;
			}
			return text;
		});
	};
	return val.markdown(opt);
};

Thelpers.color2 = function(val) {
	return Thelpers.color(HASH(val + val).toString(36));
};

Thelpers.tagcolor = function(val) {
	return DEF.cl.tag.findValue('id', val, 'color', '') || DEF.color;
};

Thelpers.tagname = function(val) {
	return DEF.cl.tag.findValue('id', val, 'name', '???');
};

MACRO('timer', function(self, element) {

	var ticks = +element.attrd('ticks');

	self.check = function() {
		if (!element[0].parentNode)
			return;
		var diff = Date.now() - ticks;
		var s = diff / 1000 >> 0;
		var raw = s / 60;
		var m = raw % 60 >> 0;
		var h = (raw / 60) % 24 >> 0;
		element.html(h.padLeft(2) + ':' + m.padLeft(2) + ':' + (s % 60).padLeft(2));
		setTimeout(self.check, 1000);
	};

	self.check();

});

Thelpers.rgba = function(hex, alpha) {
	var c = (hex.charAt(0) === '#' ? hex.substring(1) : hex).split('');
	if(c.length === 3)
		c = [c[0], c[0], c[1], c[1], c[2], c[2]];

	var a = c.splice(6);
	if (a.length)
		a = parseFloat(parseInt((parseInt(a.join(''), 16) / 255) * 1000) / 1000);
	else
		a = alpha || '1';

	c = '0x' + c.join('');
	return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + a + ')';
};

FUNC.parseminutes = function(val) {

	if (typeof(val) === 'number')
		return val;

	var minutes = val.toLowerCase();

	if (minutes.indexOf('h') !== -1)
		minutes = minutes.replace(/[^0-9,.]/g, '').parseFloat() * 60;
	else if (minutes.indexOf('d') !== -1)
		minutes = minutes.replace(/[^0-9,.]/g, '').parseFloat() * 1440;
	else
		minutes = minutes.replace(/[^0-9,.]/g, '').parseFloat();

	return minutes;
};

function Editable(el, opt, callback) {

	var openeditor = W.$Editable;

	if (!(el instanceof jQuery))
		el = $(el);

	if (!opt)
		opt = {};

	// opt.format {Boolean}
	// opt.bold {Boolean}
	// opt.italic {Boolean}
	// opt.underline {Boolean}
	// opt.link {Boolean}
	// opt.multiline {Boolean}
	// opt.callback {Function}
	// opt.html {String}
	// opt.commands {Boolean}
	// opt.backslashremove {Boolean}
	// opt.param {Object} a custom parameter
	// opt.parent {Element}
	// opt.select {Boolean} it selects all text

	if (opt.format == null)
		opt.format = true;

	if (callback)
		opt.callback = callback;

	if (openeditor) {
		if (openeditor.element[0] == el[0])
			return;
		openeditor.close();
		setTimeout(Editable, 100, el, opt, callback);
		return;
	}

	opt.backup = el.html();
	opt.html && el.html(opt.html);
	el.attr('contenteditable', true);

	openeditor = W.$Editable = {};
	openeditor.element = el;
	openeditor.dom = el[0];
	openeditor.multiline = opt.multiline;
	openeditor.parent = opt.parent ? opt.parent[0] : openeditor.dom;
	openeditor.insert = function(text) {
		text && document.execCommand('insertHTML', false, text);
	};

	var clickoutside = function(e) {
		if (!(e.target === openeditor.parent || openeditor.parent.contains(e.target)))
			openeditor.close();
	};

	var paste = function(e) {
		e.preventDefault();
		var text = (e.originalEvent || e).clipboardData.getData('text/plain');
		document.execCommand('insertHTML', false, text);
	};

	var keyup = function(e) {
		e && opt.keyup && opt.keyup(e);
		if (opt.resize) {
			var tmp = el.height();
			if (openeditor.height !== tmp) {
				opt.resize(tmp);
				openeditor.height = tmp;
			}
		}
	};

	var keydown = function(e) {

		opt.keydown && opt.keydown(e);

		if (e.keyCode === 27) {
			e.preventDefault();
			e.stopPropagation();
			openeditor.key = 27;
			openeditor.close();
			return;
		}

		if (opt.backslashremove && e.keyCode === 8 && !el.text().trim()) {
			openeditor.key = 8;
			openeditor.close();
			return;
		}

		if (e.keyCode === 13) {

			if (!opt.multiline || e.shiftKey || e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				openeditor.key = 13;
				openeditor.close();
			}

			return;
		}

		if (e.keyCode === 9) {

			e.preventDefault();

			if (opt.tabs) {
				document.execCommand('insertHTML', false, '&#009');
				return;
			}

			if (opt.endwithtab) {
				openeditor.key = 9;
				openeditor.close();
				return;
			}
		}

		openeditor.change = true;

		if (!e.metaKey && !e.ctrlKey)
			return;

		if (e.keyCode === 66) {
			// bold
			if (opt.format && (opt.bold == null || opt.bold == true))
				self.format.bold();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 77) {
			// code
			if (opt.format && (opt.code == null || opt.code == true))
				self.format.code();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 76) {
			// link
			if (opt.format && (opt.link == null || opt.link == true))
				self.format.link();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 73) {
			// italic
			if (opt.format && (opt.italic == null || opt.italic == true))
				self.format.italic();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 80) {
			self.format.icon();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 85) {
			// underline
			if (opt.format && (opt.underline == null || opt.underline == true))
				self.format.underline();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 32) {
			document.execCommand('insertHTML', false, '&nbsp;');
			e.preventDefault();
			e.stopPropagation();
			return;
		}

	};

	el.focus();

	if (opt.cursor === 'end') {
		var range = document.createRange();
		range.selectNodeContents(el[0]);
		range.collapse(false);
		var sel = W.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}

	if (opt.select)
		setTimeout(() => document.execCommand('selectAll', false, null), 20);

	openeditor.close = function() {

		$(W).off('click', clickoutside);
		el.rattr('contenteditable');
		el.off('keydown', keydown);
		el.off('keyup', keyup);
		el.off('paste', paste);
		el.off('input');

		openeditor.timeout && clearTimeout(openeditor.timeout);

		if (opt.callback) {
			var arg = {};
			arg.text = el.text();
			arg.html = el.html();
			arg.change = openeditor.change;
			arg.element = openeditor.element;
			arg.dom = openeditor.dom;
			arg.backup = opt.backup;
			arg.key = openeditor.key;
			arg.param = opt.param;
			opt.callback(arg);
		}

		keyup();
		openeditor = W.$Editable = null;
	};

	keyup();
	$(W).on('click', clickoutside);
	el.on('keydown', keydown);
	el.on('keyup', keyup);

	if (opt.placeholder) {
		var placeholder = opt.placeholder;
		var placeholderprev = false;
		placeholder && el.on('input', function() {
			var is = this.innerHTML.length > 0;
			if (placeholderprev !== is) {
				placeholderprev = is;
				placeholder.classList.toggle('hidden', is);
			}
		});
	}

	el.on('paste', paste);
}