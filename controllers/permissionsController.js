const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

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
    const { bedid, permission, group, id } = res.locals.validatedData;

    try {
        const getCurrentListOfIds = await pool.query(
            "SELECT ($1) FROM permissions WHERE bedid = ($2)",
            [`${permission}${group}ids`, bedid]
        );
        let currentListOfIds = getCurrentListOfIds.rows[0][`${permission}${group}ids`];
        if (currentListOfIds.includes(id)) {
            currentListOfIds = currentListOfIds.filter(listId => listId !== id);
        } else {
            currentListOfIds = [...currentListOfIds, id];
        };
        const updateListOfIds = await pool.query(
            "UPDATE permissions SET ($1) = ($2) WHERE bedid = ($3)",
            [`${permission}${group}ids`, currentListOfIds, bedid]
        );
    } catch(err) {
        console.log(err.message);
        res.status(404).json(err.message);
    };
};

// NOT ROUTES, but FUNCTIONS TO BE INCLUDED WHEN UPDATING MEMBERS

exports.addPermissionsLog = async function(bedid, creatorid) {
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

exports.deletePermissionsLog = async function(bedid) {
    try {
        const deletePermissionsLogReq = await pool.query(
            "DELETE FROM permissions WHERE bedid = ($1)",
            [bedid]
        );
    } catch(err) {
        console.log(err.message);
        res.status(404).json(err.message);
    };
};