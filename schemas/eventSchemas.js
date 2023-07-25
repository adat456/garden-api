const { isEqual, isAfter } = require("date-fns");
const { isISO8601 } = require("validator");

function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};

function isNanoIdLengthOrUndefined(value) {
    if (value === "undefined") {
        return true;
    } else {
        const returnValue = value.length == 21 ? true : false;
        return returnValue;
    };
};

function isAcceptedEventPublicValue(value) {
    if (value === "public" || value === "allmembers" || value === "somemembers") {
        return true;
    } else {
        return false;
    };
};

function isThereAtLeastOneParticipant(value) {
    if (value.length > 0) {
        return true;
    } else {
        return false;
    };
};

function isEndDateOnAfterStartDate(value) {
    const eventDate = value;
    if (!eventDate[1]) return true;

    const startDate = new Date(eventDate[0]);
    const endDate = new Date(eventDate[1]);
    if (eventDate[1]) {
        if (isEqual(endDate, startDate) || isAfter(endDate, startDate)) {
            return true;
        } else {
            return false;
        };
    };
};

function isEndTimeAfterStartTime(value, {req}) {
    const endTime = value;
    const { eventStartTime: startTime } = req.body;

    if (!endTime) return true;
    if (endTime) {
        if (endTime > startTime) {
            return true;
        } else {
            return false;
        };
    };
};

function isAcceptedRepeatEveryValue(value, {req}) {
    if (value === "weekly" || value === "biweekly" || value === "monthly") {
        return true;
    } else {
        return false;
    };
};

function isRepeatTillDateFormatValid(value, {req}) {
    return (isISO8601(value));
};

function isRSVPDateFormatValid(value, {req}) {
    return (isISO8601(value));
};

function isRSVPDateOnAfterToday(value, {req}) {
    const rsvpDate = new Date(value);
    const today = new Date();
    const slicedToday = today.toISOString().slice(0, 10);
    if ((value === slicedToday) || isAfter(rsvpDate, today)) {
        return true;
    } else {
        return false;
    };
};

function isRSVPDateBeforeOnEventStartDate(value, {req}) {
    const rsvpDate = new Date(value);
    const eventStartDate = new Date(req.body.eventDate[0]);
    if (isEqual(rsvpDate, eventStartDate) || isAfter(eventStartDate, rsvpDate)) {
        return true;
    } else {
        return false;
    };
};

function convertTagToLowercase(value) {
    return value.toLowerCase();
};

function ensureEveryTagIsUnique(value) {
    const uniqueEventTagsArr = [...new Set(value)];
    return uniqueEventTagsArr;
};

exports.eventBedIdSchema = {
    bedid: {
        optional: false,
        isInt: {
            errorMessage: "Bed ID must be a number/integer."
        },
        toInt: true,
    },
};

