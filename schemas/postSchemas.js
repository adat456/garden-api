function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};

function isAcceptableTable(value) {
    if (value === "posts" || value === "comments") {
        return true;
    } else {
        return false;
    };
};

exports.postSchema = {
    title: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 50 },
            errorMessage: "Post title length must be between 1 and 50 characters."
        }
    },
    content: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 500 },
            errorMessage: "Post content length must be between 1 and 500 characters."
        }
    },
    pinned: {
        optional: false,
        trim: true,
        isBoolean: {
            errorMessage: "Pinned status must be either true or false."
        }
    },
};

exports.postIdSchema = {
    id: {
        optional: false,
        trim: true,
        checkLength: {
            custom: isNanoIdLength,
            errorMessage: "Post ID must be 21 characters in length and should be randomly generated."
        }
    }
};

exports.updateReactionsSchema = {
    table: {
        optional: false,
        trim: true,
        checkAcceptableValue: {
            custom: isAcceptableTable,
            errorMessage: "Reactions may only be updated for rows in the posts or comments SQL tables."
        },
    },
    id: {
        optional: false,
        trim: true,
    },
    likes: {
        optional: true,
        isArray: true,
    },
    'likes.*': {
        optional: true,
        isInt: {
            errorMessage: "Each value in the array must be an integer representing the user's ID."
        }
    },
    dislikes: {
        optional: true,
        isArray: true,
    },
    'dislikes.*': {
        optional: true,
        isInt: {
            errorMessage: "Each value in the array must be an integer representing the user's ID."
        }
    },
};