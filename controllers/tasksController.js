const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_tasks = async function(req, res, next) {
    const { bedid } = res.locals.validatedData;
   
    try {
        let tasks = [];

        const pullPublicTasksReq = await pool.query(
            "SELECT * FROM tasks WHERE bedid = ($1) AND private = ($2)",
            [bedid, false]
        );
        tasks = [...pullPublicTasksReq.rows];

        // pulls all private tasks if user has permissions
        if (res.locals.userPermissions.includes("fullpermissions") || res.locals.userPermissions.includes("taskspermission")) {
            const pullAllPrivateTasksReq = await pool.query(
                "SELECT * FROM tasks WHERE bedid = ($1) AND private = ($2)",
                [bedid, true]
            );
            tasks = [...tasks, ...pullAllPrivateTasksReq.rows];
        } else {
            // getting user's role ID, if user has been assigned a role
            const getMembersReq = await pool.query(
                "SELECT members FROM garden_beds WHERE id = ($1)",
                [bedid]
            );
            const memberMatch = getMembersReq.rows[0].members.find(member => member.id === res.locals.user.id);
            const usersRoleID = memberMatch.role;

            // pulling all private tasks where user has been assigned, either as a member or as a role
            const pullPrivateTasksForUserReq = await pool.query(
                "SELECT * FROM tasks WHERE bedid = ($1) AND private = ($2) AND (assignedtomembers @> ($3) OR assignedtoroles @> ($4))",
                [bedid, true, [res.locals.user.id], [usersRoleID]]
            );
            tasks = [...tasks, ...pullPrivateTasksForUserReq.rows];
        };
        
        res.status(200).json(tasks);
    } catch(err) {
        console.log(err.message);
        res.status(400).json(err.message);
    };
};

exports.add_task = async function(req, res, next) {
    const { bedid, id, name, description, duedate, startdate, enddate, repeatsevery, assignedtomembers, assignedtoroles, private } = res.locals.validatedData;
    const assignedby = res.locals.user.id;
    const datecreated = new Date().toISOString().slice(0, 10);
    const completeddates = [];

    try {
        // auth
        if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("taskspermissions")) throw new Error("You do not have permission to add tasks.");

        const addTaskReq = await pool.query(
            "INSERT INTO tasks (bedid, id, name, description, duedate, startdate, enddate, repeatsevery, assignedby, datecreated, completeddates, assignedtomembers, assignedtoroles, private) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
            [bedid, id, name, description, duedate, startdate, enddate, repeatsevery, assignedby, datecreated, completeddates, assignedtomembers, assignedtoroles, private]
        );
        res.status(200).json("Task added.");
    } catch(err) {
        console.log(err.message);
        res.status(400).json(err.message);
    };
};