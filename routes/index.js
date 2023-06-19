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

router.get("/retrieve-bed/:bedId", async function(req, res, next) {
  const bedId = Number(req.params.bedId);

  try {
    const req = await pool.query(`SELECT * FROM practice WHERE id = ${bedId}`);
    res.status(200).json(req.rows);
  } catch(err) {
    res.status(404).json(err.message);
  };
});

router.get("/search/:type/:term", async function(req, res, next) {
  const searchType = req.params.type;
  const spacedTerm = req.params.term.replace(/-/g, " ");
  
  try {
    if (searchType === "live") {
      const req = await pool.query(
        "SELECT * FROM veg_data_eden WHERE name ~* ($1) ORDER BY name",
        [spacedTerm]
      );
      res.status(200).json(req.rows);
    } else if (searchType === "final") {
      const req = await pool.query(
        "SELECT * FROM veg_data_eden WHERE name ~* ($1) ORDER BY name",
        [spacedTerm]
      );
      res.status(200).json(req.rows);
    };
  } catch(err) {
    res.status(404).json(err.message);
  };
});

router.post("/save-bed", async function(req, res, next) {
  const { gridMap, bedId } = req.body;
  const gridMapJSON = JSON.stringify(gridMap);

  try {
    const req = await pool.query(
      "UPDATE practice SET gridmap = ($1) WHERE id = ($2)",
      [gridMapJSON, bedId]
    );
    res.status(200).json("Bed updated.");
  } catch(err) {
    res.status(404).json(err.message);
  };
});


module.exports = router;
