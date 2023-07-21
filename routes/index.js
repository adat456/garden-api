var express = require('express');
var router = express.Router();
require("dotenv").config();

const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const redis = require("redis");

const { checkSchema } = require("express-validator");
const { bedNameSchema, rolesSchema } = require ("../schemas/bedSchemas");
const { vegSchema } = require("../schemas/vegSchemas")
const bedController = require("../controllers/bedController");
const vegController = require("../controllers/vegController");

const pool = new Pool({
  user: process.env.PSQL_USER,
  database: "garden_data",
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  host: "localhost",
});

let redisClient = null;
(async () => {
  redisClient = redis.createClient();

  redisClient.on("error", error => {
    console.log(error);
  });
  redisClient.on("connect", () => {
    console.log("Redis connected.");
  });

  await redisClient.connect();
})();

async function authenticate(req, res, next) {
  const token = req.cookies.jwt;
  console.log(token);

  try {
    if (token) {
      const onBlacklist = await redisClient.get(`blacklist_${token}`);
      if (onBlacklist) {
        res.locals.username = null;
        throw new Error("JWT blacklisted.");
      } else {
        const decodedToken = await jwt.verify(token, process.env.JWT_KEY);
        if (decodedToken) {
          res.locals.username = decodedToken.username;

          const pullUserReq = await pool.query(
            "SELECT * FROM users WHERE username = ($1)",
            [res.locals.username]
          );
          
          res.locals.user = pullUserReq.rows[0];

          next();
        } else {
          res.locals.username = null;
          throw new Error("JWT is invalid.");
        };
      };
    } else {
      res.locals.username = null;
      throw new Error("No JWT found.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
};

// should return everything except for the password
router.get("/pull-user-data", authenticate, async function(req, res, next) {
  try {
    const getUserDataReq = await pool.query(
      "SELECT id, firstname, lastname, email, username, board_ids, added_veg_data, favorited_beds, copied_beds FROM users WHERE username = ($1)",
      [res.locals.username]
    );
    res.status(200).json(getUserDataReq.rows[0]);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

/// GARDEN BED ENDPOINTS ///
router.get("/all-public-beds", authenticate, bedController.pull_all_public_beds);

router.get("/pull-beds-data", authenticate, bedController.pull_beds_data);

router.post("/create-bed", authenticate, checkSchema(bedNameSchema, ["body"]), bedController.create_bed);

router.patch("/update-bed/:bedid", authenticate, checkSchema(bedNameSchema, ["body"]), bedController.update_bed);

router.patch("/update-gridmap/:bedid", authenticate, bedController.update_gridmap);

router.patch("/update-roles/:bedid", authenticate, checkSchema(rolesSchema, ["body"]), bedController.update_roles);

router.patch("/update-members/:bedid", authenticate, bedController.update_members);

router.delete("/delete-bed/:bedid", authenticate, bedController.delete_bed);

/// VEG DATA ENDPOINTS ///
router.post("/save-veg-data/:returning", authenticate, checkSchema(vegSchema, ["body"]), vegController.save_veg_data);

router.patch("/update-veg-data/:vegid", authenticate, checkSchema(vegSchema, ["body"]), vegController.update_veg_data);


/// MISC /// 
router.get("/search/:term", authenticate, async function(req, res, next) {
  const spacedTerm = req.params.term.replace(/-/g, " ");
  
  try {
      const edenReq = await pool.query(
        "SELECT * FROM veg_data_eden WHERE name ~* ($1)",
        [spacedTerm]
      );
      const userAddedPublicReq = await pool.query(
        "SELECT * FROM veg_data_users WHERE name ~* ($1) AND privatedata = ($2)",
        [spacedTerm, false]
      );
      const userAddedPrivateReq = await pool.query(
        "SELECT * FROM veg_data_users WHERE name ~* ($1) AND privatedata = ($2) AND contributor = ($3)",
        [spacedTerm, true, res.locals.username]
      );
      res.status(200).json([...edenReq.rows, ...userAddedPublicReq.rows, ...userAddedPrivateReq.rows]);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.patch("/update-seed-basket/:bedid", authenticate, async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid);
  let seedbasket = req.body;
  seedbasket = JSON.stringify(seedbasket);

  try {
    const req = await pool.query(
      "UPDATE garden_beds SET seedbasket = ($1) WHERE id = ($2)",
      [seedbasket, bedid]
    );
    res.status(200).json("Seedbasket successfully updated.");
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.get("/pull-seed-contributions", authenticate, async function(req, res, next) {
  try {
    const pullSeedContributionsReq = await pool.query(
      "SELECT * FROM veg_data_users WHERE contributor = ($1)",
      [res.locals.username]
    );
    res.status(200).json(pullSeedContributionsReq.rows);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.post("/toggle-bed-favorites", authenticate, async function(req, res, next) {
  let { id } = req.body;
  id = Number(id);

  try {
    // get array of favorited boards
    const getUsersFavoritesReq = await pool.query(
      "SELECT favorited_beds FROM users WHERE username = ($1)",
      [res.locals.username]
    );
    let favoritedBeds = [...getUsersFavoritesReq.rows[0].favorited_beds];
    
    // if it does not include the current id, add it and increment numhearts in the respective board, otherwise...
    if (favoritedBeds.includes(id)) {
      favoritedBeds = favoritedBeds.filter(bed => bed != id);
      const decrementNumHeartsReq = await pool.query(
        "UPDATE garden_beds SET numhearts = numhearts - 1 WHERE id = ($1)",
        [id]
      );
    } else {
      favoritedBeds = [...favoritedBeds, id];
      const incrementNumHeartsReq = await pool.query(
        "UPDATE garden_beds SET numhearts = numhearts + 1 WHERE id = ($1)",
        [id]
      );
    };

    // update row in users with the updated favorited boards arr
    const addToUserFavoritesReq = await pool.query(
      "UPDATE users SET favorited_beds = ($1) WHERE username = ($2)",
      [favoritedBeds, res.locals.username]
    );

    res.status(200).json("Toggled favorites.");
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.post("/copy-bed", authenticate, async function(req, res, next) {
  const { bed, created } = req.body;
  const { hardiness, sunlight, soil, length, width, gridmap, name, seedbasket, id } = bed;
  const gridmapJSON = JSON.stringify(gridmap);
  const seedbasketJSON = JSON.stringify(seedbasket);

  try {
    // create the new bed and retrieve its id
    // need to add the extra columns
    const addNewBedReq = await pool.query(
      "INSERT INTO garden_beds (hardiness, sunlight, soil, length, width, gridMap, name, public, created, username, numhearts, numcopies, seedbasket) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
      [hardiness, sunlight, soil, length, width, gridmapJSON, `Copy of ${name}`, false, created, res.locals.username, 0, 0, seedbasketJSON]
    );
    const newBoardId = addNewBedReq.rows[0].id;
    // retrieve the user's array of board ids and add the new board ID
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids, copied_beds FROM users WHERE username = $1",
      [res.locals.username]
    );
    // update with the returned, freshly generated id
    const boardIds = [...getUserBoardsReq.rows[0].board_ids, newBoardId];
    // update with the old/original id of the bed that was copied (for comparison purposes when looking at boards you've already copied)
    const copiedBedIds = [...getUserBoardsReq.rows[0].copied_beds, id];
    // and update the user's data with this updated board id array
    const updatedUserBoardsReq = await pool.query(
      "UPDATE users SET board_ids = ($1), copied_beds = ($2) WHERE username = ($3)",
      [boardIds, copiedBedIds, res.locals.username]
    );


    // also increment number of copies in the copied board
    const incrementNumCopiesReq = await pool.query(
      "UPDATE garden_beds SET numcopies = numcopies + 1 WHERE id = ($1)",
      [id]
    );

    res.status(200).json("Bed data copied!");
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.get("/find-users/:searchTerm", authenticate, async function(req, res, next) {
  const { searchTerm } = req.params;

  try {
    const findUsersReq = await pool.query(
      "SELECT id, username, firstname, lastname FROM users WHERE username ~* ($1)",
      [searchTerm]
    );
    res.status(200).json(findUsersReq.rows);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});


//////// NOTIFICATIONS ////////////////////

router.get("/pull-notifications", authenticate, async function(req, res, next) {
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
});

router.post("/add-notification", authenticate, async function(req, res, next) {
  let { senderid, sendername, senderusername, recipientid, message, dispatched, type, bedid, eventid } = req.body;                     

  try {
    const addNotificationReq = await pool.query(
      "INSERT INTO notifications (senderid, sendername, senderusername, recipientid, message, dispatched, read, responded, type, bedid, eventid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      [senderid, sendername, senderusername, recipientid, message, dispatched, false, false, type, bedid, eventid]
    );

    // notifies recipient via socket of the type of notification, which will then prompt manual refetching of notifications AND certain data when applicable
    req.io.emit(`notifications-${recipientid}`, type);

    // adding member to bed upon confirmation
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
          const date = new Date().toString();
          return {...member, status: "accepted", finaldate: date};
        };
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
      console.log(eventRSVPsReceived);
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
});

router.patch("/update-notification/:notifid", authenticate, async function(req, res, next) {
  let { notifid } = req.params;
  notifid = Number(notifid);
  const { read, responded } = req.body;
  
  try {
    // read will always be part of req.body, whether true or false
    const req = await pool.query(
      "UPDATE notifications SET read = ($1) WHERE id = ($2)",
      [read, notifid]
    );
    // responded will only be included if true
    if (responded) {
      const req = await pool.query(
        "UPDATE notifications SET responded = ($1) WHERE id = ($2)",
        [responded, notifid]
      );
    };
    res.status(200).json("Notification successfully updated.")
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.delete("/delete-notification/:notifid", authenticate, async function(req, res, next) {
  let { notifid } = req.params;
  notifid = Number(notifid);
  
  try {
    const req = await pool.query(
      "DELETE FROM notifications WHERE id = ($1)",
      [notifid]
    );
    res.status(200).json("Notification successfully deleted.")
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/pull-events/:bedid", authenticate, async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid);

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
});

router.post("/add-event/:bedid", authenticate, async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid);
  let { id, creatorId, creatorUsername, creatorName, eventName, eventDesc, eventLocation, eventPublic, eventParticipants, eventDate, eventStartTime, eventEndTime, repeating, repeatEvery, repeatTill, repeatId, tags, rsvpNeeded, rsvpDate } = req.body;
  eventParticipants = JSON.stringify(eventParticipants);

  try {
    const req = await pool.query(
      "INSERT INTO events (id, bedid, creatorid, creatorname, creatorusername, eventname, eventdesc, eventlocation, eventpublic, eventparticipants, eventstarttime, eventendtime, eventdate, repeating, repeatevery, repeattill, repeatid, tags, rsvpneeded, rsvpdate, rsvpsreceived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)",
      [id, bedid, creatorId, creatorName, creatorUsername, eventName, eventDesc, eventLocation, eventPublic, eventParticipants, eventStartTime, eventEndTime, eventDate, repeating, repeatEvery, repeatTill, repeatId, tags, rsvpNeeded, rsvpDate, []]
    );

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
});

router.delete("/delete-event/:eventid/:repeatid", authenticate, async function(req, res, next) {
  const { eventid, repeatid } = req.params;
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
});

router.patch("/delete-tag/:bedid", authenticate, async function(req, res, next) {
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
});

router.get("/pull-posts/:bedid", authenticate, async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid);

  try {
    const pullPosts = await pool.query(
      "SELECT * FROM posts WHERE bedid = ($1) ORDER BY posted DESC",
      [bedid]
    );
    const pinnedPostsToTheFrontArr = [];
    pullPosts.rows.forEach(post => {
      if (post.pinned) pinnedPostsToTheFrontArr.unshift(post);
      if (!post.pinned) pinnedPostsToTheFrontArr.push(post);
    });
    console.log(pinnedPostsToTheFrontArr);
    res.status(200).json(pinnedPostsToTheFrontArr);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.post("/add-post/:bedid", authenticate, async function (req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid);
  let { title, content, pinned, id } = req.body;
  title = title.trim();
  content = content.trim();
  const posted = new Date().toISOString().slice(0, 10);

  try {
    const addPost = await pool.query(
      "INSERT INTO posts (bedid, authorid, authorname, authorusername, posted, edited, title, content, likes, dislikes, pinned, id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
      [bedid, res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, posted, null, title, content, [], [], pinned, id]
    );
    res.status(200).json("Successfully added a post.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.patch("/update-post/:id", authenticate, async function(req, res, next) {
  const { id } = req.params;
  let { title, content, pinned } = req.body;
  title = title.trim();
  content = content.trim();
  const edited = new Date().toISOString().slice(0, 10);

  try {
    const getPostReq = await pool.query(
      "SELECT * FROM posts WHERE id = ($1)",
      [id]
    );
    const postAuthorUsername = getPostReq.rows[0].authorusername;
    if (postAuthorUsername === res.locals.username) {
      const updatePostReq = await pool.query(
        "UPDATE posts SET title = ($1), content = ($2), edited = ($3), pinned = ($4) WHERE id = ($5)",
        [title, content, edited, pinned, id]
      );
      res.status(200).json("Post successfully updated.");
    } else {
      throw new Error("You do not have permission to edit this post as you are not the original author.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.delete("/delete-post/:id", authenticate, async function(req, res, next) {
  const { id } = req.params;

  try {
    const getPostReq = await pool.query(
      "SELECT * FROM posts WHERE id = ($1)",
      [id]
    );
    const postAuthorUsername = getPostReq.rows[0].authorusername;
    if (postAuthorUsername === res.locals.username) {
      const deletePostReq = await pool.query(
        "DELETE FROM posts WHERE id = ($1)",
        [id]
      );
      res.status(200).json("Post successfully deleted.");
    } else {
      throw new Error("You do not have permission to delete this post as you are not the original author.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.patch("/update-reactions/:table/:id", authenticate, async function(req, res, next) {
  const { table, id } = req.params;
  const { likes, dislikes } = req.body;
  try {
    if (likes) {
      if (table === "posts") {
        const updateLikesReq = await pool.query(
          "UPDATE posts SET likes = ($1) WHERE id = ($2)",
          [likes, id]
        );
      } else if (table === "comments") {
        const updateLikesReq = await pool.query(
          "UPDATE comments SET likes = ($1) WHERE id = ($2)",
          [likes, id]
        );
      };
    };
    if (dislikes) {
      if (table === "posts") {
        const updateDislikesReq = await pool.query(
          "UPDATE posts SET dislikes = ($1) WHERE id = ($2)",
          [dislikes, id]
        );
      } else if (table === "comments") {
        const updateDislikesReq = await pool.query(
          "UPDATE comments SET dislikes = ($1) WHERE id = ($2)",
          [dislikes, id]
        );
      }; 
    };
    res.status(200).json("Reactions successfully updated");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/pull-comments/:id", authenticate, async function(req, res, next) {
  const { id } = req.params;

  async function pullComments(id, level, arr) {
    try {
      const pullCommentsReq = await pool.query(
        "SELECT * FROM comments WHERE postid = ($1)",
        [id]
      );
      if (pullCommentsReq.rowCount === 0) return;
      if (pullCommentsReq.rowCount > 0) {
        for (const comment of pullCommentsReq.rows) {
          comment.level = level;
          arr.push(comment);
          await pullComments(comment.id, level + 1, arr);
        };
      } else {
        throw new Error(res);
      };
    } catch(err) {
        console.error("Unable to pull comments: ", err.message);
    };
  };

  try {
    let finalCommentTree = [];
    let level = 0;
    await pullComments(id, level, finalCommentTree);
    res.status(200).json(finalCommentTree);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.post("/add-comment/:postid", authenticate, async function(req, res, next) {
  const { postid } = req.params;
  let { id, content } = req.body;
  content = content.trim();
  const posted = new Date().toISOString().slice(0, 10);

  try {
    const addCommentReq = await pool.query(
      "INSERT INTO comments (id, postid, authorid, authorname, authorusername, posted, edited, content, likes, dislikes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [id, postid, res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, posted, null, content, [], []]
    )
    res.status(200).json("Added comment.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.patch("/update-comment/:id", authenticate, async function(req, res, next) {
  const { id } = req.params;
  let { content } = req.body;
  content = content.trim();
  const edited = new Date().toISOString().slice(0, 10);

  try {
    const getCommentReq = await pool.query(
      "SELECT * FROM comments WHERE id = ($1)",
      [id]
    );
    const commentAuthorUsername = getCommentReq.rows[0].authorusername;
    if (commentAuthorUsername === res.locals.username) {
      const updateCommentReq = await pool.query(
        "UPDATE comments SET content = ($1), edited = ($2) WHERE id = ($3)",
        [content, edited, id]
      );
      res.status(200).json("Comment successfully updated.");
    } else {
      throw new Error("You do not have permission to edit this comment as you are not the original author.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.delete("/delete-comment/:id", authenticate, async function(req, res, next) {
  const { id } = req.params;

  try {
    const getCommentReq = await pool.query(
      "SELECT * FROM comments WHERE id = ($1)",
      [id]
    );
    const commentAuthorUsername = getCommentReq.rows[0].authorusername;
    if (commentAuthorUsername === res.locals.username) {
      const deleteCommentReq = await pool.query(
        "DELETE FROM comments WHERE id = ($1)",
        [id]
      );
      res.status(200).json("Comment successfully deleted.");
    } else {
      throw new Error("You do not have permission to delete this comment as you are not the original author.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/pull-weather/:latitude/:longitude", authenticate, async function(req, res, next) {
  const { latitude, longitude } = req.params;
  
  try {
    const weatherRequest = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${process.env.WEATHER_API_KEY}`);
    const weatherData = await weatherRequest.json();
    if (weatherRequest.ok) {
      res.status(200).json({
        type: weatherData.weather[0].main,
        temp_min: weatherData.main.temp_min,
        temp_max: weatherData.main.temp_max,
        temp: weatherData.main.temp,
        temp_feels_like: weatherData.main.feels_like,
        humidity: weatherData.main.humidity,
        wind_speed: weatherData.wind.speed,
      });
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/get-bed-name-by-id/:id", authenticate, async function(req, res, next) {
  let { id } = req.params;
  id = Number(id);

  try {
    const fetchBedName = await pool.query(
      "SELECT name FROM garden_beds WHERE id = ($1)",
      [id]
    );
    res.status(200).json(fetchBedName.rows[0].name);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/get-event-name-by-id/:id", authenticate, async function(req, res, next) {
  let { id } = req.params;

  try {
    const fetchEventName = await pool.query(
      "SELECT eventname FROM events WHERE id = ($1)",
      [id]
    );
    res.status(200).json(fetchEventName.rows[0].eventname);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

module.exports = router;
