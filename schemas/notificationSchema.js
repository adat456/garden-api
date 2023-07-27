function isValidNotificationType(value) {
    const validNotificationsTypes = ["memberinvite", "memberconfirmation", "memberrejection", "rsvpinvite", "rsvpconfirmation"]
    if (validNotificationsTypes.includes(value)) {
        return true;
    } else {
        return false;
    };
};

function isValidResponseType(value) {
    const validResponseTypes = ["", "confirmation", "rejection"];
    if (validResponseTypes.includes(value)) {
        return true;
    } else {
        return false;
    };
};

function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};

// let { senderid, sendername, senderusername, recipientid, message, dispatched, type, bedid, eventid } = req.body;     
exports.addNotificationSchema = {
    senderid: {
        optional: false,
        isInt: {
            errorMessage: "Sender ID must be an integer/numeric value."
        },
        toInt: true,
    },
    sendername: {
        optional: false,
        trim: true,
        notEmpty: {
            errorMessage: "Sender name required."
        },
    },
    senderusername: {
        optional: false,
        trim: true,
        notEmpty: {
            errorMessage: "Sender username required."
        },
    },
    recipientid: {
        optional: false,
        isInt: {
            errorMessage: "Recipient ID must be an integer/numeric value."
        },
        toInt: true,
    },
    dispatched: {
        optional: false,
        isISO8601: true,
    },
    type: {
        optional: false,
        trim: true,
        checkValidNotificationType: {
            custom: isValidNotificationType,
            errorMessage: "Notification type must be one of several pre-determined accepted values."
        },
    },
    bedid: {
        optional: true,
        trim: true,
        isInt: {
            errorMessage: "Bed ID must be an integer/numeric value."
        },
        toInt: true,
    },
    bedname: {
        optional: true,
        trim: true,
    },
    eventid: {
        optional: true,
        trim: true,
        checkEventIdLength: {
            custom: isNanoIdLength,
            errorMessage: "Event ID should be 21 characters long and randomly generated."
        },
    },
    eventname: {
        optional: true,
        trim: true,
    },
    eventdate: {
        optional: true,
        isArray: {
            errorMessage: "Event dates should be described by an array."
        },
    },
    rsvpdate: {
        optional: true,
        isISO8601: {
            errorMessage: "RSVP by date (formatted YYYY-MM-DD) required."
        },
    },
};

exports.notificationIdSchema = {
    notifid: {
        optional: false,
        isInt: {
            errorMessage: "Notification ID must be an integer/numeric value."
        },
        toInt: true,
    },
};

exports.updateNotificationSchema = {
    read: {
        optional: false,
        isBoolean: {
            errorMessage: "Notification read status must be a boolean (either true or false)."
        },
        toBoolean: true,
    },
    responded: {
        optional: false,
        trim: true,
        toLowerCase: true,
        checkValidResponseType: {
            custom: isValidResponseType,
            errorMessage: "Response value must be equal to an empty string, 'confirmation', or 'rejection'.",
        },
    },
};