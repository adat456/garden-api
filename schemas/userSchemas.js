const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

function capitalizeFirstLetter(value) {
    let firstChar = value.slice(0, 1);
    firstChar = firstChar.toUpperCase();
    let remainingChar = value.slice(1);
    remainingChar = remainingChar.toLowerCase();
    return firstChar + remainingChar;
};

async function isUsernameUnique(value) {
    const findMatchingUsername = await pool.query(
        "SELECT * FROM users WHERE username = ($1)",
        [value]
    );
    if (findMatchingUsername.rowCount > 0) throw new Error("Username already exists.");
};

async function isEmailUnique(value) {
    const findMatchingEmail = await pool.query(
        "SELECT * FROM users WHERE email = ($1)",
        [value]
    );
    if (findMatchingEmail.rowCount > 0) throw new Error("Email address is linked to an existing account.");
};

function arePasswordsTheSame(value, {req}) {
    console.log(value);
    console.log(req.body.password);
    return (value === req.body.password);
};

exports.createUserSchema = {
    firstName: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 20 },
            errorMessage: "First name length must be between 1 and 20 characters."
        },
        capitalizeFirstName: {
            customSanitizer: capitalizeFirstLetter
        },
    },
    lastName: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 20 },
            errorMessage: "First name length must be between 1 and 20 characters."
        },
        capitalizeLastName: {
            customSanitizer: capitalizeFirstLetter
        },
    },
    email: {
        optional: false,
        trim: true,
        isEmail: {
            errorMessage: "Email address must be valid (e.g., example@gmail.com)."
        },
        normalizeEmail: true,
        checkForExistingEmail: {
            custom: isEmailUnique
        },
    },
    username: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 8, max: 12 },
            errorMessage: "Username length must be between 8 and 12 characters."
        },
        isAlphanumeric: {
            errorMessage: "Username may only contain letters and numbers (non-alphanumeric symbols and spaces are not permitted)."
        },
        toLowerCase: true,
        checkForExistingUsernames: {
            custom: isUsernameUnique,
        },
    },
    password: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 8, max: 12 },
            errorMessage: "Password length must be between 8 and 12 characters."
        },
        isStrongPassword: {
            options: { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1, returnScore: false, },
            errorMessage: "Password is not strong enough. Please include at least one uppercase letter, one number, and one symbol."
        },
    },
    confirmPassword: {
        optional: false,
        trim: true,
        checkEqualityWithPassword: {
            custom: arePasswordsTheSame,
            errorMessage: "Password and password confirmation do not match."
        },
    },
};

exports.logInSchema = {
    username: {
        optional: false,
        trim: true,
        notEmpty: {
            errorMessage: "Username required to log in."
        },
        toLowerCase: true,
    },
    password: {
        optional: false,
        trim: true,
        notEmpty: {
            errorMessage: "Password required to log in."
        },
    },
};

exports.findUsersSchema = {
    searchTerm: {
        optional: false,
        trim: true,
        isLength: {
            options: {min: 1, max: 12 },
            errorMessage: "Username search length must be between 1 and 12 characters."
        },
        isAlphanumeric: {
            errorMessage: "Username search may only contain letters and numbers (non-alphanumeric symbols and spaces are not permitted)."
        },
        toLowerCase: true
    },
};

exports.logOutSchema = {
    jwt: {
        isJWT: {
            errorMessage: "Cookie does not contain a valid JWT."
        },
    },
};