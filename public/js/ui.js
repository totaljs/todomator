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
			medit.rclass('hidden');

			var opt = {};
			var md = (self.get() || '').trim();
			opt.html = Thelpers.encode(md);
			opt.multiline = true;
			opt.tabs = true;
			opt.format = false;
			opt.placeholder = mplaceholder[0];
			self.aclass('editmode');

			Editable(medit, opt, function(response) {

				if (!response.text)
					throw new Error('FET');

				self.rclass('editmode');
				var text = response.text.trim();
				if (md !== text) {
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
		mbody.rclass('hidden').html(val ? Thelpers.markdown(val) : '');
		self.resize();
		setTimeout(self.resize, 1000);
	};

});

COMPONENT('chatmessage', function(self, config, cls) {

	var input;
	var placeholder;
	var text;
	var editable = false;
	var ticketid;
	var cache = {};

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
		self.event('click', '.send', send);
	};

	self.edit = function() {
		var opt = {};
		opt.html = '';
		opt.multiline = true;
		opt.tabs = true;
		opt.format = false;
		opt.placeholder = placeholder[0];
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