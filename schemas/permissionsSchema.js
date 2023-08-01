function isAcceptablePermissionValue(value) {
    const acceptableValues = [
        "fullpermissions",
        "memberspermission",
        "rolespermission",
        "eventspermission",
        "tagspermission",
        "postspermission",
        "postinteractionspermission"
    ];
    if (acceptableValues.includes(value)) {
        return true;
    } else {
        return false;
    };
};

function isAcceptableGroupValue(value) {
    if (value === "member" || value === "role") {
        return true;
    } else {
        return false;
    };
};

function isNanoIdLength(value) {
    const returnValue = value.length == 21 ? true : false;
    return returnValue;
};

function isAcceptableIdValue(value, {req}) {
    let returnValue;
    if (req.body.permissions.group === "member") {
        returnValue = typeof value === "number";
    } else if (req.body.permissions.group === "role") {
        returnValue = isNanoIdLength(value);
    };
    return returnValue;
};

exports.pullPermissionsLogSchema = {
    bedid: {
        optional: false,
        isInt: {
            errorMessage: "Bed ID must be represented by an integer/numeric value.",
        },
        toInt: true,
    },
};

exports.updatePermissionsLogSchema = {
    'permissions.permission': {
        optional: false,
        checkIsAcceptablePermissionValue: {
            custom: isAcceptablePermissionValue,
            errorMessage: "Permissions category must be one of the pre-defined permissions values.",
        },
    },
    'permissions.group': {
        optional: false,
        checkIsAcceptableGroupValue: {
            custom: isAcceptableGroupValue,
            errorMessage: "Group must be one of the pre-defined values."
        },
    },
    'permissions.id': {
        optional: false,
        checkIsAcceptableId: {
            custom: isAcceptableIdValue,
            errorMessage: "ID must be either a string (if a role ID) or an integer (if a user ID).",
        },
        toInt: {
            if: (value, {req}) => req.body.group === "member"
        },
    },
};