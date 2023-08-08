const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});
const format = require("pg-format");

exports.pull_personal_permissions = async function(req, res, next) {
    const { bedid } = res.locals.validatedData;

    let userPermissions = [];
    try {
        const bedMembersReq = await pool.query(
        "SELECT username, members FROM garden_beds WHERE id = ($1)",
        [bedid]
        );
        const { username, members } = bedMembersReq.rows[0];

        if (username === res.locals.user.username) {
            userPermissions.push("fullpermissions");
        } else {
            // finding an assigned role id, if any 
            const userMatch = members.find(member => member.id === res.locals.user.id);
            if (!userMatch) throw new Error("You do not have permission to view or edit this board.");
            const userRoleId = userMatch.role;

            const permissionsLogReq = await pool.query(
                "SELECT * FROM permissions WHERE bedid = ($1)",
                [bedid]
            );
            const permissionsLog = permissionsLogReq.rows[0];
            delete permissionsLog.bedid;
            delete permissionsLog.creatorid;
            const permissionsLogArr = Object.entries(permissionsLog);

            permissionsLogArr.forEach(permissionsArr => {
                if (permissionsArr[0].includes("memberids") && permissionsArr[1].includes(res.locals.user.id)) {
                    userPermissions.push(permissionsArr[0].slice(0, -9));
                };
                if (permissionsArr[0].includes("roleids") && permissionsArr[1].includes(userRoleId)) {
                    userPermissions.push(permissionsArr[0].slice(0, -7));
                };
            });
        };

        res.status(200).json(userPermissions);
    } catch(err) {
        console.log(err.message);
        res.status(400).json(err.message);
    };
};

exports.pull_permissions_log = async function(req, res, next) {
    try {
        // auth
        if (!res.locals.userPermissions.includes("fullpermissions")) throw new Error("You do not have permission to view permissions.");

        const { bedid } = res.locals.validatedData;

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
        //auth
        if (!res.locals.userPermissions.includes("fullpermissions")) throw new Error("You do not have permission to update permissions.");

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

        // sending a notification to any members or members with roles who's permissions changed
        if (group === "member") {
            req.io.emit(`notifications-${id}`, "permissionsupdate", bedid);
        } else if (group === "role") {
            const bedMembersReq = await pool.query(
                "SELECT members FROM garden_beds WHERE id = ($1)",
                [bedid]
            );
            const membersWithThisRole = bedMembersReq.rows[0].members.filter(member => member.role === id);
            console.log(membersWithThisRole);
            membersWithThisRole.forEach(member => {
                req.io.emit(`notifications-${member.id}`, "permissionsupdate", bedid);
            });
        };
        
        res.status(200).json("Updated.");
    } catch(err) {
        console.log(err.message);
        res.status(404).json(err.message);
    };
};

// NOT ROUTES, but FUNCTIONS

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
