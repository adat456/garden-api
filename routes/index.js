var express = require('express');
var router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { checkSchema, validationResult, matchedData } = require("express-validator");

const { findUsersSchema } = require("../schemas/userSchema");
const { bedNameSchema, rolesSchema, toggleLikesSchema, copyBedSchema } = require ("../schemas/bedSchemas");
const { vegSchema, returningWhatSchema, vegIdSchema, searchVegSchema } = require("../schemas/vegSchemas");
const { notificationIdSchema, updateNotificationSchema, addNotificationSchema } = require("../schemas/notificationSchema");
const { eventBedIdSchema, addEventSchema, deleteEventSchema } = require("../schemas/eventSchemas");
const { postSchema, postIdSchema, updateReactionsSchema } = require("../schemas/postSchemas");
const { commentPostIdSchema, commentContentSchema, commentIdSchema } = require("../schemas/commentSchemas");

const userController = require("../controllers/userController");
const bedController = require("../controllers/bedController");
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

// attaching middleware to all requests
router.use(authenticate);

/// USER ENDPOINTS ///
router.get("/find-users/:searchTerm", checkSchema(findUsersSchema, ["params"]), accessValidatorResults, userController.find_users);

router.get("/pull-user-data", userController.pull_user_data);


/// GARDEN BED ENDPOINTS ///
router.get("/pull-beds-data", bedController.pull_beds_data);

router.post("/create-bed", checkSchema(bedNameSchema, ["body"]), accessValidatorResults, bedController.create_bed);

router.patch("/update-bed/:bedid", checkSchema(bedNameSchema, ["body"]), accessValidatorResults, bedController.update_bed);

router.patch("/update-gridmap/:bedid", bedController.update_gridmap);

router.patch("/update-roles/:bedid", checkSchema(rolesSchema, ["body"]), accessValidatorResults, bedController.update_roles);

router.patch("/update-members/:bedid", bedController.update_members);

router.delete("/delete-bed/:bedid", bedController.delete_bed);


/// PUBLIC BED ENDPOINTS ///
router.get("/all-public-beds", accessValidatorResults, bedController.pull_all_public_beds);

router.patch("/toggle-bed-favorites/:bedid", checkSchema(toggleLikesSchema, ["params"]), accessValidatorResults, bedController.toggle_bed_favorites);

router.post("/copy-bed", checkSchema(copyBedSchema, ["body"]), accessValidatorResults, bedController.copy_bed);


/// VEG DATA ENDPOINTS ///
router.post("/save-veg-data/:returning", checkSchema(returningWhatSchema, ["params"]), checkSchema(vegSchema, ["body"]), accessValidatorResults, vegController.save_veg_data);

router.patch("/update-veg-data/:vegid", checkSchema(vegIdSchema, ["params"]), checkSchema(vegSchema, ["body"]), accessValidatorResults, vegController.update_veg_data);

router.get("/search/:term", checkSchema(searchVegSchema, ["params"]), accessValidatorResults, vegController.search_veg_data);

router.get("/pull-seed-contributions", accessValidatorResults, vegController.pull_seed_contributions);


/// NOTIFICATION ENDPOINTS ///
router.get("/pull-notifications", notificationsController.pull_notifications);

router.post("/add-notification", checkSchema(addNotificationSchema, ["body"]), accessValidatorResults, notificationsController.add_notification);

router.patch("/update-notification/:notifid", checkSchema(notificationIdSchema, ["params"]), checkSchema(updateNotificationSchema, ["body"]), accessValidatorResults, notificationsController.update_notification);

router.delete("/delete-notification/:notifid", checkSchema(notificationIdSchema, ["params"]), accessValidatorResults, notificationsController.delete_notification);


/// EVENT ENDPOINTS /// 
router.get("/pull-events/:bedid", checkSchema(eventBedIdSchema, ["params"]), accessValidatorResults, eventsController.pull_events);

router.post("/add-event/:bedid", checkSchema(eventBedIdSchema, ["params"]), checkSchema(addEventSchema, ["body"]), accessValidatorResults, eventsController.add_event);

router.delete("/delete-event/:eventid/:repeatid", checkSchema(deleteEventSchema, ["params"]), accessValidatorResults, eventsController.delete_event);

router.patch("/delete-tag/:bedid", accessValidatorResults, eventsController.delete_tag);


/// POST ENDPOINTS ///
router.get("/pull-posts/:bedid", accessValidatorResults, postsController.pull_posts);

router.post("/add-post/:bedid", checkSchema(postSchema, ["body"]), checkSchema(postIdSchema, ["body"]), accessValidatorResults, postsController.add_post);

router.patch("/update-post/:id", checkSchema(postSchema, ["body"]), checkSchema(postIdSchema, ["params"]), accessValidatorResults, postsController.update_post);

router.delete("/delete-post/:id", checkSchema(postIdSchema, ["params"]), accessValidatorResults, postsController.delete_post);

router.patch("/update-reactions/:table/:id", checkSchema(updateReactionsSchema, ["params", "body"]), postsController.update_reactions);


/// COMMENT ENDPOINTS ///
router.get("/pull-comments/:postid", checkSchema(commentPostIdSchema, ["params"]), accessValidatorResults, commentsController.pull_comments);

router.post("/add-comment/:postid", checkSchema(commentPostIdSchema, ["params"]), checkSchema(commentContentSchema, ["body"]), checkSchema(commentIdSchema, ["body"]), accessValidatorResults, commentsController.add_comment);

router.patch("/update-comment/:id", checkSchema(commentIdSchema, ["params"]), checkSchema(commentContentSchema, ["body"]), accessValidatorResults, commentsController.update_comment);

router.delete("/delete-comment/:id", checkSchema(commentIdSchema, ["params"]), accessValidatorResults, commentsController.delete_comment);


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
