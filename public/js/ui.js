COMPONENT('search', function(self, config) {

	var input;
	var is = false;
	var prev = false;

	self.make = function() {
		input = self.find('input');
		input.on('input', function() {
			is = !!this.value;
			self.check();
			setTimeout2(self.ID, self.search, 300);
		});

		self.find('.clear').on('click', function() {
			input.val('');
			is = false;
			self.check();
			self.search();
		});

		self.find('.filter').on('click', function() {

			var items = [];

			for (var j = 0; j < common.projects.length; j++) {
				var tmp = common.projects[j];
				items.push({ name: tmp.id, value: '[' + tmp.id + ']', template: '<i class="far fa-code-branch" class="jdi"></i> {{ name }}' });
			}

			for (var j = 0; j < common.tags.length; j++) {
				var tmp = common.tags[j];
				items.push({ name: tmp.id, value: '#' + tmp.id, template: '<i class="far fa-hashtag" class="jdi"></i> {{ name }}' });
			}

			var opt = {};
			opt.offsetY = 12;
			opt.offsetX = -5;
			opt.element = $(this);
			opt.align = 'right';
			opt.items = items;
			opt.callback = function(item) {
				input.val(item.value);
				self.check2();
				self.search();
			};
			SETTER('directory/show', opt);
		});

	};

	self.check2 = function() {
		is = !!input[0].value;
		self.check();
	};

	self.check = function() {
		if (prev === is)
			return;
		prev = is;
		self.find('.clear').tclass('hidden', !is);
	};

	self.search = function() {
		EXEC(config.exec, input.val());
	};

	self.setter = function() {
		is = false;
		input.val('');
		self.check();
		EXEC(config.exec, '');
	};

});
COMPONENT('tabmenu', 'class:selected;selector:li', function(self, config) {
	var old, oldtab;

	self.readonly();
	self.nocompile && self.nocompile();
	self.bindvisible();

	self.make = function() {
		self.event('click', config.selector, function() {
			if (!config.disabled) {
				var el = $(this);
				if (!el.hclass(config.class)) {
					var val = el.attrd('value');
					if (config.exec)
						EXEC(self.makepath(config.exec), val);
					else
						self.set(val);
				}
			}
		});
		var scr = self.find('script');
		if (scr.length) {
			self.template = Tangular.compile(scr.html());
			scr.remove();
		}
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', !!value);
				break;
			case 'datasource':
				self.datasource(value, function(path, value) {
					if (value instanceof Array) {
						var builder = [];
						for (var i = 0; i < value.length; i++)
							builder.push(self.template(value[i]));
						old = null;
						self.html(builder.join(''));
						self.refresh();
					}
				}, true);
				break;
		}
	};

	self.setter = function(value) {
		if (old === value)
			return;
		oldtab && oldtab.rclass(config.class);
		oldtab = self.find(config.selector + '[data-value="' + value + '"]').aclass(config.class);
		old = value;
	};
});

