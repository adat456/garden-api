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
      // returns all boards where user is the creator...
      const getUserBoardsReq = await pool.query(
        "SELECT * FROM garden_beds WHERE username = ($1)",
        [res.locals.username]
      );
      // ...where the user is a member...
      const getMemberBoardsReq = await pool.query(
        "SELECT * FROM garden_beds WHERE members::JSONB @> ($1)",
        // "SELECT * FROM garden_beds WHERE members::JSONB @> '[{ ($1) : ($2) }]'",
        // [JSON.stringify("username"), JSON.stringify(res.locals.username)]
        // above code didn't work, nor when "username" was placed directly as the first argument instead of passing it in as a parameter... would get error message "invalid input syntax for type json"
        [JSON.stringify([{ "username": res.locals.username, "status": "accepted" }])]
      );
      // and LIMITED info where the user is still pending
      const getPendingBoardsReq = await pool.query(
        "SELECT id, name, username, members, length, width, gridmap FROM garden_beds WHERE members::JSONB @> ($1)",
        [JSON.stringify([{ "username": res.locals.username, "status": "pending" }])]
      );
      res.status(200).json([...getUserBoardsReq.rows, ...getMemberBoardsReq.rows, ...getPendingBoardsReq.rows]);
    } catch(err) {
      console.log(err.message);
      res.status(400).json(err.message);
    };
};

exports.create_bed = async function(req, res, next) {
    const { name, hardiness, sunlight, soil, whole, length, width, gridmap, public, created } = res.locals.validatedData;
    const gridmapJSON = JSON.stringify(gridmap);
      
    try {
      // create the new bed and retrive its id
      const addNewBedReq = await pool.query(
        "INSERT INTO garden_beds (hardiness, sunlight, soil, whole, length, width, gridmap, name, public, created, username, numhearts, numcopies, seedbasket, members, roles, eventtags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *",
        [hardiness, sunlight, soil, whole, length, width, gridmapJSON, name, public, created, res.locals.username, [], [], JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), []]
      );
      const newBoard = addNewBedReq.rows[0];
  
      res.status(200).json(newBoard);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_bed = async function(req, res, next) {
    const { name, hardiness, sunlight, soil, whole, length, width, gridmap, public, bedid } = res.locals.validatedData;
    const gridmapJSON = JSON.stringify(gridmap);
      
    try {
      /// AUTHENTICATION: that it is the bed creator
      const getBedCreatorsUsername = await pool.query(
        "SELECT username FROM garden_beds WHERE id = ($1)",
        [bedid]
      );
      if (getBedCreatorsUsername?.rows[0]?.username !== res.locals.username) throw new Error("You are not the creator of this garden bed and do not have permission to make updates.");

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
  const { bedid, gridmap } = res.locals.validatedData;
  const gridmapJSON = JSON.stringify(gridmap);

  try {
    /// AUTHENTICATION: that it is the bed creator
    const getBedCreatorsUsername = await pool.query(
      "SELECT username FROM garden_beds WHERE id = ($1)",
      [bedid]
    );
    if (getBedCreatorsUsername?.rows[0]?.username !== res.locals.username) throw new Error("You are not the creator of this garden bed and do not have permission to make updates.");

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
  const { bedid, roles } = res.locals.validatedData;
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
};

exports.update_members = async function(req, res, next) {
  const { bedid, members } = res.locals.validatedData;
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
    const { bedid } = res.locals.validatedData;
  
    try {
      /// AUTHENTICATION: that it is the bed creator
      const getBedCreatorsUsername = await pool.query(
        "SELECT username FROM garden_beds WHERE id = ($1)",
        [bedid]
      );
      if (getBedCreatorsUsername?.rows[0]?.username !== res.locals.username) throw new Error("You are not the creator of this garden bed and do not have permission to make updates.");

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

exports.toggle_bed_favorites = async function(req, res, next) {
  const { bedid } = res.locals.validatedData;

  try {
    // get array of existing user IDs in the numhearts arr
    const getNumHearts = await pool.query(
      "SELECT numhearts FROM garden_beds WHERE id = ($1)",
      [bedid]
    );
    let numHearts = [...getNumHearts.rows[0].numhearts];
    
    // check if it includes the current user's id and remove or add accordingly
    if (numHearts.includes(res.locals.user.id)) {
      numHearts = numHearts.filter(user => user != res.locals.user.id);
    } else {
      numHearts = [...numHearts, res.locals.user.id];
    };

    // update numhearts in that bed 
    const updateNumHearts = await pool.query(
      "UPDATE garden_beds SET numhearts = ($1) WHERE id = ($2)",
      [numHearts, bedid]
    );

    res.status(200).json(numHearts);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
};

exports.copy_bed = async function(req, res, next) {
  const { numCopies, bed, created } = res.locals.validatedData;

  const { whole, length, width, gridmap, name, seedbasket, id } = bed;
  const gridmapJSON = JSON.stringify(gridmap);
  const seedbasketJSON = JSON.stringify(seedbasket);

  try {
    // get the copy version number by calculating how many IDs in the numCopies array are the user's ID
    const copyVersionNumber = numCopies.reduce((total, userid) => {
      if (userid === res.locals.user.id) {
        return total + 1;
      } else {
        return total;
      };
    }, 1);
    const copyBedReq = await pool.query(
      "INSERT INTO garden_beds (hardiness, sunlight, soil, whole, length, width, gridMap, name, public, created, username, numhearts, numcopies, seedbasket, members, roles, eventtags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
      [undefined, "", [], whole, length, width, gridmapJSON, `Copy ${copyVersionNumber} of ${name}`, false, created, res.locals.username, [], [], seedbasketJSON, JSON.stringify([]), JSON.stringify([]), []]
    );

    // also add user's id to the numCopies of the copied bed
    const updatedNumCopies = [...numCopies, res.locals.user.id];
    const incrementNumCopies = await pool.query(
      "UPDATE garden_beds SET numcopies = ($1) WHERE id = ($2)",
      [updatedNumCopies, id]
    );

    res.status(200).json(updatedNumCopies);
  } catch(err) {
    console.log(err.message);
    res.status(400).json(err.message);
  };
};

