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