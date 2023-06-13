var express = require('express');
var router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PSQL_USER,
  database: "garden_data",
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  host: "localhost",
});

router.post("/create-bed", async function(req, res, next) {
  const { hardiness, sunlight, soil, length, width, gridMap } = req.body;
  const gridMapJSON = JSON.stringify(gridMap);
    
  try {
    const req = await pool.query(
      "INSERT INTO practice (hardiness, sunlight, soil, length, width, gridMap) VALUES ($1, $2, $3, $4, $5, $6)",
      [hardiness, sunlight, soil, length, width, gridMapJSON]
    );
    res.status(200).json("Bed data received!");
  } catch(err) {
    res.status(404).json(err.message);
  };
});


module.exports = router;
