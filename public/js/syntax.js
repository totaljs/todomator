CodeMirror.defineMode('todo', function() {

	var REG_NUMBER = /\[[0-9\.\,]+(\s[A-Z]{3})?\]?/i;
	var REG_MINUTES = /\[\d+\s(minutes|minute|min|m|hours|hour|h|hod)\]?/i;
	var REG_ESTIMATE = /\{\d+\s(minutes|minute|hours|hour|h|hod)\}?/i;
	var REG_ESTIMATE2 = /\{\d+(\s)(minutes|minute|hours|hour|h|hod)?(.)?\}?/i;
	var REG_KEYWORD = /@(working|canceled|done|priority|important|postponed|date)(\(.*?\))?/i;
	var REG_LINK = /(https|http):\/\/.*?\.[^\s]{2,}/i;
	var REG_SPECIAL = /(^|\s)`.*?`/;
	var REG_BOLD = /\*.*?\*/;
	var REG_SECRET = /\*\*.*?\*\*/;
	var REG_HIGH = /_{1,}.*?_{1,}/;
	var REG_STRIKE = /~.*?~/;
	var REG_USER = /<.*?>/;
	var REG_HEADER_SUB = /[^-].*?:(\s)?$/;
	var REG_HEADER = /^@\s.*?$/;
	var REG_TAG = /#[a-z0-9]+/;
	var REG_UTF8 = new RegExp('(' + String.fromCharCode(9989) + '|' + String.fromCharCode(10060) + ')', 'g');

	function remove(line, editor) {
		setTimeout(function(line, editor) {
			editor.removeLineClass(line, 'text', 'cm-header-bg');
		}, 5, line, editor);
	}

	return {

		startState: function() {
			return { type: 0, keyword: 0 };
		},

		token: function(stream, state) {

			var style = [];
			var m;
			var ora = stream.lineOracle;

			if (stream.sol()) {

				state.next = '';

				var line = stream.string;
				var c = line.charCodeAt(0);
				var trimmed = line.trim();

				if (trimmed.substring(0, 3) === '```') {
					state.code = trimmed.length > 4;
					stream.skipToEnd();
					return 'syntax';
				}

				if (state.code) {
					stream.skipToEnd();
					return 'syntax';
				}

				if (c > 34 && line.match(REG_HEADER) && line.length > 3) {
					state.type = 0;
					state.keyword = false;
					stream.skipToEnd();
					setTimeout(function(line, editor) {
						editor.addLineClass(line, 'text', 'cm-header-bg');
					}, 5, ora.line, ora.doc.getEditor());
					return 'header';
				} else if (trimmed && trimmed.substring(0, 2) === '# ') {
					state.type = 0;
					state.keyword = false;
					stream.skipToEnd();
					return 'caption';
				} else if (trimmed && trimmed.charCodeAt(0) > 45 && line.match(REG_HEADER_SUB)) {
					state.type = 0;
					state.keyword = false;
					stream.skipToEnd();
					remove(ora.line, ora.doc.getEditor());
					return 'headersub';
				}

				if (line.match(/^(\s)*=.*?$/)) {
					if (line.substring(0, 1) === '=') {
						stream.skipToEnd();
						return 'sum';
					}
					state.type = 99;
					state.next = stream.next();
					return '';
				}

				if (trimmed.substring(0, 3) === '// ') {
					stream.skipToEnd();
					return 'comment';
				}

				if (line.match(/^-{3,}$/g)) {
					// line
					stream.skipToEnd();
					return 'line';
				}

				if (line.match(/^(\s)*\+/)) {
					state.type = 98;
					state.next = stream.next();
					return find_style(state.type);
				}

				if (line.match(/^(\s)*-/)) {
					state.type = 1;

					if (line.indexOf('@done') !== -1)
						state.type = 2;
					if (line.indexOf('@canceled') !== -1)
						state.type = 3;
					if (line.indexOf('@working') !== -1)
						state.type = 4;
					if (line.indexOf('@postponed') !== -1)
						state.type = 7;
					if (state.type === 1 && (line.indexOf('@priority') !== -1 || line.indexOf('@important') !== -1))
						state.type = 6;
					else if (state.type === 1 && line.indexOf('@high') !== -1)
						state.type = 5;

					state.next = stream.next();
					return find_style(state.type);
				}

				state.type = 0;
			}

			if (state.type === 100) {
				state.type = 0;
				return stream.match(/=.*?$/, true) ? 'sum' : '';
			}

			if (state.type === 99) {
				stream.eatSpace();
				state.type = 100;
				return 'summarize';
			}

			m = stream.match(REG_UTF8, true);
			if (m) {
				style.push(find_style(state.type));
				style.push('utf8');
				return style.join(' ');
			}

			if (state.type) {
				m = stream.match(REG_KEYWORD, true);
				if (m) {
					var a = m.toString().toLowerCase();
					style.push(find_style(state.type));
					if (a.indexOf('@done') !== -1) {
						state.keyword = 1;
						style.push('completed');
					} else if (a.indexOf('@canceled') !== -1) {
						state.keyword = 2;
						style.push('canceled');
					} else if (a.indexOf('@postponed') !== -1) {
						state.keyword = 7;
						style.push('postponed');
					} else if (a.indexOf('@working') !== -1) {
						state.keyword = 3;
						style.push('working');
					} else if (a.indexOf('@priority') !== -1 || a.indexOf('@important') !== -1) {
						state.keyword = 4;
						style.push('priority');
					} else if (a.indexOf('@high') !== -1) {
						state.keyword = 5;
						style.push('high');
					} else if (a.indexOf('@date') !== -1) {
						state.keyword = 6;
						if (a.indexOf('(') !== -1) {
							style.push('date');
							if (state.type !== 2 && state.type !== 3) {
								if (m[2]) {
									var date = +m[2].replace(/\(|\)/g, '').parseDate().format('yyyyMMdd');
									if (date < (+NOW.format('yyyyMMdd')))
										style.push('date-expired');
									else if (date === (+NOW.format('yyyyMMdd')))
										style.push('date-today-expire');
									else if (date === (+NOW.add('1 day').format('yyyyMMdd')))
										style.push('date-tomorrow-expire');
									else if (date === (+NOW.add('2 day').format('yyyyMMdd')))
										style.push('date-soon-expire');
								}
							}
						}
					}
					return style.join(' ');
				}

				m = stream.match(REG_MINUTES, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('minutes');
					return style.join(' ');
				}

				//var regnumber = common.document && common.document.currencyid ? new RegExp('\\[[0-9\\.\\,\\s]+(' + common.document.currencyid + ')?\\]', 'i') : REG_NUMBER;

				m = stream.match(REG_NUMBER, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('price');
					return style.join(' ');
				}

				m = stream.match(REG_TAG, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('tag');
					return style.join(' ');
				}

				m = stream.match(REG_USER, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('user');
					style.push('u' + HASH(m[0].substring(1, m[0].length - 1)));
					return style.join(' ');
				}

				m = stream.match(REG_LINK, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('link');
					return style.join(' ');
				}

			}

			if (!state.next || state.next === ' ' || state.next === '\t') {

				m = stream.match(REG_ESTIMATE2);

				if (m) {
					m = stream.match(REG_ESTIMATE, true);
					style.push(find_style(state.type));
					style.push('estimate');
					return style.join(' ');
				}

				m = stream.match(REG_SPECIAL, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('special');
					return style.join(' ');
				}

				m = stream.match(REG_SECRET, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('secret');
					return style.join(' ');
				}

				m = stream.match(REG_STRIKE, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('strike');
					return style.join(' ');
				}

				m = stream.match(REG_BOLD, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('bold');
					return style.join(' ');
				}

				m = stream.match(REG_HIGH, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('high');
					return style.join(' ');
				}
			}

			if (stream.eol()) {
				state.next = '';
				state.type = 0;
				state.keyword = 0;
			}

			remove(ora.line, ora.doc.getEditor());
			state.next = stream.next();
			return find_style(state.type);
		}
	};
});

