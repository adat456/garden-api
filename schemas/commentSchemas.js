function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
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