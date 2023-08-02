exports.bedIdSchema = {
    bedid: {
        optional: false,
        isInt: {
            errorMessage: "Bed ID must be a number/integer."
        },
        toInt: true,
    },
};