function find_style(type) {
	if (type === 1)
		return 'code';
	if (type === 98)
		return 'plus';
	if (type === 2)
		return 'strong quote';
	if (type === 3 || type === 7)
		return 'strong error';
	if (type === 4)
		return 'strong attribute';
	if (type === 5)
		return 'high';
	if (type === 6)
		return 'highpriority';
	return 'notes';
}

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {
	var listRE = /^(\s*)(>[> ]*|[*+-]\s|(\d+)([.)]))(\s*)/;
	var emptyListRE = /^(\s*)(>[> ]*|[*+-]|(\d+)[.)])(\s*)$/;
	var unorderedListRE = /[*+-]\s/;
	CodeMirror.commands.newlineAndIndentContinue = function(cm) {

		if (cm.getOption('disableInput'))
			return CodeMirror.Pass;

		var ranges = cm.listSelections(), replacements = [];
		for (var i = 0; i < ranges.length; i++) {
			var pos = ranges[i].head;
			var eolState = cm.getStateAfter(pos.line);
			var inList = eolState.list !== false;
			var inQuote = eolState.quote !== 0;
			var line = cm.getLine(pos.line), match = listRE.exec(line);

			if (!ranges[i].empty() || (!inList && !inQuote) || !match) {
				cm.execCommand('newlineAndIndent');
				return;
			}

			if (emptyListRE.test(line)) {
				cm.replaceRange('', { line: pos.line, ch: 0 }, { line: pos.line, ch: pos.ch + 1 });
				replacements[i] = '\n';
			} else {
				var indent = match[1], after = match[5];
				var bullet = unorderedListRE.test(match[2]) || match[2].indexOf('>') >= 0 ? match[2] : (parseInt(match[3], 10) + 1) + match[4];
				replacements[i] = '\n' + indent + bullet + after;
			}
		}
		cm.replaceSelections(replacements);
	};
});

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE
(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	CodeMirror.defineOption('rulers', false, function(cm, val) {
		if (cm.state.rulerDiv) {
			cm.state.rulerDiv.parentElement.removeChild(cm.state.rulerDiv);
			cm.state.rulerDiv = null;
			cm.off('refresh', drawRulers);
		}

		if (val && val.length) {
			cm.state.rulerDiv = cm.display.lineSpace.parentElement.insertBefore(document.createElement('div'), cm.display.lineSpace);
			cm.state.rulerDiv.className = 'CodeMirror-rulers';
			drawRulers(cm);
			cm.on('refresh', drawRulers);
		}
	});

	function drawRulers(cm) {
		cm.state.rulerDiv.textContent = '';
		var val = cm.getOption('rulers');
		var cw = cm.defaultCharWidth();
		var left = cm.charCoords(CodeMirror.Pos(cm.firstLine(), 0), 'div').left;
		cm.state.rulerDiv.style.minHeight = (cm.display.scroller.offsetHeight + 30) + 'px';
		for (var i = 0; i < val.length; i++) {
			var elt = document.createElement('div');
			elt.className = 'CodeMirror-ruler';
			var col, conf = val[i];
			if (typeof(conf) == 'number') {
				col = conf;
			} else {
				col = conf.column;
				if (conf.className) elt.className += ' ' + conf.className;
				if (conf.color) elt.style.borderColor = conf.color;
				if (conf.lineStyle) elt.style.borderLeftStyle = conf.lineStyle;
				if (conf.width) elt.style.borderLeftWidth = conf.width;
			}
			elt.style.left = (left + col * cw) + 'px';
			cm.state.rulerDiv.appendChild(elt);
		}
	}
});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	function Bar(cls, orientation, scroll) {
		var self = this;
		self.orientation = orientation;
		self.scroll = scroll;
		self.screen = self.total = self.size = 1;
		self.pos = 0;

		self.node = document.createElement('div');
		self.node.className = cls + '-' + orientation;
		self.inner = self.node.appendChild(document.createElement('div'));

		CodeMirror.on(self.inner, 'mousedown', function(e) {

			if (e.which != 1)
				return;

			CodeMirror.e_preventDefault(e);
			var axis = self.orientation == 'horizontal' ? 'pageX' : 'pageY';
			var start = e[axis], startpos = self.pos;

			function done() {
				CodeMirror.off(document, 'mousemove', move);
				CodeMirror.off(document, 'mouseup', done);
			}

			function move(e) {
				if (e.which != 1)
					return done();
				self.moveTo(startpos + (e[axis] - start) * (self.total / self.size));
			}

			CodeMirror.on(document, 'mousemove', move);
			CodeMirror.on(document, 'mouseup', done);
		});

		CodeMirror.on(self.node, 'click', function(e) {
			CodeMirror.e_preventDefault(e);
			var innerBox = self.inner.getBoundingClientRect(), where;
			if (self.orientation == 'horizontal')
				where = e.clientX < innerBox.left ? -1 : e.clientX > innerBox.right ? 1 : 0;
			else
				where = e.clientY < innerBox.top ? -1 : e.clientY > innerBox.bottom ? 1 : 0;
			self.moveTo(self.pos + where * self.screen);
		});

		function onWheel(e) {
			var moved = CodeMirror.wheelEventPixels(e)[self.orientation == 'horizontal' ? 'x' : 'y'];
			var oldPos = self.pos;
			self.moveTo(self.pos + moved);
			if (self.pos != oldPos) CodeMirror.e_preventDefault(e);
		}
		CodeMirror.on(self.node, 'mousewheel', onWheel);
		CodeMirror.on(self.node, 'DOMMouseScroll', onWheel);
	}

	Bar.prototype.setPos = function(pos, force) {
		var t = this;
		if (pos < 0)
			pos = 0;
		if (pos > t.total - t.screen)
			pos = t.total - t.screen;
		if (!force && pos == t.pos)
			return false;
		t.pos = pos;
		t.inner.style[t.orientation == 'horizontal' ? 'left' : 'top'] = (pos * (t.size / t.total)) + 'px';
		return true;
	};

	Bar.prototype.moveTo = function(pos) {
		var t = this;
		t.setPos(pos) && t.scroll(pos, t.orientation);
	};

	var minButtonSize = 10;

	Bar.prototype.update = function(scrollSize, clientSize, barSize) {
		var t = this;
		var sizeChanged = t.screen != clientSize || t.total != scrollSize || t.size != barSize;

		if (sizeChanged) {
			t.screen = clientSize;
			t.total = scrollSize;
			t.size = barSize;
		}

		var buttonSize = t.screen * (t.size / t.total);
		if (buttonSize < minButtonSize) {
			t.size -= minButtonSize - buttonSize;
			buttonSize = minButtonSize;
		}

		t.inner.style[t.orientation == 'horizontal' ? 'width' : 'height'] = buttonSize + 'px';
		t.setPos(t.pos, sizeChanged);
	};

	function SimpleScrollbars(cls, place, scroll) {
		var t = this;
		t.addClass = cls;
		t.horiz = new Bar(cls, 'horizontal', scroll);
		place(t.horiz.node);
		t.vert = new Bar(cls, 'vertical', scroll);
		place(t.vert.node);
		t.width = null;
	}

	SimpleScrollbars.prototype.update = function(measure) {
		var t = this;
		if (t.width == null) {
			var style = window.getComputedStyle ? window.getComputedStyle(t.horiz.node) : t.horiz.node.currentStyle;
			if (style)
				t.width = parseInt(style.height);
		}

		var width = t.width || 0;
		var needsH = measure.scrollWidth > measure.clientWidth + 1;
		var needsV = measure.scrollHeight > measure.clientHeight + 1;

		t.vert.node.style.display = needsV ? 'block' : 'none';
		t.horiz.node.style.display = needsH ? 'block' : 'none';

		if (needsV) {
			t.vert.update(measure.scrollHeight, measure.clientHeight, measure.viewHeight - (needsH ? width : 0));
			t.vert.node.style.bottom = needsH ? width + 'px' : '0';
		}

		if (needsH) {
			t.horiz.update(measure.scrollWidth, measure.clientWidth, measure.viewWidth - (needsV ? width : 0) - measure.barLeft);
			t.horiz.node.style.right = needsV ? width + 'px' : '0';
			t.horiz.node.style.left = measure.barLeft + 'px';
		}

		return {right: needsV ? width : 0, bottom: needsH ? width : 0};
	};

	SimpleScrollbars.prototype.setScrollTop = function(pos) {
		this.vert.setPos(pos);
	};

	SimpleScrollbars.prototype.setScrollLeft = function(pos) {
		this.horiz.setPos(pos);
	};

	SimpleScrollbars.prototype.clear = function() {
		var parent = this.horiz.node.parentNode;
		parent.removeChild(this.horiz.node);
		parent.removeChild(this.vert.node);
	};

	CodeMirror.scrollbarModel.simple = function(place, scroll) {
		return new SimpleScrollbars('CodeMirror-simplescroll', place, scroll);
	};
	CodeMirror.scrollbarModel.overlay = function(place, scroll) {
		return new SimpleScrollbars('CodeMirror-overlayscroll', place, scroll);
	};
});