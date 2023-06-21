var express = require('express');
var router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PSQL_USER,
  database: "garden_data",
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  host: "localhost",
});

// USER: ID, first name, last name, email address, username, password, array of board IDs, array of added veg data
// GRID: ID, gridmap, length, width, soil, sunlight, hardiness, seedbasket (plantPicksInterface, with the gridcolor)
// veg_data_eden: ID, no gridcolor

router.post("/create-account", async function(req, res, next) {
  for (let prop in req.body) {
    prop = prop.trim();
  };
  let { firstName, lastName, email, username, password } = req.body;
  const boardIds = [];
  const addedVegDataIds = [];
  
  try {
    let responseString = "";
    const usernameReq = await pool.query(
      "SELECT username FROM users WHERE username ILIKE ($1)",
      [username]
    );
    if (usernameReq.rowCount > 0) responseString += "This username has been taken.";
    const emailReq = await pool.query(
      "SELECT email FROM users WHERE email ILIKE ($1)",
      [email]
    );
    if (emailReq.rowCount > 0) responseString += "This email address has been taken.";

    if (responseString) {
      res.status(400).json(responseString);
    } else {
      // hashing the password
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(password, salt);
      // inserting into the DB
      await pool.query(
        "INSERT INTO users (firstname, lastname, email, username, password, board_ids, added_veg_data) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [ firstName, lastName, email, username, password, boardIds, addedVegDataIds ]
      );
      // creating the token
      const token = await jwt.sign({ username }, process.env.JWT_KEY, { expiresIn: "86400s"});
      // sending res with success message and cookie
      res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true }).json("Account created.");
    };
  } catch(err) {
    res.status(400).json(err);
  };
});

router.post("/log-in", async function(req, res, next) {
  for (let prop in req.body) {
    prop = prop.trim();
  };
  let { username, password } = req.body;

  try {
    const usernameReq = await pool.query(
      "SELECT password FROM users WHERE username ILIKE ($1)",
      [username]
    );
    if (usernameReq.rowCount = 0) {
      throw new Error("Could not find a matching username.");
    } else {
      const auth = await bcrypt.compare(password, usernameReq.rows[0].password);
      if (auth) {
        // creating the token
        const token = await jwt.sign({ username }, process.env.JWT_KEY, { expiresIn: "86400s"});
        // sending res with success message and cookie
        res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true }).json("Successfully logged in.");
      } else {
        throw new Error("Passwords do not match.")
      };
    };
  } catch(err) {
    res.status(400).json(err);
  };
});

module.exports = router;
