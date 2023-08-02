const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_events = async function(req, res, next) {
    const { bedid } = res.locals.validatedData;
  
    try {
      // get all public events
      const allPublicEventsReq = await pool.query(
        "SELECT * FROM events WHERE bedid = ($1) AND eventpublic = ($2)",
        [bedid, "public"]
      );
      
      /// AUTHORIZATION - necessary regardless of whether you're a member (even though there is also client side filtering)
      let privateEvents = [];
      const bedInfoReq = await pool.query(
        "SELECT username, members FROM garden_beds WHERE id = ($1)",
        [bedid]
      );
      const { username, members } = bedInfoReq.rows[0];
      // pulls all private events (non-"public") if you're the bed creator
      if (username === res.locals.username) {
        const allPrivateEventsReq = await pool.query(
          "SELECT * FROM events WHERE bedid = ($1) AND eventpublic <> ($2)",
          [bedid, "public"]
        );
        privateEvents = allPrivateEventsReq.rows;
      } else if (members.find(member => member.username === res.locals.username)) {
        // if not a creator but a member, pulls all "allmembers" events AND all "somemembers" events where the username matches
        const allBedMembersEventsReq = await pool.query(
          "SELECT * FROM events WHERE bedid = ($1) AND eventpublic = ($2)",
          [bedid, "allmembers", ]
        );
        const someBedMembersEventsReq = await pool.query(
          "SELECT * FROM events WHERE bedid = ($1) AND eventpublic = ($2) and eventparticipants::JSONB @> ($3)",
          [bedid, "somemembers", JSON.stringify([{ "username": res.locals.username }])]
        );
        privateEvents = [...allBedMembersEventsReq.rows, ...someBedMembersEventsReq.rows];
      };
      
      res.status(200).json([...allPublicEventsReq.rows, ...privateEvents]);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.add_event = async function(req, res, next) {
  const { bedid, id, creatorId, creatorUsername, creatorName, eventName, eventDesc, eventLocation, eventPublic, eventParticipants, eventDate, eventStartTime, eventEndTime, repeating, repeatEvery, repeatTill, repeatId, tags, rsvpNeeded, rsvpDate } = res.locals.validatedData;

  const eventParticipantsJSON = JSON.stringify(eventParticipants);

  try {
    // auth
    if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("eventspermission")) throw new Error("You do not have permission to add events.");

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
    const { eventid, repeatid } = res.locals.validatedData;
    // repeatid will either be "undefined" (comes in as a string on account of it being a param) or a "string", so if repeatid is not "undefined" then delete all counterparts
  
    try {
      // AUTH
      // throw error if lacking both events and full permissions
      if (!res.locals.userPermissions.includes("eventspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
        throw new Error("You do not have permission to delete events.");
      };
      // throw error if events permissions (but no full permissions) and user is not the event creator
      if (res.locals.userPermissions.includes("eventspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
        const getEventReq = await pool.query(
          "SELECT * FROM events WHERE id = ($1)",
          [eventid]
        );
        if (getEventReq?.rows[0]?.creatorusername !== res.locals.username) {
          throw new Error("You do not have permission to delete this event as you are not the original creator.");
        };
      };

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
  const { bedid, tag } = res.locals.validatedData;

  try {
    // auth
    if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("tagspermission")) throw new Error("You do not have permission to delete tags.");

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