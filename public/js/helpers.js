FUNC.invertcolor = function(hex, bw) {

	if (hex.charAt(0) === '#')
		hex = hex.substring(1);

	if (hex.length === 3)
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

	var r = parseInt(hex.slice(0, 2), 16);
	var g = parseInt(hex.slice(2, 4), 16);
	var b = parseInt(hex.slice(4, 6), 16);

	if (bw)
		return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000' : '#FFF';

	r = (255 - r).toString(16);
	g = (255 - g).toString(16);
	b = (255 - b).toString(16);

	return "#" + r.padLeft(2, '0') + g.padLeft(2, '0') + b.padLeft(2, '0');
};

Thelpers.initialscolor = function(value) {
	var colors = ['#1abc9c','#2ecc71','#3498db','#9b59b6','#34495e','#16a085','#2980b9','#8e44ad','#2c3e50','#f1c40f','#e67e22','#e74c3c','#d35400','#c0392b'];
	return colors[value.length % colors.length];
};

var TTIC = ['#1abc9c','#2ecc71','#3498db','#9b59b6','#34495e','#16a085','#2980b9','#8e44ad','#2c3e50','#f1c40f','#e67e22','#e74c3c','#d35400','#c0392b'];

Thelpers.initials = function(value) {
	var index = value.indexOf('.');
	var arr = value.substring(index + 1).replace(/\s{2,}/g, ' ').trim().split(' ');
	var initials = ((arr[0].substring(0, 1) + (arr[1] || '').substring(0, 1))).toUpperCase();
	var sum = 0;
	for (var i = 0; i < value.length; i++)
		sum += value.charCodeAt(i);
	return '<span class="initials" style="background-color:{1}" title="{2}">{0}</span>'.format(initials, TTIC[sum % TTIC.length], value);
};

Thelpers.initialsbase64 = function(value, width, height) {

	var index = value.indexOf('.');
	var arr = value.substring(index + 1).replace(/\s{2,}/g, ' ').trim().split(' ');
	var initials = ((arr[0].substring(0, 1) + (arr[1] || '').substring(0, 1))).toUpperCase();
	var sum = 0;

	for (var i = 0; i < value.length; i++)
		sum += value.charCodeAt(i);

	var canvas = W.$initialscanvas;
	if (!canvas)
		canvas = W.$initialscanvas = document.createElement('CANVAS');

	if (canvas.width != width)
		canvas.width = width;

	if (canvas.height != height)
		canvas.height = height;

	var color = TTIC[sum % TTIC.length];
	var ctx = canvas.getContext('2d');
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, width, height);
	ctx.font = 'bold ' + ((width / 2.8) >> 0) + 'px Arial';
	ctx.fillStyle = '#FFFFFF';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(initials, (width / 2), (height / 2 >> 0) + 15);
	return canvas.toDataURL('image/png');
};

Thelpers.price = function(value) {
	return value ? value.currency(this.value.currency) : '0.0';
};

Thelpers.price2 = function(value) {
	var t = this;
	return t.value && value && t.value.hourlyrate ? (Math.ceil((value / 60) * t.value.hourlyrate).currency(t.value.currencyid)) : DEF.empty;
};

Thelpers.color = function(value) {
	var hash = HASH(value, true);
	var color = '#';
	for (var i = 0; i < 3; i++) {
		var value = (hash >> (i * 8)) & 0xFF;
		color += ('00' + value.toString(16)).substr(-2);
	}
	return color;
};
