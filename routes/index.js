var express = require('express');
var router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const pool = new Pool({
  user: process.env.PSQL_USER,
  database: "garden_data",
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  host: "localhost",
});

function authenticate(req, res, next) {
  const token = req.cookies.jwt;

  if (token) {
    jwt.verify(token, process.env.JWT_KEY, (err, decodedToken) => {
      if (err) {
        res.status(400).json("JWT is invalid.");
      } else {
        res.locals.username = decodedToken.username;
        next();
      };   
    });
  } else {
    res.status(400).json("No JWT found.")
  };
};

router.post("/create-bed", authenticate, async function(req, res, next) {
  const { hardiness, sunlight, soil, length, width, gridMap } = req.body;
  const gridMapJSON = JSON.stringify(gridMap);
    
  try {
    // create the new bed and retrive its id
    const addNewBedReq = await pool.query(
      "INSERT INTO garden_beds (hardiness, sunlight, soil, length, width, gridMap) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [hardiness, sunlight, soil, length, width, gridMapJSON]
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
      res.status(200).json(req.rows);
    } else {
      throw new Error("Permission to access this plot has not been granted.");
    };
  } catch(err) {
    res.status(404).json(err.message);
  };
});

router.get("/search/:term", authenticate, async function(req, res, next) {
  const spacedTerm = req.params.term.replace(/-/g, " ");
  
  try {
      const req = await pool.query(
        "SELECT * FROM veg_data_eden WHERE name ~* ($1) ORDER BY name",
        [spacedTerm]
      );
      res.status(200).json(req.rows);
  } catch(err) {
    res.status(404).json(err.message);
  };
});

router.post("/update-seed-basket", authenticate, async function(req, res, next) {
  let { seedBasket, bedId } = req.body;
  seedBasket = JSON.stringify(seedBasket);

  try {
    // first retrieve the user's array of board ids
    const getUserBoardsReq = await pool.query(
      "SELECT board_ids FROM users WHERE username = $1",
      [res.locals.username]
    );
    if (getUserBoardsReq.rows[0].board_ids.includes(bedId)) {
      const req = await pool.query(
        "UPDATE garden_beds SET seedbasket = ($1) WHERE id = ($2)",
        [seedBasket, bedId]
      );
      res.status(200).json("Seed basket updated.");
    } else {
      console.log("Permission to edit this plot has not been granted.");
    };
  } catch(err) {
    console.log(err);
    res.status(400).json(err);
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


module.exports = router;
