exports.bedIdSchema = {
    bedid: {
        optional: false,
        isInt: {
            errorMessage: "Bed ID must be a number/integer."
        },
        toInt: true,
    },
};

exports.isNanoIdLength = function(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};
