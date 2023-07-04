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

router.get("/pull-beds-data", authenticate, async function(req, res, next) {
  try {
    const getUserBoardsReq = await pool.query(
      "SELECT * FROM garden_beds WHERE username = ($1)",
      [res.locals.username]
    );
    res.status(200).json(getUserBoardsReq.rows);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
});

router.post("/create-bed", authenticate, async function(req, res, next) {
  const { hardiness, sunlight, soil, length, width, gridmap, name, public, created } = req.body;
  const gridmapJSON = JSON.stringify(gridmap);
    
  try {
    // create the new bed and retrive its id
    const addNewBedReq = await pool.query(
      "INSERT INTO garden_beds (hardiness, sunlight, soil, length, width, gridMap, name, public, created, username, numhearts, numcopies, seedbasket, members, roles) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *",
      [hardiness, sunlight, soil, length, width, gridmapJSON, name, public, created, res.locals.username, 0, 0, JSON.stringify([]), JSON.stringify([]), JSON.stringify([])]
    );
    const newBoard = addNewBedReq.rows[0];
    const newBoardId = newBoard.id;
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

    res.status(200).json(newBoard);
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
    // first retrieve the user's array of board ids
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    if (getUserBoardsReq.rows[0].board_ids.includes(bedid)) {
      // opted not to return the updated seedbasket because the updateSeedBasket mutation invalidates the tags associated with the getBeds query, which will automatically refetch the updated beds data (and the seedbasket along with it)
      const req = await pool.query(
        "UPDATE garden_beds SET seedbasket = ($1) WHERE id = ($2)",
        [seedbasket, bedid]
      );
      res.status(200).json("Seedbasket successfully updated.");
    } else {
      throw new Error("Permission to edit this plot has not been granted.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
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
      "INSERT INTO veg_data_users (name, description, plantingseason, fruitsize, growthhabit, growconditions, sowingmethod, light, depth, heightin, spacingin, water, hardiness, daystomaturity, lifecycle, privatedata, contributor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *",
      [name, description, plantingSzn, fruitSize, growthHabitArr, growthConditionsArr, sowingMethodArr, light, depth, heightArr, spacingArr, water, hardiness, dtmArr, lifecycle, privateData, res.locals.username]
    );
    const newVegData = addNewVegReq.rows[0];
    const newVegId = newVegData.id;
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

    res.status(200).json(newVegData);
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
  const { hardiness, sunlight, soil, length, width, gridmap, name, seedbasket, id } = bed;
  const gridmapJSON = JSON.stringify(gridmap);
  const seedbasketJSON = JSON.stringify(seedbasket);

  try {
    // create the new bed and retrieve its id
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

router.post("/save-bed/gridmap", authenticate, async function(req, res, next) {
  const { gridmap, bedid } = req.body;
  const gridmapJSON = JSON.stringify(gridmap);

  try {
    const req = await pool.query(
      "UPDATE garden_beds SET gridmap = ($1) WHERE id = ($2) RETURNING *",
      [gridmapJSON, bedid]
    );
    res.status(200).json(req.rows[0]);
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.patch("/update-roles/:bedid", authenticate, async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid); 
  const roles = req.body;
  const rolesJSON = JSON.stringify(roles);

  try {
    const updateRolesReq = await pool.query(
      "UPDATE garden_beds SET roles = ($1) WHERE id = ($2)",
      [rolesJSON, bedid]
    );
    res.status(200).json("Bed roles updated.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
});

router.patch("/update-members/:bedid", authenticate, async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid); 
  const members = req.body;
  const membersJSON = JSON.stringify(members);

  try {
    const updateMembersReq = await pool.query(
      "UPDATE garden_beds SET members = ($1) WHERE id = ($2)",
      [membersJSON, bedid]
    );
    res.status(200).json("Members updated.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
})

module.exports = router;
