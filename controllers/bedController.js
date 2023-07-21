const { validationResult, matchedData } = require("express-validator");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_beds_data = async function(req, res, next) {
    try {
      const getUserBoardsReq = await pool.query(
        "SELECT * FROM garden_beds WHERE username = ($1)",
        [res.locals.username]
      );
      const getMemberBoardsReq = await pool.query(
        "SELECT * FROM garden_beds WHERE members::JSONB @> ($1)",
        // "SELECT * FROM garden_beds WHERE members::JSONB @> '[{ ($1) : ($2) }]'",
        // [JSON.stringify("username"), JSON.stringify(res.locals.username)]
        // above code didn't work, nor when "username" was placed directly as the first argument instead of passing it in as a parameter... would get error message "invalid input syntax for type json"
        [JSON.stringify([{ "username": res.locals.username }])]
      );
      res.status(200).json([...getUserBoardsReq.rows, ...getMemberBoardsReq.rows]);
    } catch(err) {
      console.log(err.message);
      res.status(400).json(err.message);
    };
};

exports.create_bed = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgs = validationResults.formatWith(error => error.msg);
        const errMsgsArr = errMsgs.array();
        res.status(400).json(errMsgsArr);
        return;
    };
    const validatedData = matchedData(req);
    const name = validatedData.name;

    const { hardiness, sunlight, soil, whole, length, width, gridmap, public, created } = req.body;
    const gridmapJSON = JSON.stringify(gridmap);
      
    try {
      // create the new bed and retrive its id
      const addNewBedReq = await pool.query(
        "INSERT INTO garden_beds (hardiness, sunlight, soil, whole, length, width, gridMap, name, public, created, username, numhearts, numcopies, seedbasket, members, roles, eventtags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *",
        [hardiness, sunlight, soil, whole, length, width, gridmapJSON, name, public, created, res.locals.username, 0, 0, JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), []]
      );
      const newBoard = addNewBedReq.rows[0];
  
      res.status(200).json(newBoard);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_bed = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgs = validationResults.formatWith(error => error.msg);
        const errMsgsArr = errMsgs.array();
        res.status(400).json(errMsgsArr);
        return;
    };
    const validatedData = matchedData(req);
    const name = validatedData.name;

    let { bedid } = req.params;
    bedid = Number(bedid);
    const { hardiness, sunlight, soil, whole, length, width, gridmap, public } = req.body;
    const gridmapJSON = JSON.stringify(gridmap);
      
    try {
      const updateBedReq = await pool.query(
        "UPDATE garden_beds SET hardiness = ($1), sunlight = ($2), soil = ($3), whole = ($4), length = ($5), width = ($6), gridmap = ($7), name = ($8), public = ($9) WHERE id = ($10)",
        [hardiness, sunlight, soil, whole, length, width, gridmapJSON, name, public, bedid]
      );
      res.status(200).json("Successfully updated bed.");
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_gridmap = async function(req, res, next) {
  let { bedid } = req.params;
  bedid = Number(bedid); 
  const gridmap = req.body;
  const gridmapJSON = JSON.stringify(gridmap);

  try {
    const req = await pool.query(
      "UPDATE garden_beds SET gridmap = ($1) WHERE id = ($2)",
      [gridmapJSON, bedid]
    );
    res.status(200).json("Gridmap successfully updated.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};

exports.update_roles = async function(req, res, next) {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
      const errMsgs = validationResults.formatWith(error => error.msg);
      const errMsgsArr = errMsgs.array();
      res.status(400).json(errMsgsArr);
      return;
  };

  const validatedData = matchedData(req);
  let roles = [];
  for (const role in validatedData) {
    roles.push(validatedData[role]);
  };
  const rolesJSON = JSON.stringify(roles);

  let { bedid } = req.params;
  bedid = Number(bedid); 

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
};

exports.update_members = async function(req, res, next) {
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
};

exports.delete_bed = async function(req, res, next) {
    let { bedid } = req.params;
    bedid = Number(bedid);
  
    try {
      const deleteReq = await pool.query(
        "DELETE FROM garden_beds WHERE id = ($1)",
        [bedid]
      );
      res.status(200).json("Bed successfully deleted.");
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.pull_all_public_beds = async function(req, res, next) {
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
};

