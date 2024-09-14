-- USE THIS SCRIPT ONLY WHEN YOU !!!UPDATE!!! older version (<1.4) of the TODOMATOR app
-- You must run this script before the app runs.
-- How to obtain the current version? Open /definitions/init.js file and find "CONF.version".

ALTER TABLE tbl_ticket_unread ADD COLUMN dtupdated TIMESTAMP;
UPDATE tbl_ticket_unread SET dtupdated=(SELECT dtupdated FROM tbl_ticket WHERE tbl_ticket.id=tbl_ticket_unread.ticketid);