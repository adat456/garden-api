const { isNanoIdLength } = require("./shared");

function isValidRepeatingInterval(value) {
    const validValues = ["every", "every other", "every first", "every second", "every third", "every fourth"];
    if (validValues.includes(value)) {
        return true;
    } else {
        return false;
    };
};

exports.addTaskSchema = {
    id: {
        optional: false,
        checkIsValidId: {
            custom: isNanoIdLength,
            errorMessage: "Task ID should be 21 characters long and randomly generated."
        },
    },
    name: {
        optional: false,
        isLength: {
            options: { min: 1, max: 30 },
            errorMessage: "Must be between 1 and 30 characters long."
        },
    },
    description: {
        optional: true,
        isLength: {
            options: { max: 250 },
            errorMessage: "Must be no longer than 250 characters."
        },
    },
    duedate: {
        optional: true,
        isISO8601: {
            if: (value, { req }) => !req.body.startdate && !req.body.enddate,
            errorMessage: "Must be formatted YYYY-MM-DD.",
        },
    },
    startdate: {
        optional: false,
        isISO8601: {
            if: (value, { req }) => !req.body.duedate,
            errorMessage: "Must be formatted YYYY-MM-DD.",
        },
    },
    enddate: {
        optional: true,
        isISO8601: {
            if: (value, { req }) => req.body.startdate,
            errorMessage: "Must be formatted YYYY-MM-DD.",
        },
    },
    repeatsevery: {
        optional: true,
        isArray: {
            if: (value, { req }) => !req.body.duedate,
            options: { min: 2 },
            errorMessage: "Repeating frequency must be described by an array at least two elements long."
        },
    },
    'repeatsevery[0]': {
        optional: false,
        checkIsValidRepeatingInterval: {
            if: (value, { req }) => !req.body.duedate,
            custom: isValidRepeatingInterval,
            errorMessage: "Must be one of several pre-defined values (e.g., 'every', 'every other').",
        },
    },
    assignedtomembers: {
        optional: false,
        isArray: {
            errorMessage: "User assignees must be described by an array.",
        },
    },
    'assignedtomembers.*': {
        optional: false,
        isInt: {
            errorMessage: "User ID must be an integer/numeric value.",
        },
        toInt: true,
    },
    assignedtoroles: {
        optional: false,
        isArray: {
            errorMessage: "User assignees must be described by an array.",
        },
    },
    'assignedtoroles.*': {
        optional: false,
        checkValidRoleID: {
            custom: isNanoIdLength,
            errorMessage: "Role ID should be 21 characters long and randomly generated."
        },
    },
    private: {
        optional: false,
        isBoolean: {
            errorMessage: "Whether the task is private should be represented by a boolean.",
        },
        toBoolean: true,
    },
};

exports.updateTaskCompletionSchema = {
    taskid: {
        optional: false,
        checkIsValidId: {
            custom: isNanoIdLength,
            errorMessage: "Task ID should be 21 characters long and randomly generated."
        },
    },
    duedate: {
        optional: true,
        isISO8601: {
            if: (value, { req }) => req.body.startdate,
            errorMessage: "Must be formatted YYYY-MM-DD.",
        },
    },
}