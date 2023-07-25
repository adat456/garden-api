function isValidNotificationType(value) {
    const validNotificationsTypes = ["memberinvite", "memberconfirmation", "memberrejection", "rsvpinvite", "rsvpconfirmation"]
    if (validNotificationsTypes.includes(value)) {
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
    sendername: {},
    senderusername: {},
    recipientid: {
        optional: false,
        isInt: {
            errorMessage: "Recipient ID must be an integer/numeric value."
        },
        toInt: true,
    },
    message: {},
    dispatched: {
        optional: false,
        isDate: {
            errorMessage: "Dispatch date must be formatted YYYY/MM/DD."
        }
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
    eventid: {
        optional: true,
        trim: true,
        checkEventIdLength: {
            custom: isNanoIdLength,
            errorMessage: "Event ID should be 21 characters long and randomly generated."
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
        optional: true,
        isBoolean: {
            errorMessage: "Notification read status must be a boolean (either true or false)."
        },
    },
    responded: {
        optional: true,
        isBoolean: {
            errorMessage: "Notification response status must be a boolean (either true or false)."
        },
    },
};