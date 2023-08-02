var express = require('express');
var router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { checkSchema, validationResult, matchedData } = require("express-validator");

const { bedIdSchema } = require("../schemas/shared");
const { findUsersSchema } = require("../schemas/userSchema");
const { createEditBedSchema, rolesSchema, membersSchema, gridmapSchema, dateOfBedCreationSchema, copyBedSchema } = require ("../schemas/bedSchemas");
const { updatePermissionsLogSchema } = require ("../schemas/permissionsSchema");
const { vegSchema, returningWhatSchema, vegIdSchema, searchVegSchema } = require("../schemas/vegSchemas");
const { notificationIdSchema, updateNotificationSchema, addNotificationSchema } = require("../schemas/notificationSchema");
const { addEventSchema, deleteEventSchema, deleteTagSchema } = require("../schemas/eventSchemas");
const { postSchema, postIdSchema, updateSubscribersSchema, updateReactionsSchema } = require("../schemas/postSchemas");
const { commentPostIdSchema, commentContentSchema, commentIdSchema, commentTopPostIdSchema } = require("../schemas/commentSchemas");

const userController = require("../controllers/userController");
const bedController = require("../controllers/bedController");
const permissionsController = require("../controllers/permissionsController");
const vegController = require("../controllers/vegController");
const notificationsController = require("../controllers/notificationsController");
const eventsController = require("../controllers/eventsController");
const postsController = require("../controllers/postsController");
const commentsController = require("../controllers/commentsController");

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

// middleware
async function authenticate(req, res, next) {
  const token = req.cookies.jwt;
  
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

function accessValidatorResults(req, res, next) {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    const errMsgsArr = validationResults.array();
    const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path, value: error.value}});
    console.log(trimmedErrMsgsArr);
    res.status(400).json(trimmedErrMsgsArr);
  } else {
    const validatedData = matchedData(req, {
      includeOptionals: true,
    });
    res.locals.validatedData = validatedData;
    next();
  };
};