exports.addEventSchema = {
    id: {
        optional: false,
        trim: true,
        checkLength: {
            custom: isNanoIdLength,
            errorMessage: "Event ID must be 21 characters in length and should be randomly generated."
        },
    },
    creatorId: {
        optional: false,
        trim: true,
        isInt: {
            errorMessage: "Event creator ID must be a number/integer."
        },
        toInt: true,
    },
    creatorUsername: {
        // should these fields be omitted? can they be obtained with ID alone?
        // or should they be cross-referenced with the users database?
    },
    creatorName: {},
    eventName: {
        optional: false,
        trim: true,
        isLength: {
            options: { min: 1, max: 25 },
            errorMessage: "Event name length should be between 1 and 25 characters."
        },
    },
    eventDesc: {
        optional: true,
        trim: true,
        isLength: {
            options: { max: 250 },
            errorMessage: "Event description may not exceed 250 characters."
        },
    },
    eventLocation: {
        optional: false,
        notEmpty: {
            errorMessage: "Specify a location for this event."
        },
        trim: true,
        isLength: {
            options: { max: 250 },
            errorMessage: "Event location description may not exceed 250 characters."
        },
    },
    eventPublic: {
        optional: false,
        checkForValidEventPublicValue: {
            custom: isAcceptedEventPublicValue,
            errorMessage: "Event publicity level should be set to 'public', 'allmembers', or 'somemembers'."
        },
    },
    eventParticipants: {
        optional: true,
        isArray: {
            errorMessage: "Event participants must be described by an array of their user IDs."
        },
        checkNumParticipants: {
            if: (value, {req}) => req.body.eventPublic === "somemembers",
            custom: isThereAtLeastOneParticipant,
            errorMessage: "No participants have been invited to this event. Please add participants or change the public level of the event.",
        },
    },
    eventDate: {
        optional: false,
        checkEventEndDate: {
            custom: isEndDateOnAfterStartDate,
            errorMessage: "The event end date must take place after the event start date."
        }
    },
    eventStartTime: {
        optional: false,
        notEmpty: {
            errorMessage: "Specify a start time."
        },
        isTime: {
            if: (value) => value,
            errorMessage: "Time should be formatted according to a 24-hour clock."
        },
    },
    eventEndTime: {
        optional: false,
        notEmpty: {
            errorMessage: "Specify an end time."
        },
        isTime: {
            if: (value) => value,
            errorMessage: "Time should be formatted according to a 24-hour clock."
        },
        checkEventEndTime: {
            custom: isEndTimeAfterStartTime,
            errorMessage: "The event end time must take place after the event start time."
        },
    },
    repeating: {
        optional: false,
        isBoolean: {
            errorMessage: "Event must be either a repeating event (true) or a standalone event (false)."
        },
        toBoolean: true,
    },
    repeatEvery: {
        optional: true,
        trim: true,
        checkForValidRepeatEveryValue: {
            if: (value, {body}) => body.repeating,
            custom: isAcceptedRepeatEveryValue,
            errorMessage: "Events may only repeat on a weekly, biweekly, or monthly basis. Select a repeating interval."
        },
    },
    repeatTill: {
        optional: true,
        checkForValidRepeatTillDateFormat: {
            if: (value, {body}) => body.repeating,
            custom: isRepeatTillDateFormatValid,
            errorMessage: "Repeat till date must be formatted YYYY-MM-DD."
        },
    },
    repeatId: {
        optional: true,
        trim: true,
        checkLength: {
            if: (value, {body}) => body.repeating,
            custom: isNanoIdLength,
            errorMessage: "Repeat event ID must be 21 characters in length and should be randomly generated."
        },
    },
    rsvpNeeded: {
        optional: false,
        isBoolean: {
            errorMessage: "Event must either require an RSVP (true) or not (false)."
        },
        toBoolean: true
    },
    rsvpDate: {
        optional: true,
        checkForValidRSVPDateFormat: {
            if: (value, {body}) => body.rsvpNeeded,
            custom: isRSVPDateFormatValid,
            errorMessage: "RSVP date must be formatted YYYY-MM-DD."
        },
        checkRSVPDateIsOnAfterToday: {
            if: (value, {body}) => body.rsvpNeeded,
            custom: isRSVPDateOnAfterToday,
            errorMessage: "The RSVP date may not be earlier than today."
        },
        checkRSVPDateIsBeforeOnEventDate: {
            if: (value, {body}) => body.rsvpNeeded,
            custom: isRSVPDateBeforeOnEventStartDate,
            errorMessage: "If requiring RSVPs, the RSVP by date must land before or on the event start date."
        },
    },
    'tags.*': {
        optional: true,
        trim: true,
        makeLowercase: {
            customSanitizer: convertTagToLowercase,
        },
    },
    tags: {
        optional: true,
        includeOnlyUniqueTags: {
            customSanitizer: ensureEveryTagIsUnique,
        },
    }
};

exports.deleteEventSchema = {
    eventid: {
        optional: false,
        trim: true,
        checkEventIdLength: {
            custom: isNanoIdLength,
            errorMessage: "Event ID should be 21 characters in length and should be randomly generated."
        },
    },
    repeatid: {
        optional: true,
        trim: true,
        checkRepeatIdLength: {
            custom: isNanoIdLengthOrUndefined,
            errorMessage: "Repeat ID should be 21 characters in length and should be randomly generated."
        },
    }
};