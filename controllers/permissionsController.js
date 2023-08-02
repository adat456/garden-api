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

// exports.determineUserPermissions = async function(beds, username, userid, app) {
//     let userPermissions = {};
//     // initializing each bedid key-value pair with an empty array 
//     beds.forEach(bed => {
//         userPermissions[bed.id] = []
//     });
//     // will end up looking like {22: ["fullpermissions"], 122: ["rolespermission"]}
//     try {
//         beds.forEach(async bed => {
//             // if user is the creator, just set "fullpermissions" as the value to the bed id's key
//             if (bed.username === username) {
//                 userPermissions[bed.id] = [...userPermissions[bed.id], "fullpermissions"];
//             } else {
//                 // if not the creator, try to find a matching member and then the member's role ID, if any
//                 const userMatch = bed.members.find(member => member.id === userid);
//                 if (!userMatch) throw new Error("You do not have permission to view or edit this board.");
//                 const userRoleId = userMatch.role;

//                 const permissionsLogReq = await pool.query(
//                     "SELECT * FROM permissions WHERE bedid = ($1)",
//                     [bed.id]
//                 );
//                 const permissionsLog = permissionsLogReq.rows[0];
//                 delete permissionsLog.bedid;
//                 delete permissionsLog.creatorid;
//                 const permissionsLogArr = Object.entries(permissionsLog);

//                 // iterating through the array of arrays
//                 permissionsLogArr.forEach(permissionsArr => {
//                     // if permission type is for member IDs, see if the array includes the user's id
//                     if (permissionsArr[0].includes("memberids") && permissionsArr[1].includes(userid)) {
//                         userPermissions[bed.id] = [...userPermissions[bed.id], permissionsArr[0].slice(0, -9)];
//                     };
//                     // if permission type is for role IDs, see if the array includes the user's role id
//                     if (permissionsArr[0].includes("roleids") && permissionsArr[1].includes(userRoleId)) {
//                         userPermissions[bed.id] = [...userPermissions[bed.id], permissionsArr[0].slice(0, -7)];
//                     };
//                 });
//             };
//         });

//         app.locals.userPermissions = userPermissions;
//     } catch(err) {
//         console.log(err.message);
//     };
// };

