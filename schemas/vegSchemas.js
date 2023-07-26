function isAcceptableWaterValue(value) {
    if (value === "Low" || value === "High" || value === "Average") {
        return true;
    } else {
        return false;
    };
};

function isAcceptableLightValue(value) {
    if (value === "Full Shade" || value === "Partial Shade" || value === "Full Sun") {
        return true;
    } else {
        return false;
    };
};

function isAcceptableLifecycleValue(value) {
    if (value === "Annual" || value === "Biennial" || value === "Perennial") {
        return true;
    } else {
        return false;
    };
};

function isAcceptablePlantingSznValue(value) {
    if (value === "Spring" || value === "Summer" || value === "Fall" || value === "Warm Season" || value === "Cool Season") {
        return true;
    } else {
        return false;
    };
};

function isAcceptableReturningValue(value) {
    if (value === "single" || value === "all") {
        return true;
    } else {
        return false;
    };
};

function convertCommaStringToArr(value) {
    if (value) {
        const arr = value.split(",");
        const trimmedArr = arr.map(value => value.trim());
        return trimmedArr;
    };
};

function dehyphenateSearchTerm(value) {
    return value.replace(/-/g, " ");
};

exports.vegSchema = {
    name: {
        optional: false,
        trim: true,
        isLength: { 
            options: { min: 1, max: 25 },
            errorMessage: "Must be 1-25 characters without whitespace."
        },
    },
    description: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 250 },
            errorMessage: "May not exceed 250 characters."
        },
    },
    'hardiness.*': {
        optional: true,
        isInt: {
            errorMessage: "Each hardiness zone must be an integer/numeric value."
        },
        toInt: true,
    },
    water: {
        optional: true,
        checkAcceptableWaterValue: {
            if: (value, {body}) => value,
            custom: isAcceptableWaterValue,
            errorMessage: "Water needs must be 'Low', 'Average', or 'High'."
        },
    },
    'light.*': {
        optional: true,
        trim: true,
        checkAcceptableLightValue: {
            custom: isAcceptableLightValue,
            erroMessage: "Light needs must be 'Full Shade', 'Partial Shade', and/or 'Full Sun'."
        },
    },
    growthConditions: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 50 },
            errorMessage: "May not exceed 50 characters."
        },
        convertGrowthConditionsToArr: {
            customSanitizer: convertCommaStringToArr
        },
    },
    lifecycle: {
        optional: true,
        checkAcceptableLifecycleValue: {
            if: (value, {body}) => value,
            custom: isAcceptableLifecycleValue,
            erroMessage: "Lifecycle must be 'Annual', 'Biennial', or 'Perennial'."
        },
    },
    'plantingSzn.*': {
        optional: true,
        trim: true,
        checkAcceptablePlantingSznValue: {
            custom: isAcceptablePlantingSznValue,
            erroMessage: "Light needs must be 'Spring', 'Summer', 'Fall', 'Warm Season', and/or 'Cool Season'."
        },
    },
    sowingMethod: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 50 },
            errorMessage: "May not exceed 50 characters."
        },
        convertSowingMethodToArr: {
            customSanitizer: convertCommaStringToArr
        },
    },
    depth: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 25 },
            errorMessage: "May not exceed 25 characters."
        },
    },
    'spacingArr.*': {
        optional: true,
        isInt: {
            options: { min: 0 },
            errorMessage: "Seed spacing must be an integer/numeric value greater than or equal to 0."
        },
    },
    'spacingArr[1]': {
        optional: true,
        checkIfGreaterThanSpacing0: {
            if: (value, {req}) => value && req.body.spacingArr[0],
            custom: (value, {req}) => value > req.body.spacingArr[0],
            errorMessage: "If provided, upper limit of spacing range must be greater than lower limit."
        },
    },
    growthHabit: {
        optional: true,
        isLength: {
            options: { max: 50 },
            errorMessage: "May not exceed 50 characters."
        },
        convertGrowthHabitToArr: {
            customSanitizer: convertCommaStringToArr
        },
    },
    'dtmArr.*': {
        optional: true,
        isInt: {
            options: { min: 0 },
            errorMessage: "Days to maturity must be an integer/numeric value greater than or equal to 0."
        },
    },
    'dtmArr[1]': {
        optional: true,
        checkIfGreaterThanDTM0: {
            if: (value, {req}) => value && req.body.dtmArr[0],
            custom: (value, {req}) => value > req.body.dtmArr[0],
            errorMessage: "If provided, upper limit of days to maturity range must be greater than lower limit."
        },
    },
    'heightArr.*': {
        optional: true,
        isInt: {
            options: { min: 0 },
            errorMessage: "Height must be an integer/numeric value greater than or equal to 0."
        },
    },
    'heightArr[1]': {
        optional: true,
        checkIfGreaterThanHeightg0: {
            if: (value, {req}) => value && req.body.heightArr[0],
            custom: (value, {req}) => value > req.body.heightArr[0],
            errorMessage: "If provided, upper limit of height range must be greater than lower limit."
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
    privateData: {
        optional: false,
        isBoolean: {
            errorMessage: "Privacy of added seed data must be described by a boolean value."
        },
        toBoolean: true,
    },
};

exports.returningWhatSchema = {
    returning: {
        optional: false,
        trim: true,
        checkAcceptableReturningValue: {
            custom: isAcceptableReturningValue,
            errorMessage: "Returning URI parameter should be 'single' or 'all'.",
        },
    },
};

exports.vegIdSchema = {
    vegid: {
        optional: false,
        trim: true,
        isInt: {
            errorMessage: "Vegetable ID must be an integer/numeric value.",
        },
        toInt: true,
    },
};

exports.searchVegSchema = {
    term: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1 },
            errorMessage: "Search term must be at least 1 character in length."
        },
        prepareSearchTerm: {
            customSanitizer: dehyphenateSearchTerm,
        },
        isAlpha: {
            errorMessage: "Search term may only contain letters (numbers are not permitted)."
        },
    },
};