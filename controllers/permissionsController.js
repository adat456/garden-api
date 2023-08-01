const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});
const format = require("pg-format");

exports.pull_permissions_log = async function(req, res, next) {
    const { bedid } = res.locals.validatedData;

    try {
        const pullPermissionsLogReq = await pool.query(
            "SELECT * FROM permissions WHERE bedid = ($1)",
            [bedid],
        );
        res.status(200).json(pullPermissionsLogReq.rows[0]);
    } catch(err) {
        console.log(err.message);
        res.status(404).json(err.message);
    };
};

exports.update_permissions_log = async function(req, res, next) {
    // e.g., permissions = "fullpermissions", group = "member" or "role"
    const { bedid, permissions } = res.locals.validatedData;
    const { permission, group, id } = permissions;

    try {
        const getIdsSQLQuery = format("SELECT %s FROM permissions WHERE bedid = %s", `${permission}${group}ids`, bedid);
        const getCurrentListOfIds = await pool.query(getIdsSQLQuery);

        let currentListOfIds = getCurrentListOfIds.rows[0][`${permission}${group}ids`];
        if (currentListOfIds.includes(id)) {
            currentListOfIds = currentListOfIds.filter(listId => listId !== id);
        } else {
            currentListOfIds = [...currentListOfIds, id];
        };

        const updateIdsSQLQuery = format("UPDATE permissions SET %s = ($1) WHERE bedid = %s", `${permission}${group}ids`, bedid);
        console.log(updateIdsSQLQuery);
        const updateListOfIds = await pool.query(
            updateIdsSQLQuery,
            [currentListOfIds]
        );
        res.status(200).json("Updated.");
    } catch(err) {
        console.log(err.message);
        res.status(404).json(err.message);
    };
};

// NOT ROUTES, but FUNCTIONS TO BE INCLUDED WHEN UPDATING MEMBERS

exports.createPermissionsLog = async function(bedid, creatorid) {
    try {
        const addPermissionsLogReq = await pool.query(
            "INSERT INTO permissions (bedid, creatorid) VALUES ($1, $2)",
            [bedid, creatorid]
        );
    } catch(err) {
        console.log(err.message);
        res.status(404).json(err.message);
    };
};
