function extendeditable(opt) {

	var caret = function(pos) {
		setTimeout(pos => opt.editor.caret(pos + ''), 1, pos);
	};

	opt.bold = function() {
		opt.editor.replace(function(text) {

			if (!text) {
				text = '';
				caret('-2');
			}

			var f = text.charAt(0);
			return f === '_' || f === '*' ? text.replace(/_|\*/g, '') : ('__' + text + '__');

		}, true);
	};

	opt.link = function() {
		opt.editor.replace(function(text) {

			if (!text) {
				text = '';
				caret('-6');
			}

			var f = text.charAt(0);
			if (f === '[') {
				var index = text.indexOf(']');
				if (index === -1)
					return text;
				return text.substring(1, index - 1);
			}

			return '[' + text + '](url)';
		});
	};

	opt.italic = function() {
		opt.editor.replace(function(text) {

			if (!text) {
				text = '';
				caret('-1');
			}

			var f = text.charAt(0);
			return f === '*' ? text.replace(/\*/g, '') : ('*' + text + '*');
		});
	};

	opt.underline = function() {
		opt.editor.replace(function(text) {

			if (!text) {
				text = '';
				caret('-1');
			}

			var f = text.charAt(0);
			return f === '_' ? text.replace(/\_/g, '') : ('_' + text + '_');
		});
	};

	opt.code = function() {
		opt.editor.replace(function(text) {

			if (!text) {
				text = '';
				caret('-1');
			}

			var f = text.charAt(0);
			return f === '`' ? text.replace(/`/g, '') : ('`' + text + '`');
		});
	};

	opt.icon = function() {
		opt.editor.replace(function(text) {

			if (!text)
				text = 'warning';

			var f = text.charAt(0);
			return f === ':' ? text.replace(/\:/g, '') : (':' + text + ':');
		});
	};
}

COMPONENT('markdownbody', function(self, config, cls) {

	var mbody = null;
	var medit = null;
	var mplaceholder = null;

	self.make = function() {

		self.aclass(cls);
		self.rclass('hidden invisible');
		self.append('<div class="hidden mplaceholder">{0}</div><div class="medit hidden"></div><div class="mbody" data-prevent="true"></div>'.format(config.placeholder));

		mbody = self.find('.mbody');
		medit = self.find('.medit');
		mplaceholder = self.find('.mplaceholder');

		self.resize();

		self.event('click', 'li', function(e) {

			var t = this;

			if (e.tagName === 'A')
				return;

			e.stopPropagation();

			var el = $(t);
			var line = ATTRD(el, 'line');

			if (!line)
				return;

			line = +line;

			var body = self.get();
			var lines = body.split('\n');
			var is = false;
			var istask = false;

			lines[line] = lines[line].replace(/\[(x|\s)\]/, function(text) {
				istask = true;
				is = text.indexOf('x') === -1;
				return is ? '[x]' : '[ ]';
			});

			if (!istask)
				return;

			body = lines.join('\n');
			el.find('> i:first-child').tclass('ti-check-square green', is).tclass('ti-square', !is);
			config.save && self.EXEC(config.save, body);
			self.set(body, 'task');
		});

		medit.on('click', function(e) {
			e.stopPropagation();
		});

		mbody.on('dblclick', function(e) {

			e.stopPropagation();
			e.preventDefault();

			mbody.aclass('hidden');
			medit.empty().rclass('hidden');

			var opt = {};
			var md = (self.get() || '').trim();
			opt.html = Thelpers.encode(md);
			opt.multiline = true;
			opt.tabs = true;
			opt.placeholder = mplaceholder[0];
			opt.format = true;
			extendeditable(opt);

			self.aclass('editmode');

			Editable(medit, opt, function(response) {

				self.rclass('editmode');

				var text = response.text.trim();
				if (text && md !== text) {
					body = text.trim();
					self.set(body, 'content');
					config.save && self.EXEC(config.save, body);
				} else {
					medit.aclass('hidden').empty();
					mbody.rclass('hidden');
				}
			});
		});
	};

	self.resize = function() {
		setTimeout2(self.ID, self.resizeforce, 200);
	};

	self.resizeforce = function() {
		var scrollbar = self.closest('.ui-scrollbar');
		var offset = self.element.offset();
		var h = WH - scrollbar[0].scrollTop - offset.top - 120;
		mbody.css('min-height', h);
		medit.css('min-height', h);
	};

	self.setter = function(val, path, type) {

		if (type === 'task')
			return;

		val = val ? val.trim() : '';
		self.rclass('editmode');
		medit.aclass('hidden');
		mplaceholder.tclass('hidden', !!val);
		mbody.rclass('hidden').html(val ? Thelpers.markdown2(val) : '');
		self.resize();
		setTimeout(self.resize, 1000);
	};

});

COMPONENT('chatmessage', function(self, config, cls) {

	var input;
	var placeholder;
	var text = '';
	var editable = false;
	var ticketid;
	var cache = {};
	var viewbox;
	var prevmargin = 0;

	var send = function() {

		if (!text)
			return;

		config.send && self.EXEC(config.send, { ticketid: ticketid, markdown: text });

		var tmp = ticketid;
		delete cache[tmp];
		self.clear('');
		ticketid = tmp;
	};

	self.make = function() {
		self.aclass(cls);
		self.append('<div class="send" title="{button}"><i class="ti ti-envelope"></i></div><div class="placeholder">{placeholder}</div><div class="input"></div>'.args(config));
		input = self.find('.input');
		placeholder = self.find('.placeholder');
		self.rclass('invisible', 1000);
		self.event('click', '.send', function(e) {
			e.stopPropagation();
			e.preventDefault();
			W.$Editable.close();
			send();
		});

		if (config.autoheight)
			viewbox = self.parent().parent().find('ui-component[name="viewbox"]')[0];

	};

	self.edit = function() {

		var opt = {};
		opt.html = '';
		opt.multiline = 2;
		opt.tabs = true;
		opt.format = true;
		opt.placeholder = placeholder[0];

		extendeditable(opt);

		opt.resize = function(h) {
			var tmp = h + 25;

			if (tmp < 45)
				tmp = 45;

			if (prevmargin !== tmp) {
				setTimeout(() => viewbox.ui.reconfigure({ margin: tmp }), 5);
				prevmargin = tmp;
			}
		};

		input.aclass('editmode');
		editable = true;
		Editable(input, opt, function(response) {
			input.rclass('editmode');
			text = response.text.trim();
			cache[ticketid] = text;
			if (response.key === 13)
				send();
			editable = false;
			placeholder.tclass('hidden', !!text);
		});
	};

	self.event('click', self.edit);
	self.setter = self.clear = function(val) {

		if (ticketid === val)
			return;

		ticketid = val;
		editable = false;
		text = cache[ticketid] || '';
		input.rclass('editmode');
		input.html(text);
		placeholder.tclass('hidden', !!text);
	};

});

COMPONENT('quickpreview', function(self, config, cls) {

	var content = null;
	var container = null;
	var cls2 = '.' + cls;
	var is = false;

	self.readonly();

	self.make = function() {
		self.append('<div class="{0}-content"></div><div class="{0}-container"></div>'.format(cls));
		content = self.find(cls2 + '-content');
		container = self.find(cls2 + '-container');

		content.on('click mouseleave', function(e) {
			if (is) {
				if (e.target.tagName !== 'A')
					self.hide();
			}
		});

		container.on('click mousemove', function() {
			if (is)
				self.hide();
		});
	};

	self.hide = function() {
		if (self.hclass('hidden'))
			return;
		self.aclass('hidden invisible');
		content.empty();
		is = false;
	};

	self.show = function(opt) {

		self.rclass('hidden').aclass('invisible');

		content.html(opt.html);

		var el = $(opt.element);
		var w = content.width();
		var offset = el.offset();
		var css = {};

		if (opt.element) {
			switch (opt.align) {
				case 'center':
					css.left = Math.ceil((offset.left - w / 2) + (el.innerWidth() / 2));
					break;
				case 'right':
					css.left = (offset.left - w) + el.innerWidth();
					break;
				default:
					css.left = offset.left;
					break;
			}
			css.top = opt.position === 'bottom' ? (offset.top - content.height() - 10) : (offset.top + el.innerHeight() + 10);
		} else {
			css.left = opt.x;
			css.top = opt.y;
		}

		if (opt.position === 'bottom')
			css.top += 10;
		else
			css.top -= 10;

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		var mw = w;
		var mh = (opt.height || 0) + content.height();

		if (css.left < 0)
			css.left = 10;
		else if ((mw + css.left) > WW)
			css.left = (WW - mw) - 10;

		if (css.top < 0)
			css.top = 10;
		else if ((mh + css.top) > WH)
			css.top = (WH - mh) - 10;

		var zindex = opt.zindex || 100;

		container.css('z-index', zindex);
		css['z-index'] = zindex + 1;
		content.css(css);

		self.rclass('invisible', 300);
		setTimeout(() => is = true, 1000);
	};

});