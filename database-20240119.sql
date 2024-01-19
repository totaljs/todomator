-- UPDATE SCRIPT FOR EXISTING INSTANCES --
BEGIN;

ALTER TABLE tbl_ticket ADD COLUMN watcherid _text;

CREATE TABLE "public"."tbl_ticket_backup" (
	"id" text NOT NULL,
	"ticketid" text,
	"userid" text,
	"markdown" text,
	"ip" text,
	"ua" text,
	"dtcreated" timestamp DEFAULT timezone('utc'::text, now()),
	CONSTRAINT "tbl_ticket_backup_ticketid_fkey" FOREIGN KEY ("ticketid") REFERENCES "public"."tbl_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "tbl_ticket_backup_userid_fkey" FOREIGN KEY ("userid") REFERENCES "public"."tbl_user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	PRIMARY KEY ("id")
);

DROP VIEW view_ticket;
CREATE VIEW view_ticket AS
	SELECT
		a.id,
		a.folderid,
		a.ownerid,
		a.statusid,
		a.parentid,
		a.userid,
		a.watcherid,
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
		d.icon AS status_icon,
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
		a.note
	FROM tbl_ticket a
	LEFT JOIN tbl_folder b ON b.id = a.folderid
	LEFT JOIN cl_status d ON d.id = a.statusid
	WHERE
		a.isremoved = false;

COMMIT;