const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_notifications = async function(req, res, next) {
    try {
      const notificationsReq = await pool.query(
        "SELECT * FROM notifications WHERE recipientid = ($1)",
        [res.locals.user.id]
      );
      res.status(200).json(notificationsReq.rows);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.add_notification = async function(req, res, next) {
    const { senderid, sendername, senderusername, recipientid, dispatched, type, bedid, bedname, eventid, eventname, eventdate, rsvpdate } = res.locals.validatedData;  
  
    try {
      const addNotificationReq = await pool.query(
        "INSERT INTO notifications (senderid, sendername, senderusername, recipientid, dispatched, read, responded, type, bedid, bedname, eventid, eventname, eventdate, rsvpdate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
        [senderid, sendername, senderusername, recipientid, dispatched, false, "", type, bedid, bedname, eventid, eventname, eventdate, rsvpdate]
      );
  
      // notifies recipient via socket of a new notification, which will then prompt manual refetching of notifications and other data
      if (type === "rsvpinvite" || type === "rsvpconfirmation") {
        req.io.emit(`notifications-${recipientid}`, type, bedid);
      } else if (type === "memberinvite" || type === "memberconfirmation" || type === "memberrejection") {
        req.io.emit(`notifications-${recipientid}`, type);
      };
  
      // updating member status in bed upon confirmation
      if (type === "memberconfirmation" && bedid) {
        const bedMembersReq = await pool.query(
          "SELECT members FROM garden_beds WHERE id = ($1)",
          [bedid]
        );
        let members = bedMembersReq.rows[0].members;
        members = members.map(member => {
          if (member.id !== senderid) {
            return member;
          } else {
            const date = new Date().toISOString().slice(0, 10);
            return {...member, status: "accepted", finaldate: date};
          };
        });
        members = JSON.stringify(members);
  
        const updateBedMembersReq = await pool.query(
          "UPDATE garden_beds SET members = ($1) WHERE id = ($2)",
          [members, bedid]
        );

        // also give sender default permission to make and interact w/ posts by default
        const getPermissionsArrs = await pool.query(
          "SELECT postspermissionmemberids, postinteractionspermissionmemberids FROM permissions WHERE bedid = ($1)",
          [bedid]
        );
        let { postspermissionmemberids, postinteractionspermissionmemberids } = getPermissionsArrs.rows[0];
        postspermissionmemberids = [...postspermissionmemberids, senderid];
        postinteractionspermissionmemberids = [...postinteractionspermissionmemberids, senderid];
        const updatePermissionsArrs = await pool.query(
          "UPDATE permissions SET postspermissionmemberids = ($1), postinteractionspermissionmemberids = ($2) WHERE bedid = ($3)",
          [postspermissionmemberids, postinteractionspermissionmemberids, bedid]
        );
      };
      // removing member from bed upon rejection
      if (type === "memberrejection" && bedid) {
        const bedMembersReq = await pool.query(
          "SELECT members FROM garden_beds WHERE id = ($1)",
          [bedid]
        );
        let members = bedMembersReq.rows[0].members;
        members = members.filter(member => {
          if (member.id !== senderid) return member;
        });
        members = JSON.stringify(members);
        const updateBedMembersReq = await pool.query(
          "UPDATE garden_beds SET members = ($1) WHERE id = ($2)",
          [members, bedid]
        );
      };

      // adding member to rsvpsreceived in event upon confirmation
      if (type === "rsvpconfirmation" && eventid) {
        const eventRSVPsReceived = await pool.query(
          "SELECT rsvpsreceived FROM events WHERE id = ($1)",
          [eventid]
        );
        const updatedRsvps = [...eventRSVPsReceived.rows[0].rsvpsreceived, senderid];
        const updateRSVPs = await pool.query(
          "UPDATE events SET rsvpsreceived = ($1) WHERE id = ($2)",
          [updatedRsvps, eventid]
        );
      };
  
      res.status(200).json("Notification successfully added.");
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_notification = async function(req, res, next) {
    const { notifid, read, responded } = res.locals.validatedData;
    
    try {
      /// AUTHENTICATION: that it is the event creator
      const getNotificationRecipientReq = await pool.query(
        "SELECT recipientid FROM notifications WHERE recipientid = ($1)",
        [res.locals.user.id]
      );
      if (getNotificationRecipientReq?.rows[0]?.recipientid !== res.locals.user.id) throw new Error("You do not have permission to update this notification as you are not the intended recipient.");

      const req = await pool.query(
        "UPDATE notifications SET read = ($1), responded = ($2) WHERE id = ($3)",
        [read, responded, notifid]
      );
      res.status(200).json("Notification successfully updated.")
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.delete_notification = async function(req, res, next) {
    const { notifid } = res.locals.validatedData;
    
    try {
      /// AUTHENTICATION: that it is the event creator
      const getNotificationRecipientReq = await pool.query(
        "SELECT recipientid FROM notifications WHERE recipientid = ($1)",
        [res.locals.user.id]
      );
      if (getNotificationRecipientReq?.rows[0]?.recipientid !== res.locals.user.id) throw new Error("You do not have permission to delete this notification as you are not the intended recipient.");

      const req = await pool.query(
        "DELETE FROM notifications WHERE id = ($1)",
        [notifid]
      );
      res.status(200).json("Notification successfully deleted.")
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};