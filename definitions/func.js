FUNC.reconfigure = function(callback) {
	var arr = [];
	for (var key in MAIN.db.config) {
		var val = MAIN.db.config[key];
		arr.push({ id: key, type: typeof(val), value: val });
	}
	LOADCONFIG(arr);
	EMIT('configure');
	callback && callback();
};

function unreadinsert(obj, params) {
	obj.id = params.ticketid + params.userid;
	obj.ticketid = params.ticketid;
	obj.userid = params.userid;
	obj.isunread = true;
}

FUNC.notify = async function(ticketid, userid, typeid, createdby, value, dataid, unread) {

	// Skip notification for the bot
	if (userid === 'bot')
		return true;

	var data = { id: UID(), userid: userid, ticketid: ticketid, typeid: typeid, createdby: createdby, value: value, dataid: dataid, isunread: unread };
	await DATA.insert('tbl_notification', data).promise();

	if (unread === undefined)
		unread = typeid !== 'logwork';

	if (unread) {
		if (typeid === 'status' && value === 'open')
			unread = false;
	}

	if (unread)
		await DATA.modify('tbl_ticket_unread', { isunread: true, isprocessed: false }, true).id(ticketid + userid).insert(unreadinsert, data).promise();

	return true;
};

FUNC.refreshtags = async function() {
	REPO.tags = await DATA.find('tbl_tag').fields('id,search').promise();
};