const { validationResult, matchedData } = require("express-validator");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.save_veg_data = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const validatedData = matchedData(req, {
      includeOptionals: true,
    });
    const { name, description, depth, fruitSize, growthConditions: growthConditionsArr, sowingMethod: sowingMethodArr, growthHabit: growthHabitArr, spacingArr, dtmArr, heightArr } = validatedData;
    
    const { returning } = req.params;

    const { hardiness, water, light, lifecycle, plantingSzn, privateData } = req.body;
  
    try {
       const addNewVegReq = await pool.query(
        "INSERT INTO veg_data_users (name, description, plantingseason, fruitsize, growthhabit, growconditions, sowingmethod, light, depth, heightin, spacingin, water, hardiness, daystomaturity, lifecycle, privatedata, contributor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *",
        [name, description, plantingSzn, fruitSize, growthHabitArr, growthConditionsArr, sowingMethodArr, light, depth, heightArr, spacingArr, water, hardiness, dtmArr, lifecycle, privateData, res.locals.username]
      );
  
      if (returning === "single") {
        res.status(200).json(addNewVegReq.rows[0]);
      };
  
      if (returning === "all") {
        const pullAllVeg = await pool.query(
          "SELECT * FROM veg_data_users WHERE contributor = ($1)",
          [res.locals.username]
        );
        res.status(200).json(pullAllVeg.rows);
      };
      
    } catch(err) {
      console.log(err.message);
      res.status(400).json(err.message);
    };
};

exports.update_veg_data = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const validatedData = matchedData(req, {
      includeOptionals: true,
    });
    console.log(validatedData);
    const { name, description, depth, fruitSize, growthConditions: growthConditionsArr, sowingMethod: sowingMethodArr, growthHabit: growthHabitArr, spacingArr, dtmArr, heightArr } = validatedData;
    
    let { vegid } = req.params;
    vegid = Number(vegid);

    const { hardiness, water, light, lifecycle, plantingSzn, privateData } = req.body;
  
    try {
       const updateVegReq = await pool.query(
        "UPDATE veg_data_users SET name = ($1), description = ($2), plantingseason = ($3), fruitsize = ($4), growthhabit = ($5), growconditions = ($6), sowingmethod = ($7), light = ($8), depth = ($9), heightin = ($10), spacingin = ($11), water = ($12), hardiness = ($13), daystomaturity = ($14), lifecycle = ($15), privatedata = ($16) WHERE id = ($17)",
        [name, description, plantingSzn, fruitSize, growthHabitArr, growthConditionsArr, sowingMethodArr, light, depth, heightArr, spacingArr, water, hardiness, dtmArr, lifecycle, privateData, vegid]
      );
  
      const pullAllVeg = await pool.query(
        "SELECT * FROM veg_data_users WHERE contributor = ($1)",
        [res.locals.username]
      );
  
      res.status(200).json(pullAllVeg.rows);
    } catch(err) {
      console.log(err.message);
      res.status(400).json(err.message);
    };
  }