COMPONENT('editor', function(self, config) {

	var editor;
	var skip = false;
	var noscroll = false;
	var markers = {};

	self.nocompile();
	self.readonly();

	// It rewrites internal method
	self.readonly = function(is, same) {
		editor.setOption('readOnly', is);
		if (same)
			noscroll = true;
	};

	self.clearusers = function() {
		for (var m in markers)
			markers[m].remove();
		markers = {};
	};

	self.user = function(id, fline, fch, tline, tch, name) {

		if (!name) {
			if (markers[id]) {
				markers[id].remove();
				delete markers[id];
			}
			return;
		}

		var color = Thelpers.color(name);

		var mfrom = {};
		var mto = {};

		mfrom.line = fline;
		mfrom.ch = fline === tline && tch === fch ? (fch - 1) : fch;
		mto.line = tline;
		mto.ch = tch;

		if (mfrom.ch < 0) {
			mfrom.ch = 0;
			mto.ch = 1;
		}
		var attr = {};
		attr.css = 'background-color:' + color; // hexrgba(color, 0.5);
		attr.className = 'cm-user';
		attr.title = name;
		var cf = editor.cursorCoords(mfrom, 'local');

		if (!markers[id]) {
			markers[id] = $('<span class="cm-uname" style="border-left-color:{0}"><b style="background-color:{0};color:{3}">{2}</b></span>'.format(color, id, name, FUNC.invertcolor(color, true)));
			self.find('.CodeMirror-scroll').append(markers[id]);
		}

		markers[id].css({ left: cf.left + (fch ? 30 : 20), top: cf.top - 10 });
	};

	self.linewrapping = function(is) {
		editor.setOption('lineWrapping', is);
	};

	self.note_save = function() {
		self.save();
	};

	self.note_new = function() {
		EMIT('shortcut', 'new');
	};

	self.note_find = function() {
		EMIT('shortcut', 'find');
	};

	self.task_done = function() {

		var cursors = editor.listSelections();
		for (var i = 0; i < cursors.length; i++) {

			var cursor = cursors[i].anchor;
			var current = editor.getLine(cursor.line);

			if (!current.match(/^(\s)*-\s/))
				return;

			var done = current.match(/@done(\(.*?\))?/gi);

			if (done)
				editor.doc.replaceRange(current.replace(done, '').replace(/\s+$/, ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
			else
				editor.doc.replaceRange(current.replace(/@(canceled|working)(\(.*?\))?/gi, '').replace(/\s+$/, '') + ' @done' + (user.istimestamp ? ('(' + NOW.format(user.format || 'yyyy-MM-dd') + ')') : ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
		}

		setTimeout(function() {
			self.emit('refresh');
		}, 10);

		self.save();
		return false;
	};

	self.task_cancel = function() {

		var cursors = editor.listSelections();
		for (var i = 0; i < cursors.length; i++) {
			var cursor = cursors[i].anchor;
			var current = editor.getLine(cursor.line);
			if (!current.match(/^(\s)*-\s/))
				return;
			var canceled = current.match(/@canceled(\(.*?\))?/gi);
			if (canceled)
				editor.doc.replaceRange(current.replace(canceled, '').replace(/\s+$/, ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
			else
				editor.doc.replaceRange(current.replace(/@(done|working)(\(.*?\))?/gi, '').replace(/\s+$/, '') + ' @canceled' + (user.istimestamp ? ('(' + NOW.format(user.format || 'yyyy-MM-dd') + ')') : ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
		}

		setTimeout(function() {
			self.emit('refresh');
		}, 10);

		self.save();
		return false;
	};

	self.task_priority = function() {

		var cursors = editor.listSelections();
		for (var i = 0; i < cursors.length; i++) {
			var cursor = cursors[i].anchor;
			var current = editor.getLine(cursor.line);
			if (!current.match(/^(\s)*-\s/))
				return;
			var priority = current.match(/@priority?/gi);
			if (priority)
				editor.doc.replaceRange(current.replace(priority, '').replace(/\s+$/, ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
			else
				editor.doc.replaceRange(current.replace(/\s+$/, '') + ' @priority', { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
		}

		setTimeout(function() {
			self.emit('refresh');
		}, 10);

		self.save();
		return false;
	};

	self.task_working = function() {

		var cursors = editor.listSelections();
		for (var i = 0; i < cursors.length; i++) {
			var cursor = cursors[i].anchor;
			var current = editor.getLine(cursor.line);
			if (!current.match(/^(\s)*-\s/))
				return;

			var working = current.match(/@working/gi);
			if (working)
				editor.doc.replaceRange(current.replace(working, '').replace(/\s+$/, ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
			else
				editor.doc.replaceRange(current.replace(/@(done|canceled)(\(.*?\))?/gi, '').replace(/\s+$/, '') + ' @working', { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
		}

		setTimeout(function() {
			self.emit('refresh');
		}, 10);

		self.save();
		return false;
	};

	self.note_addline = function(e, s) {

		if (s.type !== 'keyup')
			return;

		var cursor;
		var current;

		if (s.keyCode === 9) {
			cursor = editor.getCursor();
			current = editor.getLine(cursor.line);

			var m = current.match(/@table\d/);
			if (m) {
				var c = parseInt(m.toString().replace('@table', ''));
				if (isNaN(c))
					c = 1;
				editor.doc.replaceRange('', { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
				self.note_table(c);
				return;
			}

			var numbers = current.lastIndexOf('@', cursor.ch);
			if (numbers === -1)
				return;

			numbers = current.substring(numbers, cursor.ch);

			if (!(/@\d+/).test(numbers))
				return;

			var days = numbers.replace('@', '').parseInt();
			if (days === 0)
				return;
			var dt = new Date();
			dt.setDate(dt.getDate() + days);
			numbers = current.replace(numbers.trimEnd(), '@date(' + dt.format(user.format || 'yyyy-MM-dd') + ')');
			editor.doc.replaceRange(numbers.trimEnd(), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
			return false;
		}

		if (s.keyCode < 40)
			return;

		if (s.keyCode !== 189)
			return;

		cursor = editor.getCursor();
		current = editor.getLine(cursor.line);
		if (current.length > 99 || !current.match(/^-{3,}$/))
			return;
		var max = 98 - length;
		var s = '';
		for (var i = 0; i < max; i++)
			s += '-';
		editor.doc.replaceRange(s, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
	};

	self.task_date = function() {
		// editor.doc.replaceSelection(' @date(' + (new Date().format(user.dateformat || 'yyyy-MM-dd')) + ')');
		editor.doc.replaceSelection(new Date().format(user.dateformat || 'yyyy-MM-dd'));
		return false;
	};

	self.task_checkmark = function() {
		editor.doc.replaceSelection(String.fromCharCode(9989));
		return false;
	};

	self.task_cancelmark = function() {
		editor.doc.replaceSelection(String.fromCharCode(10060));
		return false;
	};

	self.clean = function() {
		editor.setValue(FUNC.note_clean(editor.getValue()));
		editor.refresh();
		self.note_save();
	};

	self.task_expiration = function() {
		var cursor = editor.getCursor();
		var current = editor.getLine(cursor.line);
		var dt = new Date();
		var length = current.length;
		dt.setDate(dt.getDate() + 1);
		editor.doc.replaceRange(current + (current.substring(length - 1, length) !== ' ' ? ' ' : '') + '@date(' + dt.format(user.format || 'yyyy-MM-dd') + ')', { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
		return false;
	};

	self.note_table = function(count) {

		if (typeof(count) !== 'number' || !count)
			count = 1;

		var max = 80;
		var str = '';

		for (var j = 0; j < 4; j++) {
			str += '|';
			for (var i = 0; i < max; i++) {
				if (i + 1 !== max && (i + 1) % (max / count) === 0)
					str += '|';
				else
					str += j === 0 || j === 3 ? '-' : ' ';
			}
			str += '|\n';
		}

		editor.doc.replaceSelection(str);
		return false;
	};

	self.save = function() {
		var value = editor.getValue().split('\n');

		for (var i = 0; i < value.length; i++)
			value[i] = value[i].trimEnd();

		value = value.join('\n');

		skip = true;
		self.set(value);
		EMIT('shortcut', 'save');
		self.emit('stats', FUNC.note_stats(value || ''));
	};

	self.redraw = function() {
		editor.refresh();
		editor.resize();
	};

	self.resize = function() {
		$(W).trigger('resize');
	};

	var GutterDiff = function() {
		var marker = document.createElement('div');
		marker.className = 'cm-diff';
		marker.innerHTML = '+';
		return marker;
	};

	var findmatch = function() {
		var sel = editor.getSelections()[0];
		var cur = editor.getCursor();
		var count = editor.lineCount();
		var before = editor.getLine(cur.line).substring(cur.ch, cur.ch + sel.length) === sel;
		var beg = cur.ch + (before ? sel.length : 0);
		for (var i = cur.line; i < count; i++) {
			var ch = editor.getLine(i).indexOf(sel, beg);
			if (ch !== -1) {
				editor.doc.addSelection({ line: i, ch: ch }, { line: i, ch: ch + sel.length });
				break;
			}
			beg = 0;
		}
	};

	self.make = function() {

		var opt = { rulers: [{ column: 100, lineStyle: 'dashed' }], autoRefresh: true, styleActiveLine: true, matchBrackets: true, indentWithTabs: true, indentUnit: 3, tabSize: 3, lineNumbers: false, showCursorWhenSelecting: true, lineWrapping: true, mode: 'todo', foldGutter: true, extraKeys: { 'Alt-T': self.note_table, 'Shift-Ctrl-Enter': self.task_checkmark, 'Shift-Alt-Enter': self.task_cancelmark, 'Alt-D': self.task_done, 'Alt-C': self.task_cancel, 'Shift-Alt-C': self.task_cancel, 'Cmd-S': self.note_save, 'Ctrl-S': self.setSave, 'Ctrl-D': findmatch, 'Cmd-D': findmatch, 'Cmd-Enter': self.task_working, 'Ctrl-Enter': self.task_working, 'Alt-Enter': self.task_date, 'Alt-N': self.note_new, 'Enter': 'newlineAndIndentContinue', 'Alt-F': self.note_find, 'F1': self.note_find, 'Alt-E': self.task_expiration, 'Cmd-E': self.task_expiration }};
		opt.gutters = ['GutterDiff'];
		opt.scrollPastEnd = true;

		if (!common.mobile)
			opt.scrollbarStyle = 'simple';

		self.event('dblclick', '.cm-link', function() {
			var url = $(this).text().trim();
			url && W.open(url);
		});

		self.editor = editor = CodeMirror(self.dom, opt);
		editor.on('keyup', self.note_addline);
		editor.on('focus', function() {
			self.emit('editor.focus');
		});
		editor.on('drop', function(cm, e) {
			config.drop && self.SEEX(config.drop, e);
			e.preventDefault();
			e.stopPropagation();
		});

		editor.on('keydown', function(editor, e) {
			if (e.shiftKey && e.ctrlKey && (e.keyCode === 40 || e.keyCode === 38)) {
				var tmp = editor.getCursor();
				editor.doc.addSelection({ line: tmp.line + (e.keyCode === 40 ? 1 : -1), ch: tmp.ch });
				e.stopPropagation();
				e.preventDefault();
			}
		});

		self.event('contextmenu', function(e) {
			e.preventDefault();
			e.stopPropagation();
			config.contextmenu && EXEC(self.makepath(config.contextmenu), e, editor);
		});

		var can = {};
		var prevline = -1;
		can['+input'] = can['+delete'] = can.undo = can.redo = can.paste = can.cut = can.clear = true;

		var cursoractivity = function() {
			var text = editor.getSelection();
			if (self.prev !== text && text.length > 10 && text.indexOf('\n') !== -1) {
				self.prev = text;
				self.emit('stats', FUNC.note_stats(text));
			} else
				self.emit('stats', FUNC.note_stats(editor.getValue()));
		};

		editor.on('cursorActivity', function(e) {
			var cursor = e.getCursor();
			if (prevline > -1)
				editor.removeLineClass(prevline, 'wrap', 'CodeMirror-activeline');
			var line = cursor.line;
			editor.addLineClass(line, 'wrap', 'CodeMirror-activeline');
			prevline = line;
			setTimeout2(self.ID + 'sel', cursoractivity, 800);
		});

		var onchange = function() {
			var val = editor.getValue();
			self.getter2 && self.getter2(val);
			self.change(true);
			skip = true;
			self.set(val);
		};

		editor.on('change', function(a, b) {

			if (b.origin !== 'setValue') {
				var lf = b.from.line;
				var lt = b.from.line + b.text.length;
				var isremoved = -1;

				if (b.removed[0] || b.removed.length > 1)
					isremoved = lt;

				for (var i = lf; i < lt; i++)
					editor.setGutterMarker(i, 'GutterDiff', GutterDiff());
			}

			if (!b.origin || !can[b.origin])
				return;

			if (b.origin && can[b.origin])
				setTimeout2(self.ID + 'sum', self.summarize, 1000);

			setTimeout2(self.ID, onchange, 200);
			setTimeout2(self.ID + 'save', self.note_save, 1000);
		});

		$(W).on('resize', function() {
			self.find('.CodeMirror').css('height', self.closest('.ui-layout-section').height());
		});

		self.increment = function(plus) {

			if (!plus)
				plus = 1;

			var count = editor.lineCount();
			var reg = /^(\s)*(-|\+)/;
			var reg2 = /\[\d+\s(minutes|minute|min|m)\]/g;
			var reg3 = /\[\d+\s(hours|hour|hod|h)\]/g;
			var is = false;

			for (var i = 0; i < count; i++) {
				var li = i;
				var line = editor.getLine(li);

				if (!line)
					continue;

				if (!reg.test(line))
					continue;

				var index = line.indexOf('@working');
				if (index === -1)
					continue;

				var counter = line.match(reg3);
				var minutes;

				if (counter)
					minutes = (counter.toString().match(/\d+/g).toString().parseInt() * 60);
				else
					counter = line.match(reg2);

				if (!minutes && !counter) {
					var beg = line.substring(0, index).replace(/\s+$/, '');
					var end = line.substring(index);
					editor.doc.replaceRange(beg + ' [1 m] ' + end, { line: li, ch: 0 }, { line: li, ch: line.length });
					is = true;
					continue;
				}

				minutes = (typeof(minutes) === 'number' ? minutes : 0) + counter.toString().match(/\d+/g).toString().parseInt() + plus;
				editor.doc.replaceRange(line.replace(counter, '[' + minutes + ' m]'), { line: li, ch: 0 }, { line: li, ch: line.length });
				is = true;
			}

			self.summarize();
			is && setTimeout(self.save, 500);
		};

		setInterval(self.increment, 60000, 1);
	};

	self.summarize = function() {

		var count = editor.lineCount();
		var reg = /^(\s)*(-|\+)/;
		var reg2 = /\[\d+\s(minutes|minute|min|m)\]/g;
		var reg3 = /\[\d+\s(hours|hour|hod|h)\]/g;
		var reg4 = /.*?:$/;
		var reg5 = /^(\s)*=.*?$/;
		var reg6 = /\[\d+.*?\]/g;
		var sum = 0;
		var total = 0;

		for (var i = 0; i < count; i++) {
			var line = editor.getLine(i);
			if (!line)
				continue;

			if (reg4.test(line)) {
				// caption
				sum = 0;
				continue;
			}

			if (reg5.test(line)) {
				var index = line.indexOf('=');
				var hours = Math.ceil(sum / 60);
				var l = line.length;

				if (total)
					line = line.substring(0, index) + '= ' + total + (common.document.currencyid ? (' ' + common.document.currencyid) : '');
				else
					line = line.substring(0, index) + '= ' + hours + ' h' + (common.document.hourlyrate ? (' (' + (common.document.hourlyrate * hours) + (common.document.currencyid ? (' ' + common.document.currencyid) : '') + ')') : '');

				editor.doc.replaceRange(line, { line: i, ch: 0 }, { line: i, ch: l });
				sum = 0;
				total = 0;
				continue;
			}

			if (!reg.test(line))
				continue;

			var counter = line.match(reg3);
			var minutes;

			if (counter) {
				for (var j = 0; j < counter.length; j++)
					sum += (parseInt(counter[j].match(/\d+/g).toString()) * 60);
				continue;
			} else {
				counter = line.match(reg2);
				if (counter) {
					for (var j = 0; j < counter.length; j++)
						minutes = parseInt(counter[j].toString().match(/\d+/g).toString());
					sum += minutes;
					continue;
				}
			}

			counter = line.match(reg6);
			if (counter) {
				for (var j = 0; j < counter.length; j++)
					total += counter[j].substring(1, counter[j].length - 1).parseFloat();
			}
		}
	};

	self.setter = function(value, path, type) {

		if (skip) {
			skip = false;
			return;
		}

		self.prev = null;

		var si = editor.getScrollInfo();
		editor.setValue(value || '');

		if (type !== 'operation')
			editor.clearHistory();

		editor.refresh();
		self.emit('stats', FUNC.note_stats(value || ''));
		self.summarize();

		if (noscroll) {
			noscroll = false;
			editor.scrollTo(si.left, si.top);
		} else {
			setTimeout(function() {
				editor.refresh();
				editor.scrollTo(0, 0);
				editor.setCursor(0);
			}, 200);
		}

		setTimeout(function() {
			editor.refresh();
		}, 1000);

		setTimeout(function() {
			editor.refresh();
		}, 2000);
	};
});

COMPONENT('loading',function(self,config,cls){var delay,prev;self.readonly();self.singleton();self.nocompile();self.make=function(){self.aclass(cls+' '+cls+'-'+(config.style||1));self.append('<div><div class="'+cls+'-text hellip"></div></div>')};self.show=function(text){clearTimeout(delay);if(prev!==text){prev=text;self.find('.'+cls+'-text').html(text||'')}self.rclass('hidden');return self};self.hide=function(timeout){clearTimeout(delay);delay=setTimeout(function(){self.aclass('hidden')},timeout||1);return self}});
COMPONENT('selected','class:selected;selector:a;attr:if',function(self,config){self.readonly();self.configure=function(key,value){switch(key){case'datasource':self.datasource(value,function(){self.refresh()});break}};self.setter=function(value){var cls=config.class;self.find(config.selector).each(function(){var el=$(this);if(el.attrd(config.attr)===value)el.aclass(cls);else el.hclass(cls)&&el.rclass(cls)})}});
COMPONENT('datepicker','today:Set today;firstday:0',function(self,config,cls){var cls2='.'+cls,skip=false,visible=false,current,elyears,elmonths,elbody;self.days=EMPTYARRAY;self.days_short=EMPTYARRAY;self.months=EMPTYARRAY;self.months_short=EMPTYARRAY;self.years_from;self.years_to;self.singleton();self.readonly();self.nocompile();self.configure=function(key,value){switch(key){case'days':if(value instanceof Array)self.days=value;else self.days=value.split(',').trim();self.days_short=[];for(var i=0;i<DAYS.length;i++){DAYS[i]=self.days[i];self.days_short[i]=DAYS[i].substring(0,2).toUpperCase()}break;case'months':if(value instanceof Array)self.months=value;else self.months=value.split(',').trim();self.months_short=[];for(var i=0,length=self.months.length;i<length;i++){var m=self.months[i];MONTHS[i]=m;if(m.length>4)m=m.substring(0,3)+'.';self.months_short.push(m)}break;case'yearfrom':if(value.indexOf('current')!==-1)self.years_from=+(NOW.format('yyyy'));else self.years_from=+(NOW.add(value).format('yyyy'));break;case'yearto':if(value.indexOf('current')!==-1)self.years_to=+(NOW.format('yyyy'));else self.years_to=+(NOW.add(value).format('yyyy'));break}};function getMonthDays(dt){var m=dt.getMonth();var y=dt.getFullYear();if(m===-1){m=11;y--}return(32-new Date(y,m,32).getDate())}self.calculate=function(year,month,selected){var d=new Date(year,month,1,12,0);var output={header:[],days:[],month:month,year:year},firstday=config.firstday,firstcount=0,frm=d.getDay()-firstday;var today=NOW,ty=today.getFullYear();var tm=today.getMonth();var td=today.getDate();var sy=selected?selected.getFullYear():-1;var sm=selected?selected.getMonth():-1;var sd=selected?selected.getDate():-1;var days=getMonthDays(d);if(frm<0)frm=7+frm;while(firstcount++<7){output.header.push({index:firstday,name:self.days_short[firstday]});firstday++;if(firstday>6)firstday=0}var index=0,indexEmpty=0,count=0,prev=getMonthDays(new Date(year,month-1,1,12,0))-frm;var cur;for(var i=0;i<days+frm;i++){var obj={today:false,selected:false,empty:false,future:false,number:0,index:++count};if(i>=frm){obj.number=++index;obj.selected=sy===year&&sm===month&&sd===index;obj.today=ty===year&&tm===month&&td===index;obj.future=ty<year;if(!obj.future&&year===ty){if(tm<month)obj.future=true;else if(tm===month)obj.future=td<index}}else{indexEmpty++;obj.number=prev+indexEmpty;obj.empty=true;cur=d.add('-'+indexEmpty+' days')}if(!obj.empty)cur=d.add(i+' days');obj.month=i>=frm&&obj.number<=days?d.getMonth():cur.getMonth();obj.year=i>=frm&&obj.number<=days?d.getFullYear():cur.getFullYear();obj.date=cur;output.days.push(obj)}indexEmpty=0;for(var i=count;i<42;i++){var cur=d.add(i+' days');var obj={today:false,selected:false,empty:true,future:true,number:++indexEmpty,index:++count};obj.month=cur.getMonth();obj.year=cur.getFullYear();obj.date=cur;output.days.push(obj)}return output};self.hide=function(){if(visible){self.unbindevents();self.opt.close&&self.opt.close();self.opt=null;self.older=null;self.target=null;self.aclass('hidden');self.rclass(cls+'-visible');visible=false}return self};self.show=function(opt){setTimeout(function(){clearTimeout2('datepickerhide')},5);var el=$(opt.element);var dom=el[0];if(self.target===dom){self.hide();return}if(self.opt&&self.opt.close)self.opt.close();var off=el.offset();var w=el.innerWidth();var h=el.innerHeight();var l=0,t=0,height=305+(opt.cancel?25:0);var s=250;if(opt.element){switch(opt.align){case'center':l=Math.ceil((off.left-s/2)+(w/2));break;case'right':l=(off.left+w)-s;break;default:l=off.left;break}t=opt.position==='bottom'?(off.top-height):(off.top+h+12)}if(opt.offsetX)l+=opt.offsetX;if(opt.offsetY)t+=opt.offsetY;if(l+s>WW)l=(l+w)-s;if(t+height>WH)t=(t+h)-height;var dt=typeof(opt.value)==='string'?GET(opt.value):opt.value;if((!(dt instanceof Date))||isNaN(dt.getTime()))dt=NOW;opt.scope=M.scope?M.scope():'';self.opt=opt;self.time=dt.format('HH:mm:ss');self.css({left:l,top:t});self.rclass('hidden');self.date(dt);self.aclass(cls+'-visible',50);self.bindevents();self.target=dom;visible=true};self.setdate=function(dt){var time=self.time.split(':');if(time.length>1){dt.setHours(+(time[0]||'0'));dt.setMinutes(+(time[1]||'0'));dt.setSeconds(+(time[2]||'0'))}self.opt.scope&&M.scope(self.opt.scope);if(typeof(self.opt.value)==='string')SET2(self.opt.value,dt);else self.opt.callback(dt)};self.make=function(){self.aclass(cls+' hidden');var conf={},reconfigure=false;if(!config.days){conf.days=[];for(var i=0;i<DAYS.length;i++)conf.days.push(DAYS[i]);reconfigure=true}if(!config.months){conf.months=MONTHS;reconfigure=true}reconfigure&&self.reconfigure(conf);W.$datepicker=self;self.event('click',function(e){e.stopPropagation()});var hide=function(){visible&&W.$datepicker&&W.$datepicker.hide()};var hide2=function(){visible&&setTimeout2('datepickerhide',function(){W.$datepicker&&W.$datepicker.hide()},20)};self.bindevents=function(){if(!visible)$(W).on('scroll click',hide2)};self.unbindevents=function(){if(visible)$(W).off('scroll click',hide2)};self.on('reflow + scroll + resize',hide)};self.makehtml=function(){var builder=[];builder.push('<div class="{0}-header"><span class="{0}-next"><i class="fa fa-angle-right"></i></span><span class="{0}-prev"><i class="fa fa-angle-left"></i></span><div class="{0}-info"><span class="{0}-month">---</span><span class="{0}-year">---</span></div></div><div class="{0}-years hidden"></div><div class="{0}-months"></div><div class="{0}-body hidden"><div class="{0}-week">'.format(cls));for(var i=0;i<7;i++)builder.push('<div></div>');builder.push('</div><div class="{0}-days">'.format(cls));for(var i=0;i<42;i++)builder.push('<div class="{0}-date"><div></div></div>'.format(cls,i));builder.push('</div></div><div class="{0}-footer"><span class="{0}-now">{2}</span></div>'.format(cls,config.close,config.today));self.html(builder.join(''));builder=[];elbody=self.find(cls2+'-body');elmonths=self.find(cls2+'-months');for(var i=0;i<12;i++)builder.push('<div class="{0}-month" data-index="{1}"><div></div></div>'.format(cls,i));elmonths.html(builder.join(''));builder=[];elyears=self.find(cls2+'-years');for(var i=0;i<25;i++)builder.push('<div class="{0}-year"><div></div></div>'.format(cls));elyears.html(builder.join(''));self.makehtml=null;self.find(cls2+'-month').on('click',function(e){var el=$(this);var index=el.attrd('index');var h='hidden';if(index){current.setMonth(+index);self.date(current,true)}else if(!elmonths.hclass(h))index=1;elyears.aclass(h);if(index)elmonths.aclass(h);else{elmonths.find(cls2+'-today').rclass(cls+'-today');elmonths.find(cls2+'-month').eq(current.getMonth()).aclass(cls+'-today');elmonths.rclass(h)}elbody.tclass(h,!elmonths.hclass(h));e.preventDefault();e.stopPropagation()});self.find(cls2+'-year').on('click',function(e){var el=$(this);var year=el.attrd('year');var h='hidden';if(year){current.setFullYear(+year);self.date(current,true)}else if(!elyears.hclass(h))year=1;elmonths.aclass(h);if(year)elyears.aclass(h);else{self.years();elyears.rclass(h)}elbody.tclass(h,!elyears.hclass(h));e.preventDefault();e.stopPropagation()});self.years=function(){dom=self.find(cls2+'-years').find(cls2+'-year');var year=current.getFullYear();var index=12;for(var i=0;i<25;i++){var val=year-(index--);$(dom[i]).tclass(cls+'-today',val===year).attrd('year',val).find('div')[0].innerHTML=val}};self.find(cls2+'-date').on('click',function(){var dt=$(this).attrd('date').split('-');self.setdate(new Date(+dt[0],+dt[1],+dt[2],12,0,0));self.hide()});self.find(cls2+'-now').on('click',function(){self.setdate(new Date());self.hide()});self.find(cls2+'-next').on('click',function(e){if(elyears.hclass('hidden')){current.setMonth(current.getMonth()+1);self.date(current,true)}else{current.setFullYear(current.getFullYear()+25);self.years()}e.preventDefault();e.stopPropagation()});self.find(cls2+'-prev').on('click',function(e){if(elyears.hclass('hidden')){current.setMonth(current.getMonth()-1);self.date(current,true)}else{current.setFullYear(current.getFullYear()-25);self.years()}e.preventDefault();e.stopPropagation()})};self.date=function(value,skipday){self.makehtml&&self.makehtml();if(typeof(value)==='string')value=value.parseDate();var year=value==null?null:value.getFullYear();if(year&&(year<self.years_from||year>self.years_to))return;if(!value||isNaN(value.getTime())){self.find('.'+clssel).rclass(clssel);value=NOW}var empty=!value;if(skipday){skipday=false;empty=true}if(skip){skip=false;return}value=new Date((value||NOW).getTime());var output=self.calculate(value.getFullYear(),value.getMonth(),value);var dom=self.find(cls2+'-date');self.find(cls2+'-body').rclass('hidden');self.find(cls2+'-months,'+cls2+'-years').aclass('hidden');current=value;for(var i=0;i<42;i++){var item=output.days[i],classes=[cls+'-date'];if(item.empty)classes.push(cls+'-disabled');if(!empty&&item.selected)classes.push(cls+'-selected');if(item.today)classes.push(cls+'-day-today');var el=$(dom[i]);el.attrd('date',item.year+'-'+item.month+'-'+item.number);el.find('div').html(item.number);el.find('i').remove();el.rclass().aclass(classes.join(' '))}if(!skipday){dom=self.find(cls2+'-week').find('div');for(var i=0;i<7;i++)dom[i].innerHTML=output.header[i].name;dom=self.find(cls2+'-months').find(cls2+'-month');for(var i=0;i<12;i++)$(dom[i]).find('div').attrd('index',i)[0].innerHTML=self.months_short[i]}self.opt.badges&&self.opt.badges(current,function(date){if(!(date instanceof Array))date=[date];for(var i=0;i<date.length;i++){var dt=date[i].getFullYear()+'-'+date[i].getMonth()+'-'+date[i].getDate();var el=self.find(cls2+'-date[data-date="{0}"]'.format(dt));if(el.length&&!el.find('i').length)el.append('<i class="fa fa-circle"></i>')}});var info=self.find(cls2+'-info');info.find(cls2+'-month').html(self.months[current.getMonth()]);info.find(cls2+'-year').html(current.getFullYear())}});
COMPONENT('checkbox',function(self,config,cls){self.nocompile&&self.nocompile();self.validate=function(value){return(config.disabled||!config.required)?true:(value===true||value==='true'||value==='on')};self.configure=function(key,value,init){if(init)return;switch(key){case'label':self.find('span').html(value);break;case'required':self.find('span').tclass(cls+'-label-required',value);break;case'disabled':self.tclass('ui-disabled',value);break;case'checkicon':self.find('i').rclass2('fa-').aclass('fa-'+value);break}};self.make=function(){self.aclass(cls);self.html('<div><i class="fa fa-{2}"></i></div><span{1}>{0}</span>'.format(config.label||self.html(),config.required?(' class="'+cls+'-label-required"'):'',config.checkicon||'check'));config.disabled&&self.aclass('ui-disabled');self.event('click',function(){if(!config.disabled){self.dirty(false);self.getter(!self.get())}})};self.setter=function(value){var is=config.reverse?!value:!!value;self.tclass(cls+'-checked',is)}});
COMPONENT('colorpicker',function(self){var cls='ui-colorpicker',cls2='.'+cls,is=false,events={},colors=[['e73323','ec8632','fffd54','7bfa4c','7cfbfd','041ef5','e73cf7','73197b','91683c','ffffff','808080','000000'],['ffffff','e8e8e8','d1d1d1','b9b9b9','a2a2a2','8b8b8b','747474','5d5d5d','464646','2e2e2e','171717','000000'],['5c0e07','5e350f','66651c','41641a','2d6419','2d6438','2d6465','133363','000662','2d0962','5c1262','5c0f32','8a1a11','8e501b','99982f','62962b','47962a','479654','479798','214d94','010e93','451393','8a2094','8a1c4c','b9261a','bd6b27','cccb41','83c83c','61c83b','61c871','62c9ca','2e67c5','0216c4','5c1dc4','b92ec5','b92865','e73323','ec8632','fffd54','a4fb4e','7bfa4c','7bfa8d','7cfbfd','3b80f7','041ef5','7327f5','e73cf7','e7357f','e8483f','ef9d4b','fffe61','b4fb5c','83fa5a','83faa2','83fbfd','5599f8','343cf5','8c42f6','e84ff7','e84a97','ea706b','f2b573','fffe7e','c5fc7c','96fa7a','96fbb9','96fcfd','7bb2f9','666af6','a76ef7','eb73f8','ea71b0','f6cecd','fae6cf','fffed1','ebfed1','d7fdd0','d7fde7','d8fefe','d1e5fd','cccdfb','e1cefb','f6cffc','f6cee4']];self.singleton();self.readonly();self.blind();self.nocompile();self.make=function(){var html='';for(var i=0;i<colors.length;i++){html+='<div>';for(var j=0;j<colors[i].length;j++){html+='<span class="{0}-cell"><span style="background-color:#{1}"></span></span>'.format(cls,colors[i][j])}html+='</div>'}self.html('<div class="{0}"><div class="{0}-body">{1}</div></div>'.format(cls,html));self.aclass(cls+'-container hidden');self.event('click',cls2+'-cell',function(){var el=$(this);self.opt.callback&&self.opt.callback(el.find('span').attr('style').replace('background-color:',''));self.hide()});events.click=function(e){var el=e.target,parent=self.dom;do{if(el==parent)return;el=el.parentNode}while(el);self.hide()};self.on('scroll + reflow',self.hide)};self.bindevents=function(){if(!events.is){events.is=true;$(document).on('click',events.click)}};self.unbindevents=function(){if(events.is){events.is=false;$(document).off('click',events.click)}};self.show=function(opt){var tmp=opt.element?opt.element instanceof jQuery?opt.element[0]:opt.element.element?opt.element.dom:opt.element:null;if(is&&tmp&&self.target===tmp){self.hide();return}events.is&&self.unbindevents();self.target=tmp;self.opt=opt;var css={};if(is){css.left=0;css.top=0;self.element.css(css)}else self.rclass('hidden');var target=$(opt.element);var w=self.element.width();var offset=target.offset();if(opt.element){switch(opt.align){case'center':css.left=Math.ceil((offset.left-w/2)+(target.innerWidth()/2));break;case'right':css.left=(offset.left-w)+target.innerWidth();break;default:css.left=offset.left;break}css.top=opt.position==='bottom'?(offset.top-self.element.height()-10):(offset.top+target.innerHeight()+10)}else{css.left=opt.x;css.top=opt.y}if(opt.offsetX)css.left+=opt.offsetX;if(opt.offsetY)css.top+=opt.offsetY;is=true;self.element.css(css);setTimeout(self.bindevents,10)};self.hide=function(){if(is){is=false;self.target=null;self.opt=null;setTimeout(self.unbindevents,50);self.aclass('hidden')}}});
COMPONENT('faicons','search:Search',function(self,config){var icons='ad,address-book,address-card,adjust,air-freshener,align-center,align-justify,align-left,align-right,allergies,ambulance,american-sign-language-interpreting,anchor,angle-double-down,angle-double-left,angle-double-right,angle-double-up,angle-down,angle-left,angle-right,angle-up,angry,ankh,apple-alt,archive,archway,arrow-alt-circle-down,arrow-alt-circle-left,arrow-alt-circle-right,arrow-alt-circle-up,arrow-circle-down,arrow-circle-left,arrow-circle-right,arrow-circle-up,arrow-down,arrow-left,arrow-right,arrow-up,arrows-alt,arrows-alt-h,arrows-alt-v,assistive-listening-systems,asterisk,at,atlas,atom,audio-description,award,baby,baby-carriage,backspace,backward,bacon,bahai,balance-scale,balance-scale-left,balance-scale-right,ban,band-aid,barcode,bars,baseball-ball,basketball-ball,bath,battery-empty,battery-full,battery-half,battery-quarter,battery-three-quarters,bed,beer,bell,bell-slash,bezier-curve,bible,bicycle,biking,binoculars,biohazard,birthday-cake,blender,blender-phone,blind,blog,bold,bolt,bomb,bone,bong,book,book-dead,book-medical,book-open,book-reader,bookmark,border-all,border-none,border-style,bowling-ball,box,box-open,boxes,braille,brain,bread-slice,briefcase,briefcase-medical,broadcast-tower,broom,brush,bug,building,bullhorn,bullseye,burn,bus,bus-alt,business-time,calculator,calendar,calendar-alt,calendar-check,calendar-day,calendar-minus,calendar-plus,calendar-times,calendar-week,camera,camera-retro,campground,candy-cane,cannabis,capsules,car,car-alt,car-battery,car-crash,car-side,caravan,caret-down,caret-left,caret-right,caret-square-down,caret-square-left,caret-square-right,caret-square-up,caret-up,carrot,cart-arrow-down,cart-plus,cash-register,cat,certificate,chair,chalkboard,chalkboard-teacher,charging-station,chart-area,chart-bar,chart-line,chart-pie,check,check-circle,check-double,check-square,cheese,chess,chess-bishop,chess-board,chess-king,chess-knight,chess-pawn,chess-queen,chess-rook,chevron-circle-down,chevron-circle-left,chevron-circle-right,chevron-circle-up,chevron-down,chevron-left,chevron-right,chevron-up,child,church,circle,circle-notch,city,clinic-medical,clipboard,clipboard-check,clipboard-list,clock,clone,closed-captioning,cloud,cloud-download-alt,cloud-meatball,cloud-moon,cloud-moon-rain,cloud-rain,cloud-showers-heavy,cloud-sun,cloud-sun-rain,cloud-upload-alt,cocktail,code,code-branch,coffee,cog,cogs,coins,columns,comment,comment-alt,comment-dollar,comment-dots,comment-medical,comment-slash,comments,comments-dollar,compact-disc,compass,compress,compress-alt,compress-arrows-alt,concierge-bell,cookie,cookie-bite,copy,copyright,couch,credit-card,crop,crop-alt,cross,crosshairs,crow,crown,crutch,cube,cubes,cut,database,deaf,democrat,desktop,dharmachakra,diagnoses,dice,dice-d20,dice-d6,dice-five,dice-four,dice-one,dice-six,dice-three,dice-two,digital-tachograph,directions,divide,dizzy,dna,dog,dollar-sign,dolly,dolly-flatbed,donate,door-closed,door-open,dot-circle,dove,download,drafting-compass,dragon,draw-polygon,drum,drum-steelpan,drumstick-bite,dumbbell,dumpster,dumpster-fire,dungeon,edit,egg,eject,ellipsis-h,ellipsis-v,envelope,envelope-open,envelope-open-text,envelope-square,equals,eraser,ethernet,euro-sign,exchange-alt,exclamation,exclamation-circle,exclamation-triangle,expand,expand-alt,expand-arrows-alt,external-link-alt,external-link-square-alt,eye,eye-dropper,eye-slash,fan,fast-backward,fast-forward,fax,feather,feather-alt,female,fighter-jet,file,file-alt,file-archive,file-audio,file-code,file-contract,file-csv,file-download,file-excel,file-export,file-image,file-import,file-invoice,file-invoice-dollar,file-medical,file-medical-alt,file-pdf,file-powerpoint,file-prescription,file-signature,file-upload,file-video,file-word,fill,fill-drip,film,filter,fingerprint,fire,fire-alt,fire-extinguisher,first-aid,fish,fist-raised,flag,flag-checkered,flag-usa,flask,flushed,folder,folder-minus,folder-open,folder-plus,font,football-ball,forward,frog,frown,frown-open,funnel-dollar,futbol,gamepad,gas-pump,gavel,gem,genderless,ghost,gift,gifts,glass-cheers,glass-martini,glass-martini-alt,glass-whiskey,glasses,globe,globe-africa,globe-americas,globe-asia,globe-europe,golf-ball,gopuram,graduation-cap,greater-than,greater-than-equal,grimace,grin,grin-alt,grin-beam,grin-beam-sweat,grin-hearts,grin-squint,grin-squint-tears,grin-stars,grin-tears,grin-tongue,grin-tongue-squint,grin-tongue-wink,grin-wink,grip-horizontal,grip-lines,grip-lines-vertical,grip-vertical,guitar,h-square,hamburger,hammer,hamsa,hand-holding,hand-holding-heart,hand-holding-usd,hand-lizard,hand-middle-finger,hand-paper,hand-peace,hand-point-down,hand-point-left,hand-point-right,hand-point-up,hand-pointer,hand-rock,hand-scissors,hand-spock,hands,hands-helping,handshake,hanukiah,hard-hat,hashtag,hat-cowboy,hat-cowboy-side,hat-wizard,hdd,heading,headphones,headphones-alt,headset,heart,heart-broken,heartbeat,helicopter,highlighter,hiking,hippo,history,hockey-puck,holly-berry,home,horse,horse-head,hospital,hospital-alt,hospital-symbol,hot-tub,hotdog,hotel,hourglass,hourglass-end,hourglass-half,hourglass-start,house-damage,hryvnia,i-cursor,ice-cream,icicles,icons,id-badge,id-card,id-card-alt,igloo,image,images,inbox,indent,industry,infinity,info,info-circle,italic,jedi,joint,journal-whills,kaaba,key,keyboard,khanda,kiss,kiss-beam,kiss-wink-heart,kiwi-bird,landmark,language,laptop,laptop-code,laptop-medical,laugh,laugh-beam,laugh-squint,laugh-wink,layer-group,leaf,lemon,less-than,less-than-equal,level-down-alt,level-up-alt,life-ring,lightbulb,link,lira-sign,list,list-alt,list-ol,list-ul,location-arrow,lock,lock-open,long-arrow-alt-down,long-arrow-alt-left,long-arrow-alt-right,long-arrow-alt-up,low-vision,luggage-cart,magic,magnet,mail-bulk,male,map,map-marked,map-marked-alt,map-marker,map-marker-alt,map-pin,map-signs,marker,mars,mars-double,mars-stroke,mars-stroke-h,mars-stroke-v,mask,medal,medkit,meh,meh-blank,meh-rolling-eyes,memory,menorah,mercury,meteor,microchip,microphone,microphone-alt,microphone-alt-slash,microphone-slash,microscope,minus,minus-circle,minus-square,mitten,mobile,mobile-alt,money-bill,money-bill-alt,money-bill-wave,money-bill-wave-alt,money-check,money-check-alt,monument,moon,mortar-pestle,mosque,motorcycle,mountain,mouse,mouse-pointer,mug-hot,music,network-wired,neuter,newspaper,not-equal,notes-medical,object-group,object-ungroup,oil-can,om,otter,outdent,pager,paint-brush,paint-roller,palette,pallet,paper-plane,paperclip,parachute-box,paragraph,parking,passport,pastafarianism,paste,pause,pause-circle,paw,peace,pen,pen-alt,pen-fancy,pen-nib,pen-square,pencil-alt,pencil-ruler,people-carry,pepper-hot,percent,percentage,person-booth,phone,phone-alt,phone-slash,phone-square,phone-square-alt,phone-volume,photo-video,piggy-bank,pills,pizza-slice,place-of-worship,plane,plane-arrival,plane-departure,play,play-circle,plug,plus,plus-circle,plus-square,podcast,poll,poll-h,poo,poo-storm,poop,portrait,pound-sign,power-off,pray,praying-hands,prescription,prescription-bottle,prescription-bottle-alt,print,procedures,project-diagram,puzzle-piece,qrcode,question,question-circle,quidditch,quote-left,quote-right,quran,radiation,radiation-alt,rainbow,random,receipt,record-vinyl,recycle,redo,redo-alt,registered,remove-format,reply,reply-all,republican,restroom,retweet,ribbon,ring,road,robot,rocket,route,rss,rss-square,ruble-sign,ruler,ruler-combined,ruler-horizontal,ruler-vertical,running,rupee-sign,sad-cry,sad-tear,satellite,satellite-dish,save,school,screwdriver,scroll,sd-card,search,search-dollar,search-location,search-minus,search-plus,seedling,server,shapes,share,share-alt,share-alt-square,share-square,shekel-sign,shield-alt,ship,shipping-fast,shoe-prints,shopping-bag,shopping-basket,shopping-cart,shower,shuttle-van,sign,sign-in-alt,sign-language,sign-out-alt,signal,signature,sim-card,sitemap,skating,skiing,skiing-nordic,skull,skull-crossbones,slash,sleigh,sliders-h,smile,smile-beam,smile-wink,smog,smoking,smoking-ban,sms,snowboarding,snowflake,snowman,snowplow,socks,solar-panel,sort,sort-alpha-down,sort-alpha-down-alt,sort-alpha-up,sort-alpha-up-alt,sort-amount-down,sort-amount-down-alt,sort-amount-up,sort-amount-up-alt,sort-down,sort-numeric-down,sort-numeric-down-alt,sort-numeric-up,sort-numeric-up-alt,sort-up,spa,space-shuttle,spell-check,spider,spinner,splotch,spray-can,square,square-full,square-root-alt,stamp,star,star-and-crescent,star-half,star-half-alt,star-of-david,star-of-life,step-backward,step-forward,stethoscope,sticky-note,stop,stop-circle,stopwatch,store,store-alt,stream,street-view,strikethrough,stroopwafel,subscript,subway,suitcase,suitcase-rolling,sun,superscript,surprise,swatchbook,swimmer,swimming-pool,synagogue,sync,sync-alt,syringe,table,table-tennis,tablet,tablet-alt,tablets,tachometer-alt,tag,tags,tape,tasks,taxi,teeth,teeth-open,temperature-high,temperature-low,tenge,terminal,text-height,text-width,th,th-large,th-list,theater-masks,thermometer,thermometer-empty,thermometer-full,thermometer-half,thermometer-quarter,thermometer-three-quarters,thumbs-down,thumbs-up,thumbtack,ticket-alt,times,times-circle,tint,tint-slash,tired,toggle-off,toggle-on,toilet,toilet-paper,toolbox,tools,tooth,torah,torii-gate,tractor,trademark,traffic-light,trailer,train,tram,transgender,transgender-alt,trash,trash-alt,trash-restore,trash-restore-alt,tree,trophy,truck,truck-loading,truck-monster,truck-moving,truck-pickup,tshirt,tty,tv,umbrella,umbrella-beach,underline,undo,undo-alt,universal-access,university,unlink,unlock,unlock-alt,upload,user,user-alt,user-alt-slash,user-astronaut,user-check,user-circle,user-clock,user-cog,user-edit,user-friends,user-graduate,user-injured,user-lock,user-md,user-minus,user-ninja,user-nurse,user-plus,user-secret,user-shield,user-slash,user-tag,user-tie,user-times,users,users-cog,utensil-spoon,utensils,vector-square,venus,venus-double,venus-mars,vial,vials,video,video-slash,vihara,voicemail,volleyball-ball,volume-down,volume-mute,volume-off,volume-up,vote-yea,vr-cardboard,walking,wallet,warehouse,water,wave-square,weight,weight-hanging,wheelchair,wifi,wind,window-close,window-maximize,window-minimize,window-restore,wine-bottle,wine-glass,wine-glass-alt,won-sign,wrench,x-ray,yen-sign,yin-yang,r address-book,r address-card,r angry,r arrow-alt-circle-down,r arrow-alt-circle-left,r arrow-alt-circle-right,r arrow-alt-circle-up,r bell,r bell-slash,r bookmark,r building,r calendar,r calendar-alt,r calendar-check,r calendar-minus,r calendar-plus,r calendar-times,r caret-square-down,r caret-square-left,r caret-square-right,r caret-square-up,r chart-bar,r check-circle,r check-square,r circle,r clipboard,r clock,r clone,r closed-captioning,r comment,r comment-alt,r comment-dots,r comments,r compass,r copy,r copyright,r credit-card,r dizzy,r dot-circle,r edit,r envelope,r envelope-open,r eye,r eye-slash,r file,r file-alt,r file-archive,r file-audio,r file-code,r file-excel,r file-image,r file-pdf,r file-powerpoint,r file-video,r file-word,r flag,r flushed,r folder,r folder-open,r frown,r frown-open,r futbol,r gem,r grimace,r grin,r grin-alt,r grin-beam,r grin-beam-sweat,r grin-hearts,r grin-squint,r grin-squint-tears,r grin-stars,r grin-tears,r grin-tongue,r grin-tongue-squint,r grin-tongue-wink,r grin-wink,r hand-lizard,r hand-paper,r hand-peace,r hand-point-down,r hand-point-left,r hand-point-right,r hand-point-up,r hand-pointer,r hand-rock,r hand-scissors,r hand-spock,r handshake,r hdd,r heart,r hospital,r hourglass,r id-badge,r id-card,r image,r images,r keyboard,r kiss,r kiss-beam,r kiss-wink-heart,r laugh,r laugh-beam,r laugh-squint,r laugh-wink,r lemon,r life-ring,r lightbulb,r list-alt,r map,r meh,r meh-blank,r meh-rolling-eyes,r minus-square,r money-bill-alt,r moon,r newspaper,r object-group,r object-ungroup,r paper-plane,r pause-circle,r play-circle,r plus-square,r question-circle,r registered,r sad-cry,r sad-tear,r save,r share-square,r smile,r smile-beam,r smile-wink,r snowflake,r square,r star,r star-half,r sticky-note,r stop-circle,r sun,r surprise,r thumbs-down,r thumbs-up,r times-circle,r tired,r trash-alt,r user,r user-circle,r window-close,r window-maximize,r window-minimize,r window-restore,b 500px,b accessible-icon,b accusoft,b acquisitions-incorporated,b adn,b adobe,b adversal,b affiliatetheme,b airbnb,b algolia,b alipay,b amazon,b amazon-pay,b amilia,b android,b angellist,b angrycreative,b angular,b app-store,b app-store-ios,b apper,b apple,b apple-pay,b artstation,b asymmetrik,b atlassian,b audible,b autoprefixer,b avianex,b aviato,b aws,b bandcamp,b battle-net,b behance,b behance-square,b bimobject,b bitbucket,b bitcoin,b bity,b black-tie,b blackberry,b blogger,b blogger-b,b bluetooth,b bluetooth-b,b bootstrap,b btc,b buffer,b buromobelexperte,b buy-n-large,b buysellads,b canadian-maple-leaf,b cc-amazon-pay,b cc-amex,b cc-apple-pay,b cc-diners-club,b cc-discover,b cc-jcb,b cc-mastercard,b cc-paypal,b cc-stripe,b cc-visa,b centercode,b centos,b chrome,b chromecast,b cloudscale,b cloudsmith,b cloudversify,b codepen,b codiepie,b confluence,b connectdevelop,b contao,b cotton-bureau,b cpanel,b creative-commons,b creative-commons-by,b creative-commons-nc,b creative-commons-nc-eu,b creative-commons-nc-jp,b creative-commons-nd,b creative-commons-pd,b creative-commons-pd-alt,b creative-commons-remix,b creative-commons-sa,b creative-commons-sampling,b creative-commons-sampling-plus,b creative-commons-share,b creative-commons-zero,b critical-role,b css3,b css3-alt,b cuttlefish,b d-and-d,b d-and-d-beyond,b dashcube,b delicious,b deploydog,b deskpro,b dev,b deviantart,b dhl,b diaspora,b digg,b digital-ocean,b discord,b discourse,b dochub,b docker,b draft2digital,b dribbble,b dribbble-square,b dropbox,b drupal,b dyalog,b earlybirds,b ebay,b edge,b elementor,b ello,b ember,b empire,b envira,b erlang,b ethereum,b etsy,b evernote,b expeditedssl,b facebook,b facebook-f,b facebook-messenger,b facebook-square,b fantasy-flight-games,b fedex,b fedora,b figma,b firefox,b firefox-browser,b first-order,b first-order-alt,b firstdraft,b flickr,b flipboard,b fly,b font-awesome,b font-awesome-alt,b font-awesome-flag,b fonticons,b fonticons-fi,b fort-awesome,b fort-awesome-alt,b forumbee,b foursquare,b free-code-camp,b freebsd,b fulcrum,b galactic-republic,b galactic-senate,b get-pocket,b gg,b gg-circle,b git,b git-alt,b git-square,b github,b github-alt,b github-square,b gitkraken,b gitlab,b gitter,b glide,b glide-g,b gofore,b goodreads,b goodreads-g,b google,b google-drive,b google-play,b google-plus,b google-plus-g,b google-plus-square,b google-wallet,b gratipay,b grav,b gripfire,b grunt,b gulp,b hacker-news,b hacker-news-square,b hackerrank,b hips,b hire-a-helper,b hooli,b hornbill,b hotjar,b houzz,b html5,b hubspot,b ideal,b imdb,b instagram,b intercom,b internet-explorer,b invision,b ioxhost,b itch-io,b itunes,b itunes-note,b java,b jedi-order,b jenkins,b jira,b joget,b joomla,b js,b js-square,b jsfiddle,b kaggle,b keybase,b keycdn,b kickstarter,b kickstarter-k,b korvue,b laravel,b lastfm,b lastfm-square,b leanpub,b less,b line,b linkedin,b linkedin-in,b linode,b linux,b lyft,b magento,b mailchimp,b mandalorian,b markdown,b mastodon,b maxcdn,b mdb,b medapps,b medium,b medium-m,b medrt,b meetup,b megaport,b mendeley,b microblog,b microsoft,b mix,b mixcloud,b mizuni,b modx,b monero,b napster,b neos,b nimblr,b node,b node-js,b npm,b ns8,b nutritionix,b odnoklassniki,b odnoklassniki-square,b old-republic,b opencart,b openid,b opera,b optin-monster,b orcid,b osi,b page4,b pagelines,b palfed,b patreon,b paypal,b penny-arcade,b periscope,b phabricator,b phoenix-framework,b phoenix-squadron,b php,b pied-piper,b pied-piper-alt,b pied-piper-hat,b pied-piper-pp,b pied-piper-square,b pinterest,b pinterest-p,b pinterest-square,b playstation,b product-hunt,b pushed,b python,b qq,b quinscape,b quora,b r-project,b raspberry-pi,b ravelry,b react,b reacteurope,b readme,b rebel,b red-river,b reddit,b reddit-alien,b reddit-square,b redhat,b renren,b replyd,b researchgate,b resolving,b rev,b rocketchat,b rockrms,b safari,b salesforce,b sass,b schlix,b scribd,b searchengin,b sellcast,b sellsy,b servicestack,b shirtsinbulk,b shopware,b simplybuilt,b sistrix,b sith,b sketch,b skyatlas,b skype,b slack,b slack-hash,b slideshare,b snapchat,b snapchat-ghost,b snapchat-square,b soundcloud,b sourcetree,b speakap,b speaker-deck,b spotify,b squarespace,b stack-exchange,b stack-overflow,b stackpath,b staylinked,b steam,b steam-square,b steam-symbol,b sticker-mule,b strava,b stripe,b stripe-s,b studiovinari,b stumbleupon,b stumbleupon-circle,b superpowers,b supple,b suse,b swift,b symfony,b teamspeak,b telegram,b telegram-plane,b tencent-weibo,b the-red-yeti,b themeco,b themeisle,b think-peaks,b trade-federation,b trello,b tripadvisor,b tumblr,b tumblr-square,b twitch,b twitter,b twitter-square,b typo3,b uber,b ubuntu,b uikit,b umbraco,b uniregistry,b unity,b untappd,b ups,b usb,b usps,b ussunnah,b vaadin,b viacoin,b viadeo,b viadeo-square,b viber,b vimeo,b vimeo-square,b vimeo-v,b vine,b vk,b vnv,b vuejs,b waze,b weebly,b weibo,b weixin,b whatsapp,b whatsapp-square,b whmcs,b wikipedia-w,b windows,b wix,b wizards-of-the-coast,b wolf-pack-battalion,b wordpress,b wordpress-simple,b wpbeginner,b wpexplorer,b wpforms,b wpressr,b xbox,b xing,b xing-square,b y-combinator,b yahoo,b yammer,b yandex,b yandex-international,b yarn,b yelp,b yoast,b youtube,b youtube-square,b zhihu'.split(',');var iconspro='abacus,acorn,ad,address-book,address-card,adjust,air-conditioner,air-freshener,alarm-clock,alarm-exclamation,alarm-plus,alarm-snooze,album,album-collection,alicorn,alien,alien-monster,align-center,align-justify,align-left,align-right,align-slash,allergies,ambulance,american-sign-language-interpreting,amp-guitar,analytics,anchor,angel,angle-double-down,angle-double-left,angle-double-right,angle-double-up,angle-down,angle-left,angle-right,angle-up,angry,ankh,apple-alt,apple-crate,archive,archway,arrow-alt-circle-down,arrow-alt-circle-left,arrow-alt-circle-right,arrow-alt-circle-up,arrow-alt-down,arrow-alt-from-bottom,arrow-alt-from-left,arrow-alt-from-right,arrow-alt-from-top,arrow-alt-left,arrow-alt-right,arrow-alt-square-down,arrow-alt-square-left,arrow-alt-square-right,arrow-alt-square-up,arrow-alt-to-bottom,arrow-alt-to-left,arrow-alt-to-right,arrow-alt-to-top,arrow-alt-up,arrow-circle-down,arrow-circle-left,arrow-circle-right,arrow-circle-up,arrow-down,arrow-from-bottom,arrow-from-left,arrow-from-right,arrow-from-top,arrow-left,arrow-right,arrow-square-down,arrow-square-left,arrow-square-right,arrow-square-up,arrow-to-bottom,arrow-to-left,arrow-to-right,arrow-to-top,arrow-up,arrows,arrows-alt,arrows-alt-h,arrows-alt-v,arrows-h,arrows-v,assistive-listening-systems,asterisk,at,atlas,atom,atom-alt,audio-description,award,axe,axe-battle,baby,baby-carriage,backpack,backspace,backward,bacon,badge,badge-check,badge-dollar,badge-percent,badge-sheriff,badger-honey,bags-shopping,bahai,balance-scale,balance-scale-left,balance-scale-right,ball-pile,ballot,ballot-check,ban,band-aid,banjo,barcode,barcode-alt,barcode-read,barcode-scan,bars,baseball,baseball-ball,basketball-ball,basketball-hoop,bat,bath,battery-bolt,battery-empty,battery-full,battery-half,battery-quarter,battery-slash,battery-three-quarters,bed,bed-alt,bed-bunk,bed-empty,beer,bell,bell-exclamation,bell-on,bell-plus,bell-school,bell-school-slash,bell-slash,bells,betamax,bezier-curve,bible,bicycle,biking,biking-mountain,binoculars,biohazard,birthday-cake,blanket,blender,blender-phone,blind,blinds,blinds-open,blinds-raised,blog,bold,bolt,bomb,bone,bone-break,bong,book,book-alt,book-dead,book-heart,book-medical,book-open,book-reader,book-spells,book-user,bookmark,books,books-medical,boombox,boot,booth-curtain,border-all,border-bottom,border-center-h,border-center-v,border-inner,border-left,border-none,border-outer,border-right,border-style,border-style-alt,border-top,bow-arrow,bowling-ball,bowling-pins,box,box-alt,box-ballot,box-check,box-fragile,box-full,box-heart,box-open,box-up,box-usd,boxes,boxes-alt,boxing-glove,brackets,brackets-curly,braille,brain,bread-loaf,bread-slice,briefcase,briefcase-medical,bring-forward,bring-front,broadcast-tower,broom,browser,brush,bug,building,bullhorn,bullseye,bullseye-arrow,bullseye-pointer,burger-soda,burn,burrito,bus,bus-alt,bus-school,business-time,cabinet-filing,cactus,calculator,calculator-alt,calendar,calendar-alt,calendar-check,calendar-day,calendar-edit,calendar-exclamation,calendar-minus,calendar-plus,calendar-star,calendar-times,calendar-week,camcorder,camera,camera-alt,camera-home,camera-movie,camera-polaroid,camera-retro,campfire,campground,candle-holder,candy-cane,candy-corn,cannabis,capsules,car,car-alt,car-battery,car-building,car-bump,car-bus,car-crash,car-garage,car-mechanic,car-side,car-tilt,car-wash,caravan,caravan-alt,caret-circle-down,caret-circle-left,caret-circle-right,caret-circle-up,caret-down,caret-left,caret-right,caret-square-down,caret-square-left,caret-square-right,caret-square-up,caret-up,carrot,cars,cart-arrow-down,cart-plus,cash-register,cassette-tape,cat,cat-space,cauldron,cctv,certificate,chair,chair-office,chalkboard,chalkboard-teacher,charging-station,chart-area,chart-bar,chart-line,chart-line-down,chart-network,chart-pie,chart-pie-alt,chart-scatter,check,check-circle,check-double,check-square,cheese,cheese-swiss,cheeseburger,chess,chess-bishop,chess-bishop-alt,chess-board,chess-clock,chess-clock-alt,chess-king,chess-king-alt,chess-knight,chess-knight-alt,chess-pawn,chess-pawn-alt,chess-queen,chess-queen-alt,chess-rook,chess-rook-alt,chevron-circle-down,chevron-circle-left,chevron-circle-right,chevron-circle-up,chevron-double-down,chevron-double-left,chevron-double-right,chevron-double-up,chevron-down,chevron-left,chevron-right,chevron-square-down,chevron-square-left,chevron-square-right,chevron-square-up,chevron-up,child,chimney,church,circle,circle-notch,city,clarinet,claw-marks,clinic-medical,clipboard,clipboard-check,clipboard-list,clipboard-list-check,clipboard-prescription,clipboard-user,clock,clone,closed-captioning,cloud,cloud-download,cloud-download-alt,cloud-drizzle,cloud-hail,cloud-hail-mixed,cloud-meatball,cloud-moon,cloud-moon-rain,cloud-music,cloud-rain,cloud-rainbow,cloud-showers,cloud-showers-heavy,cloud-sleet,cloud-snow,cloud-sun,cloud-sun-rain,cloud-upload,cloud-upload-alt,clouds,clouds-moon,clouds-sun,club,cocktail,code,code-branch,code-commit,code-merge,coffee,coffee-pot,coffee-togo,coffin,cog,cogs,coin,coins,columns,comet,comment,comment-alt,comment-alt-check,comment-alt-dollar,comment-alt-dots,comment-alt-edit,comment-alt-exclamation,comment-alt-lines,comment-alt-medical,comment-alt-minus,comment-alt-music,comment-alt-plus,comment-alt-slash,comment-alt-smile,comment-alt-times,comment-check,comment-dollar,comment-dots,comment-edit,comment-exclamation,comment-lines,comment-medical,comment-minus,comment-music,comment-plus,comment-slash,comment-smile,comment-times,comments,comments-alt,comments-alt-dollar,comments-dollar,compact-disc,compass,compass-slash,compress,compress-alt,compress-arrows-alt,compress-wide,computer-classic,computer-speaker,concierge-bell,construction,container-storage,conveyor-belt,conveyor-belt-alt,cookie,cookie-bite,copy,copyright,corn,couch,cow,cowbell,cowbell-more,credit-card,credit-card-blank,credit-card-front,cricket,croissant,crop,crop-alt,cross,crosshairs,crow,crown,crutch,crutches,cube,cubes,curling,cut,dagger,database,deaf,debug,deer,deer-rudolph,democrat,desktop,desktop-alt,dewpoint,dharmachakra,diagnoses,diamond,dice,dice-d10,dice-d12,dice-d20,dice-d4,dice-d6,dice-d8,dice-five,dice-four,dice-one,dice-six,dice-three,dice-two,digging,digital-tachograph,diploma,directions,disc-drive,disease,divide,dizzy,dna,do-not-enter,dog,dog-leashed,dollar-sign,dolly,dolly-empty,dolly-flatbed,dolly-flatbed-alt,dolly-flatbed-empty,donate,door-closed,door-open,dot-circle,dove,download,drafting-compass,dragon,draw-circle,draw-polygon,draw-square,dreidel,drone,drone-alt,drum,drum-steelpan,drumstick,drumstick-bite,dryer,dryer-alt,duck,dumbbell,dumpster,dumpster-fire,dungeon,ear,ear-muffs,eclipse,eclipse-alt,edit,egg,egg-fried,eject,elephant,ellipsis-h,ellipsis-h-alt,ellipsis-v,ellipsis-v-alt,empty-set,engine-warning,envelope,envelope-open,envelope-open-dollar,envelope-open-text,envelope-square,equals,eraser,ethernet,euro-sign,exchange,exchange-alt,exclamation,exclamation-circle,exclamation-square,exclamation-triangle,expand,expand-alt,expand-arrows,expand-arrows-alt,expand-wide,external-link,external-link-alt,external-link-square,external-link-square-alt,eye,eye-dropper,eye-evil,eye-slash,fan,fan-table,farm,fast-backward,fast-forward,faucet,faucet-drip,fax,feather,feather-alt,female,field-hockey,fighter-jet,file,file-alt,file-archive,file-audio,file-certificate,file-chart-line,file-chart-pie,file-check,file-code,file-contract,file-csv,file-download,file-edit,file-excel,file-exclamation,file-export,file-image,file-import,file-invoice,file-invoice-dollar,file-medical,file-medical-alt,file-minus,file-music,file-pdf,file-plus,file-powerpoint,file-prescription,file-search,file-signature,file-spreadsheet,file-times,file-upload,file-user,file-video,file-word,files-medical,fill,fill-drip,film,film-alt,film-canister,filter,fingerprint,fire,fire-alt,fire-extinguisher,fire-smoke,fireplace,first-aid,fish,fish-cooked,fist-raised,flag,flag-alt,flag-checkered,flag-usa,flame,flashlight,flask,flask-poison,flask-potion,flower,flower-daffodil,flower-tulip,flushed,flute,flux-capacitor,fog,folder,folder-minus,folder-open,folder-plus,folder-times,folder-tree,folders,font,font-case,football-ball,football-helmet,forklift,forward,fragile,french-fries,frog,frosty-head,frown,frown-open,function,funnel-dollar,futbol,galaxy,game-board,game-board-alt,game-console-handheld,gamepad,gamepad-alt,garage,garage-car,garage-open,gas-pump,gas-pump-slash,gavel,gem,genderless,ghost,gift,gift-card,gifts,gingerbread-man,glass,glass-champagne,glass-cheers,glass-citrus,glass-martini,glass-martini-alt,glass-whiskey,glass-whiskey-rocks,glasses,glasses-alt,globe,globe-africa,globe-americas,globe-asia,globe-europe,globe-snow,globe-stand,golf-ball,golf-club,gopuram,graduation-cap,gramophone,greater-than,greater-than-equal,grimace,grin,grin-alt,grin-beam,grin-beam-sweat,grin-hearts,grin-squint,grin-squint-tears,grin-stars,grin-tears,grin-tongue,grin-tongue-squint,grin-tongue-wink,grin-wink,grip-horizontal,grip-lines,grip-lines-vertical,grip-vertical,guitar,guitar-electric,guitars,h-square,h1,h2,h3,h4,hamburger,hammer,hammer-war,hamsa,hand-heart,hand-holding,hand-holding-box,hand-holding-heart,hand-holding-magic,hand-holding-seedling,hand-holding-usd,hand-holding-water,hand-lizard,hand-middle-finger,hand-paper,hand-peace,hand-point-down,hand-point-left,hand-point-right,hand-point-up,hand-pointer,hand-receiving,hand-rock,hand-scissors,hand-spock,hands,hands-heart,hands-helping,hands-usd,handshake,handshake-alt,hanukiah,hard-hat,hashtag,hat-chef,hat-cowboy,hat-cowboy-side,hat-santa,hat-winter,hat-witch,hat-wizard,hdd,head-side,head-side-brain,head-side-headphones,head-side-medical,head-vr,heading,headphones,headphones-alt,headset,heart,heart-broken,heart-circle,heart-rate,heart-square,heartbeat,heat,helicopter,helmet-battle,hexagon,highlighter,hiking,hippo,history,hockey-mask,hockey-puck,hockey-sticks,holly-berry,home,home-alt,home-heart,home-lg,home-lg-alt,hood-cloak,horizontal-rule,horse,horse-head,horse-saddle,hospital,hospital-alt,hospital-symbol,hospital-user,hospitals,hot-tub,hotdog,hotel,hourglass,hourglass-end,hourglass-half,hourglass-start,house,house-damage,house-day,house-flood,house-leave,house-night,house-return,house-signal,hryvnia,humidity,hurricane,i-cursor,ice-cream,ice-skate,icicles,icons,icons-alt,id-badge,id-card,id-card-alt,igloo,image,image-polaroid,images,inbox,inbox-in,inbox-out,indent,industry,industry-alt,infinity,info,info-circle,info-square,inhaler,integral,intersection,inventory,island-tropical,italic,jack-o-lantern,jedi,joint,journal-whills,joystick,jug,kaaba,kazoo,kerning,key,key-skeleton,keyboard,keynote,khanda,kidneys,kiss,kiss-beam,kiss-wink-heart,kite,kiwi-bird,knife-kitchen,lambda,lamp,lamp-desk,lamp-floor,landmark,landmark-alt,language,laptop,laptop-code,laptop-medical,lasso,laugh,laugh-beam,laugh-squint,laugh-wink,layer-group,layer-minus,layer-plus,leaf,leaf-heart,leaf-maple,leaf-oak,lemon,less-than,less-than-equal,level-down,level-down-alt,level-up,level-up-alt,life-ring,light-ceiling,light-switch,light-switch-off,light-switch-on,lightbulb,lightbulb-dollar,lightbulb-exclamation,lightbulb-on,lightbulb-slash,lights-holiday,line-columns,line-height,link,lips,lira-sign,list,list-alt,list-music,list-ol,list-ul,location,location-arrow,location-circle,location-slash,lock,lock-alt,lock-open,lock-open-alt,long-arrow-alt-down,long-arrow-alt-left,long-arrow-alt-right,long-arrow-alt-up,long-arrow-down,long-arrow-left,long-arrow-right,long-arrow-up,loveseat,low-vision,luchador,luggage-cart,lungs,mace,magic,magnet,mail-bulk,mailbox,male,mandolin,map,map-marked,map-marked-alt,map-marker,map-marker-alt,map-marker-alt-slash,map-marker-check,map-marker-edit,map-marker-exclamation,map-marker-minus,map-marker-plus,map-marker-question,map-marker-slash,map-marker-smile,map-marker-times,map-pin,map-signs,marker,mars,mars-double,mars-stroke,mars-stroke-h,mars-stroke-v,mask,meat,medal,medkit,megaphone,meh,meh-blank,meh-rolling-eyes,memory,menorah,mercury,meteor,microchip,microphone,microphone-alt,microphone-alt-slash,microphone-slash,microphone-stand,microscope,microwave,mind-share,minus,minus-circle,minus-hexagon,minus-octagon,minus-square,mistletoe,mitten,mobile,mobile-alt,mobile-android,mobile-android-alt,money-bill,money-bill-alt,money-bill-wave,money-bill-wave-alt,money-check,money-check-alt,money-check-edit,money-check-edit-alt,monitor-heart-rate,monkey,monument,moon,moon-cloud,moon-stars,mortar-pestle,mosque,motorcycle,mountain,mountains,mouse,mouse-alt,mouse-pointer,mp3-player,mug,mug-hot,mug-marshmallows,mug-tea,music,music-alt,music-alt-slash,music-slash,narwhal,network-wired,neuter,newspaper,not-equal,notes-medical,object-group,object-ungroup,octagon,oil-can,oil-temp,om,omega,ornament,otter,outdent,outlet,oven,overline,page-break,pager,paint-brush,paint-brush-alt,paint-roller,palette,pallet,pallet-alt,paper-plane,paperclip,parachute-box,paragraph,paragraph-rtl,parking,parking-circle,parking-circle-slash,parking-slash,passport,pastafarianism,paste,pause,pause-circle,paw,paw-alt,paw-claws,peace,pegasus,pen,pen-alt,pen-fancy,pen-nib,pen-square,pencil,pencil-alt,pencil-paintbrush,pencil-ruler,pennant,people-carry,pepper-hot,percent,percentage,person-booth,person-carry,person-dolly,person-dolly-empty,person-sign,phone,phone-alt,phone-laptop,phone-office,phone-plus,phone-rotary,phone-slash,phone-square,phone-square-alt,phone-volume,photo-video,pi,piano,piano-keyboard,pie,pig,piggy-bank,pills,pizza,pizza-slice,place-of-worship,plane,plane-alt,plane-arrival,plane-departure,planet-moon,planet-ringed,play,play-circle,plug,plus,plus-circle,plus-hexagon,plus-octagon,plus-square,podcast,podium,podium-star,police-box,poll,poll-h,poll-people,poo,poo-storm,poop,popcorn,portal-enter,portal-exit,portrait,pound-sign,power-off,pray,praying-hands,prescription,prescription-bottle,prescription-bottle-alt,presentation,print,print-search,print-slash,procedures,project-diagram,projector,pumpkin,puzzle-piece,qrcode,question,question-circle,question-square,quidditch,quote-left,quote-right,quran,rabbit,rabbit-fast,racquet,radar,radiation,radiation-alt,radio,radio-alt,rainbow,raindrops,ram,ramp-loading,random,raygun,receipt,record-vinyl,rectangle-landscape,rectangle-portrait,rectangle-wide,recycle,redo,redo-alt,refrigerator,registered,remove-format,repeat,repeat-1,repeat-1-alt,repeat-alt,reply,reply-all,republican,restroom,retweet,retweet-alt,ribbon,ring,rings-wedding,road,robot,rocket,rocket-launch,route,route-highway,route-interstate,router,rss,rss-square,ruble-sign,ruler,ruler-combined,ruler-horizontal,ruler-triangle,ruler-vertical,running,rupee-sign,rv,sack,sack-dollar,sad-cry,sad-tear,salad,sandwich,satellite,satellite-dish,sausage,save,sax-hot,saxophone,scalpel,scalpel-path,scanner,scanner-image,scanner-keyboard,scanner-touchscreen,scarecrow,scarf,school,screwdriver,scroll,scroll-old,scrubber,scythe,sd-card,search,search-dollar,search-location,search-minus,search-plus,seedling,send-back,send-backward,sensor,sensor-alert,sensor-fire,sensor-on,sensor-smoke,server,shapes,share,share-all,share-alt,share-alt-square,share-square,sheep,shekel-sign,shield,shield-alt,shield-check,shield-cross,ship,shipping-fast,shipping-timed,shish-kebab,shoe-prints,shopping-bag,shopping-basket,shopping-cart,shovel,shovel-snow,shower,shredder,shuttle-van,shuttlecock,sickle,sigma,sign,sign-in,sign-in-alt,sign-language,sign-out,sign-out-alt,signal,signal-1,signal-2,signal-3,signal-4,signal-alt,signal-alt-1,signal-alt-2,signal-alt-3,signal-alt-slash,signal-slash,signal-stream,signature,sim-card,siren,siren-on,sitemap,skating,skeleton,ski-jump,ski-lift,skiing,skiing-nordic,skull,skull-cow,skull-crossbones,slash,sledding,sleigh,sliders-h,sliders-h-square,sliders-v,sliders-v-square,smile,smile-beam,smile-plus,smile-wink,smog,smoke,smoking,smoking-ban,sms,snake,snooze,snow-blowing,snowboarding,snowflake,snowflakes,snowman,snowmobile,snowplow,socks,solar-panel,solar-system,sort,sort-alpha-down,sort-alpha-down-alt,sort-alpha-up,sort-alpha-up-alt,sort-alt,sort-amount-down,sort-amount-down-alt,sort-amount-up,sort-amount-up-alt,sort-circle,sort-circle-down,sort-circle-up,sort-down,sort-numeric-down,sort-numeric-down-alt,sort-numeric-up,sort-numeric-up-alt,sort-shapes-down,sort-shapes-down-alt,sort-shapes-up,sort-shapes-up-alt,sort-size-down,sort-size-down-alt,sort-size-up,sort-size-up-alt,sort-up,soup,spa,space-shuttle,space-station-moon,space-station-moon-alt,spade,sparkles,speaker,speakers,spell-check,spider,spider-black-widow,spider-web,spinner,spinner-third,splotch,spray-can,sprinkler,square,square-full,square-root,square-root-alt,squirrel,staff,stamp,star,star-and-crescent,star-christmas,star-exclamation,star-half,star-half-alt,star-of-david,star-of-life,star-shooting,starfighter,starfighter-alt,stars,starship,starship-freighter,steak,steering-wheel,step-backward,step-forward,stethoscope,sticky-note,stocking,stomach,stop,stop-circle,stopwatch,store,store-alt,stream,street-view,stretcher,strikethrough,stroopwafel,subscript,subway,suitcase,suitcase-rolling,sun,sun-cloud,sun-dust,sun-haze,sunglasses,sunrise,sunset,superscript,surprise,swatchbook,swimmer,swimming-pool,sword,sword-laser,sword-laser-alt,swords,swords-laser,synagogue,sync,sync-alt,syringe,table,table-tennis,tablet,tablet-alt,tablet-android,tablet-android-alt,tablet-rugged,tablets,tachometer,tachometer-alt,tachometer-alt-average,tachometer-alt-fast,tachometer-alt-fastest,tachometer-alt-slow,tachometer-alt-slowest,tachometer-average,tachometer-fast,tachometer-fastest,tachometer-slow,tachometer-slowest,taco,tag,tags,tally,tanakh,tape,tasks,tasks-alt,taxi,teeth,teeth-open,telescope,temperature-down,temperature-frigid,temperature-high,temperature-hot,temperature-low,temperature-up,tenge,tennis-ball,terminal,text,text-height,text-size,text-width,th,th-large,th-list,theater-masks,thermometer,thermometer-empty,thermometer-full,thermometer-half,thermometer-quarter,thermometer-three-quarters,theta,thumbs-down,thumbs-up,thumbtack,thunderstorm,thunderstorm-moon,thunderstorm-sun,ticket,ticket-alt,tilde,times,times-circle,times-hexagon,times-octagon,times-square,tint,tint-slash,tire,tire-flat,tire-pressure-warning,tire-rugged,tired,toggle-off,toggle-on,toilet,toilet-paper,toilet-paper-alt,tombstone,tombstone-alt,toolbox,tools,tooth,toothbrush,torah,torii-gate,tornado,tractor,trademark,traffic-cone,traffic-light,traffic-light-go,traffic-light-slow,traffic-light-stop,trailer,train,tram,transgender,transgender-alt,transporter,transporter-1,transporter-2,transporter-3,transporter-empty,trash,trash-alt,trash-restore,trash-restore-alt,trash-undo,trash-undo-alt,treasure-chest,tree,tree-alt,tree-christmas,tree-decorated,tree-large,tree-palm,trees,triangle,triangle-music,trophy,trophy-alt,truck,truck-container,truck-couch,truck-loading,truck-monster,truck-moving,truck-pickup,truck-plow,truck-ramp,trumpet,tshirt,tty,turkey,turntable,turtle,tv,tv-alt,tv-music,tv-retro,typewriter,ufo,ufo-beam,umbrella,umbrella-beach,underline,undo,undo-alt,unicorn,union,universal-access,university,unlink,unlock,unlock-alt,upload,usb-drive,usd-circle,usd-square,user,user-alien,user-alt,user-alt-slash,user-astronaut,user-chart,user-check,user-circle,user-clock,user-cog,user-cowboy,user-crown,user-edit,user-friends,user-graduate,user-hard-hat,user-headset,user-injured,user-lock,user-md,user-md-chat,user-minus,user-music,user-ninja,user-nurse,user-plus,user-robot,user-secret,user-shield,user-slash,user-tag,user-tie,user-times,user-visor,users,users-class,users-cog,users-crown,users-medical,utensil-fork,utensil-knife,utensil-spoon,utensils,utensils-alt,vacuum,vacuum-robot,value-absolute,vector-square,venus,venus-double,venus-mars,vhs,vial,vials,video,video-plus,video-slash,vihara,violin,voicemail,volcano,volleyball-ball,volume,volume-down,volume-mute,volume-off,volume-slash,volume-up,vote-nay,vote-yea,vr-cardboard,wagon-covered,walker,walkie-talkie,walking,wallet,wand,wand-magic,warehouse,warehouse-alt,washer,watch,watch-calculator,watch-fitness,water,water-lower,water-rise,wave-sine,wave-square,wave-triangle,waveform,waveform-path,webcam,webcam-slash,weight,weight-hanging,whale,wheat,wheelchair,whistle,wifi,wifi-1,wifi-2,wifi-slash,wind,wind-turbine,wind-warning,window,window-alt,window-close,window-frame,window-frame-open,window-maximize,window-minimize,window-restore,windsock,wine-bottle,wine-glass,wine-glass-alt,won-sign,wreath,wrench,x-ray,yen-sign,yin-yang,b 500px,b accessible-icon,b accusoft,b acquisitions-incorporated,b adn,b adobe,b adversal,b affiliatetheme,b airbnb,b algolia,b alipay,b amazon,b amazon-pay,b amilia,b android,b angellist,b angrycreative,b angular,b app-store,b app-store-ios,b apper,b apple,b apple-pay,b artstation,b asymmetrik,b atlassian,b audible,b autoprefixer,b avianex,b aviato,b aws,b bandcamp,b battle-net,b behance,b behance-square,b bimobject,b bitbucket,b bitcoin,b bity,b black-tie,b blackberry,b blogger,b blogger-b,b bluetooth,b bluetooth-b,b bootstrap,b btc,b buffer,b buromobelexperte,b buy-n-large,b buysellads,b canadian-maple-leaf,b cc-amazon-pay,b cc-amex,b cc-apple-pay,b cc-diners-club,b cc-discover,b cc-jcb,b cc-mastercard,b cc-paypal,b cc-stripe,b cc-visa,b centercode,b centos,b chrome,b chromecast,b cloudscale,b cloudsmith,b cloudversify,b codepen,b codiepie,b confluence,b connectdevelop,b contao,b cotton-bureau,b cpanel,b creative-commons,b creative-commons-by,b creative-commons-nc,b creative-commons-nc-eu,b creative-commons-nc-jp,b creative-commons-nd,b creative-commons-pd,b creative-commons-pd-alt,b creative-commons-remix,b creative-commons-sa,b creative-commons-sampling,b creative-commons-sampling-plus,b creative-commons-share,b creative-commons-zero,b critical-role,b css3,b css3-alt,b cuttlefish,b d-and-d,b d-and-d-beyond,b dashcube,b delicious,b deploydog,b deskpro,b dev,b deviantart,b dhl,b diaspora,b digg,b digital-ocean,b discord,b discourse,b dochub,b docker,b draft2digital,b dribbble,b dribbble-square,b dropbox,b drupal,b dyalog,b earlybirds,b ebay,b edge,b elementor,b ello,b ember,b empire,b envira,b erlang,b ethereum,b etsy,b evernote,b expeditedssl,b facebook,b facebook-f,b facebook-messenger,b facebook-square,b fantasy-flight-games,b fedex,b fedora,b figma,b firefox,b firefox-browser,b first-order,b first-order-alt,b firstdraft,b flickr,b flipboard,b fly,b font-awesome,b font-awesome-alt,b font-awesome-flag,b fonticons,b fonticons-fi,b fort-awesome,b fort-awesome-alt,b forumbee,b foursquare,b free-code-camp,b freebsd,b fulcrum,b galactic-republic,b galactic-senate,b get-pocket,b gg,b gg-circle,b git,b git-alt,b git-square,b github,b github-alt,b github-square,b gitkraken,b gitlab,b gitter,b glide,b glide-g,b gofore,b goodreads,b goodreads-g,b google,b google-drive,b google-play,b google-plus,b google-plus-g,b google-plus-square,b google-wallet,b gratipay,b grav,b gripfire,b grunt,b gulp,b hacker-news,b hacker-news-square,b hackerrank,b hips,b hire-a-helper,b hooli,b hornbill,b hotjar,b houzz,b html5,b hubspot,b ideal,b imdb,b instagram,b intercom,b internet-explorer,b invision,b ioxhost,b itch-io,b itunes,b itunes-note,b java,b jedi-order,b jenkins,b jira,b joget,b joomla,b js,b js-square,b jsfiddle,b kaggle,b keybase,b keycdn,b kickstarter,b kickstarter-k,b korvue,b laravel,b lastfm,b lastfm-square,b leanpub,b less,b line,b linkedin,b linkedin-in,b linode,b linux,b lyft,b magento,b mailchimp,b mandalorian,b markdown,b mastodon,b maxcdn,b mdb,b medapps,b medium,b medium-m,b medrt,b meetup,b megaport,b mendeley,b microblog,b microsoft,b mix,b mixcloud,b mizuni,b modx,b monero,b napster,b neos,b nimblr,b node,b node-js,b npm,b ns8,b nutritionix,b odnoklassniki,b odnoklassniki-square,b old-republic,b opencart,b openid,b opera,b optin-monster,b orcid,b osi,b page4,b pagelines,b palfed,b patreon,b paypal,b penny-arcade,b periscope,b phabricator,b phoenix-framework,b phoenix-squadron,b php,b pied-piper,b pied-piper-alt,b pied-piper-hat,b pied-piper-pp,b pied-piper-square,b pinterest,b pinterest-p,b pinterest-square,b playstation,b product-hunt,b pushed,b python,b qq,b quinscape,b quora,b r-project,b raspberry-pi,b ravelry,b react,b reacteurope,b readme,b rebel,b red-river,b reddit,b reddit-alien,b reddit-square,b redhat,b renren,b replyd,b researchgate,b resolving,b rev,b rocketchat,b rockrms,b safari,b salesforce,b sass,b schlix,b scribd,b searchengin,b sellcast,b sellsy,b servicestack,b shirtsinbulk,b shopware,b simplybuilt,b sistrix,b sith,b sketch,b skyatlas,b skype,b slack,b slack-hash,b slideshare,b snapchat,b snapchat-ghost,b snapchat-square,b soundcloud,b sourcetree,b speakap,b speaker-deck,b spotify,b squarespace,b stack-exchange,b stack-overflow,b stackpath,b staylinked,b steam,b steam-square,b steam-symbol,b sticker-mule,b strava,b stripe,b stripe-s,b studiovinari,b stumbleupon,b stumbleupon-circle,b superpowers,b supple,b suse,b swift,b symfony,b teamspeak,b telegram,b telegram-plane,b tencent-weibo,b the-red-yeti,b themeco,b themeisle,b think-peaks,b trade-federation,b trello,b tripadvisor,b tumblr,b tumblr-square,b twitch,b twitter,b twitter-square,b typo3,b uber,b ubuntu,b uikit,b umbraco,b uniregistry,b unity,b untappd,b ups,b usb,b usps,b ussunnah,b vaadin,b viacoin,b viadeo,b viadeo-square,b viber,b vimeo,b vimeo-square,b vimeo-v,b vine,b vk,b vnv,b vuejs,b waze,b weebly,b weibo,b weixin,b whatsapp,b whatsapp-square,b whmcs,b wikipedia-w,b windows,b wix,b wizards-of-the-coast,b wolf-pack-battalion,b wordpress,b wordpress-simple,b wpbeginner,b wpexplorer,b wpforms,b wpressr,b xbox,b xing,b xing-square,b y-combinator,b yahoo,b yammer,b yandex,b yandex-international,b yarn,b yelp,b yoast,b youtube,b youtube-square,b zhihu'.split(',');var cls='ui-faicons',cls2='.'+cls,template='<span data-search="{0}"><i class="{1}"></i></span>',events={},container,is=false,ispro=false,cachekey;self.singleton();self.readonly();self.blind();self.nocompile();self.redraw=function(){self.html('<div class="{0}"><div class="{0}-header"><div class="{0}-search"><span><i class="fa fa-search clearsearch"></i></span><div><input type="text" placeholder="{1}" class="{0}-search-input"></div></div></div><div class="{0}-content noscrollbar"></div></div>'.format(cls,config.search));container=self.find(cls2+'-content')};self.rendericons=function(empty){var key=empty?'1':'0';if(cachekey===key)return;cachekey=key;var builder=[];empty&&builder.push(template.format('',''));var arr=ispro?iconspro:icons;for(var i=0;i<arr.length;i++)builder.push(template.format(arr[i].replace(/^.*?-/,'').replace(/-/g,' ').toSearch(),arr[i]));self.find(cls2+'-content').html(builder.join(''))};self.search=function(value){var search=self.find('.clearsearch');search.rclass2('fa-');if(!value.length){search.aclass('fa-search');container.find('.hidden').rclass('hidden');return}value=value.toSearch();search.aclass('fa-times');container[0].scrollTop=0;var icons=container.find('span');for(var i=0;i<icons.length;i++){var el=$(icons[i]);el.tclass('hidden',el.attrd('search').indexOf(value)===-1)}};self.make=function(){var links=$(document.head).find('link');for(var i=0;i<links.length;i++){var href=links[i].getAttribute('href');if(href.indexOf('pro.css')!==-1){ispro=true;break}}var txt=' fa-';if(ispro){var tmp=[];for(var i=0;i<iconspro.length;i++){var icon=iconspro[i];if(icon.charAt(1)===' '){tmp.push('fa'+icon.replace(' ',txt))}else{tmp.push('fas fa-'+icon.replace(' ',txt));tmp.push('far fa-'+icon.replace(' ',txt));tmp.push('fal fa-'+icon.replace(' ',txt));tmp.push('fad fa-'+icon.replace(' ',txt))}}iconspro=tmp;icons=null}else{iconspro=null;for(var i=0;i<icons.length;i++){var icon=icons[i];if(icon.charAt(1)===' ')icons[i]='fa'+icon.replace(' ',txt);else icons[i]='fa fa-'+icons[i]}}self.aclass(cls+'-container hidden');self.event('keydown','input',function(){var t=this;setTimeout2(self.ID,function(){self.search(t.value)},300)});self.event('click','.fa-times',function(){self.find('input').val('');self.search('')});self.event('click',cls2+'-content span',function(){self.opt.scope&&M.scope(self.opt.scope);self.opt.callback&&self.opt.callback($(this).find('i').attr('class'));self.hide()});events.click=function(e){var el=e.target,parent=self.dom;do{if(el==parent)return;el=el.parentNode}while(el);self.hide()};self.on('reflow + scroll + resize',self.hide);self.redraw()};self.bindevents=function(){if(!events.is){events.is=true;$(document).on('click',events.click)}};self.unbindevents=function(){if(events.is){events.is=false;$(document).off('click',events.click)}};self.show=function(opt){var tmp=opt.element?opt.element instanceof jQuery?opt.element[0]:opt.element.element?opt.element.dom:opt.element:null;if(is&&tmp&&self.target===tmp){self.hide();return}var search=self.find(cls2+'-search-input');search.val('');self.find('.clearsearch').rclass2('fa-').aclass('fa-search');if(M.scope)opt.scope=M.scope();self.target=tmp;self.opt=opt;var css={};if(is){css.left=0;css.top=0;self.css(css)}else self.rclass('hidden');var target=$(opt.element);var w=self.element.width();var offset=target.offset();if(opt.element){switch(opt.align){case'center':css.left=Math.ceil((offset.left-w/2)+(target.innerWidth()/2));break;case'right':css.left=(offset.left-w)+target.innerWidth();break;default:css.left=offset.left;break}css.top=opt.position==='bottom'?(offset.top-self.element.height()-10):(offset.top+target.innerHeight()+10)}else{css.left=opt.x;css.top=opt.y}if(opt.offsetX)css.left+=opt.offsetX;if(opt.offsetY)css.top+=opt.offsetY;is=true;self.rendericons(opt.empty);var scrollarea=self.find('.noscrollbar').noscrollbar();self.css(css);if(opt.scrolltop==null||opt.scrolltop)scrollarea[0].scrollTop=0;search.focus();setTimeout(self.bindevents,50);clearTimeout2(self.ID)};self.clear=function(){container.empty();cachekey=null};self.hide=function(){is=false;self.target=null;self.opt=null;self.unbindevents();self.aclass('hidden');container.find('.hidden').rclass('hidden');setTimeout2(self.ID,self.clear,1000*10)}});
COMPONENT('detail','datetimeformat:yyyy-MM-dd HH:mm;dateformat:yyyy-MM-dd;timeformat:HH:mm;defaultgroup:Default',function(self,config,cls){var cls2='.'+cls,types={},container,mapping;self.make=function(){self.aclass(cls+(config.small?(' '+cls+'-small'):''));var scr=self.find('script');if(scr.length){mapping=(new Function('return '+scr.html().trim()))();for(var i=0;i<mapping.length;i++){var item=mapping[i];if(item.show)item.show=FN(item.show)}}self.html('<div><div class="{0}-container"></div></div>'.format(cls));container=self.find(cls2+'-container');var keys=Object.keys(types);for(var i=0;i<keys.length;i++){var key=keys[i];types[key].init&&types[key].init()}};self.nocompile();self.bindvisible();self.mapvalue=function(item){var val=item.path?item.path.indexOf('.')===-1?item.value[item.path]:GET(item.path,item.value):item.value;return val===false||val===true?val:val==null||val===''?(item.empty||DEF.empty):val};self.register=function(name,init,render){types[name]={};types[name].init=init;types[name].render=render;init(self)};types.template={};types.template.init=NOOP;types.template.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-template">{1}</div>'.format(cls,Tangular.render(item.template,{value:value,item:item.value})))};types.string={};types.string.init=NOOP;types.string.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-string">{1}</div>'.format(cls,Thelpers.encode(value)))};types.password={};types.password.init=function(){self.event('click',cls2+'-password',function(){var el=$(this);var html=el.html();if(html.substring(0,DEF.empty.length)===DEF.empty){return}var tmp=el.attrd('value');el.attrd('value',html);el.html(tmp)})};types.password.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-password" data-value="{1}">{2}</div>'.format(cls,Thelpers.encode(value),value?'************':DEF.empty))};types.number={};types.number.init=NOOP;types.number.render=function(item,next){var value=self.mapvalue(item);var format=item.format||config.numberformat;value=format?value.format(format):value;next('<div class="{0}-number">{1}</div>'.format(cls,Thelpers.encode(value+'')))};types.date={};types.date.init=NOOP;types.date.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-date">{1}</div>'.format(cls,value?value.format(item.format||config.dateformat):''))};types.bool={};types.bool.init=NOOP;types.bool.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-bool{1}"><span><i class="fa fa-check"></i></span></div>'.format(cls,value?' checked':''))};types.list={};types.list.init=NOOP;types.list.render=function(item,next){var value=self.mapvalue(item);var template='<div class="{0}-list"><span>{1}</span></div>';if(item.detail){AJAX('GET '+item.detail.format(encodeURIComponent(value)),function(response){next(template.format(cls,response[item.dirkey||'name']||item.placeholder||DEF.empty))})}else{var arr=typeof(item.items)==='string'?GET(item.items):item.items;var m=(arr||EMPTYARRAY).findValue(item.dirvalue||'id',value,item.dirkey||'name',item.placeholder||DEF.empty);next(template.format(cls,m))}};types.color={};types.color.init=NOOP;types.color.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-color"><span><b{1}>&nbsp;</b></span></div>'.format(cls,value?(' style="background-color:'+value+'"'):''))};types.fontawesome={};types.fontawesome.init=NOOP;types.fontawesome.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-fontawesome"><i class="{1}"></i></div>'.format(cls,value||''))};types.emoji={};types.emoji.init=NOOP;types.emoji.render=function(item,next){var value=self.mapvalue(item);next('<div class="{0}-emoji">{1}</div>'.format(cls,value||DEF.empty))};self.nocompile();self.bindvisible();self.render=function(item,index){var type=types[item.type==='boolean'?'bool':item.type],c=cls,meta={label:item.label||item.name};if(item.icon){var tmp=item.icon;if(tmp.indexOf(' ')===-1)tmp='fa fa-'+tmp;meta.icon='<i class="{0}"></i>'.format(tmp)}else meta.icon='';var el=$('<div class="{2}-item{3}" data-index="{1}"><div class="{0}-key">{{ icon}}{{ label}}</div><div class="{0}-value">&nbsp;</div></div>'.format(cls,index,c,item.required?(' '+cls+'-required'):'').arg(meta));type.render(item,function(html){if(item.note)html+='<div class="{0}-note">{1}</div>'.format(cls,item.note);el.find(cls2+'-value').html(html)});return el};self.setter=function(value){if(!value)value=EMPTYARRAY;var raw;if(mapping&&value&&value!==EMPTYARRAY){raw=value;for(var i=0;i<mapping.length;i++){var m=mapping[i];m.value=raw}value=mapping}container.empty();var groups={};for(var i=0;i<value.length;i++){var item=value[i];if(raw&&item.show&&!item.show(raw))continue;var g=item.group||config.defaultgroup;if(!groups[g])groups[g]={html:[]};groups[g].html.push(self.render(item,i))}var keys=Object.keys(groups);for(var i=0;i<keys.length;i++){var key=keys[i],group=groups[key],hash='g'+HASH(key,true);var el=$('<div class="{0}-group" data-id="{2}"><label>{1}</label><section></section></div>'.format(cls,key,hash));var section=el.find('section');for(var j=0;j<group.html.length;j++)section.append(group.html[j]);container.append(el)}}});
COMPONENT('menu',function(self,config,cls){self.singleton();self.readonly();self.nocompile&&self.nocompile();var cls2='.'+cls,is=false,issubmenu=false,isopen=false,events={},ul,children,prevsub,parentclass;self.make=function(){self.aclass(cls+' hidden '+cls+'-style-'+(config.style||1));self.append('<div class="{0}-items"><ul></ul></div><div class="{0}-submenu hidden"><ul></ul></div>'.format(cls));ul=self.find(cls2+'-items').find('ul');children=self.find(cls2+'-submenu');self.event('click','li',function(e){clearTimeout2(self.ID);var el=$(this);if(!el.hclass(cls+'-divider')&&!el.hclass(cls+'-disabled')){self.opt.scope&&M.scope(self.opt.scope);var index=el.attrd('index').split('-');if(index.length>1){self.opt.callback(self.opt.items[+index[0]].children[+index[1]]);self.hide()}else if(!issubmenu){self.opt.callback(self.opt.items[+index[0]]);self.hide()}}e.preventDefault();e.stopPropagation()});events.hide=function(){is&&self.hide()};self.event('scroll',events.hide);self.on('reflow + scroll + resize + resize2',events.hide);events.click=function(e){if(is&&!isopen&&(!self.target||(self.target!==e.target&&!self.target.contains(e.target))))setTimeout2(self.ID,self.hide,isMOBILE?700:300)};events.hidechildren=function(){if($(this.parentNode.parentNode).hclass(cls+'-items')){if(prevsub&&prevsub[0]!==this){prevsub.rclass(cls+'-selected');prevsub=null;children.aclass('hidden');issubmenu=false}}};events.children=function(){if(prevsub&&prevsub[0]!==this){prevsub.rclass(cls+'-selected');prevsub=null}issubmenu=true;isopen=true;setTimeout(function(){isopen=false},500);var el=prevsub=$(this);var index=+el.attrd('index');var item=self.opt.items[index];el.aclass(cls+'-selected');var html=self.makehtml(item.children,index);children.find('ul').html(html);children.rclass('hidden');var css={},offset=el.position();css.left=ul.width()-5;css.top=offset.top-5;var offsetX=offset.left;offset=self.element.offset();var w=children.width();var left=offset.left+css.left+w;if(left>WW+30)css.left=(offsetX-w)+5;children.css(css)}};self.bindevents=function(){events.is=true;$(document).on('touchstart mouseenter mousedown',cls2+'-children',events.children).on('touchstart mousedown',events.click);$(W).on('scroll',events.hide);self.element.on('mouseenter','li',events.hidechildren)};self.unbindevents=function(){events.is=false;$(document).off('touchstart mouseenter mousedown',cls2+'-children',events.children).off('touchstart mousedown',events.click);$(W).off('scroll',events.hide);self.element.off('mouseenter','li',events.hidechildren)};self.showxy=function(x,y,items,callback){var opt={};opt.x=x;opt.y=y;opt.items=items;opt.callback=callback;self.show(opt)};self.makehtml=function(items,index){var builder=[],tmp;for(var i=0;i<items.length;i++){var item=items[i];if(typeof(item)==='string'){if(item==='-')tmp='<hr />';else tmp='<span>{0}</span>'.format(item);builder.push('<li class="{0}-divider">{1}</li>'.format(cls,tmp));continue}var cn=item.classname||'',icon='';if(item.icon)icon='<i class="{0}"></i>'.format(item.icon.charAt(0)==='!'?item.icon.substring(1):item.icon.indexOf('fa-')===-1?('fa fa-'+item.icon):item.icon);else cn=(cn?(cn+' '):'')+cls+'-nofa';tmp='';if(index==null&&item.children&&item.children.length){cn+=(cn?' ':'')+cls+'-children';tmp+='<i class="fa fa-play pull-right"></i>'}if(item.selected)cn+=(cn?' ':'')+cls+'-selected';if(item.disabled)cn+=(cn?' ':'')+cls+'-disabled';tmp+='<div class="{0}-name">{1}{2}{3}</div>'.format(cls,icon,item.name,item.shortcut?'<b>{0}</b>'.format(item.shortcut):'');if(item.note)tmp+='<div class="ui-menu-note">{0}</div>'.format(item.note);builder.push('<li class="{0}" data-index="{2}">{1}</li>'.format(cn,tmp,(index!=null?(index+'-'):'')+i))}return builder.join('')};self.show=function(opt){if(typeof(opt)==='string'){opt={align:opt};opt.element=arguments[1];opt.items=arguments[2];opt.callback=arguments[3];opt.offsetX=arguments[4];opt.offsetY=arguments[5]}var tmp=opt.element?opt.element instanceof jQuery?opt.element[0]:opt.element.element?opt.element.dom:opt.element:null;if(is&&tmp&&self.target===tmp){self.hide();return}var tmp;self.target=tmp;self.opt=opt;opt.scope=M.scope();if(parentclass&&opt.classname!==parentclass){self.rclass(parentclass);parentclass=null}if(opt.large)self.aclass('ui-large');else self.rclass('ui-large');isopen=false;issubmenu=false;prevsub=null;var css={};children.aclass('hidden');children.find('ul').empty();clearTimeout2(self.ID);ul.html(self.makehtml(opt.items));if(!parentclass&&opt.classname){self.aclass(opt.classname);parentclass=opt.classname}if(is){css.left=0;css.top=0;self.element.css(css)}else{self.rclass('hidden');self.aclass(cls+'-visible',100);is=true;if(!events.is)self.bindevents()}var target=$(opt.element);var w=self.width();var offset=target.offset();if(opt.element){switch(opt.align){case'center':css.left=Math.ceil((offset.left-w/2)+(target.innerWidth()/2));break;case'right':css.left=(offset.left-w)+target.innerWidth();break;default:css.left=offset.left;break}css.top=opt.position==='bottom'?(offset.top-self.element.height()-10):(offset.top+target.innerHeight()+10)}else{css.left=opt.x;css.top=opt.y}if(opt.offsetX)css.left+=opt.offsetX;if(opt.offsetY)css.top+=opt.offsetY;var mw=w,mh=self.height();if(css.left<0)css.left=10;else if((mw+css.left)>WW)css.left=(WW-mw)-10;if(css.top<0)css.top=10;else if((mh+css.top)>WH)css.top=(WH-mh)-10;self.element.css(css)};self.hide=function(){events.is&&self.unbindevents();is=false;self.opt&&self.opt.hide&&self.opt.hide();self.target=null;self.opt=null;self.aclass('hidden');self.rclass(cls+'-visible')}});
COMPONENT('approve','cancel:Cancel',function(self,config,cls){var cls2='.'+cls,events={},buttons,oldcancel;self.readonly();self.singleton();self.nocompile&&self.nocompile();self.make=function(){self.aclass(cls+' hidden');self.html('<div><div class="{0}-body"><span class="{0}-close"><i class="fa fa-times"></i></span><div class="{0}-content"></div><div class="{0}-buttons"><button data-index="0"></button><button data-index="1"></button></div></div></div>'.format(cls));buttons=self.find(cls2+'-buttons').find('button');self.event('click','button',function(){self.hide(+$(this).attrd('index'))});self.event('click',cls2+'-close',function(){self.callback=null;self.hide(-1)});self.event('click',function(e){var t=e.target.tagName;if(t!=='DIV')return;var el=self.find(cls2+'-body');el.aclass(cls+'-click');setTimeout(function(){el.rclass(cls+'-click')},300)})};events.keydown=function(e){var index=e.which===13?0:e.which===27?1:null;if(index!=null){self.find('button[data-index="{0}"]'.format(index)).trigger('click');e.preventDefault();e.stopPropagation();events.unbind()}};events.bind=function(){$(W).on('keydown',events.keydown)};events.unbind=function(){$(W).off('keydown',events.keydown)};self.show=function(message,a,b,fn){if(typeof(b)==='function'){fn=b;b=config.cancel}if(M.scope)self.currscope=M.scope();self.callback=fn;var icon=a.match(/"[a-z0-9-\s]+"/);if(icon){var tmp=icon+'';if(tmp.indexOf(' ')==-1)tmp='fa fa-'+tmp;a=a.replace(icon,'').trim();icon='<i class="{0}"></i>'.format(tmp.replace(/"/g,''))}else icon='';var color=a.match(/#[0-9a-f]+/i);if(color)a=a.replace(color,'').trim();buttons.eq(0).css('background-color',color||'').html(icon+a);if(oldcancel!==b){oldcancel=b;buttons.eq(1).html(b)}self.find(cls2+'-content').html(message.replace(/\n/g,'<br />'));$('html').aclass(cls+'-noscroll');self.rclass('hidden');events.bind();self.aclass(cls+'-visible',5)};self.hide=function(index){if(!index){self.currscope&&M.scope(self.currscope);self.callback&&self.callback(index)}self.rclass(cls+'-visible');events.unbind();setTimeout2(self.id,function(){$('html').rclass(cls+'-noscroll');self.aclass('hidden')},1000)}});
COMPONENT('enter','validate:1;trigger:button[name="submit"]',function(self,config){self.readonly();self.make=function(){self.event('keydown','input',function(e){if(e.which===13&&(!config.validate||CAN(self.path))){if(config.exec)EXEC(self.makepath(config.exec),self);else self.find(config.trigger).trigger('click')}})}});
COMPONENT('radiobutton','inline:1',function(self,config,cls){var cls2='.'+cls,template='<div data-value="{1}"><i></i><span>{0}</span></div>';self.nocompile();self.configure=function(key,value,init){if(init)return;switch(key){case'disabled':self.tclass('ui-disabled',value);break;case'required':self.find(cls2+'-label').tclass(cls+'-label-required',value);break;case'type':self.type=config.type;break;case'label':self.find(cls2+'-label').html(value);break;case'items':self.find('div[data-value]').remove();var builder=[];value.split(',').forEach(function(item){item=item.split('|');builder.push(template.format(item[0]||item[1],item[1]||item[0]))});self.append(builder.join(''));self.refresh();break;case'datasource':self.datasource(value,self.bind);break}};self.make=function(){var builder=[],label=config.label||self.html();label&&builder.push('<div class="'+cls+'-label{1}">{0}</div>'.format(label,config.required?(' '+cls+'-label-required'):''));self.aclass(cls+(!config.inline?(' '+cls+'-block'):'')+(config.disabled?' ui-disabled':''));self.event('click','div[data-value]',function(){if(config.disabled)return;var value=self.parser($(this).attrd('value'));self.set(value);self.change(true)});self.html(builder.join(''));config.items&&self.reconfigure('items:'+config.items);config.datasource&&self.reconfigure('datasource:'+config.datasource);config.type&&(self.type=config.type)};self.validate=function(value){return config.disabled||!config.required?true:!!value};self.setter=function(value){self.find('div[data-value]').each(function(){var el=$(this);var is=el.attrd('value')===(value==null?null:value.toString());el.tclass(cls+'-selected',is);el.find('.fa').tclass('fa-circle-o',!is).tclass('fa-circle',is)})};self.bind=function(path,arr){if(!arr)arr=EMPTYARRAY;var builder=[],propText=config.text||'name',propValue=config.value||'id',type=typeof(arr[0]);var notObj=type==='string'||type==='number';for(var i=0,length=arr.length;i<length;i++){var item=arr[i];if(notObj)builder.push(template.format(item,item));else builder.push(template.format(item[propText],item[propValue]))}self.find('div[data-value]').remove();self.append(builder.join(''));self.refresh()}});
COMPONENT('pin','blank:●;count:6;hide:false;mask:true',function(self,config,cls){var reg_validation=/[0-9]/,inputs=null,skip=false,count=0;self.nocompile&&self.nocompile();self.validate=function(value,init){return init?true:config.required||config.disabled?!!(value&&value.indexOf(' ')===-1):true};self.configure=function(key,value,init){switch(key){case'count':!init&&self.redraw();break;case'disabled':self.find('input').prop('disabled',value);self.tclass('ui-disabled',value);!init&&!value&&self.state(1,1);break}};self.redraw=function(){var builder=[];count=config.count;for(var i=0;i<count;i++)builder.push('<div data-index="{0}" class="ui-pin-input"><input type="{1}" maxlength="1" autocomplete="pin{2}" name="pin{2}" pattern="[0-9]" /></div>'.format(i,isMOBILE?'tel':'text',Date.now()+i));self.html(builder.join(''))};self.make=function(){self.aclass(cls);self.redraw();self.event('keypress','input',function(e){var c=e.which,t=this;if(c>=48&&c<=57){var c=String.fromCharCode(e.charCode);if(t.value!==c)t.value=c;if(config.mask){if(config.hide){self.maskforce(t)}else self.mask()}else{t.setAttribute('data-value',t.value);self.getter()}setTimeout(function(el){var next=el.parent().next().find('input');next.length&&next.focus()},50,$(t))}else if(c>30)e.preventDefault()});self.event('keydown','input',function(e){if(e.which===8){var el=$(this);if(!el.val()){var prev=el.parent().prev().find('input');prev.val('').focus();prev.attrd('value','');config.mask&&self.mask()}el.attrd('value','');self.getter()}});inputs=self.find('input')};self.maskforce2=function(){self.maskforce(this)};self.maskforce=function(input){if(input.value&&reg_validation.test(input.value)){input.setAttribute('data-value',input.value);input.value=config.blank;self.getter()}};self.mask=function(){setTimeout2(self.id+'.mask',function(){inputs.each(self.maskforce2)},300)};self.focus=function(){var el=self.find('input').eq(0);if(el.length)el.focus();else setTimeout(self.focus,500)};self.getter=function(){setTimeout2(self.id+'.getter',function(){var value='';inputs.each(function(){value+=this.getAttribute('data-value')||' '});if(self.get()!==value){self.change(true);skip=true;self.set(value.trim())}},100)};self.setter=function(value){if(skip){skip=false;return}if(value==null)value='';inputs.each(function(index){var number=value.substring(index,index+1);this.setAttribute('data-value',number);this.value=value?config.mask?config.blank:number:''})};self.state=function(type){if(!type)return;var invalid=config.required?self.isInvalid():false;if(invalid===self.$oldstate)return;self.$oldstate=invalid;self.tclass(cls+'-invalid',invalid)}});
COMPONENT('radiobuttonexpert',function(self,config,cls){var cls2='.'+cls,template,recompile=false,selected,reg=/\$(index|path)/g;self.nocompile();self.configure=function(key,value,init){if(init)return;switch(key){case'disabled':self.tclass('ui-disabled',value);break;case'required':self.find(cls2+'-label').tclass(cls+'-label-required',value);break;case'type':self.type=config.type;break;case'label':self.find(cls2+'-label').html(value);break;case'datasource':self.datasource(value,self.bind);break}};self.make=function(){var element=self.find('script');if(!element.length)return;var html=element.html();element.remove();html=html.replace('>',' data-value="{{ {0} }}" data-disabled="{{ {1} }}">'.format(config.value||'id',config.disabledkey||'disabled'));template=Tangular.compile(html);recompile=html.COMPILABLE();config.label&&self.html('<div class="'+cls+'-label{1}">{0}</div>'.format(config.label,config.required?(' '+cls+'-label-required'):''));config.datasource&&self.reconfigure('datasource:'+config.datasource);config.type&&(self.type=config.type);config.disabled&&self.aclass('ui-disabled');self.event('click','[data-value]',function(){var el=$(this);if(config.disabled||+el.attrd('disabled'))return;var value=self.parser(el.attrd('value'));self.set(value);self.change(true)})};self.validate=function(value){return config.disabled||!config.required?true:!!value};self.setter=function(value){selected&&selected.rclass('selected');if(value==null)return;var el=self.find('[data-value="'+value+'"]');if(el){el.aclass('selected');selected=el}};self.bind=function(path,arr){if(!arr)arr=EMPTYARRAY;var builder=[],disabledkey=config.disabledkey||'disabled';for(var i=0;i<arr.length;i++){var item=arr[i];item[disabledkey]=+item[disabledkey]||0;builder.push(template(item).replace(reg,function(text){return text.substring(0,2)==='$i'?i.toString():self.path+'['+i+']'}))}var render=builder.join('');self.find(cls2+'-container').remove();self.append('<div class="{0}-container{1}">{2}</div>'.format(cls,config.class?' '+config.class:'',render));self.refresh();recompile&&self.compile()}});
COMPONENT('imageuploader',function(self,config){var name,input,queue,tmpresponse=[],tmperror=[];self.singleton();self.readonly();self.nocompile&&self.nocompile();self.upload=self.browse=function(opt){tmpresponse=[];tmperror=[];self.find('input').prop('multiple',!!opt.multiple);self.opt=opt;input.click()};var resizewidth=function(w,h,size){return Math.ceil(w*(size/h))};var resizeheight=function(w,h,size){return Math.ceil(h*(size/w))};self.resizeforce=function(image){var opt=self.opt,canvas=document.createElement('canvas');var ctx=canvas.getContext('2d');canvas.width=opt.width;canvas.height=opt.height;ctx.fillStyle=opt.background||'#FFFFFF';ctx.fillRect(0,0,opt.width,opt.height);var w=0,h=0,x=0,y=0,is=false,diff=0;if(image.width>opt.width||image.height>opt.height){if(image.width>image.height){w=resizewidth(image.width,image.height,opt.height);h=opt.height;if(w<opt.width){w=opt.width;h=resizeheight(image.width,image.height,opt.width)}if(w>opt.width){diff=w-opt.width;x-=(diff/2)>>0}is=true}else if(image.height>image.width){w=opt.width;h=resizeheight(image.width,image.height,opt.width);if(h<opt.height){h=opt.height;w=resizewidth(image.width,image.height,opt.height)}if(h>opt.height){diff=h-opt.height;y-=(diff/2)>>0}is=true}}if(!is){if(image.width<opt.width&&image.height<opt.height){w=image.width;h=image.height;x=(opt.width/2)-(image.width/2);y=(opt.height/2)-(image.height/2)}else if(image.width>=image.height){w=opt.width;h=image.height*(opt.width/image.width);y=(opt.height/2)-(h/2)}else{h=opt.height;w=(image.width*(opt.height/image.height))>>0;x=(opt.width/2)-(w/2)}}ctx.drawImage(image,x,y,w,h);var base64=canvas.toDataURL('image/jpeg',(opt.quality||90)*0.01);self.uploadforce(base64)};self.make=function(){self.aclass('hidden');self.append('<input type="file" accept="image/*" multiple />');input=self.find('input');self.event('change','input',function(){SETTER('loading/show');queue=[];for(var i=0;i<this.files.length;i++)queue.push(this.files[i]);self.wait();this.value=''})};self.wait=function(){if(!queue||!queue.length){self.opt.callback(tmpresponse,tmperror);self.opt=null;queue=null;SETTER('loading/hide',300)}else self.load(queue.shift())};self.load=function(file){name=file.name;self.getorientation(file,function(orient){var reader=new FileReader();reader.onload=function(){var img=new Image();img.onload=function(){self.resizeforce(img);self.change(true)};img.crossOrigin='anonymous';if(orient<2){img.src=reader.result}else{self.resetorientation(reader.result,orient,function(url){img.src=url})}};reader.readAsDataURL(file)})};self.uploadforce=function(base64){if(base64){var data=(new Function('base64','filename','return '+(self.opt.schema||'{file:base64,name:filename}')))(base64,name);AJAX('POST '+self.opt.url.env(true),data,function(response,err){if(err){tmperror.push(err+'');self.wait()}else{var tmp=response instanceof Array?response[0]:response;if(tmp){if(tmp.error)tmperror.push(err+'');else tmpresponse.push(tmp)}self.wait()}})}};self.getorientation=function(file,callback){var reader=new FileReader();reader.onload=function(e){var view=new DataView(e.target.result);if(view.getUint16(0,false)!=0xFFD8)return callback(-2);var length=view.byteLength,offset=2;while(offset<length){var marker=view.getUint16(offset,false);offset+=2;if(marker==0xFFE1){if(view.getUint32(offset+=2,false)!=0x45786966)return callback(-1);var little=view.getUint16(offset+=6,false)==0x4949;offset+=view.getUint32(offset+4,little);var tags=view.getUint16(offset,little);offset+=2;for(var i=0;i<tags;i++)if(view.getUint16(offset+(i*12),little)==0x0112)return callback(view.getUint16(offset+(i*12)+8,little))}else if((marker&0xFF00)!=0xFF00)break;else offset+=view.getUint16(offset,false)}return callback(-1)};reader.readAsArrayBuffer(file.slice(0,64*1024))};self.resetorientation=function(src,srcOrientation,callback){var img=new Image();img.onload=function(){var width=img.width,height=img.height,canvas=document.createElement('canvas');var ctx=canvas.getContext('2d');if(4<srcOrientation&&srcOrientation<9){canvas.width=height;canvas.height=width}else{canvas.width=width;canvas.height=height}switch(srcOrientation){case 2:ctx.transform(-1,0,0,1,width,0);break;case 3:ctx.transform(-1,0,0,-1,width,height);break;case 4:ctx.transform(1,0,0,-1,0,height);break;case 5:ctx.transform(0,1,1,0,0,0);break;case 6:ctx.transform(0,1,-1,0,height,0);break;case 7:ctx.transform(0,-1,-1,0,height,width);break;case 8:ctx.transform(0,-1,1,0,0,width);break}ctx.drawImage(img,0,0);callback(canvas.toDataURL())};img.src=src}});
COMPONENT('movable',function(self,config){var events={},draggable;self.readonly();self.make=function(){$(document).on('dragenter dragover dragexit drop dragleave dragstart',config.selector,events.ondrag).on('mousedown',config.selector,events.ondown)};events.ondrag=function(e){if(!draggable)return;if(e.type!=='dragstart'){e.stopPropagation();e.preventDefault()}switch(e.type){case'drop':var parent=draggable.parentNode,a=draggable,b=e.target,ai=-1,bi=-1,is=false;while(true){if(b.parentNode===parent){is=true;break}b=b.parentNode;if(b==null||b.tagName==='HTML')break}if(a===b||!is)return;for(var i=0;i<parent.children.length;i++){var child=parent.children[i];if(a===child)ai=i;else if(b===child)bi=i;if(bi!==-1&&ai!==-1)break}if(ai>bi)parent.insertBefore(a,b);else parent.insertBefore(a,b.nextSibling);config.exec&&EXEC(self.makepath(config.exec),self.find(config.selector),a,b);self.path&&self.change(true);break;case'dragstart':var eo=e.originalEvent;eo.dataTransfer&&eo.dataTransfer.setData('text','1');break;case'dragenter':case'dragover':case'dragexit':case'dragleave':break}};events.ondown=function(){draggable=this};self.destroy=function(){$(document).off('dragenter dragover dragexit drop dragleave dragstart',config.selector,events.ondrag).off('mousedown',config.selector,events.ondown)}});
COMPONENT('layout','space:1;border:0;parent:window;margin:0;remember:1;autoresize:1',function(self,config,cls){var cls2='.'+cls,cache={},drag={},s={},events={},istop2=false,isbottom2=false,isright2=false,loaded=false,resizecache='',settings,prefkey='',prefexpire='1 month',isreset=false,layout=null;self.readonly();self.init=function(){var obj;if(W.OP)obj=W.OP;else obj=$(W);obj.on('resize',function(){for(var i=0;i<M.components.length;i++){var com=M.components[i];if(com.name==='layout'&&com.dom.offsetParent&&com.$ready&&!com.$removed&&com.config.autoresize)com.resize()}})};self.make=function(){self.aclass(cls);self.find('> section').each(function(){var el=$(this);var type=el.attrd('type');if(type.charAt(type.length-1)==='2'){type=type.substring(0,type.length-1);switch(type){case'top':istop2=true;break;case'bottom':isbottom2=true;break;case'right':isright2=true;break}}el.aclass(cls+'-'+type+' hidden ui-layout-section');el.after('<div class="{0}-resize-{1} {0}-resize" data-type="{1}"></div>'.format(cls,type));el.after('<div class="{0}-lock hidden" data-type="{1}"></div>'.format(cls,type));s[type]=el});self.find('> .{0}-resize'.format(cls)).each(function(){var el=$(this);s[el.attrd('type')+'resize']=el});self.find('> .{0}-lock'.format(cls)).each(function(){var el=$(this);s[el.attrd('type')+'lock']=el});var tmp=self.find('> script');if(tmp.length){self.rebind(tmp.html(),true);tmp.remove()}events.bind=function(){var el=self.element;el.bind('mousemove',events.mmove);el.bind('mouseup',events.mup);el.bind('mouseleave',events.mup)};events.unbind=function(){var el=self.element;el.unbind('mousemove',events.mmove);el.unbind('mouseup',events.mup);el.unbind('mouseleave',events.mup)};events.mdown=function(e){var target=$(e.target);var type=target.attrd('type');var w=self.width();var h=self.height();var m=2;self.element.find('iframe').css('pointer-events','none');drag.cur=self.element.offset();drag.cur.top-=10;drag.cur.left-=8;drag.offset=target.offset();drag.el=target;drag.x=e.pageX;drag.y=e.pageY;drag.horizontal=type==='left'||type==='right'?1:0;drag.type=type;drag.plusX=10;drag.plusY=10;var ch=cache[type],offset=0,min=ch.minsize?(ch.minsize.value-1):0;target.aclass(cls+'-drag');switch(type){case'top':drag.min=min||(ch.size-m);drag.max=(h-(cache.bottom?s.bottom.height():0)-50);break;case'right':offset=w;drag.min=(cache.left?s.left.width():0)+50+min;drag.max=offset-(min||ch.size);break;case'bottom':offset=h;drag.min=(cache.top?s.top.height():0)+50;drag.max=offset-(min||ch.size);break;case'left':drag.min=min||(ch.size-m);drag.max=w-(cache.right?s.right.width():0)-50;break}events.bind()};events.mmove=function(e){if(drag.horizontal){var x=drag.offset.left+(e.pageX-drag.x)-drag.plusX-drag.cur.left;if(x<drag.min)x=drag.min+1;if(x>drag.max)x=drag.max-1;drag.el.css('left',x+'px')}else{var y=drag.offset.top+(e.pageY-drag.y)-drag.plusY;if(y<drag.min)y=drag.min+1;if(y>drag.max)y=drag.max-1;drag.el.css('top',(y-drag.cur.top)+'px')}};events.mup=function(){self.element.find('iframe').css('pointer-events','');var offset=drag.el.offset();var d=WIDTH();var pk=prefkey+'_'+layout+'_'+drag.type+'_'+d;drag.el.rclass(cls+'-drag');if(drag.horizontal){offset.left-=drag.cur.left;if(offset.left<drag.min)offset.left=drag.min;if(offset.left>drag.max)offset.left=drag.max;var w=offset.left-(drag.offset.left-drag.cur.left);if(!isright2&&drag.type==='right')w=w*-1;drag.el.css('left',offset.left);w=s[drag.type].width()+w;s[drag.type].css('width',w);config.remember&&PREF.set(pk,w,prefexpire)}else{offset.top-=drag.cur.top;if(offset.top<drag.min)offset.top=drag.min;if(offset.top>drag.max)offset.top=drag.max;drag.el.css('top',offset.top);var h=offset.top-(drag.offset.top-drag.cur.top);if(drag.type==='bottom'||drag.type==='preview')h=h*-1;h=s[drag.type].height()+h;s[drag.type].css('height',h);config.remember&&PREF.set(pk,h,prefexpire)}events.unbind();self.refresh()};self.find('> '+cls2+'-resize').on('mousedown',events.mdown)};self.lock=function(type,b){var el=s[type+'lock'];el&&el.tclass('hidden',b==null?b:!b)};self.rebind=function(code,noresize){code=code.trim();prefkey='L'+HASH(code);resizecache='';settings=new Function('return '+code)();!noresize&&self.resize()};var getSize=function(display,data){var obj=data[display];if(obj)return obj;switch(display){case'md':return getSize('lg',data);case'sm':return getSize('md',data);case'xs':return getSize('sm',data)}return data};self.resize=function(){if(self.dom.offsetParent==null){setTimeout(self.resize,100);return}if(settings==null)return;var d=WIDTH();var el=self.parent(config.parent);var width=el.width();var height=el.height();var key=d+'x'+width+'x'+height;if(resizecache===key)return;var tmp=layout?settings[layout]:settings;if(tmp==null){WARN('j-Layout: layout "{0}" not found'.format(layout));tmp=settings}var size=getSize(d,tmp);var keys=Object.keys(s);height-=config.margin;resizecache=key;self.css({width:width,height:height});for(var i=0;i<keys.length;i++){var key=keys[i];el=s[key];self.update(key,size[key]?size[key]:settings[key])}config.resize&&EXEC(config.resize,d,width,height)};var parseSize=function(val,size){var str=typeof(val)==='string';var obj={raw:str?val.parseFloat():val,percentage:str?val.charAt(val.length-1)==='%':false};obj.value=obj.percentage?((((size/100)*obj.raw)>>0)-config.space):obj.raw;return obj};self.reset=function(){isreset=true;resizecache='';self.resize()};self.layout=function(name){if(name==null)name='';if(layout!=name){layout=name;resizecache='';self.resize()}};self.update=function(type,opt){if(opt==null)return;if(typeof(opt)==='string')opt=opt.parseConfig();if(s[type]==null)return;var el=s[type],css={},is=0,size=null,d=WIDTH();var c=cache[type];if(c==null)c=cache[type]={};var w=self.width();var h=self.height();var pk=prefkey+'_'+layout+'_'+type+'_'+d,cached=PREF.get(pk,prefexpire);if(isreset){cached&&PREF.set(pk);cached=0}c.minsize=opt.minwidth?parseSize(opt.minwidth,w):opt.minsize?parseSize(opt.minsize,w):0;var def=getSize(d,settings);var width=(opt.size||opt.width)||(def[type]?def[type].width:0);var height=(opt.size||opt.height)||(def[type]?def[type].height:0);if(width&&(type==='left'||type==='right')){size=parseSize(width,w);c.size=size.value;css.width=cached?cached:size.value;is=1}c.minsize=opt.minheight?parseSize(opt.minheight,w):opt.minsize?parseSize(opt.minsize,w):0;if(height&&(type==='top'||type==='bottom')){size=parseSize(height,h);c.size=size.value;css.height=(cached?cached:size.value);is=1}if(opt.show==null)opt.show=true;el.tclass('hidden',!opt.show);c.show=!!opt.show;c.resize=opt.resize==null?false:!!opt.resize;el.tclass(cls+'-resizable',c.resize);s[type+'resize'].tclass('hidden',!c.show||!c.resize);is&&el.css(css);setTimeout2(self.ID+'refresh',self.refresh,50)};var getWidth=function(el){return el.hclass('hidden')?0:el.width()};var getHeight=function(el){return el.hclass('hidden')?0:el.height()};self.refresh=function(){var top=0,bottom=0,right=0,left=0,hidden='hidden',top2=0,bottom2=0,space=2,topbottomoffset=0,right2visible=isright2&&!s.right.hclass(hidden);if(s.top)top=top2=getHeight(s.top);if(s.bottom)bottom=bottom2=getHeight(s.bottom);var width=self.width()-(config.border*2);var height=self.height()-(config.border*2);if(istop2){topbottomoffset++;top2=0}if(isbottom2){topbottomoffset--;bottom2=0}if(s.left&&!s.left.hclass(hidden)){var cssleft={};space=top&&bottom?2:top||bottom?1:0;cssleft.left=0;cssleft.top=istop2?config.border:(top?(top+config.space):0);cssleft.height=isbottom2?(height-top2-config.border):(height-top2-bottom2-(config.space*space));cssleft.height+=topbottomoffset;s.left.css(cssleft);cssleft.width=s.left.width();s.leftlock.css(cssleft);delete cssleft.width;left=s.left.width();cssleft.left=s.left.width();s.leftresize.css(cssleft);s.leftresize.tclass(hidden,!s.left.hclass(cls+'-resizable'))}if(s.right&&!s.right.hclass(hidden)){right=s.right.width();space=top&&bottom?2:top||bottom?1:0;var cssright={};cssright.left=right2visible?(getWidth(s.left)+config.border+config.space):(width-right);cssright.top=istop2?config.border:(top?(top+config.space):0);cssright.height=isbottom2?(height-top2-config.border):(height-top2-bottom2-(config.space*space));cssright.height+=topbottomoffset;s.right.css(cssright);cssright.width=s.right.width();if((cssright.width+cssright.left)===width){s.right.css('left',0);cssright.width++}s.rightlock.css(cssright);delete cssright.width;if(right2visible)cssright.left+=s.right.width();else cssright.left=width-right-2;s.rightresize.css(cssright);s.rightresize.tclass(hidden,!s.right.hclass(cls+'-resizable'))}if(s.top){var csstop={};space=left?config.space:0;csstop.left=istop2?(left+space):0;if(right2visible&&istop2)csstop.left+=getWidth(s.right)+config.space;space=left&&right?2:left||right?1:0;csstop.width=istop2?(width-right-left-(config.space*space)):width;csstop.top=0;s.top.css(csstop);s.topresize.css(csstop);csstop.height=s.top.height();s.toplock.css(csstop);delete csstop.height;csstop.top=s.top.height();s.topresize.css(csstop);s.topresize.tclass(hidden,!s.top.hclass(cls+'-resizable'))}if(s.bottom){var cssbottom={};cssbottom.top=height-bottom;space=left?config.space:0;cssbottom.left=isbottom2?(left+space):0;if(right2visible&&isbottom2)cssbottom.left+=getWidth(s.right)+config.space;space=left&&right?2:left||right?1:0;cssbottom.width=isbottom2?(width-right-left-(config.space*space)):width;s.bottom.css(cssbottom);cssbottom.height=s.bottom.height();s.bottomlock.css(cssbottom);delete cssbottom.height;cssbottom.top=cssbottom.top-2;s.bottomresize.css(cssbottom);s.bottomresize.tclass(hidden,!s.bottom.hclass(cls+'-resizable'))}var space=left&&right?2:left?1:right?1:0,css={};css.left=left?left+config.space:0;if(right2visible)css.left+=getWidth(s.right)+config.space;css.width=(width-left-right-(config.space*space));css.top=top?top+config.space:0;space=top&&bottom?2:top||bottom?1:0;css.height=height-top-bottom-(config.space*space);s.main&&s.main.css(css);s.mainlock&&s.mainlock.css(css);self.element.SETTER('*','resize');if(loaded==false){loaded=true;self.rclass('invisible')}isreset=false};self.setter=function(value){self.layout(value)}});
COMPONENT('textboxlist','maxlength:100;required:false;error:You reach the maximum limit',function(self,config,cls){var container,content,empty={},skip=false,cempty=cls+'-empty',crequired='required',helper=null,cls2='.'+cls;self.setter=null;self.getter=null;self.nocompile&&self.nocompile();self.template=Tangular.compile('<div class="'+cls+'-item"><div><i class="fa fa-times"></i></div><div><input type="text" autocomplete="new-password" maxlength="{{ max}}" placeholder="{{ placeholder}}"{{ if disabled}} disabled="disabled"{{ fi}} value="{{ value}}" /></div></div>');self.configure=function(key,value,init,prev){if(init)return;var redraw=false;switch(key){case'disabled':self.tclass(crequired,value);self.find('input').prop('disabled',true);empty.disabled=value;self.reset();break;case'maxlength':empty.max=value;self.find('input').prop(key,value);break;case'placeholder':empty.placeholder=value;self.find('input').prop(key,value);break;case'label':redraw=true;break;case'icon':if(value&&prev)self.find('i').rclass().aclass(value);else redraw=true;break}if(redraw){skip=false;self.redraw();self.refresh()}};self.redraw=function(){var icon='',html=config.label||content;if(config.icon)icon='<i class="fa fa-{0}"></i>'.format(config.icon);empty.value='';self.html((html?('<div class="'+cls+'-label{2}">{1}{0}:</div>').format(html,icon,config.required?(' '+cls+'-required'):''):'')+('<div class="'+cls+'-items"></div>'+self.template(empty).replace('-item"','-item '+cls+'-base"')));container=self.find(cls2+'-items')};self.make=function(){empty.max=config.max;empty.placeholder=config.placeholder;empty.value='';empty.disabled=config.disabled;if(config.disabled)self.aclass('ui-disabled');content=self.html();self.aclass(cls);self.redraw();self.event('click','.fa-times',function(){if(config.disabled)return;var el=$(this);var parent=el.closest(cls2+'-item');var value=parent.find('input').val();var arr=self.get();helper!=null&&helper.remove();helper=null;parent.remove();var index=arr.indexOf(value);if(index===-1)return;arr.splice(index,1);self.tclass(cempty,!arr.length);self.tclass(crequired,config.required&&!arr.length);skip=true;SET(self.path,arr,2);self.change(true)});self.event('change keypress blur','input',function(e){if((e.type==='keypress'&&e.which!==13)||config.disabled)return;var el=$(this);var value=this.value.trim();if(!value)return;var arr=[],base=el.closest(cls2+'-base');var len=base.length>0;if(len&&e.type==='change')return;var raw=self.get();if(config.limit&&len&&raw.length>=config.limit){if(!helper){base.after(('<div class="'+cls+'-helper"><i class="fa fa-warning" aria-hidden="true"></i> {0}</div>').format(config.error));helper=container.closest(cls2).find(cls2+'-helper')}return}if(len){if(!raw||raw.indexOf(value)===-1)self.push(value);this.value='';self.change(true);return}skip=true;container.find('input').each(function(){var temp=this.value.trim();switch(config.type){case'number':temp=temp.parseInt();break;case'date':temp=temp.parseDate();break}if(arr.indexOf(temp)===-1)arr.push(temp);else skip=false});self.set(arr,2);self.change(true)})};self.setter=function(value){if(skip){skip=false;return}if(!value||!value.length){self.aclass(cempty);config.required&&self.aclass(crequired);container.empty();return}self.rclass(cempty);self.rclass(crequired);var builder=[];for(var i=0;i<value.length;i++){empty.value=value[i];builder.push(self.template(empty))}container.empty().append(builder.join(''))};self.validate=function(value,init){if(init)return true;var valid=!config.required,items=container.children();if(!value||!value.length)return valid;for(var i=0;i<value.length;i++){var item=value[i];!item&&(item='');switch(config.type){case'email':valid=item.isEmail();break;case'url':valid=item.isURL();break;case'currency':case'number':valid=item>0;break;case'date':valid=item instanceof Date&&!isNaN(item.getTime());break;default:valid=item.length>0;break}items.eq(i).tclass(cls+'-item-invalid',!valid)}return valid}});
COMPONENT('intro',function(self,config,cls){var cls2='.'+cls,container='intro'+GUID(4);var content,figures,buttons,button=null,index=0,visible=false;self.readonly();self.make=function(){$(document.body).append('<div id="{0}" class="hidden {1}"><div class="{1}-body"></div></div>'.format(container,cls));content=self.element;container=$('#'+container);content.rclass('hidden');var body=container.find(cls2+'-body');body[0].appendChild(self.element[0]);self.replace(container);content.aclass('ui-intro-figures');figures=content.find('figure');var items=[];figures.each(function(index){items.push('<i class="fa fa-circle {0}-button" data-index="{1}"></i>'.format(cls,index))});body.append('<div class="{0}-pagination"><button name="next"></button>{1}</div>'.format(cls,items.join('')));buttons=self.find(cls2+'-button');button=self.find(cls2+'-pagination').find('button');self.event('click','button[name="next"]',function(){index++;if(index>=figures.length){self.set('');config.exec&&EXEC(config.exec);config.remove&&self.remove()}else{self.move(index);config.page&&EXEC(config.page,index)}});self.event('click','button[name="close"]',function(){self.set('');config.exec&&EXEC(config.exec,true);config.remove&&self.remove()});self.event('click',cls2+'-button',function(){self.move(+this.getAttribute('data-index'))})};self.move=function(indexer){figures.filter('.visible').rclass('visible');buttons.filter('.selected').rclass('selected');figures.eq(indexer).aclass('visible');buttons.eq(indexer).aclass('selected');button.html(indexer<buttons.length-1?((config.next||'Next')+'<i class="fa fa-chevron-right"></i>'):(config.close||'Done'));index=indexer;return self};self.setter=function(value){var is=value==config.if;if(is===visible)return;index=0;self.move(0);visible=is;self.tclass('hidden',!is);setTimeout(function(){self.find(cls2+'-body').tclass(cls+'-body-visible',is)},100)}});
COMPONENT('autocomplete','height:200',function(self,config,cls){var clssel='selected',container,old,searchtimeout,searchvalue,blurtimeout,datasource,offsetter,scroller,margin={},skipmouse=false,is=false,prev;self.template=Tangular.compile('<li{{ if index === 0}} class="'+clssel+'"{{ fi}} data-index="{{ index}}"><span>{{ name}}</span><span>{{ type}}</span></li>');self.readonly();self.singleton();self.nocompile&&self.nocompile();self.make=function(){self.aclass(cls+'-container hidden');self.html('<div class="'+cls+'"><div class="noscrollbar"><ul></ul></div></div>');scroller=self.find('.noscrollbar');container=self.find('ul');self.event('click','li',function(e){e.preventDefault();e.stopPropagation();if(self.opt.callback){var val=datasource[+$(this).attrd('index')];self.opt.scope&&M.scope(self.opt.scope);if(self.opt.path)SET(self.opt.path,val.value===undefined?val.name:val.value);else self.opt.callback(val,old)}self.visible(false)});self.event('mouseenter mouseleave','li',function(e){if(!skipmouse){prev&&prev.rclass(clssel);prev=$(this).tclass(clssel,e.type==='mouseenter')}});$(document).on('click',function(){is&&self.visible(false)});$(window).on('resize',function(){self.resize()});self.on('scroll',function(){is&&self.visible(false)})};self.prerender=function(value){self.render(value)};self.configure=function(name,value){switch(name){case'height':value&&scroller.css('height',value);break}};function keydown(e){var c=e.which,input=this;if(c!==38&&c!==40&&c!==13){if(c!==8&&c<32)return;clearTimeout(searchtimeout);searchtimeout=setTimeout(function(){var val=input.value||input.innerHTML;if(!val)return self.render(EMPTYARRAY);if(searchvalue===val)return;searchvalue=val;self.resize();self.opt.search(val,self.prerender)},200);return}if(!datasource||!datasource.length||!is)return;var current=container.find('.'+clssel);if(c===13){if(prev){prev=null;self.visible(false);if(current.length){var val=datasource[+current.attrd('index')];self.opt.scope&&M.scope(self.opt.scope);if(self.opt.callback)self.opt.callback(val,old);else if(self.opt.path)SET(self.opt.path,val.value===undefined?val.name:val.value);e.preventDefault();e.stopPropagation()}}return}e.preventDefault();e.stopPropagation();if(current.length){current.rclass(clssel);current=c===40?current.next():current.prev()}skipmouse=true;!current.length&&(current=self.find('li:{0}-child'.format(c===40?'first':'last')));prev&&prev.rclass(clssel);prev=current.aclass(clssel);var index=+current.attrd('index');var h=current.innerHeight();var offset=((index+1)*h)+(h*2);scroller[0].scrollTop=offset>config.height?offset-config.height:0;setTimeout2(self.ID+'skipmouse',function(){skipmouse=false},100)}function blur(){clearTimeout(blurtimeout);blurtimeout=setTimeout(function(){self.visible(false)},300)}self.visible=function(visible){clearTimeout(blurtimeout);self.tclass('hidden',!visible);is=visible};self.resize=function(){if(!offsetter||!old)return;var offset=offsetter.offset();offset.top+=offsetter.height();offset.width=offsetter.width();if(margin.left)offset.left+=margin.left;if(margin.top)offset.top+=margin.top;if(margin.width)offset.width+=margin.width;self.css(offset)};self.show=function(opt){clearTimeout(searchtimeout);var selector='input,[contenteditable]';if(opt.input==null)opt.input=opt.element;if(opt.input.setter)opt.input=opt.input.find(selector);else opt.input=$(opt.input);if(opt.input[0].tagName!=='INPUT'&&!opt.input.attr('contenteditable'))opt.input=opt.input.find(selector);if(opt.element.setter){if(!opt.callback)opt.callback=opt.element.path;opt.element=opt.element.element}if(old){old.removeAttr('autocomplete');old.off('blur',blur);old.off('keydown',keydown)}opt.input.on('keydown',keydown);opt.input.on('blur',blur);opt.input.attr('autocomplete','off');old=opt.input;margin.left=opt.offsetX;margin.top=opt.offsetY;margin.width=opt.offsetWidth;opt.scope=M.scope?M.scope():'';offsetter=$(opt.element);self.opt=opt;self.resize();self.refresh();searchvalue='';self.visible(false)};self.attach=function(input,search,callback,left,top,width){self.attachelement(input,input,search,callback,left,top,width)};self.attachelement=function(element,input,search,callback,left,top,width){if(typeof(callback)==='number'){width=left;left=top;top=callback;callback=null}var opt={};opt.offsetX=left;opt.offsetY=top;opt.offsetWidth=width;if(typeof(callback)==='string')opt.path=callback;else opt.callback=callback;opt.search=search;opt.element=input;opt.input=input;self.show(opt)};self.render=function(arr){datasource=arr;if(!arr||!arr.length){self.visible(false);return}var builder=[];for(var i=0,length=arr.length;i<length;i++){var obj=arr[i];obj.index=i;if(!obj.name)obj.name=obj.text;builder.push(self.template(obj))}container.empty().append(builder.join(''));skipmouse=true;setTimeout(function(){scroller[0].scrollTop=0;skipmouse=false},100);prev=container.find('.'+clssel);self.visible(true);setTimeout(function(){scroller.noscrollbar(true)},100)}});

COMPONENT('infowindows', 'reoffsetresize:0', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = {};
	var services = [];
	var events = {};
	var drag = {};
	var prevfocused;
	var serviceid;
	var data = [];
	var lastWW = WW;
	var lastWH = WH;

	self.make = function() {
		self.aclass(cls);
		self.event('click', cls2 + '-control', function() {
			var el = $(this);
			var name = el.attrd('name');
			var item = cache[el.closest(cls2 + '-item').attrd('id')];
			switch (name) {
				case 'close':
					item.setcommand('close');
					break;
				default:
					item.setcommand(name);
					break;
			}
		});

		self.event('mousedown touchstart', cls2 + '-item', function() {
			if (prevfocused) {
				if (prevfocused[0] == this)
					return;
				prevfocused.rclass(cls + '-focused');
			}
			prevfocused = $(this).aclass(cls + '-focused');
		});

		self.event('mousedown touchstart', cls2 + '-title,' + cls2 + '-resize', events.down);
		$(W).on('resize', self.resize2);
		serviceid = setInterval(events.service, 5000);
	};

	self.finditem = function(id) {
		return cache[id];
	};

	self.send = function(type, body) {
		for (var i = 0; i < data.length; i++)
			data[i].meta.data(type, body, data[i].element);
	};

	self.destroy = function() {
		$(W).off('resize', self.resize2);
		clearInterval(serviceid);
	};

	self.resize2 = function() {
		setTimeout2(self.ID, self.resize, 200);
	};

	self.recompile = function() {
		setTimeout2(self.iD + 'compile', COMPILE, 50);
	};

	self.resizeforce = function() {

		self.element.find(cls2 + '-maximized').each(function() {
			cache[$(this).attrd('id')].setcommand('maximize');
		});

		if (config.reoffsetresize) {
			var diffWW = lastWW - WW;
			var diffWH = lastWH - WH;

			var keys = Object.keys(cache);
			for (var i = 0; i < keys.length; i++) {
				var win = cache[keys[i]];
				win.setoffset(win.x - diffWW, win.y - diffWH);
			}

			lastWW = WW;
			lastWH = WH;
		}
	};

	self.resize = function() {
		setTimeout2(self.ID + 'resize', self.resizeforce, 300);
	};

	events.service = function() {
		for (var i = 0; i < services.length; i++) {
			var tmp = services[i];
			if (tmp.$service)
				tmp.$service++;
			else
				tmp.$service = 1;
			tmp.meta.service && tmp.meta.service.call(tmp, tmp.$service, tmp.element);
		}
	};

	events.down = function(e) {

		var E = e;

		if (e.type === 'touchstart') {
			drag.touch = true;
			e = e.touches[0];
		} else
			drag.touch = false;

		if (e.target.nodeName === 'I')
			return;

		var el = $(this);
		var parent = el.closest(cls2 + '-item');

		if (parent.hclass(cls + '-maximized'))
			return;

		drag.resize = el.hclass(cls + '-resize');
		drag.is = false;

		E.preventDefault();

		var myoffset = self.element.position();
		var pos;

		if (drag.resize) {
			var c = el.attr('class');
			drag.el = el.closest(cls2 + '-item');
			drag.dir = c.match(/-(tl|tr|bl|br)/)[0].substring(1);
			pos = drag.el.position();
			var m = self.element.offset();
			drag.body = drag.el.find(cls2 + '-body');
			drag.plus = m;
			drag.x = pos.left;
			drag.y = pos.top;
			drag.width = drag.el.width();
			drag.height = drag.body.height();
		} else {
			drag.el = el.closest(cls2 + '-item');
			pos = drag.el.position();
			drag.x = e.pageX - pos.left;
			drag.y = e.pageY - pos.top;
		}

		drag.el.aclass(cls + '-block');
		drag.offX = myoffset.left;
		drag.offY = myoffset.top;
		drag.item = cache[drag.el.attrd('id')];

		if (drag.item.meta.actions) {
			if (drag.resize) {
				if (drag.item.meta.actions.resize == false)
					return;
			} else {
				if (drag.item.meta.actions.move == false)
					return;
			}
		}

		drag.el.aclass(cls + '-dragged');
		$(W).on('mousemove touchmove', events.move).on('mouseup touchend', events.up);
	};

	events.move = function(e) {

		var evt = e;
		if (drag.touch)
			evt = e.touches[0];

		var obj = {};
		drag.is = true;

		if (drag.resize) {

			var x = evt.pageX - drag.offX - drag.plus.left;
			var y = evt.pageY - drag.offY - drag.plus.top;
			var off = drag.item.meta.offset;
			var w;
			var h;

			switch (drag.dir) {

				case 'tl':
					obj.left = x;
					obj.top = y;
					w = drag.width - (x - drag.x);
					h = drag.height - (y - drag.y);

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					obj.width = w;
					drag.el.css(obj);
					obj.height = h;
					delete obj.width;
					delete obj.top;
					drag.body.css(obj);
					break;

				case 'tr':
					w = x - drag.x;
					h = drag.height - (y - drag.y);

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					obj.width = w;
					obj.top = y;
					drag.el.css(obj);
					obj.height = h;
					delete obj.width;
					delete obj.top;
					drag.body.css(obj);
					break;

				case 'bl':

					w = drag.width - (x - drag.x);
					h = y - drag.y - 30;

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					obj.left = x;
					obj.width = w;
					drag.el.css(obj);
					delete obj.width;
					obj.height = h;
					drag.body.css(obj);
					break;

				case 'br':
					w = x - drag.x;
					h = y - drag.y - 30;

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					obj.width = w;
					drag.el.css(obj);
					delete obj.width;
					obj.height = h;
					drag.body.css(obj);
					break;
			}

			drag.item.ert && clearTimeout(drag.item.ert);
			drag.item.ert = setTimeout(drag.item.emitresize, 100);

		} else {
			obj.left = evt.pageX - drag.x - drag.offX;
			obj.top = evt.pageY - drag.y - drag.offY;

			if (obj.top < 0)
				obj.top = 0;

			drag.el.css(obj);
		}

		if (!drag.touch)
			e.preventDefault();
	};

	events.up = function() {

		drag.el.rclass(cls + '-dragged').rclass(cls + '-block');
		$(W).off('mousemove touchmove', events.move).off('mouseup touchend', events.up);

		if (!drag.is)
			return;

		var item = drag.item;
		var meta = item.meta;
		var pos = drag.el.position();

		drag.is = false;
		drag.x = meta.offset.x = item.x = pos.left;
		drag.y = meta.offset.y = item.y = pos.top;

		if (drag.resize) {
			item.width = meta.offset.width = drag.el.width();
			item.height = meta.offset.height = drag.body.height();
			meta.resize && meta.resize.call(item, item.width, item.height, drag.body, item.x, item.y);
			self.element.SETTER('*', 'resize');
		}

		meta.move && meta.move.call(item, item.x, item.y, drag.body);
		self.wsave(item);
		self.change(true);
	};

	var wsavecallback = function(item) {

		var obj = {};
		obj.x = item.x;
		obj.y = item.y;
		obj.width = item.width;
		obj.height = item.height;
		obj.ww = WW;
		obj.wh = WH;
		obj.hidden = item.meta.hidden;

		PREF.set(item.cachekey, obj, '1 month');
	};

	self.wsave = function(obj) {
		if (obj.meta.actions && obj.meta.actions.autosave)
			setTimeout2(self.ID + '_infowin_' + obj.meta.id, wsavecallback, 500, null, obj);
	};

	self.wadd = function(item) {

		var obj = cache[item.id] = {};

		obj.cachekey = 'infowin_' + (item.cachekey || item.id) + '_' + (item.offset.width + 'x' + item.offset.height);

		var hidden = '';
		var ishidden = false;

		if (item.actions && item.actions.autosave) {
			pos = PREF[obj.cachekey];
			if (pos) {

				var mx = 0;
				var my = 0;

				if (config.reoffsetresize && pos.ww != null && pos.wh != null) {
					mx = pos.ww - WW;
					my = pos.wh - WH;
				}

				item.offset.x = pos.x - mx;
				item.offset.y = pos.y - my;
				item.offset.width = pos.width;
				item.offset.height = pos.height;

				if (pos.hidden && (item.hidden == null || item.hidden)) {
					ishidden = true;
					item.hidden = true;
				}
			}
		}

		if (!ishidden)
			ishidden = item.hidden;

		hidden = ishidden ? ' hidden' : '';

		var el = $('<div class="{0}-item{1}" data-id="{id}" style="left:{x}px;top:{y}px;width:{width}px"><span class="{0}-resize {0}-resize-tl"></span><span class="{0}-resize {0}-resize-tr"></span><span class="{0}-resize {0}-resize-bl"></span><span class="{0}-resize {0}-resize-br"></span><div class="{0}-title"><i class="fa fa-times {0}-control" data-name="close"></i><span>{{ title }}</span></div><div class="{0}-body" style="height:{height}px"></div></div>'.format(cls, hidden).arg(item.offset).arg(item));
		var body = el.find(cls2 + '-body');
		var pos;

		body.append(item.html);

		if (typeof(item.html) === 'string' && item.html.COMPILABLE())
			self.recompile();

		if (item.actions) {
			if (item.actions.resize == false)
				el.aclass(cls + '-noresize');
			if (item.actions.move == false)
				el.aclass(cls + '-nomove');

			var noclose = item.actions.close == false;
			if (item.actions.hide)
				noclose = false;

			if (noclose)
				el.aclass(cls + '-noclose');
		}

		obj.main = self;
		obj.meta = item;
		obj.element = body;
		obj.container = el;
		obj.x = item.offset.x;
		obj.y = item.offset.y;
		obj.width = item.offset.width;
		obj.height = item.offset.height;

		if (item.buttons) {
			var builder = [];
			for (var i = 0; i < item.buttons.length; i++) {
				var btn = item.buttons[i];
				var icon = btn.icon.indexOf(' ') === -1 ? ('fa fa-' + btn.icon) : btn.icon;
				builder.push('<i class="fa fa-{1} {0}-control" data-name="{2}"></i>'.format(cls, icon, btn.name));
			}
			builder.length && el.find(cls2 + '-lastbutton').before(builder.join(''));
		}

		item.make && item.make.call(cache[item.id], body);

		obj.emitresize = function() {
			obj.ert = null;
			obj.element.SETTER('*', 'resize');
		};

		obj.setsize = function(w, h) {
			var t = this;
			var obj = {};

			if (w) {
				obj.width = t.width = t.meta.offset.width = w;
				t.element.parent().css('width', w);
			}

			if (h) {
				t.element.css('height', h);
				t.height = t.meta.offset.height = h;
			}

			t.ert && clearTimeout(t.ert);
			t.ert = setTimeout(t.emitresize, 100);
			self.wsave(t);
		};

		obj.setcommand = function(type) {

			var el = obj.element.parent();
			var c;

			switch (type) {

				case 'toggle':
					obj.setcommand(obj.meta.hidden ? 'show' : 'hide');
					break;

				case 'show':
					if (obj.meta.hidden) {
						obj.meta.hidden = false;
						obj.element.parent().rclass('hidden');
						self.wsave(obj);
						self.resize2();
					}
					break;

				case 'close':
				case 'hide':

					if (type === 'hide' && obj.meta.hidden)
						return;

					if (obj.meta.close) {
						obj.meta.close(function() {
							self.wrem(obj.meta);
							self.resize2();
						});
					} else {
						self.wrem(obj.meta);
						self.resize2();
					}
					break;

				case 'resize':
					obj.setsize(obj.width, obj.height);
					break;

				case 'move':
					obj.setoffset(obj.x, obj.y);
					break;

				case 'focus':
					prevfocused && prevfocused.rclass(cls + '-focused');
					prevfocused = obj.element.parent().aclass(cls + '-focused');
					break;
				default:
					if (obj.meta.buttons) {
						var btn = obj.meta.buttons.findItem('name', type);
						if (btn && btn.exec)
							btn.exec.call(obj, obj);
					}
					break;
			}
		};

		obj.setoffset = function(x, y) {
			var t = this;
			var obj = {};

			if (x != null)
				obj.left = t.x = t.meta.offset.x = x;

			if (y != null)
				obj.top = t.y = t.meta.offset.y = y;

			t.element.parent().css(obj);
			self.wsave(t);
		};

		obj.meta.service && services.push(obj);
		obj.meta.data && data.push(obj);

		self.append(el);
		return obj;
	};

	self.wrem = function(item) {
		var obj = cache[item.id];
		if (obj) {
			var main = obj.element.closest(cls2 + '-item');

			if (obj.meta.actions.hide) {
				obj.meta.hidden = true;
				main.aclass('hidden');
				self.wsave(obj);
			} else {
				obj.meta.destroy && obj.meta.destroy.call(obj);
				main.off('*');
				main.find('*').off('*');
				main.remove();
				delete cache[item.id];

				var index = services.indexOf(obj);
				if (index !== -1)
					services.splice(index, 1);

				index = data.indexOf(obj);
				if (index !== -1)
					data.splice(index, 1);

				var arr = self.get();
				arr.splice(arr.findIndex('id', item.id), 1);
				self.update();
			}
		}
	};

	self.setter = function(value) {

		if (!value)
			value = EMPTYARRAY;

		var updated = {};

		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			if (!cache[item.id])
				cache[item.id] = self.wadd(item);
			updated[item.id] = 1;
		}

		// Remove older windows
		var keys = Object.keys(cache);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (!updated[key])
				self.wrem(cache[key].meta);
		}
	};

	self.toggle = function(id) {
		var item = cache[id];
		item && item.setcommand('toggle');
	};

	self.show = function(id) {
		var item = cache[id];
		item && item.setcommand('show');
	};

	self.focus = function(id) {
		var item = cache[id];
		item && item.setcommand('focus');
	};

	self.hide = function(id) {
		var item = cache[id];
		item && item.setcommand('hide');
	};

});

COMPONENT('infinitescroll', 'margin:0;padding:50;autoscroll:100', function(self, config, cls) {

	var cls2 = '.' + cls;
	var init = false;
	var isloading = true;
	var css = {};
	var container;
	var body;

	self.readonly();
	self.blind();

	self.add = function(content) {
		content && body.append(content);

		if (typeof(content) === 'string' && content.COMPILABLE())
			COMPILE();

		setTimeout(function() {
			self.scrollbar.area.css('overflow-y', 'scroll');
			setTimeout(function() {
				self.scrollbar.resize();
				self.scrollbar.area[0].scrollTop += config.autoscroll;
				isloading = false;
			}, 100);
		}, 200);
	};

	self.make = function() {
		self.aclass(cls);
		self.element.wrapInner('<div class="{0}-container"></div>'.format(cls));
		container = self.find(cls2 + '-container');
		self.scrollbar = new SCROLLBAR(container, { visibleY: true, orientation: 'y', onscroll: self.onscroll });
		body = self.scrollbar.area.find('.ui-scrollbar-body');
		self.resize();
		setTimeout(function() {
			isloading = false;
			config.exec && EXEC(config.exec, self.add, body, true);
		}, 200);
	};

	self.onscroll = function(sb) {
		if (!isloading) {
			var y = sb.area[0].scrollTop + sb.size.viewHeight + config.padding;
			if (y >= sb.size.scrollHeight) {
				isloading = true;
				self.scrollbar.area.css('overflow-y', 'hidden');
				config.exec && EXEC(config.exec, self.add, self.scrollbar.area, false);
			}
		}
	};

	self.reset = function() {
		self.scrollbar.scrollTop(0);
		self.refresh();
	};

	self.refresh = function() {
		isloading = true;
		self.scrollbar.resize();
		setTimeout(function() {
			isloading = false;
		}, 200);
	};

	self.resize = function() {

		if (self.release())
			return;

		var el = self.parent(config.parent);
		var h = el.height();
		var w = el.width();

		if (h === 0 || w === 0) {
			self.$waiting && clearTimeout(self.$waiting);
			self.$waiting = setTimeout(self.resize, 234);
			return;
		}

		if (config.margin)
			h -= config.margin;

		css.height = h;
		css.width = self.element.width();
		container.css(css);

		css.width = null;
		self.element.SETTER('*', 'resize');
		self.scrollbar.resize();

		if (!init) {
			self.rclass('invisible', 250);
			init = true;
		}
	};
});

COMPONENT('centered', 'closebutton:1;closeesc:1;scrollbar:1;visibleY:0', function(self, config, cls) {

	var events = {};
	var container, scroller;

	events.bind = function() {
		if (!events.is) {
			events.is = true;
			$(W).on('keydown', events.keydown);
		}
	};

	events.keydown = function(e) {
		if (e.which === 27)
			self.set('');
	};

	events.unbind = function() {
		if (events.is) {
			events.is = false;
			$(W).off('keydown', events.keydown);
		}
	};

	self.resize = function() {
		setTimeout2(self.ID, self.resizeforce, 300);
	};

	self.resizeforce = function() {
		var css = { width: WW, height: WH };
		self.css(css);
		$(scroller).css(css);
		$(container).css({ height: WH });
		self.scrollbar && self.scrollbar.resize();
	};

	self.readonly();

	self.make = function() {

		self.aclass(cls + '-container hidden invisible');
		self.event('click', '[data-name="close"],[name="close"]', function() {
			self.set('');
		});

		if (self.dom.children[0].nodeName === ('SCRI' + 'PT')) {
			var html = self.dom.children[0].innerHTML;
			self.makeforce = function() {
				self.html('<span class="fas fa-times {0}-button{2}" data-name="close"></span><div class="{0}-content"><div class="{0}-body">{1}</div></div>'.format(cls, html, config.closebutton ? '' : ' hidden'));
				if (html.COMPILABLE())
					COMPILE();
				self.makeforce = null;
			};
		} else {
			container = document.createElement('DIV');
			container.setAttribute('class', cls + '-content');
			var div = document.createElement('DIV');
			div.setAttribute('class', cls + '-body');
			for (var i = 0; i < self.dom.children.length; i++)
				div.appendChild(self.dom.children[i]);

			container.appendChild(div);

			scroller = document.createElement('DIV');
			scroller.appendChild(container);

			if (config.scrollbar)
				self.scrollbar = SCROLLBAR($(scroller), { visibleY: config.visibleY });

			self.dom.appendChild(scroller);
			self.element.prepend('<span class="fas fa-times {0}-button{1}" data-name="close"></span>'.format(cls, config.closebutton ? '' : ' hidden'));
		}

		config.closeoutside && self.element.on('click', function(e) {
			if (e.target === self.dom)
				self.set('');
		});

		$(W).on('resize', self.resize);
	};

	self.destroy = function() {
		$(W).off('resize', self.resize);
	};

	self.setter = function(value) {
		var is = value === config.if;
		var hs = self.hclass('hidden');
		if (is === hs) {
			if (is) {
				self.makeforce && self.makeforce();
				config.closeesc && events.bind();
				config.default && DEFAULT(config.default, true);
				config.reload && EXEC(config.reload, self);
				config.zindex && self.css('z-index', config.zindex);
				if (!isMOBILE && config.autofocus) {
					setTimeout(function() {
						self.find(typeof(config.autofocus) === 'string' ? config.autofocus : 'input[type="text"],select,textarea').eq(0).focus();
					}, 1000);
				}

			} else
				config.closeesc && events.unbind();

			self.tclass('hidden', !is);
			self.resizeforce();
			self.rclass('invisible');
			$('html').tclass(cls + '-noscroll', is);
		}
	};
});

COMPONENT('websocket', 'reconnect:3000;encoder:false', function(self, config) {

	var ws, url;
	var queue = [];
	var sending = false;
	var isidle = false;

	self.online = false;
	self.readonly();
	self.nocompile && self.nocompile();

	self.make = function() {
		url = (config.url || '').env(true);
		if (!url.match(/^(ws|wss):\/\//))
			url = location.origin.replace('http', 'ws') + (url.charAt(0) !== '/' ? '/' : '') + url;
		setTimeout(self.connect, 500);
		self.destroy = function() {
			isidle = true;
			self.close();
		};
	};

	self.send = function(obj) {
		var data = JSON.stringify(obj);
		if (config.encoder)
			queue.push(encodeURIComponent(data));
		else
			queue.push(data);
		self.process();
		return self;
	};

	self.idletime = function(is) {
		if (isidle !== is) {
			isidle = is;
			if (is) {
				// close
				ws && self.close();
			} else {
				// open
				if (!ws)
					self.connect();
			}
		}
	};

	self.process = function(callback) {

		if (!ws || !ws.send || sending || !queue.length || ws.readyState !== 1) {
			callback && callback();
			return;
		}

		sending = true;

		var async = queue.splice(0, 3);

		async.wait(function(item, next) {
			if (ws) {
				ws.send(item);
				setTimeout(next, 5);
			} else {
				queue.unshift(item);
				next();
			}
		}, function() {
			callback && callback();
			sending = false;
			queue.length && self.process();
		});
	};

	self.close = function(isClosed) {
		if (ws) {
			self.online = false;
			ws.onopen = ws.onclose = ws.onmessage = null;
			!isClosed && ws.close();
			ws = null;
			EMIT('online', false);
		}
		return self;
	};

	function onClose(e) {

		if (e.code === 4001) {
			location.href = location.href + '';
			return;
		}

		e.reason && WARN('WebSocket:', config.encoder ? decodeURIComponent(e.reason) : e.reason);
		self.close(true);

		if (!isidle)
			setTimeout(self.connect, config.reconnect);
	}

	function onMessage(e) {
		var data;
		try {
			data = PARSE(config.encoder ? decodeURIComponent(e.data) : e.data);
			self.path && self.set(data);
		} catch (e) {
			WARN('WebSocket "{0}": {1}'.format(url, e.toString()));
		}
		data && EMIT('message', data);
	}

	function onOpen() {
		self.online = true;
		self.process(function() {
			EMIT('online', true);
		});
	}

	self.connect = function() {
		ws && self.close();
		setTimeout2(self.id, function() {
			ws = new WebSocket(url.env(true));
			ws.onopen = onOpen;
			ws.onclose = onClose;
			ws.onmessage = onMessage;
			self.ws = ws;
		}, 100);
		return self;
	};
});

COMPONENT('miniform', 'zindex:12', function(self, config, cls) {

	var cls2 = '.' + cls;
	var csspos = {};

	if (!W.$$miniform) {

		W.$$miniform_level = W.$$miniform_level || 1;
		W.$$miniform = true;

		$(document).on('click', cls2 + '-button-close', function() {
			SET($(this).attrd('path'), '');
		});

		var resize = function() {
			setTimeout2(self.name, function() {
				for (var i = 0; i < M.components.length; i++) {
					var com = M.components[i];
					if (com.name === 'miniform' && !HIDDEN(com.dom) && com.$ready && !com.$removed)
						com.resize();
				}
			}, 200);
		};

		ON('resize2', resize);

		$(document).on('click', cls2 + '-container', function(e) {

			if (e.target === this) {
				var com = $(this).component();
				if (com && com.config.closeoutside) {
					com.set('');
					return;
				}
			}

			var el = $(e.target);

			if (el.hclass(cls + '-container-cell')) {
				var form = $(this).find(cls2);
				var c = cls + '-animate-click';
				form.aclass(c).rclass(c, 300);
				var com = el.parent().component();
				if (com && com.config.closeoutside)
					com.set('');
			}
		});
	}

	self.readonly();
	self.submit = function() {
		if (config.submit)
			self.EXEC(config.submit, self.hide, self.element);
		else
			self.hide();
	};

	self.cancel = function() {
		config.cancel && self.EXEC(config.cancel, self.hide);
		self.hide();
	};

	self.hide = function() {
		if (config.independent)
			self.hideforce();
		self.esc(false);
		self.set('');
	};

	self.esc = function(bind) {
		if (bind) {
			if (!self.$esc) {
				self.$esc = true;
				$(W).on('keydown', self.esc_keydown);
			}
		} else {
			if (self.$esc) {
				self.$esc = false;
				$(W).off('keydown', self.esc_keydown);
			}
		}
	};

	self.esc_keydown = function(e) {
		if (e.which === 27 && !e.isPropagationStopped()) {
			var val = self.get();
			if (!val || config.if === val) {
				e.preventDefault();
				e.stopPropagation();
				self.hide();
			}
		}
	};

	self.hideforce = function() {
		if (!self.hclass('hidden')) {
			self.aclass('hidden');
			self.release(true);
			self.find(cls2).rclass(cls + '-animate');
			W.$$miniform_level--;
		}
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass(value.icon.indexOf(' ') === -1 ? ('fa fa-' + value.icon) : value.icon);
		this.tclass('hidden', !value.icon);
	};

	self.resize = function() {

		if (!config.center || self.hclass('hidden'))
			return;

		var ui = self.find(cls2);
		var fh = ui.innerHeight();
		var wh = WH;
		var r = (wh / 2) - (fh / 2);
		csspos.marginTop = (r > 30 ? (r - 15) : 20) + 'px';
		ui.css(csspos);
	};

	self.make = function() {

		$(document.body).append('<div id="{0}" class="hidden {4}-container invisible"><div class="{4}-container-table"><div class="{4}-container-cell"><div class="{4}" style="max-width:{1}px"><div data-bind="@config__text span:value.title__change .{4}-icon:@icon" class="{4}-title"><button name="cancel" class="{4}-button-close{3}" data-path="{2}"><i class="fa fa-times"></i></button><i class="{4}-icon"></i><span></span></div></div></div></div>'.format(self.ID, config.width || 800, self.path, config.closebutton == false ? ' hidden' : '', cls));

		var scr = self.find('> script');
		self.template = scr.length ? scr.html().trim() : '';
		if (scr.length)
			scr.remove();

		var el = $('#' + self.ID);
		var body = el.find(cls2)[0];

		while (self.dom.children.length)
			body.appendChild(self.dom.children[0]);

		self.rclass('hidden invisible');
		self.replace(el, true);

		self.event('scroll', function() {
			EMIT('scroll', self.name);
			EMIT('reflow', self.name);
		});

		self.event('click', 'button[name]', function() {
			var t = this;
			switch (t.name) {
				case 'submit':
					self.submit(self.hide);
					break;
				case 'cancel':
					!t.disabled && self[t.name](self.hide);
					break;
			}
		});

		config.enter && self.event('keydown', 'input', function(e) {
			e.which === 13 && !self.find('button[name="submit"]')[0].disabled && setTimeout(self.submit, 800);
		});
	};

	self.configure = function(key, value, init, prev) {
		if (!init) {
			switch (key) {
				case 'width':
					value !== prev && self.find(cls2).css('max-width', value + 'px');
					break;
				case 'closebutton':
					self.find(cls2 + '-button-close').tclass('hidden', value !== true);
					break;
			}
		}
	};

	self.setter = function(value) {

		setTimeout2(cls + '-noscroll', function() {
			$('html').tclass(cls + '-noscroll', !!$(cls2 + '-container').not('.hidden').length);
		}, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden) {
			if (!isHidden) {
				config.reload && self.EXEC(config.reload, self);
				config.default && DEFAULT(self.makepath(config.default), true);
			}
			return;
		}

		setTimeout2(cls, function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			if (!config.independent)
				self.hideforce();
			return;
		}

		if (self.template) {
			var is = self.template.COMPILABLE();
			self.find(cls2).append(self.template);
			self.template = null;
			is && COMPILE();
		}

		if (W.$$miniform_level < 1)
			W.$$miniform_level = 1;

		W.$$miniform_level++;

		self.css('z-index', W.$$miniform_level * config.zindex);
		self.rclass('hidden');

		self.resize();
		self.release(false);

		config.reload && self.EXEC(config.reload, self);
		config.default && DEFAULT(self.makepath(config.default), true);

		if (!isMOBILE && config.autofocus) {
			setTimeout(function() {
				self.find(typeof(config.autofocus) === 'string' ? config.autofocus : 'input[type="text"],select,textarea').eq(0).focus();
			}, 1000);
		}

		setTimeout(function() {
			self.rclass('invisible');
			self.find(cls2).aclass(cls + '-animate');
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.ID, function() {
			self.css('z-index', (W.$$miniform_level * config.zindex) + 1);
		}, 500);

		config.closeesc && self.esc(true);
	};
});

COMPONENT('idletime', 'count:300', function(self, config) {

	var is = false;
	var count = 0;
	var countfocus = 0;
	var interval;
	var interval_rebind;
	var ticks;
	var rebinded = false;
	var $W = $(W);

	self.singleton();
	self.blind();
	self.readonly();

	function rebind() {
		is && EMIT('idletime', false);
		is = false;
		countfocus = 0;
		count = 0;
		unbind();
		interval_rebind && clearTimeout(interval_rebind);
		interval_rebind = setTimeout(rebind2, config.count * 100);
	}

	function rebind2() {
		if (!rebinded) {
			$W.on('mousemove mousewheel click keyup touchstart focus scroll pageshow', rebind);
			rebinded = true;
		}
	}

	function unbind() {
		if (rebinded) {
			$W.off('mousemove mousewheel click keyup touchstart focus scroll pageshow', rebind);
			rebinded = false;
		}
	}

	self.destroy = function() {
		interval_rebind && clearTimeout(interval_rebind);
		clearInterval(interval);
		interval = null;
		unbind();
	};

	self.make = function() {

		$(document).on('visibilitychange', function() {
			var now = Date.now();
			if (document.hidden) {
				ticks = now;
			} else {
				var diff = Math.ceil((now - ticks) / 1000);
				if (diff >= config.count) {
					rebind();
					setTimeout(function() {
						EMIT('reload');
					}, 500);
				}
				ticks = now;
			}
		});

		rebind2();
		interval = setInterval(function() {

			if (document.hasFocus())
				countfocus = 0;
			else
				countfocus++;

			if ((count > config.count || countfocus > config.count) && !is) {
				is = true;
				EMIT('idletime', true);
			} else
				count++;

		}, 1000);
	};
});

COMPONENT('scrollbar', 'reset:true;margin:0;marginxs:0;marginsm:0;marginmd:0;marginlg:0;visibleY:1', function(self, config) {

	self.readonly();

	self.configure = function(key, value) {
		if (key === 'track') {
			if (!(value instanceof Array))
				value = value.split(',').trim();

			for (var i = 0; i < value.length; i++)
				value[i] = self.path + '.' + value[i];

			value.push(self.path);
			config.track = value;
		}
	};

	self.init = function() {

		var resize = function() {
			SETTER('scrollbar', 'resize');
		};

		var resizedelay = function() {
			setTimeout2('scrollbar', resize, 300);
		};

		ON('resize2', resizedelay);
	};

	self.make = function() {
		self.scrollbar = SCROLLBAR(self.element, { visibleX: config.visibleX, visibleY: config.visibleY, orientation: !config.visibleX && config.visibleY ? 'y' : null, shadow: !!config.shadow });
		self.scrollleft = self.scrollbar.scrollLeft;
		self.scrolltop = self.scrollbar.scrollTop;
		self.scrollright = self.scrollbar.scrollRight;
		self.scrollbottom = self.scrollbar.scrollBottom;
	};

	self.resize = function() {
		if (config.parent) {
			var parent = self.parent(config.parent);
			self.element.css('height', parent.height() - (config.offset ? self.element.offset().top : 0) - config.margin - config['margin' + WIDTH()]);
		}
		self.scrollbar.resize();
	};

	self.on('resize + reflow', self.resize);
	self.done = self.resize;

	self.scroll = function(x, y) {
		self.scrollbar.scroll(x, y);
	};

	self.reset = function() {
		self.scroll(0, 0);
	};

	self.setter = function(value, path, type) {
		if (config.track && config.track.indexOf(path) === -1)
			return;
		type && setTimeout(function() {
			self.done();
			config.reset && self.reset();
		}, 500);
	};
});

// Component: j-Importer
// Version: 1
// Updated: 2021-03-29 11:15
COMPONENT('importer',function(self,config){var init=false,clid=null,pending=false,content='',replace=function(value){return self.scope?self.makepath(value):value.replace(/\?/g,config.path||config.if)};var replace2=function(value){return value?value.replace(/~PATH~/g,config.path||config.if):value};self.readonly();self.make=function(){var scr=self.find('script');content=scr.length?scr.html():''};self.reload=function(recompile){config.reload&&EXEC(replace(config.reload));recompile&&COMPILE();setTimeout(function(){pending=false;init=true},1000)};self.setter=function(value){if(pending)return;if(config.if!==value){if(config.cleaner&&init&&!clid)clid=setTimeout(self.clean,config.cleaner*60000);return}pending=true;if(clid){clearTimeout(clid);clid=null}if(init){self.reload();return}if(content){self.html(replace2(content));setTimeout(self.reload,50,true)}else self.import(config.url,self.reload,true,replace2)};self.clean=function(){config.clean&&EXEC(replace(config.clean));setTimeout(function(){self.empty();init=false;clid=null},1000)}});
// End: j-Importer

// Component: j-LargeForm
// Version: 1
// Updated: 2021-04-08 10:53
COMPONENT('largeform','zindex:12;padding:30;scrollbar:1;scrolltop:1;style:1',function(self,config,cls){var cls2='.'+cls,csspos={},nav=false,init=false;if(!W.$$largeform){W.$$largeform_level=W.$$largeform_level||1;W.$$largeform=true;$(document).on('click',cls2+'-button-close',function(){SET($(this).attrd('path'),'')});var resize=function(){setTimeout2(self.name,function(){for(var i=0;i<M.components.length;i++){var com=M.components[i];if(com.name==='largeform'&&!HIDDEN(com.dom)&&com.$ready&&!com.$removed)com.resize()}},200)};ON('resize2',resize);$(document).on('click',cls2+'-container',function(e){if(e.target===this){var com=$(this).component();if(com&&com.config.closeoutside){com.set('');return}}var el=$(e.target);if(el.hclass(cls+'-container')&&!el.hclass(cls+'-style-2')){var form=el.find(cls2);var c=cls+'-animate-click';form.aclass(c);setTimeout(function(){form.rclass(c)},300)}})}self.readonly();self.submit=function(){if(config.submit)self.EXEC(config.submit,self.hide,self.element);else self.hide()};self.cancel=function(){config.cancel&&self.EXEC(config.cancel,self.hide);self.hide()};self.hide=function(){if(config.independent)self.hideforce();self.esc(false);self.set('')};self.icon=function(value){var el=this.rclass2('fa');value.icon&&el.aclass(value.icon.indexOf(' ')===-1?('fa fa-'+value.icon):value.icon)};self.resize=function(){if(self.hclass('hidden'))return;var padding=isMOBILE?0:config.padding,ui=self.find(cls2);csspos.height=WH-(config.style==1?(padding*2):padding);csspos.top=padding;ui.css(csspos);var el=self.find(cls2+'-title');var th=el.height();var w=ui.width();if(w>WW)w=WW;csspos={height:csspos.height-th,width:w};if(nav)csspos.height-=nav.height();self.find(cls2+'-body').css(csspos);self.scrollbar&&self.scrollbar.resize();self.element.SETTER('*','resize')};self.make=function(){$(document.body).append('<div id="{0}" class="hidden {4}-container invisible"><div class="{4}" style="max-width:{1}px"><div data-bind="@config__text span:value.title__change .{4}-icon:@icon" class="{4}-title"><button name="cancel" class="{4}-button-close{3}" data-path="{2}"><i class="fa fa-times"></i></button><i class="{4}-icon"></i><span></span></div><div class="{4}-body"></div></div>'.format(self.ID,config.width||800,self.path,config.closebutton==false?' hidden':'',cls));var scr=self.find('> script');self.template=scr.length?scr.html().trim():'';scr.length&&scr.remove();var el=$('#'+self.ID);var body=el.find(cls2+'-body')[0];while(self.dom.children.length){var child=self.dom.children[0];if(child.tagName==='NAV'){nav=$(child);body.parentNode.appendChild(child)}else body.appendChild(child)}self.rclass('hidden invisible');self.replace(el,true);if(config.scrollbar)self.scrollbar=SCROLLBAR(self.find(cls2+'-body'),{shadow:config.scrollbarshadow,visibleY:config.visibleY,orientation:'y'});if(config.style===2)self.aclass(cls+'-style-2');self.event('scroll',function(){EMIT('scroll',self.name);EMIT('reflow',self.name)});self.event('click','button[name]',function(){var t=this;switch(t.name){case'submit':self.submit(self.hide);break;case'cancel':!t.disabled&&self[t.name](self.hide);break}});config.enter&&self.event('keydown','input',function(e){e.which===13&&!self.find('button[name="submit"]')[0].disabled&&setTimeout(self.submit,800)})};self.configure=function(key,value,init,prev){if(!init){switch(key){case'width':value!==prev&&self.find(cls2).css('max-width',value+'px');break;case'closebutton':self.find(cls2+'-button-close').tclass('hidden',value!==true);break}}};self.esc=function(bind){if(bind){if(!self.$esc){self.$esc=true;$(W).on('keydown',self.esc_keydown)}}else{if(self.$esc){self.$esc=false;$(W).off('keydown',self.esc_keydown)}}};self.esc_keydown=function(e){if(e.which===27&&!e.isPropagationStopped()){var val=self.get();if(!val||config.if===val){e.preventDefault();e.stopPropagation();self.hide()}}};self.hideforce=function(){if(!self.hclass('hidden')){self.aclass('hidden');self.release(true);self.find(cls2).rclass(cls+'-animate');W.$$largeform_level--}};var allowscrollbars=function(){$('html').tclass(cls+'-noscroll',!!$(cls2+'-container').not('.hidden').length)};self.setter=function(value){setTimeout2(self.name+'-noscroll',allowscrollbars,50);var isHidden=value!==config.if;if(self.hclass('hidden')===isHidden){if(!isHidden){config.reload&&self.EXEC(config.reload,self);config.default&&DEFAULT(self.makepath(config.default),true);config.scrolltop&&self.scrollbar&&self.scrollbar.scrollTop(0)}return}setTimeout2(cls,function(){EMIT('reflow',self.name)},10);if(isHidden){if(!config.independent)self.hideforce();return}if(self.template){var is=self.template.COMPILABLE();self.find(cls2).append(self.template);self.template=null;is&&COMPILE()}if(W.$$largeform_level<1)W.$$largeform_level=1;W.$$largeform_level++;self.css('z-index',W.$$largeform_level*config.zindex);self.aclass('invisible');self.rclass('hidden');self.release(false);config.scrolltop&&self.scrollbar&&self.scrollbar.scrollTop(0);config.reload&&self.EXEC(config.reload,self);config.default&&DEFAULT(self.makepath(config.default),true);if(!isMOBILE&&config.autofocus){setTimeout(function(){self.find(typeof(config.autofocus)==='string'?config.autofocus:'input[type="text"],select,textarea').eq(0).focus()},1000)}self.resize();setTimeout(function(){self.rclass('invisible');self.find(cls2).aclass(cls+'-animate');if(!init&&isMOBILE){$('body').aclass('hidden');setTimeout(function(){$('body').rclass('hidden')},50)}init=true},200);setTimeout2(self.ID,function(){self.css('z-index',(W.$$largeform_level*config.zindex)+1)},500);config.closeesc&&self.esc(true)}});
// End: j-LargeForm

// Component: j-Shortcuts
// Version: 1
// Updated: 2020-07-30 15:25
COMPONENT('shortcuts', function(self) {

	var items = [];
	var length = 0;
	var keys = {};
	var keys_session = {};
	var issession = false;

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	var cb = function(o, e) {
		o.callback(e, o.owner);
	};

	self.make = function() {

		$(W).on('keydown', function(e) {

			var f = e.key || '';
			var c = e.keyCode;

			if (f.length > 1 && f.charAt(0) === 'F')
				c = 0;
			else
				f = '-';

			// ctrl,alt,shift,meta,fkey,code
			var key = (e.ctrlKey ? 1 : 0) + '' + (e.altKey ? 1 : 0) + '' + (e.shiftKey ? 1 : 0) + '' + (e.metaKey ? 1 : 0) + f + c;

			if (issession) {
				if (!keys_session[key])
					return;
			} else {
				if (!keys[key])
					return;
			}

			if (length && !e.isPropagationStopped()) {
				for (var i = 0; i < length; i++) {
					var o = items[i];
					if (o.fn(e)) {
						if (o.prevent) {
							e.preventDefault();
							e.stopPropagation();
						}
						setTimeout(cb, 100, o, e);
						return;
					}
				}
			}
		});

		ON('component + knockknock', self.refresh);
	};

	self.refreshforce = function() {

		var arr = document.querySelectorAll('.shortcut');
		var index = 0;

		while (true) {
			var item = items[index++];
			if (item == null)
				break;
			if (item.owner) {
				index--;
				items.splice(index, 1);
			}
		}

		for (var i = 0; i < arr.length; i++) {
			var shortcut = arr[i].getAttribute('data-shortcut');
			shortcut && self.register(shortcut, self.execshortcut, true, arr[i]);
		}
	};

	self.session = function(callback) {
		issession = true;
		keys_session = {};
		callback(self.register);
	};

	self.end = function() {
		issession = false;
	};

	self.execshortcut = function(e, owner) {
		$(owner).trigger('click');
	};

	self.refresh = function() {
		setTimeout2(self.ID, self.refreshforce, 500);
	};

	self.exec = function(shortcut) {
		var item = items.findItem('shortcut', shortcut.toLowerCase().replace(/\s/g, ''));
		item && item.callback(EMPTYOBJECT, item.owner);
	};

	self.register = function(shortcut, callback, prevent, owner) {

		var currentkeys = issession ? keys_session : keys;

		shortcut.split(',').trim().forEach(function(shortcut) {

			var builder = [];
			var alias = [];
			var cachekey = [0, 0, 0, 0, '-', 0]; // ctrl,alt,shift,meta,fkey,code

			shortcut.split('+').trim().forEach(function(item) {
				var lower = item.toLowerCase();
				alias.push(lower);

				switch (lower) {
					case 'ctrl':
						cachekey[0] = 1;
						break;
					case 'alt':
						cachekey[1] = 1;
						break;
					case 'shift':
						cachekey[2] = 1;
						break;
					case 'win':
					case 'meta':
					case 'cmd':
						cachekey[3] = 1;
						break;
				}

				switch (lower) {
					case 'ctrl':
					case 'alt':
					case 'shift':
						builder.push('e.{0}Key'.format(lower));
						return;
					case 'win':
					case 'meta':
					case 'cmd':
						builder.push('e.metaKey');
						return;
					case 'ins':
						builder.push('e.keyCode===45');
						cachekey[5] = 45;
						return;
					case 'space':
						builder.push('e.keyCode===32');
						cachekey[5] = 32;
						return;
					case 'tab':
						builder.push('e.keyCode===9');
						cachekey[5] = 9;
						return;
					case 'esc':
						builder.push('e.keyCode===27');
						cachekey[5] = 27;
						return;
					case 'enter':
						builder.push('e.keyCode===13');
						cachekey[5] = 13;
						return;
					case 'backspace':
						builder.push('e.keyCode===8');
						cachekey[5] = 8;
						break;
					case 'del':
					case 'delete':
						builder.push('e.keyCode===46');
						cachekey[5] = 46;
						return;
					case 'save':
						builder.push('(e.metaKey&&e.keyCode===115)');
						cachekey[5] = -1;
						return;
					case 'remove':
						builder.push('((e.metaKey&&e.keyCode===8)||e.keyCode===46)');
						cachekey[5] = -1;
						return;
					case 'up':
						builder.push('e.keyCode===38');
						cachekey[5] = 38;
						return;
					case 'down':
						builder.push('e.keyCode===40');
						cachekey[5] = 40;
						return;
					case 'right':
						builder.push('e.keyCode===39');
						cachekey[5] = 39;
						return;
					case 'left':
						builder.push('e.keyCode===37');
						cachekey[5] = 37;
						return;
					case 'f1':
					case 'f2':
					case 'f3':
					case 'f4':
					case 'f5':
					case 'f6':
					case 'f7':
					case 'f8':
					case 'f9':
					case 'f10':
					case 'f11':
					case 'f12':
						var a = item.toUpperCase();
						builder.push('e.key===\'{0}\''.format(a));
						cachekey[4] = a;
						return;
					case 'capslock':
						builder.push('e.which===20');
						cachekey[5] = 20;
						return;
				}

				var num = item.parseInt();
				if (num) {
					builder.push('e.which===' + num);
					cachekey[5] = num;
				} else {
					num = item.toUpperCase().charCodeAt(0);
					cachekey[5] = num;
					builder.push('e.keyCode==={0}'.format(num));
				}
			});

			items.push({ shortcut: alias.join('+'), fn: new Function('e', 'return ' + builder.join('&&')), callback: callback, prevent: prevent, owner: owner });
			length = items.length;

			var k;

			// Remove
			if (cachekey[5] === -1) {
				cachekey[5] = 8;
				k = cachekey.join('');
				currentkeys[k] = 1;
				cachekey[5] = 46;
			}

			k = cachekey.join('');
			currentkeys[k] = 1;
		});

		if (!owner)
			self.refresh();

		return self;
	};
});
// End: j-Shortcuts

// Component: j-ToggleButton
// Version: 1
// Updated: 2019-10-04 20:07
COMPONENT('togglebutton',function(self,config,cls){var icon;self.nocompile();self.validate=function(value){return(config.disabled||!config.required)?true:value===true};self.configure=function(key,value,init){switch(key){case'disabled':!init&&self.tclass('ui-disabled',value);break;case'icontrue':case'iconfalse':if(value.indexOf(' ')===-1)config[key]='fa fa-'+value;break}};self.make=function(){self.aclass(cls);self.append('<button><i></i></button>');icon=self.find('i');self.event('click',function(){if(!config.disabled){self.dirty(false);self.getter(!self.get())}})};self.setter=function(value){self.tclass(cls+'-selected',value===true);icon.rclass();if(value===true){if(config.icontrue)icon.aclass(config.icontrue)}else{if(config.iconfalse)icon.aclass(config.iconfalse)}};self.state=function(type){if(!type)return;var invalid=config.required?self.isInvalid():false;if(invalid===self.$oldstate)return;self.$oldstate=invalid;self.tclass(cls+'-invalid',invalid)}});
// End: j-ToggleButton

// Component: j-Message
// Version: 1
// Updated: 2021-04-20 15:52
COMPONENT('message','button:OK',function(self,config,cls){var cls2='.'+cls,is,events={};self.readonly();self.singleton();self.nocompile&&self.nocompile();self.make=function(){var pls=(config.style===2?(' '+cls+'2'):'');self.aclass(cls+' hidden'+pls);if(config.closeoutside)self.event('click',function(e){var node=e.target,skip={SPAN:1,A:1,I:1};if(!skip[node.tagName])self.hide()});else self.event('click','button',self.hide)};events.keyup=function(e){if(e.which===27)self.hide()};events.bind=function(){if(!events.is){$(W).on('keyup',events.keyup);events.is=false}};events.unbind=function(){if(events.is){events.is=false;$(W).off('keyup',events.keyup)}};self.warning=function(message,icon,fn){if(typeof(icon)==='function'){fn=icon;icon=undefined}self.callback=fn;self.content(cls+'-warning',message,icon||'warning')};self.info=function(message,icon,fn){if(typeof(icon)==='function'){fn=icon;icon=undefined}self.callback=fn;self.content(cls+'-info',message,icon||'info-circle')};self.success=function(message,icon,fn){if(typeof(icon)==='function'){fn=icon;icon=undefined}self.callback=fn;self.content(cls+'-success',message,icon||'check-circle')};self.response=function(message,callback,response){var fn;if(typeof(message)==='function'){response=callback;fn=message;message=null}else if(typeof(callback)==='function')fn=callback;else{response=callback;fn=null}if(response instanceof Array){var builder=[];for(var i=0;i<response.length;i++){var err=response[i].error;err&&builder.push(err)}self.warning(builder.join('<br />'));SETTER('!loading/hide')}else if(typeof(response)==='string'){self.warning(response);SETTER('!loading/hide')}else{if(message){if(message.length<40&&message.charAt(0)==='?')SET(message,response);else self.success(message)}if(typeof(fn)==='string')SET(fn,response);else if(fn)fn(response)}};self.hide=function(){events.unbind();self.callback&&self.callback();self.aclass('hidden')};self.content=function(classname,text,icon){if(icon.indexOf(' ')===-1)icon='fa fa-'+icon;!is&&self.html('<div><div class="{0}-icon"><i class="{1}"></i></div><div class="{0}-body"><div class="{0}-text"></div><hr /><button>{2}</button></div></div>'.format(cls,icon,config.button));self.rclass2(cls+'-').aclass(classname);self.find(cls2+'-body').rclass().aclass(cls+'-body');is&&self.find(cls2+'-icon').find('.fa').rclass2('fa').aclass(icon);self.find(cls2+'-text').html(text);self.rclass('hidden');self.element.focus();is=true;events.bind();document.activeElement&&document.activeElement.blur();setTimeout(function(){self.aclass(cls+'-visible');setTimeout(function(){self.find(cls2+'-icon').aclass(cls+'-icon-animate');document.activeElement&&document.activeElement.blur()},300)},100)}});
// End: j-Message

// Component: j-Directory
// Version: 1
// Updated: 2021-05-21 14:14
COMPONENT('directory','minwidth:200',function(self,config,cls){var cls2='.'+cls,container,timeout,icon,plus,skipreset=false,skipclear=false,ready=false,input=null,issearch=false,is=false,selectedindex=0,resultscount=0,skiphide=false,templateE='{{ name | encode | ui_directory_helper}}',templateR='{{ name | raw}}',template='<li data-index="{{ $.index}}" data-search="{{ $.search}}" {{ if selected}} class="current selected{{ if classname}} {{ classname}}{{ fi}}"{{ else if classname}} class="{{ classname}}"{{ fi}}>{{ if $.checkbox}}<span class="'+cls+'-checkbox"><i class="fa fa-check"></i></span>{{ fi}}{0}</li>',templateraw=template.format(templateR);var regstrip=/(&nbsp;|<([^>]+)>)/ig;var parentclass;template=template.format(templateE);Thelpers.ui_directory_helper=function(val){var t=this;return t.template?(typeof(t.template)==='string'?t.template.indexOf('{{')===-1?t.template:Tangular.render(t.template,this):t.render(this,val)):self.opt.render?self.opt.render(this,val):val};self.template=Tangular.compile(template);self.templateraw=Tangular.compile(templateraw);self.readonly();self.singleton();self.nocompile&&self.nocompile();self.configure=function(key,value,init){if(init)return;switch(key){case'placeholder':self.find('input').prop('placeholder',value);break}};self.make=function(){self.aclass(cls+' hidden');self.append('<div class="{1}-search"><span class="{1}-add hidden"><i class="fa fa-plus"></i></span><span class="{1}-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" name="dir{2}" autocomplete="new-password" /></div></div><div class="{1}-container"><ul></ul></div>'.format(config.placeholder,cls,Date.now()));container=self.find('ul');input=self.find('input');icon=self.find(cls2+'-button').find('.fa');plus=self.find(cls2+'-add');self.event('mouseenter mouseleave','li',function(){if(ready&&!issearch){container.find('li.current').rclass('current');$(this).aclass('current');var arr=container.find('li:visible');for(var i=0;i<arr.length;i++){if($(arr[i]).hclass('current')){selectedindex=i;break}}}});self.event('focus','input',function(){if(self.opt.search===false)$(this).blur()});self.event('click',cls2+'-button',function(e){skipclear=false;input.val('');self.search();e.stopPropagation();e.preventDefault()});self.event('click',cls2+'-add',function(){if(self.opt.custom&&self.opt.callback){self.opt.scope&&M.scope(self.opt.scope);self.opt.callback(input.val(),self.opt.element,true);self.hide()}});self.event('click','li',function(e){if(self.opt.callback){self.opt.scope&&M.scope(self.opt.scope);var item=self.opt.items[+this.getAttribute('data-index')];if(self.opt.checkbox){item.selected=!item.selected;$(this).tclass('selected',item.selected);var response=[];for(var i=0;i<self.opt.items.length;i++){var m=self.opt.items[i];if(m.selected)response.push(m)}self.opt.callback(response,self.opt.element,false,e);skiphide=true}else self.opt.callback(item,self.opt.element,false,e)}is=true;if(!self.opt.checkbox){self.hide(0);e.preventDefault();e.stopPropagation()}});var e_click=function(e){if(skiphide){skiphide=false;return}var node=e.target,count=0;if(is){while(true){var c=node.getAttribute('class')||'';if(c.indexOf(cls+'-search-input')!==-1)return;node=node.parentNode;if(!node||!node.tagName||node.tagName==='BODY'||count>3)break;count++}}else{is=true;while(true){var c=node.getAttribute('class')||'';if(c.indexOf(cls)!==-1){is=false;break}node=node.parentNode;if(!node||!node.tagName||node.tagName==='BODY'||count>4)break;count++}}is&&self.hide(0)};var e_resize=function(){is&&self.hide(0)};self.bindedevents=false;self.bindevents=function(){if(!self.bindedevents){$(document).on('click',e_click);$(W).on('resize',e_resize);self.bindedevents=true}};self.unbindevents=function(){if(self.bindedevents){self.bindedevents=false;$(document).off('click',e_click);$(W).off('resize',e_resize)}};self.event('keydown','input',function(e){var o=false;switch(e.which){case 8:skipclear=false;break;case 27:o=true;self.hide();break;case 13:o=true;var sel=self.find('li.current');if(self.opt.callback){self.opt.scope&&M.scope(self.opt.scope);var index=+sel.attrd('index');if(self.opt.custom&&(!sel.length||index===-1))self.opt.callback(this.value,self.opt.element,true);else self.opt.callback(self.opt.items[index],self.opt.element)}self.hide();break;case 38:o=true;selectedindex--;if(selectedindex<0)selectedindex=0;self.move();break;case 40:o=true;selectedindex++;if(selectedindex>=resultscount)selectedindex=resultscount;self.move();break}if(o){e.preventDefault();e.stopPropagation()}});self.event('input','input',function(){issearch=true;setTimeout2(self.ID,self.search,100,null,this.value)});var fn=function(){is&&self.hide(1)};self.on('reflow + scroll + resize + resize2',fn);$(W).on('scroll',fn)};self.move=function(){var counter=0,scroller=container.parent();var li=container.find('li');var hli=0,was=false,last=-1,lastselected=0,plus=0;for(var i=0;i<li.length;i++){var el=$(li[i]);if(el.hclass('hidden')){el.rclass('current');continue}var is=selectedindex===counter;el.tclass('current',is);if(is){hli=(el.innerHeight()||30)+1;plus=(hli*2);was=true;var t=(hli*(counter||1));scroller[0].scrollTop=t-plus}counter++;last=i;lastselected++}if(!was&&last>=0){selectedindex=lastselected;li.eq(last).aclass('current')}};var nosearch=function(){issearch=false};self.nosearch=function(){setTimeout2(self.ID+'nosearch',nosearch,500)};self.search=function(value){if(!self.opt)return;icon.tclass('fa-times',!!value).tclass('fa-search',!value);self.opt.custom&&plus.tclass('hidden',!value);if(!value&&!self.opt.ajax){if(!skipclear)container.find('li').rclass('hidden');if(!skipreset)selectedindex=0;resultscount=self.opt.items?self.opt.items.length:0;self.move();self.nosearch();return}resultscount=0;selectedindex=0;if(self.opt.ajax){var val=value||'';if(self.ajaxold!==val){self.ajaxold=val;setTimeout2(self.ID,function(val){self.opt&&self.opt.ajax(val,function(items){var builder=[],indexer={},item,key=(self.opt.search==true?self.opt.key:(self.opt.search||self.opt.key))||'name';for(var i=0;i<items.length;i++){item=items[i];if(self.opt.exclude&&self.opt.exclude(item))continue;indexer.index=i;indexer.search=item[key]?item[key].replace(regstrip,''):'';indexer.checkbox=self.opt.checkbox===true;resultscount++;builder.push(self.opt.ta(item,indexer))}if(self.opt.empty){item={};var tmp=self.opt.raw?'<b>{0}</b>'.format(self.opt.empty):self.opt.empty;item[self.opt.key||'name']=tmp;if(!self.opt.raw)item.template='<b>{0}</b>'.format(self.opt.empty);indexer.index=-1;builder.unshift(self.opt.ta(item,indexer))}skipclear=true;self.opt.items=items;container.html(builder);self.move();self.nosearch()})},300,null,val)}}else if(value){value=value.toSearch().split(' ');var arr=container.find('li');for(var i=0;i<arr.length;i++){var el=$(arr[i]);var val=el.attrd('search').toSearch();var is=false;for(var j=0;j<value.length;j++){if(val.indexOf(value[j])===-1){is=true;break}}el.tclass('hidden',is);if(!is)resultscount++}skipclear=true;self.move();self.nosearch()}};self.show=function(opt){var el=opt.element instanceof jQuery?opt.element[0]:opt.element;if(opt.items==null)opt.items=EMPTYARRAY;self.tclass(cls+'-default',!opt.render);if(parentclass){self.rclass(parentclass);parentclass=null}if(opt.classname){self.aclass(opt.classname);parentclass=opt.classname}if(!opt.minwidth)opt.minwidth=200;if(is){clearTimeout(timeout);if(self.target===el){self.hide(1);return}}self.initializing=true;self.target=el;opt.ajax=null;self.ajaxold=null;var element=$(opt.element);var callback=opt.callback,items=opt.items,type=typeof(items);var item;if(type==='string'){items=opt.items=GET(items);type=typeof(items)}if(type==='function'&&callback){type='';opt.ajax=items;items=null}if(!items&&!opt.ajax){self.hide(0);return}setTimeout(self.bindevents,500);self.tclass(cls+'-search-hidden',opt.search===false);self.opt=opt;opt.class&&self.aclass(opt.class);input.val('');var builder=[],selected=null;opt.ta=opt.key?Tangular.compile((opt.raw?templateraw:template).replace(/\{\{\sname/g,'{{ '+opt.key)):opt.raw?self.templateraw:self.template;if(!opt.ajax){var indexer={},key=(opt.search==true?opt.key:(opt.search||opt.key))||'name';for(var i=0;i<items.length;i++){item=items[i];if(typeof(item)==='string')item={name:item,id:item,selected:item===opt.selected};if(opt.exclude&&opt.exclude(item))continue;if(item.selected||opt.selected===item){selected=i;skipreset=true;item.selected=true}else item.selected=false;indexer.checkbox=opt.checkbox===true;indexer.index=i;indexer.search=item[key]?item[key].replace(regstrip,''):'';builder.push(opt.ta(item,indexer))}if(opt.empty){item={};var tmp=opt.raw?'<b>{0}</b>'.format(opt.empty):opt.empty;item[opt.key||'name']=tmp;if(!opt.raw)item.template='<b>{0}</b>'.format(opt.empty);indexer.index=-1;builder.unshift(opt.ta(item,indexer))}}self.target=element[0];var w=element.width();var offset=element.offset();var width=w+(opt.offsetWidth||0);if(opt.minwidth&&width<opt.minwidth)width=opt.minwidth;else if(opt.maxwidth&&width>opt.maxwidth)width=opt.maxwidth;ready=false;opt.ajaxold=null;plus.aclass('hidden');self.find('input').prop('placeholder',opt.placeholder||config.placeholder);var scroller=self.find(cls2+'-container').css('width',width+30);container.html(builder);var options={left:0,top:0,width:width};switch(opt.align){case'center':options.left=Math.ceil((offset.left-width/2)+(opt.element.innerWidth()/2));break;case'right':options.left=(offset.left-width)+opt.element.innerWidth();break;default:options.left=offset.left;break}options.top=opt.position==='bottom'?((offset.top-self.height())+element.height()):offset.top;options.scope=M.scope?M.scope():'';if(opt.offsetX)options.left+=opt.offsetX;if(opt.offsetY)options.top+=opt.offsetY;var mw=width,mh=self.height();if(options.left<0)options.left=10;else if((mw+options.left)>WW)options.left=(WW-mw)-10;if(options.top<0)options.top=10;else if((mh+options.top)>WH)options.top=(WH-mh)-10;self.css(options);!isMOBILE&&setTimeout(function(){ready=true;if(opt.search!==false)input.focus()},200);setTimeout(function(){self.initializing=false;is=true;if(selected==null)scroller[0].scrollTop=0;else{var h=container.find('li:first-child').innerHeight()+1;var y=(container.find('li.selected').index()*h)-(h*2);scroller[0].scrollTop=y<0?0:y}},100);if(is){self.search();return}selectedindex=selected||0;resultscount=items?items.length:0;skipclear=true;self.search();self.rclass('hidden');setTimeout(function(){if(self.opt&&self.target&&self.target.offsetParent)self.aclass(cls+'-visible');else self.hide(1)},100);skipreset=false};self.hide=function(sleep){if(!is||self.initializing)return;clearTimeout(timeout);timeout=setTimeout(function(){self.unbindevents();self.rclass(cls+'-visible').aclass('hidden');if(self.opt){self.opt.close&&self.opt.close();self.opt.class&&self.rclass(self.opt.class);self.opt=null}is=false},sleep?sleep:100)}});
// End: j-Directory

// Component: j-Input
// Version: 1
// Updated: 2021-05-20 12:03
COMPONENT('input','maxlength:200;dirkey:name;dirvalue:id;increment:1;autovalue:name;direxclude:false;forcevalidation:1;searchalign:1;after:\\:',function(self,config,cls){var cls2='.'+cls,input,placeholder,dirsource,binded,customvalidator,mask,rawvalue,isdirvisible=false,nobindcamouflage=false,focused=false;self.nocompile();self.bindvisible(20);self.init=function(){Thelpers.ui_input_icon=function(val){return val.charAt(0)==='!'||val.indexOf(' ')!==-1?('<span class="ui-input-icon-custom">'+(val.charAt(0)==='!'?val.substring(1):('<i class="'+val)+'"></i>')+'</span>'):('<i class="fa fa-'+val+'"></i>')};W.ui_input_template=Tangular.compile(('{{ if label}}<div class="{0}-label">{{ if icon}}<i class="{{ icon}}"></i>{{ fi}}{{ label | raw}}{{ after | raw}}</div>{{ fi}}<div class="{0}-control{{ if licon}} {0}-licon{{ fi}}{{ if ricon || (type === \'number\' && increment) }} {0}-ricon{{ fi}}">{{ if ricon || (type === \'number\' && increment) }}<div class="{0}-icon-right{{ if type === \'number\' && increment && !ricon}} {0}-increment{{ else if riconclick || type === \'date\' || type === \'time\' || (type === \'search\' && searchalign === 1) || type === \'password\' }} {0}-click{{ fi}}">{{ if type === \'number\' && !ricon}}<i class="fa fa-caret-up"></i><i class="fa fa-caret-down"></i>{{ else}}{{ ricon | ui_input_icon}}{{ fi}}</div>{{ fi}}{{ if licon}}<div class="{0}-icon-left{{ if liconclick || (type === \'search\' && searchalign !== 1) }} {0}-click{{ fi}}">{{ licon | ui_input_icon}}</div>{{ fi}}<div class="{0}-input{{ if align === 1 || align === \'center\' }} center{{ else if align === 2 || align === \'right\' }} right{{ fi}}">{{ if placeholder && !innerlabel}}<div class="{0}-placeholder">{{ placeholder}}</div>{{ fi}}{{ if dirsource || type === \'icon\' || type === \'emoji\' || type === \'color\' }}<div class="{0}-value" tabindex="0"></div>{{ else}}<input type="{{ if type === \'password\' }}password{{ else}}text{{ fi}}"{{ if autofill}} autocomplete="on" name="{{ PATH}}"{{ else}} name="input'+Date.now()+'" autocomplete="new-password"{{ fi}} data-jc-bind=""{{ if maxlength > 0}} maxlength="{{ maxlength}}"{{ fi}}{{ if autofocus}} autofocus{{ fi}} />{{ fi}}</div></div>{{ if error}}<div class="{0}-error hidden"><i class="fa fa-warning"></i> {{ error}}</div>{{ fi}}').format(cls))};self.make=function(){if(!config.label)config.label=self.html();if(isMOBILE&&config.autofocus)config.autofocus=false;config.PATH=self.path.replace(/\./g,'_');self.aclass(cls+' invisible');self.rclass('invisible',100);self.redraw();self.event('input change',function(){if(nobindcamouflage)nobindcamouflage=false;else self.check()});self.event('focus','input,'+cls2+'-value',function(){if(config.disabled){$(this).blur();return}focused=true;self.camouflage(false);self.aclass(cls+'-focused');config.autocomplete&&EXEC(self.makepath(config.autocomplete),self,input.parent());if(config.autosource){var opt={};opt.element=self.element;opt.search=GET(self.makepath(config.autosource));opt.callback=function(value){var val=typeof(value)==='string'?value:value[config.autovalue];if(config.autoexec){EXEC(self.makepath(config.autoexec),value,function(val){self.set(val,2);self.change();self.bindvalue()})}else{self.set(val,2);self.change();self.bindvalue()}};SETTER('autocomplete','show',opt)}else if(config.mask){setTimeout(function(input){input.selectionStart=input.selectionEnd=0},50,this)}else if(config.dirsource&&(config.autofocus!=false&&config.autofocus!=0)){if(!isdirvisible)self.find(cls2+'-control').trigger('click')}else if(config.type==='date'||config.type==='time'){setTimeout(function(){self.element.find(cls2+'-icon-right').trigger('click')},300)}});self.event('paste','input',function(e){if(config.mask){var val=(e.originalEvent.clipboardData||window.clipboardData).getData('text');self.set(val.replace(/\s|\t/g,''));e.preventDefault()}self.check()});self.event('keydown','input',function(e){var t=this,code=e.which;if(t.readOnly||config.disabled){if(e.keyCode!==9){if(config.dirsource){self.find(cls2+'-control').trigger('click');return}e.preventDefault();e.stopPropagation()}return}if(!config.disabled&&config.dirsource&&(code===13||code>30)){self.find(cls2+'-control').trigger('click');return}if(config.mask){if(e.metaKey){if(code===8||code===127){e.preventDefault();e.stopPropagation()}return}if(code===32){e.preventDefault();e.stopPropagation();return}var beg=e.target.selectionStart,end=e.target.selectionEnd,val=t.value,c;if(code===8||code===127){if(beg===end){c=config.mask.substring(beg-1,beg);t.value=val.substring(0,beg-1)+c+val.substring(beg);self.curpos(beg-1)}else{for(var i=beg;i<=end;i++){c=config.mask.substring(i-1,i);val=val.substring(0,i-1)+c+val.substring(i)}t.value=val;self.curpos(beg)}e.preventDefault();return}if(code>40){var cur=String.fromCharCode(code);if(mask&&mask[beg]){if(!mask[beg].test(cur)){e.preventDefault();return}}c=config.mask.charCodeAt(beg);if(c!==95){beg++;while(true){c=config.mask.charCodeAt(beg);if(c===95||isNaN(c))break;else beg++}}if(c===95){val=val.substring(0,beg)+cur+val.substring(beg+1);t.value=val;beg++;while(beg<config.mask.length){c=config.mask.charCodeAt(beg);if(c===95)break;else beg++}self.curpos(beg)}else self.curpos(beg+1);e.preventDefault();e.stopPropagation()}}});self.event('blur','input,'+cls2+'-value',function(){focused=false;self.camouflage(true);self.rclass(cls+'-focused')});self.event('click',cls2+'-control',function(){if(config.disabled||isdirvisible)return;if(config.type==='icon'){opt={};opt.element=self.element;opt.value=self.get();opt.empty=true;opt.callback=function(val){self.change(true);self.set(val);self.check();rawvalue.focus()};SETTER('faicons','show',opt);return}else if(config.type==='color'){opt={};opt.element=self.element;opt.value=self.get();opt.empty=true;opt.callback=function(al){self.change(true);self.set(al);self.check();rawvalue.focus()};SETTER('colorpicker','show',opt);return}else if(config.type==='emoji'){opt={};opt.element=self.element;opt.value=self.get();opt.empty=true;opt.callback=function(al){self.change(true);self.set(al);self.check();rawvalue.focus()};SETTER('emoji','show',opt);return}if(!config.dirsource)return;isdirvisible=true;setTimeout(function(){isdirvisible=false},500);var opt={};opt.element=self.find(cls2+'-control');opt.items=dirsource||GET(self.makepath(config.dirsource));opt.offsetY=-1+(config.diroffsety||0);opt.offsetX=0+(config.diroffsetx||0);opt.placeholder=config.dirplaceholder;opt.render=config.dirrender?GET(self.makepath(config.dirrender)):null;opt.custom=!!config.dircustom;opt.offsetWidth=2;opt.minwidth=config.dirminwidth||200;opt.maxwidth=config.dirmaxwidth;opt.key=config.dirkey||config.key;opt.empty=config.dirempty;if(config.dirraw)opt.raw=true;if(config.dirsearch!=null)opt.search=config.dirsearch;var val=self.get();opt.selected=val;if(dirsource&&config.direxclude==false){for(var i=0;i<dirsource.length;i++){var item=dirsource[i];if(item)item.selected=typeof(item)==='object'&&item[config.dirvalue]===val}}else if(config.direxclude){opt.exclude=function(item){return item?item[config.dirvalue]===val:false}}opt.callback=function(item,el,custom){if(item==null){rawvalue.html('');self.set(null,2);self.change();self.check();return}var val=custom||typeof(item)==='string'?item:item[config.dirvalue||config.value];if(custom&&typeof(config.dircustom)==='string'){var fn=GET(config.dircustom);fn(val,function(val){self.set(val,2);self.change();self.bindvalue()})}else if(custom){if(val){self.set(val,2);self.change();if(dirsource)self.bindvalue();else input.val(val)}}else{self.set(val,2);self.change();if(dirsource)self.bindvalue();else input.val(val)}rawvalue.focus()};SETTER('directory','show',opt)});self.event('click',cls2+'-placeholder,'+cls2+'-label',function(e){if(!config.disabled){if(config.dirsource){e.preventDefault();e.stopPropagation();self.find(cls2+'-control').trigger('click')}else if(!config.camouflage||$(e.target).hclass(cls+'-placeholder')){if(input.length)input.focus();else rawvalue.focus()}}});self.event('click',cls2+'-icon-left,'+cls2+'-icon-right',function(e){if(config.disabled)return;var el=$(this);var left=el.hclass(cls+'-icon-left');var opt;if(config.dirsource&&left&&config.liconclick){e.preventDefault();e.stopPropagation()}if(!left&&!config.riconclick){if(config.type==='date'){opt={};opt.element=self.element;opt.value=self.get();opt.callback=function(val){self.change(true);self.set(val)};SETTER('datepicker','show',opt)}else if(config.type==='time'){opt={};opt.element=self.element;opt.value=self.get();opt.callback=function(val){self.change(true);self.set(val)};SETTER('timepicker','show',opt)}else if(config.type==='search')self.set('');else if(config.type==='password')self.password();else if(config.type==='number'){var tmp=$(e.target);if(tmp.attr('class').indexOf('fa-')!==-1){var n=tmp.hclass('fa-caret-up')?1:-1;self.change(true);var val=self.preparevalue((self.get()||0)+(config.increment*n));self.set(val,2)}}return}if(left&&config.liconclick)EXEC(self.makepath(config.liconclick),self,el);else if(config.riconclick)EXEC(self.makepath(config.riconclick),self,el);else if(left&&config.type==='search')self.set('')})};self.camouflage=function(is){if(config.camouflage){if(is){var t=input[0],arr=t.value.split('');for(var i=0;i<arr.length;i++)arr[i]=typeof(config.camouflage)==='string'?config.camouflage:'*';nobindcamouflage=true;t.value=arr.join('')}else{nobindcamouflage=true;var val=self.get();input[0].value=val==null?'':val}self.tclass(cls+'-camouflaged',is)}};self.curpos=function(pos){var el=input[0];if(el.createTextRange){var range=el.createTextRange();range.move('character',pos);range.select()}else if(el.selectionStart){el.focus();el.setSelectionRange(pos,pos)}};self.validate=function(value){if((!config.required||config.disabled)&&!self.forcedvalidation())return true;if(config.disabled)return true;if(config.dirsource)return!!value;if(customvalidator)return customvalidator(value);if(self.type==='date')return value instanceof Date&&!isNaN(value.getTime());if(value==null)value='';else value=value.toString();if(config.mask&&typeof(value)==='string'&&value.indexOf('_')!==-1)return false;if(config.minlength&&value.length<config.minlength)return false;switch(self.type){case'email':return value.isEmail();case'phone':return value.isPhone();case'url':return value.isURL();case'zip':return(/^\d{5}(?:[-\s]\d{4})?$/).test(value);case'currency':case'number':value=value.parseFloat();if((config.minvalue!=null&&value<config.minvalue)||(config.maxvalue!=null&&value>config.maxvalue))return false;return config.minvalue==null?value>0:true}return value.length>0};self.offset=function(){var offset=self.element.offset();var control=self.find(cls2+'-control');var width=control.width()+2;return{left:offset.left,top:control.offset().top+control.height(),width:width}};self.password=function(show){var visible=show==null?input.attr('type')==='text':show;input.attr('type',visible?'password':'text');self.find(cls2+'-icon-right').find('i').tclass(config.ricon,visible).tclass('fa-eye-slash',!visible)};self.preparevalue=function(value){if(self.type==='number'&&(config.minvalue!=null||config.maxvalue!=null)){var tmp=typeof(value)==='string'?+value.replace(',','.'):value;if(config.minvalue>tmp)value=config.minvalue;if(config.maxvalue<tmp)value=config.maxvalue}return value};self.getterin=self.getter;self.getter=function(value,realtime,nobind){if(nobindcamouflage)return;if(config.mask&&config.masktidy){var val=[];for(var i=0;i<value.length;i++){if(config.mask.charAt(i)==='_')val.push(value.charAt(i))}value=val.join('')}self.getterin(self.preparevalue(value),realtime,nobind)};self.setterin=self.setter;self.setter=function(value,path,type){if(config.mask){if(value){if(config.masktidy){var index=0,val=[];for(var i=0;i<config.mask.length;i++){var c=config.mask.charAt(i);val.push(c==='_'?(value.charAt(index++)||'_'):c)}value=val.join('')}if(mask){var arr=[];for(var i=0;i<mask.length;i++){var c=value.charAt(i);if(mask[i]&&mask[i].test(c))arr.push(c);else arr.push(config.mask.charAt(i))}value=arr.join('')}}else value=config.mask}self.setterin(value,path,type);self.bindvalue();config.camouflage&&!focused&&setTimeout(self.camouflage,type==='show'?2000:1,true);if(config.type==='password')self.password(true)};self.check=function(){var is=false;if(config.dirsource)is=!!rawvalue.text();else is=input.length?!!input[0].value:!!self.get();if(binded===is)return;binded=is;placeholder&&placeholder.tclass('hidden',is);self.tclass(cls+'-binded',is);if(config.type==='search')self.find(cls2+'-icon-'+(config.searchalign===1?'right':'left')).find('i').tclass(config.searchalign===1?config.ricon:config.licon,!is).tclass('fa-times',is)};self.bindvalue=function(){var value=self.get();if(dirsource){var item;for(var i=0;i<dirsource.length;i++){item=dirsource[i];if(typeof(item)==='string'){if(item===value)break;item=null}else if(item[config.dirvalue||config.value]===value){item=item[config.dirkey||config.key];break}else item=null}if(value&&item==null&&config.dircustom)item=value;if(config.dirraw)rawvalue.html(item||'');else rawvalue.text(item||'')}else if(config.dirsource)if(config.dirraw)rawvalue.html(value||'');else rawvalue.text(value||'');else{switch(config.type){case'color':rawvalue.css('background-color',value||'');break;case'icon':rawvalue.html('<i class="{0}"></i>'.format(value||''));break;case'emoji':rawvalue.html(value);break}}self.check()};self.redraw=function(){if(!config.ricon){if(config.dirsource)config.ricon='angle-down';else if(config.type==='date'){config.ricon='calendar';if(!config.align&&!config.innerlabel)config.align=1}else if(config.type==='icon'||config.type==='color'||config.type==='emoji'){config.ricon='angle-down';if(!config.align&&!config.innerlabel)config.align=1}else if(config.type==='time'){config.ricon='clock-o';if(!config.align&&!config.innerlabel)config.align=1}else if(config.type==='search')if(config.searchalign===1)config.ricon='search';else config.licon='search';else if(config.type==='password')config.ricon='eye';else if(config.type==='number'){if(!config.align&&!config.innerlabel)config.align=1}}self.tclass(cls+'-masked',!!config.mask);self.rclass2(cls+'-type-');if(config.type)self.aclass(cls+'-type-'+config.type);self.html(W.ui_input_template(config));input=self.find('input');rawvalue=self.find(cls2+'-value');placeholder=self.find(cls2+'-placeholder')};self.configure=function(key,value){switch(key){case'icon':if(value&&value.indexOf(' ')===-1)config.icon='fa fa-'+value;break;case'dirsource':if(config.dirajax||value.indexOf('/')!==-1){dirsource=null;self.bindvalue()}else{if(value.indexOf(',')!==-1){dirsource=self.parsesource(value);self.bindvalue()}else{self.datasource(value,function(path,value){dirsource=value;self.bindvalue()})}}self.tclass(cls+'-dropdown',!!value);input.prop('readonly',!!config.disabled||!!config.dirsource);break;case'disabled':self.tclass('ui-disabled',!!value);input.prop('readonly',!!value||!!config.dirsource);self.reset();break;case'required':self.tclass(cls+'-required',!!value);self.reset();break;case'type':self.type=value;break;case'validate':customvalidator=value?(/\(|=|>|<|\+|-|\)/).test(value)?FN('value=>'+value):(function(path){path=self.makepath(path);return function(value){return GET(path)(value)}})(value):null;break;case'innerlabel':self.tclass(cls+'-inner',!!value);break;case'monospace':self.tclass(cls+'-monospace',!!value);break;case'maskregexp':if(value){mask=value.toLowerCase().split(',');for(var i=0;i<mask.length;i++){var m=mask[i];if(!m||m==='null')mask[i]='';else mask[i]=new RegExp(m)}}else mask=null;break;case'mask':config.mask=value.replace(/#/g,'_');break}};self.formatter(function(path,value){if(value){switch(config.type){case'lower':return(value+'').toLowerCase();case'upper':return(value+'').toUpperCase();case'phone':return(value+'').replace(/\s/g,'');case'email':return(value+'').toLowerCase();case'date':return value.format(config.format||DEF.dateformat||'yyyy-MM-dd');case'time':return value.format(config.format||'HH:mm');case'number':return config.format?value.format(config.format):value}}return value});self.parser(function(path,value){if(value){var tmp;switch(config.type){case'date':tmp=self.get();if(tmp)tmp=tmp.format('HH:mm');else tmp='';return value+(tmp?(' '+tmp):'');case'lower':case'email':value=value.toLowerCase();break;case'upper':value=value.toUpperCase();break;case'phone':value=value.replace(/\s/g,'');break;case'time':tmp=value.split(':');var dt=self.get();value=dt?new Date(dt.getTime()):new Date();value.setHours((tmp[0]||'0').parseInt());value.setMinutes((tmp[1]||'0').parseInt());value.setSeconds((tmp[2]||'0').parseInt());break}}return value?config.spaces===false?value.replace(/\s/g,''):value:value});self.state=function(type,what){if(type){if(type===1&&what===4){self.rclass(cls+'-ok '+cls+'-invalid');self.$oldstate=null;return}var invalid=config.required?self.isInvalid():self.forcedvalidation()?self.isInvalid():false;if(invalid!==self.$oldstate){self.$oldstate=invalid;self.tclass(cls+'-invalid',invalid);self.tclass(cls+'-ok',!invalid);config.error&&self.find(cls2+'-error').tclass('hidden',!invalid)}}};self.forcedvalidation=function(){if(!config.forcevalidation)return false;if(self.type==='number')return false;var val=self.get();return(self.type==='phone'||self.type==='email')&&(val!=null&&(typeof(val)==='string'&&val.length!==0))}});
// End: j-Input

// Component: j-Exec
// Version: 1
// Updated: 2021-01-07 13:02
COMPONENT('exec',function(self,config){var regparent=/\?\d/;self.readonly();self.blind();self.make=function(){var scope=null,scopepath=function(el,val){if(!scope)scope=el.scope();return val==null?scope:scope?scope.makepath?scope.makepath(val):val.replace(/\?/g,el.scope().path):val};var fn=function(plus){return function(e){var el=$(this);var attr=el.attrd('exec'+plus);var path=el.attrd('path'+plus);var href=el.attrd('href'+plus);var def=el.attrd('def'+plus);var reset=el.attrd('reset'+plus);scope=null;var prevent=el.attrd('prevent'+plus);if(prevent==='true'||prevent==='1'){e.preventDefault();e.stopPropagation()}if(attr){if(attr.indexOf('?')!==-1){var tmp=scopepath(el);if(tmp){var isparent=regparent.test(attr);attr=tmp.makepath?tmp.makepath(attr):attr.replace(/\?/g,tmp.path);if(isparent&&attr.indexOf('/')!==-1)M.scope(attr.split('/')[0]);else M.scope(tmp.path)}}EXEC(attr,el,e)}href&&NAV.redirect(href);if(def){if(def.indexOf('?')!==-1)def=scopepath(el,def);DEFAULT(def)}if(reset){if(reset.indexOf('?')!==-1)reset=scopepath(el,reset);RESET(reset)}if(path){var val=el.attrd('value');if(val){if(path.indexOf('?')!==-1)path=scopepath(el,path);var v=GET(path);SET(path,new Function('value','return '+val)(v),true)}}}};self.event('dblclick',config.selector2||'.exec2',fn('2'));self.event('click',config.selector||'.exec',fn(''))}});
// End: j-Exec

// Component: j-ViewBox
// Version: 1
// Updated: 2021-05-12 11:38
COMPONENT('viewbox','margin:0;scroll:true;delay:100;scrollbar:0;visibleY:1;height:100;invisible:1',function(self,config,cls){var eld,elb,scrollbar,cls2='.'+cls,init=false,cache,scrolltoforce;self.readonly();self.init=function(){var resize=function(){for(var i=0;i<M.components.length;i++){var com=M.components[i];if(com.name==='viewbox'&&com.dom.offsetParent&&com.$ready&&!com.$removed)com.resizeforce()}};ON('resize2',function(){setTimeout2('viewboxresize',resize,200)})};self.destroy=function(){scrollbar&&scrollbar.destroy()};self.configure=function(key,value,init){switch(key){case'disabled':eld.tclass('hidden',!value);break;case'minheight':case'margin':case'marginxs':case'marginsm':case'marginmd':case'marginlg':!init&&self.resizeforce();break;case'selector':config.parent=value;self.resize();break}};self.scrollbottom=function(val){if(val==null)return elb[0].scrollTop;elb[0].scrollTop=(elb[0].scrollHeight-self.dom.clientHeight)-(val||0);return elb[0].scrollTop};self.scrolltop=function(val){if(val==null)return elb[0].scrollTop;elb[0].scrollTop=(val||0);return elb[0].scrollTop};self.make=function(){config.invisible&&self.aclass('invisible');config.scroll&&MAIN.version>17&&self.element.wrapInner('<div class="'+cls+'-body"></div>');self.element.prepend('<div class="'+cls+'-disabled hidden"></div>');eld=self.find('> .{0}-disabled'.format(cls)).eq(0);elb=self.find('> .{0}-body'.format(cls)).eq(0);self.aclass('{0} {0}-hidden'.format(cls));if(config.scroll){if(config.scrollbar){if(MAIN.version>17){scrollbar=W.SCROLLBAR(self.find(cls2+'-body'),{shadow:config.scrollbarshadow,visibleY:config.visibleY,visibleX:config.visibleX,orientation:config.visibleX?null:'y',parent:self.element});self.scrolltop=scrollbar.scrollTop;self.scrollbottom=scrollbar.scrollBottom}else self.aclass(cls+'-scroll')}else{self.aclass(cls+'-scroll');self.find(cls2+'-body').aclass('noscrollbar')}}self.resize()};self.released=function(is){!is&&self.resize()};var css={};self.resize=function(){setTimeout2(self.ID,self.resizeforce,200)};self.resizeforce=function(){var el=self.parent(config.parent);var h=el.height();var w=el.width();var width=WIDTH();var mywidth=self.element.width();var key=width+'x'+mywidth+'x'+w+'x'+h+'x'+config.margin;if(cache===key){scrollbar&&scrollbar.resize();if(scrolltoforce){if(scrolltoforce==='bottom')self.scrollbottom(0);else self.scrolltop(0);scrolltoforce=null}return}cache=key;var margin=config.margin,responsivemargin=config['margin'+width];if(responsivemargin!=null)margin=responsivemargin;if(margin==='auto')margin=self.element.offset().top;if(h===0||w===0){self.$waiting&&clearTimeout(self.$waiting);self.$waiting=setTimeout(self.resize,234);return}h=((h/100)*config.height)-margin;if(config.minheight&&h<config.minheight)h=config.minheight;css.height=h;css.width=mywidth;eld.css(css);css.width='';self.css(css);elb.length&&elb.css(css);self.element.SETTER('*','resize');var c=cls+'-hidden';self.hclass(c)&&self.rclass(c,100);scrollbar&&scrollbar.resize();if(scrolltoforce){if(scrolltoforce==='bottom')self.scrollbottom(0);else self.scrolltop(0);scrolltoforce=null}if(!init){self.rclass('invisible',250);init=true}};self.resizescrollbar=function(){scrollbar&&scrollbar.resize()};self.setter=function(){scrolltoforce=config.scrollto||config.scrolltop;if(scrolltoforce){if(scrolltoforce==='bottom')self.scrollbottom(0);else self.scrolltop(0);scrolltoforce=null}setTimeout(self.resize,config.delay,scrolltoforce)}});
// End: j-ViewBox

// Component: Tangular-FileSize
// Version: 1
// Updated: 2018-11-03 22:40
Thelpers.filesize=function(value,decimals,type){return value?value.filesize(decimals,type):'...'};Number.prototype.filesize=function(decimals,type){if(typeof(decimals)==='string'){var tmp=type;type=decimals;decimals=tmp}var value,t=this;switch(type){case'bytes':value=t;break;case'KB':value=t/1024;break;case'MB':value=filesizehelper(t,2);break;case'GB':value=filesizehelper(t,3);break;case'TB':value=filesizehelper(t,4);break;default:type='bytes';value=t;if(value>1023){value=value/1024;type='KB'}if(value>1023){value=value/1024;type='MB'}if(value>1023){value=value/1024;type='GB'}if(value>1023){value=value/1024;type='TB'}break}type=' '+type;return(decimals===undefined?value.format(2).replace('.00',''):value.format(decimals))+type};function filesizehelper(number,count){while(count--){number=number/1024;if(number.toFixed(3)==='0.000')return 0}return number}
// End: Tangular-FileSize

// Component: j-Validation
// Version: 1
// Updated: 2021-03-16 21:25
COMPONENT('validation','delay:100;flags:visible',function(self,config,cls){var elements=null,def='button[name="submit"]',flags=null,tracked=false,reset=0,old,track;self.readonly();self.make=function(){elements=self.find(config.selector||def)};self.configure=function(key,value,init){switch(key){case'selector':if(!init)elements=self.find(value||def);break;case'flags':if(value){flags=value.split(',');for(var i=0;i<flags.length;i++)flags[i]='@'+flags[i]}else flags=null;break;case'track':track=value.split(',').trim();break}};var settracked=function(){tracked=0};self.setter=function(value,path,type){var is=path===self.path||path.length<self.path.length;if(reset!==is){reset=is;self.tclass(cls+'-modified',!reset)}if((type===1||type===2)&&track&&track.length){for(var i=0;i<track.length;i++){if(path.indexOf(track[i])!==-1){tracked=1;return}}if(tracked===1){tracked=2;setTimeout(settracked,config.delay*3)}}};var check=function(){var path=self.path.replace(/\.\*$/,'');var disabled=tracked||config.validonly?!VALID(path,flags):DISABLED(path,flags);if(!disabled&&config.if)disabled=!EVALUATE(path,config.if);if(disabled!==old){elements.prop('disabled',disabled);self.tclass(cls+'-ok',!disabled);self.tclass(cls+'-no',disabled);old=disabled}};self.state=function(type,what){if(type===3||what===3){self.rclass(cls+'-modified');tracked=0}setTimeout2(self.ID,check,config.delay)}});
// End: j-Validation

// Component: j-Sounds
// Version: 1
// Updated: 2020-03-11 14:55
COMPONENT('sounds','url:https://cdn.componentator.com/sounds/',function(self,config){var volume=0,can=false;self.items=[];self.readonly();self.singleton();self.nocompile&&self.nocompile();self.make=function(){var audio=document.createElement('audio');if(audio.canPlayType&&audio.canPlayType('audio/mpeg').replace(/no/,''))can=true};self.setter=function(value){volume=value||0};self.play=function(type){self.playurl(config.url+type+'.mp3')};self.success=function(){self.play('success')};self.error=self.fail=function(){self.play('fail')};self.message=function(){self.play('message')};self.notify=self.notifications=function(){self.play('notifications')};self.badge=self.badges=function(){self.play('badges')};self.confirm=function(){self.play('confirm')};self.beep=function(){self.play('beep')};self.drum=function(){self.play('drum')};self.warning=function(){self.play('warning')};self.alert=function(){self.play('alert')};self.playurl=function(url){if(!can||!volume)return;var audio=new W.Audio();audio.src=url;audio.volume=volume;audio.play();audio.onended=function(){audio.$destroy=true;self.cleaner()};audio.onerror=function(){audio.$destroy=true;self.cleaner()};audio.onabort=function(){audio.$destroy=true;self.cleaner()};self.items.push(audio);return self};self.cleaner=function(){var index=0;while(true){var item=self.items[index++];if(item===undefined)return self;if(!item.$destroy)continue;item.pause();item.onended=null;item.onerror=null;item.onsuspend=null;item.onabort=null;item=null;index--;self.items.splice(index,1)}};self.stop=function(url){if(!url){for(var i=0;i<self.items.length;i++)self.items[i].$destroy=true;return self.cleaner()}var index=self.items.findIndex('src',url);if(index===-1)return self;self.items[index].$destroy=true;return self.cleaner()};self.setter=function(value){if(value===undefined)value=0.5;else value=(value/100);if(value>1)value=1;else if(value<0)value=0;volume=value?+value:0;for(var i=0,length=self.items.length;i<length;i++){var a=self.items[i];if(!a.$destroy)a.volume=value}}});
// End: j-Sounds