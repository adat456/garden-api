const { validationResult, matchedData } = require("express-validator");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_events = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const { bedid } = matchedData(req);
  
    try {
      const req = await pool.query(
        "SELECT * FROM events WHERE bedid = ($1)",
        [bedid]
      );
      res.status(200).json(req.rows);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.add_event = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path, value: error.value}});
        console.log(trimmedErrMsgsArr);
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const validatedData = matchedData(req, {
        includeOptionals: true,
      });
    const { bedid, id, creatorId, creatorUsername, creatorName, eventName, eventDesc, eventLocation, eventPublic, eventParticipants, eventDate, eventStartTime, eventEndTime, repeating, repeatEvery, repeatTill, repeatId, tags, rsvpNeeded, rsvpDate } = validatedData;
    console.log(validatedData);

    const eventParticipantsJSON = JSON.stringify(eventParticipants);
  
    try {
      const req = await pool.query(
        "INSERT INTO events (id, bedid, creatorid, creatorname, creatorusername, eventname, eventdesc, eventlocation, eventpublic, eventparticipants, eventstarttime, eventendtime, eventdate, repeating, repeatevery, repeattill, repeatid, tags, rsvpneeded, rsvpdate, rsvpsreceived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)",
        [id, bedid, creatorId, creatorName, creatorUsername, eventName, eventDesc, eventLocation, eventPublic, eventParticipantsJSON, eventStartTime, eventEndTime, eventDate, repeating, repeatEvery, repeatTill, repeatId, tags, rsvpNeeded, rsvpDate, []]
      );
  
      // suspect code
      const pullBedTagsReq = await pool.query(
        "SELECT eventtags FROM garden_beds WHERE id = ($1)",
        [bedid]
      );
      const currentEventTags = pullBedTagsReq.rows[0].eventtags;
      let newEventTags = [];
      tags.forEach(tag => {
        if (!currentEventTags.includes(tag)) newEventTags.push(tag);
      });
      const updateBedTagsReq = await pool.query(
        "UPDATE garden_beds SET eventtags = ($1) WHERE id = ($2)",
        [[...currentEventTags, ...newEventTags], bedid]
      );
  
      res.status(200).json("Event successfully added.");
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.delete_event = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path, value: error.value}});
        console.log(trimmedErrMsgsArr);
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const validatedData = matchedData(req, {
        includeOptionals: true,
    });
    const { eventid, repeatid } = validatedData;
    // repeatid will either be "undefined" (comes in as a string on account of it being a param) or a "string", so if repeatid is not "undefined" then delete all counterparts
  
    try {
      if (repeatid !== "undefined") {
        const req = await pool.query(
          "DELETE FROM events WHERE repeatid = ($1)",
          [repeatid]
        );
        res.status(200).json("Repeating events successfully deleted.");
      } else {
        const req = await pool.query(
          "DELETE FROM events WHERE id = ($1)",
          [eventid]
        );
        res.status(200).json("Event successfully deleted.");
      };
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.delete_tag = async function(req, res, next) {
    let { bedid }  = req.params;
    bedid = Number(bedid);
    let { tag } = req.body;
    tag = tag.trim().toLowerCase();
  
    try {
      const pullBedTagsReq = await pool.query(
        "SELECT eventtags FROM garden_beds WHERE id = ($1)",
        [bedid]
      );
      const updatedEventTags = pullBedTagsReq.rows[0].eventtags.filter(currentTag => currentTag !== tag);
      const updateBedTagsReq = await pool.query(
        "UPDATE garden_beds SET eventtags = ($1) WHERE id = ($2)",
        [updatedEventTags, bedid]
      );
  
      const pullBedEventsReq = await pool.query(
        "SELECT tags, id FROM events WHERE bedid = ($1)",
        [bedid]
      );
      let tagsAndEventIds = pullBedEventsReq.rows;
      tagsAndEventIds.forEach(async event => {
        if (event.tags.includes(tag)) {
          const updatedEventTags = event.tags.filter(currentTag => currentTag !== tag);
          const updateEventReq = await pool.query(
            "UPDATE events SET tags = ($1) WHERE id = ($2)",
            [updatedEventTags, event.id]
          );
        };
      });
      res.status(200).json("Successfully deleted tag.");
  
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};