const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

function convertCommaStringToArr(value) {
    if (value) {
        const arr = value.split(",");
        const trimmedArr = arr.map(value => value.trim());
        return trimmedArr;
    };
};

exports.vegSchema = {
    name: {
        optional: false,
        trim: true,
        isLength: { 
            options: { min: 1, max: 25 },
            errorMessage: "Plant name must be between 1 and 25 characters in length."
        },
    },

    description: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 500 },
            errorMessage: "Plant description may not exceed 500 characters."
        },
    },
    depth: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 25 },
            errorMessage: "Seed planting depth description may not exceed 25 characters."
        },
    },
    fruitSize: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 25 },
            errorMessage: "Fruit size description may not exceed 25 characters."
        },
    },

    growthConditions: {
        optional: true,
        isLength: {
            options: { max: 50 },
            errorMessage: "Growth conditions description may not exceed 25 characters."
        },
        convertGrowthConditionsToArr: {
            customSanitizer: convertCommaStringToArr
        },
    },
    sowingMethod: {
        optional: true,
        isLength: {
            options: { max: 50 },
            errorMessage: "Sowing method description may not exceed 25 characters."
        },
        convertSowingMethodToArr: {
            customSanitizer: convertCommaStringToArr
        },
    },
    growthHabit: {
        optional: true,
        isLength: {
            options: { max: 50 },
            errorMessage: "Growth habit description may not exceed 25 characters."
        },
        convertGrowthHabitToArr: {
            customSanitizer: convertCommaStringToArr
        },
    },

    'spacingArr.*': {
        optional: true,
        trim: true,
        isInt: {
            errorMessage: "Seed spacing must be an integer/numeric value."
        }
    },
    'dtmArr.*': {
        optional: true,
        trim: true,
        isInt: {
            errorMessage: "Days to maturity must be an integer/numeric value."
        }
    },
    'heightArr.*': {
        optional: true,
        trim: true,
        isInt: {
            errorMessage: "Height must be an integer/numeric value."
        }
    }
};