async function determineUserPermissions(req, res, next) {
  const { bedid } = res.locals.validatedData;
  let userPermissions = [];
  try {
    const bedMembersReq = await pool.query(
      "SELECT username, members FROM garden_beds WHERE id = ($1)",
      [bedid]
    );
    const { username, members } = bedMembersReq.rows[0];

    if (username === res.locals.user.username) {
      userPermissions.push("fullpermissions");
    } else {
      const userMatch = members.find(member => member.id === res.locals.user.id);
      if (!userMatch) throw new Error("You do not have permission to view or edit this board.");
      const userRoleId = userMatch.role;

      const permissionsLogReq = await pool.query(
        "SELECT * FROM permissions WHERE bedid = ($1)",
        [bedid]
      );
      const permissionsLog = permissionsLogReq.rows[0];
      delete permissionsLog.bedid;
      delete permissionsLog.creatorid;
      const permissionsLogArr = Object.entries(permissionsLog);

      permissionsLogArr.forEach(permissionsArr => {
        if (permissionsArr[0].includes("memberids") && permissionsArr[1].includes(res.locals.user.id)) {
          userPermissions.push(permissionsArr[0].slice(0, -9));
        };
        if (permissionsArr[0].includes("roleids") && permissionsArr[1].includes(userRoleId)) {
          userPermissions.push(permissionsArr[0].slice(0, -7));
        };
      });
    };

    console.log(userPermissions);
    res.locals.userPermissions = userPermissions;
    next();
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
};

// attaching middleware to all requests
router.use(authenticate);

/// USER ENDPOINTS ///
router.get("/find-users/:searchTerm", checkSchema(findUsersSchema, ["params"]), accessValidatorResults, userController.find_users);

router.get("/pull-user-data", userController.pull_user_data);


/// GARDEN BED ENDPOINTS ///
router.get("/pull-beds-data", bedController.pull_beds_data);

router.post("/create-bed", checkSchema(createEditBedSchema, ["body"]), checkSchema(dateOfBedCreationSchema, ["body"]), accessValidatorResults, bedController.create_bed);

router.patch("/update-bed/:bedid", checkSchema(createEditBedSchema, ["body"]), checkSchema(bedIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, bedController.update_bed);

router.patch("/update-gridmap/:bedid", checkSchema(gridmapSchema, ["body"]), checkSchema(bedIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, bedController.update_gridmap);

router.patch("/update-roles/:bedid", checkSchema(rolesSchema, ["body"]), checkSchema(bedIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, bedController.update_roles);

router.patch("/update-members/:bedid", checkSchema(membersSchema, ["body"]), checkSchema(bedIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, bedController.update_members);

router.delete("/delete-bed/:bedid", checkSchema(bedIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, bedController.delete_bed);

/// PERMISSIONS ENDPOINTS ///
router.get("/pull-personal-permissions/:bedid", checkSchema(bedIdSchema, ["params"]), accessValidatorResults, permissionsController.pull_personal_permissions);

router.get("/pull-permissions-log/:bedid", checkSchema(bedIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, permissionsController.pull_permissions_log);

router.patch("/update-permissions-log/:bedid", checkSchema(bedIdSchema, ["params"]), checkSchema(updatePermissionsLogSchema, ["body"]), accessValidatorResults, determineUserPermissions, permissionsController.update_permissions_log);

/// PUBLIC BED ENDPOINTS ///
router.get("/all-public-beds", accessValidatorResults, bedController.pull_all_public_beds);

router.patch("/toggle-bed-favorites/:bedid", checkSchema(bedIdSchema, ["params"]), accessValidatorResults, bedController.toggle_bed_favorites);

router.post("/copy-bed", checkSchema(copyBedSchema, ["body"]), accessValidatorResults, bedController.copy_bed);


/// VEG DATA ENDPOINTS ///
router.post("/save-veg-data/:returning", checkSchema(returningWhatSchema, ["params"]), checkSchema(vegSchema, ["body"]), accessValidatorResults, vegController.save_veg_data);

router.patch("/update-veg-data/:vegid", checkSchema(vegIdSchema, ["params"]), checkSchema(vegSchema, ["body"]), accessValidatorResults, vegController.update_veg_data);

router.get("/search/:term", checkSchema(searchVegSchema, ["params"]), accessValidatorResults, vegController.search_veg_data);

router.get("/pull-seed-contributions", accessValidatorResults, vegController.pull_seed_contributions);


/// NOTIFICATION ENDPOINTS ///
router.get("/pull-notifications", notificationsController.pull_notifications);

router.post("/add-notification", checkSchema(addNotificationSchema, ["body"]), checkSchema(bedIdSchema, ["body"]), accessValidatorResults, notificationsController.add_notification);

router.patch("/update-notification/:notifid", checkSchema(notificationIdSchema, ["params"]), checkSchema(updateNotificationSchema, ["body"]), accessValidatorResults, notificationsController.update_notification);

router.delete("/delete-notification/:notifid", checkSchema(notificationIdSchema, ["params"]), accessValidatorResults, notificationsController.delete_notification);


/// EVENT ENDPOINTS /// 
router.get("/pull-events/:bedid", checkSchema(bedIdSchema, ["params"]), accessValidatorResults, eventsController.pull_events);

router.post("/add-event/:bedid", checkSchema(bedIdSchema, ["params"]), checkSchema(addEventSchema, ["body"]), accessValidatorResults, determineUserPermissions, eventsController.add_event);

router.delete("/delete-event/:bedid/:eventid/:repeatid", checkSchema(bedIdSchema, ["params"]), checkSchema(deleteEventSchema, ["params"]), accessValidatorResults, determineUserPermissions, eventsController.delete_event);

router.patch("/delete-tag/:bedid", checkSchema(bedIdSchema, ["params"]), checkSchema(deleteTagSchema, ["body"]), accessValidatorResults, determineUserPermissions, eventsController.delete_tag);


/// POST ENDPOINTS ///
router.get("/pull-posts/:bedid", checkSchema(bedIdSchema, ["params"]), accessValidatorResults, postsController.pull_posts);

router.post("/add-post/:bedid", checkSchema(bedIdSchema, ["params"]), checkSchema(postSchema, ["body"]), checkSchema(postIdSchema, ["body"]), accessValidatorResults, determineUserPermissions, postsController.add_post);

router.patch("/toggle-post-pin/:bedid/:postid", checkSchema(bedIdSchema, ["params"]), checkSchema(postIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, postsController.toggle_post_pin);

router.patch("/update-post/:bedid/:postid", checkSchema(postSchema, ["body"]), checkSchema(bedIdSchema, ["params"]), checkSchema(postIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, postsController.update_post);

router.patch("/update-subscribers/:postid/:userid", checkSchema(updateSubscribersSchema, ["params"]), accessValidatorResults, postsController.update_subscribers);

router.delete("/delete-post/:bedid/:postid", checkSchema(bedIdSchema, ["params"]), checkSchema(postIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, postsController.delete_post);

router.patch("/update-reactions/:bedid/:table/:id", checkSchema(bedIdSchema, ["params"]), checkSchema(updateReactionsSchema, ["params", "body"]), accessValidatorResults, determineUserPermissions, postsController.update_reactions);


/// COMMENT ENDPOINTS ///
router.get("/pull-comments/:postid", checkSchema(commentPostIdSchema, ["params"]), accessValidatorResults, commentsController.pull_comments);

router.post("/add-comment/:bedid/:postid", checkSchema(bedIdSchema, ["params"]), checkSchema(commentPostIdSchema, ["params"]), checkSchema(commentContentSchema, ["body"]), checkSchema(commentIdSchema, ["body"]), checkSchema(commentTopPostIdSchema, ["body"]), accessValidatorResults, determineUserPermissions, commentsController.add_comment);

router.patch("/update-comment/:bedid/:commentid", checkSchema(bedIdSchema, ["params"]), checkSchema(commentIdSchema, ["params"]), checkSchema(commentContentSchema, ["body"]), accessValidatorResults, determineUserPermissions, commentsController.update_comment);

router.delete("/delete-comment/:bedid/:commentid", checkSchema(bedIdSchema, ["params"]), checkSchema(commentIdSchema, ["params"]), accessValidatorResults, determineUserPermissions, commentsController.delete_comment);


/// MISC ENDPOINTS ///
router.patch("/update-seed-basket/:bedid", async function(req, res, next) {
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

router.get("/pull-weather/:latitude/:longitude", async function(req, res, next) {
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

router.get("/get-bed-name-by-id/:id", async function(req, res, next) {
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

router.get("/get-event-name-by-id/:id", async function(req, res, next) {
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
