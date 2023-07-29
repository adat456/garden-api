const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

async function checkNoDuplicateBedName(value, {req}) {
    const duplicateBedName = await pool.query(
        "SELECT id FROM garden_beds WHERE name ~* ($1)",
        [value]
    );
    // this first condition checks to see if the bed name has remained the same while editing (in which case it's valid)
    // compares the ID belonging a matching garden bed/matching bed name to the current bed's ID (which was passed in through req.params)
    if (duplicateBedName.rowCount > 0) {
        if (duplicateBedName.rows[0]?.id === Number(req.params?.bedid)) {
            return true;
        } else {
            throw new Error("Garden bed name must be unique.");
        };
    } else {
        return true;
    };
};

function isAcceptableSunlightValue(value) {
    if (value === "full sun" || value === "partial sun" || value === "") {
        return true;
    } else {
        return false;
    };
};

function isAcceptableSoilValue(value) {
    const acceptableSoilValues = ["well-drained", "poorly drained", "high fertility", "low fertility", "acidic", "basic"];
    if (acceptableSoilValues.includes(value)) {
        return true;
    } else {
        return false;
    };
};

function isAcceptableDimensionValue(value) {
    if (value >= 1 && value <= 100) {
        return true;
    } else {
        return false;
    };
};

function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};

function isAcceptableMemberStatus(value) {
    if (value === "pending" || value === "accepted") {
        return true;
    } else {
        return false;
    };
};

function checkNoDuplicateTitleName(value, {req}) {
    const allRoles = req.body.roles;
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

exports.createEditBedSchema = {
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
    public: {
        optional: false,
        isBoolean: {
            errorMessage: "Whether the garden bed is public must be represented by a boolean."
        },
        toBoolean: true,
    },
    hardiness: {
        optional: true,
        isInt: {
            errorMessage: "Hardiness zone must be an integer/numeric value."
        },
        toInt: true,
    },
    sunlight: {
        optional: true,
        checkAcceptableSunlightValue: {
            custom: isAcceptableSunlightValue,
            errorMessage: "Sunlight value must be either 'partial sun' or 'full sun'.",
        },
    },
    soil: {
        optional: true,
        isArray: {
            errorMessage: "Soil characteristics must be represented by an array."
        },
    },
    'soil.*': {
        optional: true,
        checkAcceptableSoilValue: {
            custom: isAcceptableSoilValue,
            errorMessage: "Soil characteristic must be one of the pre-defined characteristics."
        },
    },
    whole: {
        optional: false,
        isBoolean: {
            errorMessage: "Whether the gridmap is whole should be described by a boolean."
        },
        toBoolean: true,
    },
    length: {
        optional: false,
        isInt: {
            errorMessage: "Length must be an integer/numeric value."
        },
        toInt: true,
        checkAppropriateLength: {
            custom: isAcceptableDimensionValue,
            errorMessage: "Length must be greater than/equal to 1 foot and less than/equal to 100 feet.",
        },
    },
    width: {
        optional: false,
        isInt: {
            errorMessage: "Width must be an integer/numeric value."
        },
        toInt: true,
        checkAppropriateWidth: {
            custom: isAcceptableDimensionValue,
            errorMessage: "Width must be greater than/equal to 1 foot and less than/equal to 100 feet.",
        },
    },
    gridmap: {
        notEmpty: {
            errorMessage: "Grid map must be specified."
        },
        isArray: {
            errorMessage: "Grid map must be described by an array of cell descriptions."
        },
    },
};

exports.dateOfBedCreationSchema = {
    created: {
        optional: false,
        isISO8601: {
            errorMessage: "Must specify date of creation formatted YYYY-MM-DD."
        },
    },
};

exports.membersSchema = {
    members: {
        optional: false,
        isArray: {
            errorMessage: "Members must be described by an array."
        },
    },
    '**.id': {
        optional: false,
        isInt: {
            errorMessage: "Each member ID must be an integer/numeric value."
        },
    },
    '**.username': {
        optional: false,
        notEmpty: {
            errorMessage: "Member username required.",
        },
    },
    '**.name': {
        optional: false,
        notEmpty: {
            errorMessage: "Member name required.",
        },
    },
    '**.role': {
        optional: false,
        checkIdLength: {
            custom: isNanoIdLength,
            errorMessage: "Role ID must be 21 characters and randomly generated."
        },
    },
    '**.invitedate': {
        optional: false,
        isISO8601: {
            errorMessage: "Invite date required, must be formatted as YYYY-MM-DD."
        },
    },
    '**.status': {
        optional: false,
        checkAcceptableMemberStatusValue: {
            custom: isAcceptableMemberStatus,
            errorMessage: "Member status must be either 'pending' or 'accepted'.",
        },
    },
    '**.finaldate': {
        optional: false,
        isISO8601: {
            errorMessage: "Finalized date required, must be formatted as YYYY-MM-DD."
        },
    },
};

exports.gridmapSchema = {
    '**.num': {
        optional: false,
        isInt: {
            errorMessage: "Cell number must be an integer as a string."
        },
    },
    '**.selected': {
        optional: false,
        isBoolean: {
            errorMessage: "Whether a cell is plantable should be represented by a boolean.",
        },
    },
    '**.horizontalwalkway': {
        optional: false,
        isBoolean: {
            errorMessage: "Whether a cell is a horizontal walkway should be represented by a boolean.",
        },
    },
    '**.verticalwalkway': {
        optional: false,
        isBoolean: {
            errorMessage: "Whether a cell is a vertical walkway should be represented by a boolean.",
        },
    },
    '**.customwalkway': {
        optional: false,
        isBoolean: {
            errorMessage: "Whether a cell is a custom walkway should be represented by a boolean.",
        },
    },
    '**.plantId': {
        optional: true,
        isInt: {
            errorMessage: "Plant ID must be an integer/numeric value."
        },
        toInt: true,
    },
    '**.plantName': {
        optional: true,
        trim: true,
    },
    '**.gridColor': {
        optional: true,
        isHexColor: {
            errorMessage: "Grid color must be a hexadecimal color value."
        },
    },
};

exports.rolesSchema = {
    '**.title': {
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
    'roles.*.id': {
        optional: false,
        checkIdLength: {
            custom: isNanoIdLength,
            errorMessage: "Role ID must be 21 characters and randomly generated."
        },
    },
    'roles.*.duties.*.id': {
        optional: false,
        isInt: {
            errorMessage: "Duty ID must be an integer/numeric value."
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

exports.bedIdSchema = {
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