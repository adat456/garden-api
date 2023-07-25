const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

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
            errorMessage: "Must be 1-25 characters without whitespace."
        },
        noDuplicateRoleName: {
            custom: checkNoDuplicateTitleName,
            errorMessage: "A role with this title already exists. Rename this role title or an existing role title."
        },
    },
    '**.id': {
        optional: false,
        notEmpty: {
            errorMessage: "All roles and their duties must have an id."
        },
    },
    '**.value' : {
        trim: true,
        isLength: {
            options: { min: 1, max: 75 },
            errorMessage: "Must be 1-75 characters without whitespace. Remove if not needed."
        },
    },
};

exports.toggleLikesSchema = {
    bedid: {
        trim: true,
        isInt: {
            errorMessage: "A numeric bed ID must be provided.",
        },
        toInt: true,
    },
};

exports.copyBedSchema = {
    numCopies: {
        optional: false,
        isArray: {
            errorMessage: "The number of copies must be an array of user IDs."
        },
    },
    'numCopies.*': {
        optional: false,
        isInt: {
            errorMessage: "All user IDs must be an integer/numeric value."
        },
        toInt: true,
    },
    created: {
        trim: true,
        isISO8601: {
            errorMessage: "Date of board creation must be formatted YYYY-MM-DD."
        },
    },
    bed: {},
    'bed.whole': {
        isBoolean: {
            errorMessage: "Garden bed whole status must be a boolean value."
        },
        toBoolean: true,
    },
    'bed.length': {
        isInt: {
            errorMessage: "Bed length must be an integer/numeric value."
        },
        toInt: true,
    },
    'bed.width': {
        isInt: {
            errorMessage: "Bed width must be an integer/numeric value."
        },
        toInt: true,
    },
    'bed.name': {
        trim: true,
        notEmpty: {
            errorMessage: "Garden bed must have a name in order to be copied."
        },
    },
    'bed.gridmap': {
        notEmpty: {
            errorMessage: "Garden bed must have a gridmap in order to be copied."
        },
    },
    'bed.seedbasket': {
        notEmpty: {
            errorMessage: "Garden bed must have a seed basket in order to be copied."
        },
    },
    'bed.id': {
        isInt: {
            errorMessage: "Bed ID must be an integer/numeric value."
        },
        toInt: true,
    },
};