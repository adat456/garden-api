const { validationResult, matchedData } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Pool } = require("pg");
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

exports.create_account = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      console.log(trimmedErrMsgsArr);
      res.status(400).json(trimmedErrMsgsArr);
      return;
    };
    const { firstName, lastName, email, username, password } = matchedData(req);
    
    try {
        // hashing the password
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(password, salt);
        // inserting into the DB
        await pool.query(
          "INSERT INTO users (firstname, lastname, email, username, password, board_ids, added_veg_data, favorited_beds, copied_beds) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [ firstName, lastName, email, username, hashedPassword, [], [], [], [] ]
        );
        // creating the token
        const token = await jwt.sign({ username }, process.env.JWT_KEY, { expiresIn: "86400s"});
        // sending res with success message and cookie
        res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true }).json("Account created.");
    } catch(err) {
      console.log(err);
      res.status(400).json(err);
    };
};

exports.log_in = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      console.log(trimmedErrMsgsArr);
      res.status(400).json(trimmedErrMsgsArr);
      return;
    };
    const { username, password } = matchedData(req);
    console.log(username, password);
  
    try {
      const usernameReq = await pool.query(
        "SELECT password FROM users WHERE username ILIKE ($1)",
        [username]
      );
      if (usernameReq.rowCount == 0) {
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
      console.log(err);
      res.status(400).json(err);
    };
};

// should return everything except for the password
exports.pull_user_data = async function(req, res, next) {
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
};

exports.find_users = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      res.status(400).json(trimmedErrMsgsArr);
      return;
    };
    const { searchTerm } = matchedData(req);
  
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
};

// logging out a user by storing current JWT on blacklist (client will redirect to log-in screen)
exports.log_out = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      res.status(400).json(trimmedErrMsgsArr);
      return;
    };
    const { jwt: token } = matchedData(req);
  
    try {
      if (token) {
        const { exp } = await jwt.verify(token, process.env.JWT_KEY);
        // storing a key-value pair consisting of an arbitrary (but unique) key name and the actual JWT token
        const key = `blacklist_${token}`;
        await redisClient.set(key, token);
        // specifying the expiry date of the key-value pair with the key name and the expiry date of the token itself
        redisClient.expireAt(key, exp);
        
        res.status(200).json("Logged out. JWT added to blacklist.");
      } else {
        throw new Error("No JWT found.");
      };
    } catch(err) {
      next(err);
    };  
};