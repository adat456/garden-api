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
            options: { max: 250 },
            errorMessage: "Plant description may not exceed 250 characters."
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
        isInt: {
            options: { min: 0 },
            errorMessage: "Seed spacing must be an integer/numeric value greater than or equal to 0."
        }
    },
    'dtmArr.*': {
        optional: true,
        isInt: {
            options: { min: 0 },
            errorMessage: "Days to maturity must be an integer/numeric value greater than or equal to 0."
        }
    },
    'heightArr.*': {
        optional: true,
        isInt: {
            options: { min: 0 },
            errorMessage: "Height must be an integer/numeric value greater than or equal to 0."
        }
    }
};