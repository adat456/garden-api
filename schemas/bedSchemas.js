const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.bedNameSchema = {
    name: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 25 },
            errorMessage: "Garden bed name must be between 1 and 25 characters in length."
        },
        noDuplicateBedName: {
            custom: checkNoDuplicateBedName
        },
    },
};

exports.rolesSchema = {
    '*.title': {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 25 },
            errorMessage: "Role title must be between 1 and 25 characters in length."
        },
        noDuplicateRoleName: {
            custom: checkNoDuplicateTitleName,
            errorMessage: "A role with this title already exists. Please rename this title or an existing title."
        },
    },
    '**.id': {
        optional: false,
    },
    '**.value' : {
        trim: true,
    },
};

async function checkNoDuplicateBedName(value) {
    const duplicateBedName = await pool.query(
        "SELECT name FROM garden_beds WHERE name ~* ($1)",
        [value]
    );
    if (duplicateBedName.rowCount > 0) throw new Error ("Garden bed name must be unique.");
};

function checkNoDuplicateTitleName(value, {req}) {
    const allRoles = req.body;
    let ding = 0;
    allRoles.forEach(role => {
        if (role.title.toLowerCase() === value.toLowerCase()) ding += 1;
    });
    // greater than 1, not 0, because this title is already included in req.body
    if (ding > 1) {
        return false;
    } else {
        return true;
    };
};