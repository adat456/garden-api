var express = require('express');
var router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const redis = require("redis");

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

router.get("/pull-user-data", authenticate, async function(req, res, next) {
  try {
    const getUserDataReq = await pool.query(
      "SELECT id, firstname, lastname, email, username, board_ids, added_veg_data, favorited_beds FROM users WHERE username = ($1)",
      [res.locals.username]
    );
    res.status(200).json(getUserDataReq.rows[0]);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.get("/get-bedids", authenticate, async function(req, res, next) {
  try {
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    res.status(200).json(getUserBoardsReq.rows[0].board_ids);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.post("/create-bed", authenticate, async function(req, res, next) {
  const { hardiness, sunlight, soil, length, width, gridMap, name, public, created } = req.body;
  const gridMapJSON = JSON.stringify(gridMap);
    
  try {
    // create the new bed and retrive its id
    const addNewBedReq = await pool.query(
      "INSERT INTO garden_beds (hardiness, sunlight, soil, length, width, gridMap, name, public, created, username, numhearts, numcopies, seedbasket) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
      [hardiness, sunlight, soil, length, width, gridMapJSON, name, public, created, res.locals.username, 0, 0, JSON.stringify([])]
    );
    const newBoardId = addNewBedReq.rows[0].id;
    // retrieve the user's array of board ids
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    // add the new board id...
    const boardIds = [...getUserBoardsReq.rows[0].board_ids, newBoardId];
    // and update the user's data with this updated board id array
    const updatedUserBoardsReq = await pool.query(
      "UPDATE users SET board_ids = $1 WHERE username = $2",
      [boardIds, res.locals.username]
    );

    res.status(200).json("Bed data received!");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/retrieve-bed/:bedId", authenticate, async function(req, res, next) {
  const bedId = Number(req.params.bedId);

  try {
    // retrieve the user's array of board ids
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    if (getUserBoardsReq.rows[0].board_ids.includes(bedId)) {
      const req = await pool.query(`SELECT * FROM garden_beds WHERE id = ${bedId}`);
      res.status(200).json(req.rows[0]);
    } else {
      throw new Error("Permission to access this plot has not been granted.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.get("/search/:term", authenticate, async function(req, res, next) {
  const spacedTerm = req.params.term.replace(/-/g, " ");
  
  try {
      const edenReq = await pool.query(
        "SELECT * FROM veg_data_eden WHERE name ~* ($1)",
        [spacedTerm]
      );
      const userAddedReq = await pool.query(
        "SELECT * FROM veg_data_users WHERE name ~* ($1) AND privatedata = ($2)",
        [spacedTerm, false]
      );
      res.status(200).json([...edenReq.rows, ...userAddedReq.rows]);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.post("/update-seed-basket", authenticate, async function(req, res, next) {
  let { seedBasket, bedid } = req.body;
  seedBasket = JSON.stringify(seedBasket);
  bedid = Number(bedid);

  try {
    // first retrieve the user's array of board ids
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    console.log(getUserBoardsReq.rows[0].board_ids.includes(bedid));
    if (getUserBoardsReq.rows[0].board_ids.includes(bedid)) {
      const req = await pool.query(
        "UPDATE garden_beds SET seedbasket = ($1) WHERE id = ($2) RETURNING seedbasket",
        [seedBasket, bedid]
      );
      res.status(200).json(req.rows[0]);
    } else {
      console.log("Permission to edit this plot has not been granted.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.post("/save-bed", authenticate, async function(req, res, next) {
  const { gridMap, bedId } = req.body;
  const gridMapJSON = JSON.stringify(gridMap);

  try {
    const req = await pool.query(
      "UPDATE garden_beds SET gridmap = ($1) WHERE id = ($2)",
      [gridMapJSON, bedId]
    );
    res.status(200).json("Bed updated.");
  } catch(err) {
    res.status(404).json(err.message);
  };
});

router.post("/save-veg-data", authenticate, async function(req, res, next) {
  for (let prop in req.body) {
    if (typeof prop === "string") prop = prop.trim();
  };
  const { name, description, hardiness, water, light, growthConditionsArr, lifecycle, plantingSzn, sowingMethodArr, depth, spacingArr, growthHabitArr, dtmArr, heightArr, fruitSize, privateData } = req.body;

  try {
     // create the new bed and retrive its id
     const addNewVegReq = await pool.query(
      "INSERT INTO veg_data_users (name, description, plantingseason, fruitsize, growthhabit, growconditions, sowingmethod, light, depth, heightin, spacingin, water, hardiness, daystomaturity, lifecycle, privatedata, contributor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id",
      [name, description, plantingSzn, fruitSize, growthHabitArr, growthConditionsArr, sowingMethodArr, light, depth, heightArr, spacingArr, water, hardiness, dtmArr, lifecycle, privateData, res.locals.username]
    );
    const newVegId = addNewVegReq.rows[0].id;
    // retrieve the user's array of added veg IDs
    const userAddedVegReq = await pool.query(
      "SELECT added_veg_data FROM users WHERE username = $1",
      [res.locals.username]
    );
    // add the new veg id...
    const vegIds = [...userAddedVegReq.rows[0].added_veg_data, newVegId];
    // and update the user's data with this updated board id array
    const updatedUserAddedVegReq = await pool.query(
      "UPDATE users SET added_veg_data = $1 WHERE username = $2",
      [vegIds, res.locals.username]
    );

    res.status(200).json("Bed data received!");
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.get("/all-public-beds", authenticate, async function(req, res, next) {
  try {
    const recentPublicBedsReq = await pool.query(
      "SELECT * FROM garden_beds WHERE public = $1 AND username != $2",
      [true, res.locals.username]
    );
    res.status(200).json(recentPublicBedsReq.rows);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
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
  const { hardiness, sunlight, soil, length, width, gridmap, name, seedbasket } = bed;
  const gridmapJSON = JSON.stringify(gridmap);
  const seedbasketJSON = JSON.stringify(seedbasket);

  try {
    // create the new bed and retrive its id
    const addNewBedReq = await pool.query(
      "INSERT INTO garden_beds (hardiness, sunlight, soil, length, width, gridMap, name, public, created, username, numhearts, numcopies, seedbasket) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
      [hardiness, sunlight, soil, length, width, gridmapJSON, `Copy of ${name}`, false, created, res.locals.username, 0, 0, seedbasketJSON]
    );
    const newBoardId = addNewBedReq.rows[0].id;
    // retrieve the user's array of board ids and add the new board ID
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    const boardIds = [...getUserBoardsReq.rows[0].board_ids, newBoardId];
    // and update the user's data with this updated board id array
    const updatedUserBoardsReq = await pool.query(
      "UPDATE users SET board_ids = $1 WHERE username = $2",
      [boardIds, res.locals.username]
    );

    res.status(200).json("Bed data copied!");
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});



module.exports = router;
