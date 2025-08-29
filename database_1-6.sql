-- USE THIS SCRIPT ONLY WHEN YOU !!!UPDATE!!! older version (<1.5) of the TODOMATOR app
-- You must run this script before the app runs.
-- How to obtain the current version? Open /definitions/init.js file and find "CONF.version".

DROP VIEW view_ticket;

CREATE VIEW view_ticket AS
	SELECT
		a.id,
		a.folderid,
		a.ownerid,
		a.statusid,
		a.parentid,
		a.userid,
		a.name,
		a.worked,
		a.estimate,
		a.comments,
		a.ispriority,
		b.name AS folder,
		b.color AS folder_color,
		b.icon AS folder_icon,
		a.attachments,
		a.tags,
		a.date,
		a.dtstatus,
		a.dtupdated,
		a.deadline,
		a.isbillable,
		d.name AS status,
		d.sortindex,
		d.color AS status_color,
		a.search,
		b.isprivate,
		a.html,
		a.dtparent,
		a.dtcreated,
		a.reference,
		a.source,
		a.markdown,
		a.ispublic,
		d.icon AS status_icon,
		a.note,
		a.watcherid,
		a.attrs,
		ARRAY(SELECT tbl_ticket.id FROM tbl_ticket WHERE tbl_ticket.parentid = a.id) AS children
	FROM tbl_ticket a
	LEFT JOIN tbl_folder b ON b.id = a.folderid
	LEFT JOIN cl_status d ON d.id = a.statusid
	WHERE a.isremoved = false;