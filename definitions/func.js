FUNC.reconfigure = async function(callback) {
	var config = await DATA.find('cl_config').fields('id,value,type').promise();
	LOADCONFIG(config);
	EMIT('configure');
	callback && callback();
};

function unreadinsert(obj, params) {
	obj.id = params.ticketid + params.userid;
	obj.ticketid = params.ticketid;
	obj.userid = params.userid;
	obj.isunread = true;
}

FUNC.notify = async function(ticketid, userid, typeid, createdby, value, reference) {
	var data = { id: UID(), userid: userid, ticketid: ticketid, typeid: typeid, createdby: createdby, value: value, reference: reference };
	await DATA.insert('tbl_notification', data).promise();
};

FUNC.unread = async function(ticketid, userid, typeid, value, unread) {

	// Skip notification for the bot
	if (userid === 'bot')
		return true;

	if (unread === undefined)
		unread = typeid !== 'logwork';

	if (unread) {
		if (typeid === 'markdown' || (typeid === 'status' && value === 'open'))
			unread = false;
	}

	if (unread) {
		NOW = new Date();
		var udata = {};
		udata.isunread = true;
		udata.isprocessed = false;
		udata.dtupdated = NOW;
		if (typeid === 'comment')
			udata.iscomment = true;
		await DATA.modify('tbl_ticket_unread', udata, true).id(ticketid + userid).insert(unreadinsert, { userid: userid, ticketid: ticketid }).promise();
	}

	return true;
};

FUNC.refreshtags = async function() {
	REPO.tags = await DATA.find('tbl_tag').fields('id,search').promise();
};