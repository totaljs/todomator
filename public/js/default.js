Thelpers.markdown2 = function(val) {

	var opt = {};
	var allowed = ['.', ',', ' ', ':', '(', ')'];
	var users = /[a-zA-Z]+/;
	var tasks = /[a-zA-Z0-9]+/;

	opt.html = function(line) {

		var index = 0;

		while (true) {

			index = line.indexOf('@', index);
			if (index === -1)
				break;

			var first = line.substring(index - 1, index);
			if (first && !allowed.includes(first)) {
				index++;
				continue;
			}

			// check other characters
			for (var i = index + 1; i < (index + 30); i++) {
				var c = line.charAt(i);
				if (!c || !users.test(c))
					break;
			}

			var name = line.substring(index, i);
			var pos = index;

			for (var m of DEF.cl.user) {
				if (m.search.indexOf(name.trim().substring(1).toSearch()) !== -1) {
					var tmp = '<span class="user">' + (m.photo ? '<img src="{0}" loading="lazy" />'.format(m.photo) : '') + m.name + '</span>';
					line = line.substring(0, pos) + tmp + line.substring(name.length + pos);
					index += tmp.length;
					break;
				}
			}
		}

		while (true) {

			index = line.indexOf('#', index);
			if (index === -1)
				break;

			var first = line.substring(index - 1, index);
			if (first && !allowed.includes(first)) {
				index++;
				continue;
			}

			// check other characters
			for (var i = index + 1; i < (index + 30); i++) {
				var c = line.charAt(i);
				if (!c || !tasks.test(c))
					break;
			}

			var name = line.substring(index, i);
			var pos = index;

			if (name.length > 10 && name.length < 14) {
				var tmp = '<span class="markdown-link" data-id="{0}"></span>'.format(name.substring(1));
				line = line.substring(0, pos) + tmp + line.substring(name.length + pos);
			}

			index += tmp.length;
		}

		return line;
	};

	setTimeout(function() {

		var links = $('.markdown-link');
		var arr = [];

		for (var link of links)
			arr.push(ATTRD(link));

		if (arr.length) {
			TAPI(QUERIFY('tickets_find', { id: arr.join(',') }), function(response) {
				for (var link of links) {
					var id = ATTRD(link);
					var item = response.findItem('id', id);
					var el = $(link);
					if (item) {
						item.icon = item.statusid === 'closed' ? 'ti-check-square' : 'ti ti-square';
						el.replaceWith('<a href="#{id}" class="markdown-task"><i class="ti {{ icon }}"></i>{name}</a>'.args(item));
					} else
						el.replaceWith('#' + id);
				}
			});
		}

	}, 10);

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

	// opt.format {Function}
	// opt.bold {Function}
	// opt.italic {Function}
	// opt.underline {Function}
	// opt.link {Function}
	// opt.multiline {Number} 1: enter, 2: shift + enter
	// opt.callback {Function}
	// opt.html {String}
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

	if (opt.format) {
		if (opt.link == null) {
			opt.link = function() {

				var sel = self.getSelection().trim();
				if (!sel)
					return;

				var el = openeditor.element;
				var url = '#link' + Date.now().toString(36);
				var mtd = el[0];

				for (var i = 0; i < 5; i++) {
					if (mtd.tagName === 'A')
						return;
					mtd = mtd.parentNode;
					if (!mtd)
						break;
				}

				document.execCommand('CreateLink', false, url);

				var tmp = el.find('a[href="' + url + '"]');
				if (!tmp.length)
					return;

				var content = tmp.text();
				var link = {};
				link.element = tmp;
				link.href = '';
				tmp.aclass('elink');

				openeditor && openeditor.close();

				if (content.indexOf('@') !== -1)
					link.href = 'mailto:' + content;
				else if ((/^[0-9\s+-]+$/).test(content))
					link.href = 'tel:' + content;
				else if (content.indexOf(' ') === -1 && content.indexOf(',') === -1 && content.indexOf('.') !== -1)
					link.href = (/http(s):\/\//).test(content) ? content : ('https://' + content);

				link.target = link.href.indexOf('.') !== -1 && link.href.indexOf(location.hostname) === -1 ? '_blank' : '';
				link.href && tmp.attr('href', link.href);
				link.target && tmp.attr('target', link.target);
				link.widget = self;
			};
		}

		if (opt.bold == null) {
			opt.bold = function() {
				document.execCommand('Bold', false, null);
			};
		}

		if (opt.code == null) {
			opt.code = function() {
				var url = '#code' + Date.now().toString(36);
				document.execCommand('CreateLink', false, url);
				var a = openeditor.element.find('a[href="{0}"]'.format(url));
				a.replaceWith('<span class="ecode">' + a.html() + '</span>');
			};
		}

		if (opt.italic == null) {
			opt.italic = function() {
				document.execCommand('Italic', false, null);
			};
		}

		if (opt.underline == null) {
			opt.underline = function() {
				document.execCommand('Underline', false, null);
			};
		}

		if (opt.icon == null) {
			opt.icon = function() {

				// Total.js icon
				var tag = openeditor.element[0].nodeName.toLowerCase();
				var icon = '<i class="ti ti-flag eicon" contenteditable="false"></i>';

				switch (tag) {
					case 'span':
						$(openeditor.element).parent().prepend(icon);
						break;
					default:
						document.execCommand('insertHTML', false, icon);
						break;
				}
			};
		}
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

	openeditor.caret = function(pos) {

		if (pos == null) {
			var sel = document.getSelection();
			sel.modify('extend', 'backward', 'paragraphboundary');
			pos = sel.toString().length;
			if(sel.anchorNode != undefined)
				sel.collapseToEnd();
			return pos;
		}

		if (typeof(pos) === 'string')
			pos = openeditor.caret() + (+pos);

		var selection = W.getSelection();
		var range = opt.editor.createrange(pos);
		if (range) {
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	};

	openeditor.createrange = function(count, range, node) {

		var chars = count;

		if (typeof(chars) === 'number')
			chars = { count: count };

		if (!node)
			node = openeditor.element[0];

		if (!range) {
			range = document.createRange();
			range.selectNode(node);
			range.setStart(node, 0);
		}

		if (chars.count === 0) {
			range.setEnd(node, chars.count);
		} else if (node && chars.count > 0) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (node.textContent.length < chars.count) {
					chars.count -= node.textContent.length;
				} else {
					range.setEnd(node, chars.count);
					chars.count = 0;
				}
			} else {
				for (var lp = 0; lp < node.childNodes.length; lp++) {
					range = openeditor.createrange(chars, range, node.childNodes[lp]);
					if (chars.count === 0)
						break;
				}
			}
		}

		return range;
	};

	opt.editor = openeditor;

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

			var ismeta = e.shiftKey || e.metaKey;

			if (!opt.multiline || ((opt.multiline == true || opt.multiline === 1) && ismeta) || (opt.multiline === 2 && !ismeta)) {
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
			opt.format && opt.bold && opt.bold();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 77) {
			// code
			opt.format && opt.code && opt.code();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 76) {
			// link
			opt.format && opt.link && opt.link();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 73) {
			// italic
			opt.format && opt.italic && opt.italic();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 80) {
			opt.icon && opt.icon();
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		if (e.keyCode === 85) {
			// underline
			opt.format && opt.underline && opt.underline();
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

	openeditor.selected = function() {
		return W.getSelection().toString();
	};

	openeditor.find = function(text, callback, el) {

		var NODE_TYPE_TEXT = 3;
		var tree = {};

		if (!el)
			el = openeditor.element[0];

		var browse = function(element, obj) {
			var nodes = element.childNodes;
			if (nodes != null && nodes.length) {
				obj[element.nodeName] = [];
				for (var node of nodes) {
					if (node.nodeType == NODE_TYPE_TEXT) {
						var p = node.nodeValue.indexOf(text);
						if (p != -1) {
							var sel = W.getSelection();
							var range = sel.getRangeAt(0);
							range.setStart(node, p);
							range.setEnd(node, p + text.length);
							callback && callback(range);
							return;
						}
					} else {
						obj[element.nodeName].push({});
						browse(node, obj[element.nodeName][obj[element.nodeName].length - 1]);
					}
				}
			} else if (callback)
				callback();
		};
		browse(el, tree);
	};

	openeditor.replace = function(callback, noselect) {

		var sel = W.getSelection();
		if (sel.rangeCount) {

			var html = sel.toString();
			html = callback(html);

			if (html === sel)
				return;

			range = sel.getRangeAt(0);
			range.deleteContents();

			var div = document.createElement('div');
			var frag = document.createDocumentFragment();
			var node = null;
			var last = null;

			div.innerHTML = html;

			while ((node = div.firstChild))
				last = frag.appendChild(node);

			range.insertNode(frag);

			if (last) {
				range = range.cloneRange();
				range.setStartAfter(last);
				range.collapse(true);
				noselect && sel.removeAllRanges();
				sel.addRange(range);
			}

			openeditor.checkplaceholder();
		}
	};

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

	var placeholder = opt.placeholder;
	var placeholderprev = false;

	openeditor.checkplaceholder = function() {
		if (placeholder) {
			var is = el[0].innerHTML.length > 0;
			if (placeholderprev !== is) {
				placeholderprev = is;
				placeholder.classList.toggle('hidden', is);
			}
		}
	};

	opt.placeholder && placeholder && el.on('input', openeditor.checkplaceholder);
	el.on('paste', paste);
}