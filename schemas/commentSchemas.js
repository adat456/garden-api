const { isValid } = require("date-fns");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};

async function isValidTopPostId(value) {
    const req = await pool.query(
        "SELECT id FROM posts WHERE id = ($1)",
        [value]
    );
    if (req.rowCount === 1) {
        return true;
    } else if (req.rowCount === 0) {
        throw new Error("Top post ID not found/valid.");
    };
};

exports.commentPostIdSchema = {
    postid: {
        optional: false,
        trim: true,
        checkLength: {
            custom: isNanoIdLength,
            errorMessage: "Parent ID should be 21 characters in length."
        }
    }
};

exports.commentContentSchema = {
    content: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 500 },
            errorMessage: "Post content length must be between 1 and 500 characters."
        }
    },
};

exports.commentTopPostIdSchema = {
    toppostid: {
        optional: false,
        notEmpty: {
            errorMessage: "Top post ID required for all comments."
        },
        checkIsValidTopPostId: {
            custom: isValidTopPostId,
        },
    },
};

exports.commentIdSchema = {
    id: {
        optional: false,
        trim: true,
        checkLength: {
            custom: isNanoIdLength,
            errorMessage: "Comment ID must be 21 characters in length and should be randomly generated."
        }
    }
};