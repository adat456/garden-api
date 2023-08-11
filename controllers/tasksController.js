const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});
const { parseISO, getDay, nextDay, eachDayOfInterval, eachMonthOfInterval, addDays } = require("date-fns");

exports.pull_tasks = async function(req, res, next) {
    const { bedid } = res.locals.validatedData;
   
    try {
        let tasks = [];

        const pullPublicTasksReq = await pool.query(
            "SELECT * FROM tasks WHERE bedid = ($1) AND private = ($2)",
            [bedid, false]
        );
        tasks = [...pullPublicTasksReq.rows];

        // pulls all private tasks if user has permissions
        if (res.locals.userPermissions.includes("fullpermissions") || res.locals.userPermissions.includes("taskspermission")) {
            const pullAllPrivateTasksReq = await pool.query(
                "SELECT * FROM tasks WHERE bedid = ($1) AND private = ($2)",
                [bedid, true]
            );
            tasks = [...tasks, ...pullAllPrivateTasksReq.rows];
        } else {
            // getting user's role ID, if user has been assigned a role
            const getMembersReq = await pool.query(
                "SELECT members FROM garden_beds WHERE id = ($1)",
                [bedid]
            );
            const memberMatch = getMembersReq.rows[0].members.find(member => member.id === res.locals.user.id);
            const usersRoleID = memberMatch.role;

            // pulling all private tasks where user has been assigned, either as a member or as a role
            const pullPrivateTasksForUserReq = await pool.query(
                "SELECT * FROM tasks WHERE bedid = ($1) AND private = ($2) AND (assignedtomembers @> ($3) OR assignedtoroles @> ($4))",
                [bedid, true, [res.locals.user.id], [usersRoleID]]
            );
            tasks = [...tasks, ...pullPrivateTasksForUserReq.rows];
        };
        
        res.status(200).json(tasks);
    } catch(err) {
        console.log(err.message);
        res.status(400).json(err.message);
    };
};

exports.add_task = async function(req, res, next) {
    const { bedid, id, name, description, duedate, startdate, enddate, repeatsevery, assignedtomembers, assignedtoroles, private } = res.locals.validatedData;
    const assignedby = res.locals.user.id;
    const datecreated = new Date().toISOString().slice(0, 10);
    const completeddates = JSON.stringify([]);
    const completed = false;

    try {
        // auth
        if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("taskspermission")) throw new Error("You do not have permission to add tasks.");

        // numbers corresponding to each weekday for date-fns fx
        const weekdayNums = {
            "sunday": 0,
            "monday": 1,
            "tuesday": 2,
            "wednesday": 3,
            "thursday": 4,
            "friday": 5,
            "saturday": 6
        };
        let repeatingduedates = [];

        // note that repeat dates are generated from start date to end date INCLUSIVE
        if (repeatsevery.length >= 2) {
            // use each repeating weekday to generate a smaller array of due dates, to be added to the repeatingduedates array
            const repeatingWeekdays = repeatsevery.slice(1);
            repeatingWeekdays.forEach(repeatingWeekday => {
                // INITIALIZING VARIABLES DEPENDING ON REPEAT INTERVAL
                
                let startDateDayNum, repeatingWeekdayNum; // should both be a number representing a day of the week
                if (repeatsevery[0] === "every" || repeatsevery[0] === "every other") {
                    startDateDayNum = getDay(parseISO(startdate)); 
                    repeatingWeekdayNum = weekdayNums[repeatingWeekday];
                };

                let monthStartDates, firstWeekdaysOfEachMonth; // should both be arrays of dates, one date for each month (first day date and first repeating weekday date of each month)
                if (repeatsevery[0] === "every first" || repeatsevery[0] === "every second" || repeatsevery[0] === "every third" || repeatsevery[0] === "every fourth") {
                    repeatingWeekdayNum = weekdayNums[repeatingWeekday];
                    // EXAMPLE... continued in the "every first" and "every second" cases
                    // if "every first monday"...
                    // get the first day of every month from start date to end date 
                    monthStartDates = eachMonthOfInterval({
                        start: parseISO(startdate),
                        end: parseISO(enddate)
                    });
                    firstWeekdaysOfEachMonth = monthStartDates.map(monthStartDate => {
                        // if the first day of a month is a monday, return it
                        if (getDay(monthStartDate) === repeatingWeekdayNum) {
                            return monthStartDate;
                        // if the first day of a month is NOT a monday, find the next monday and return it
                        } else {
                            return nextDay(monthStartDate, repeatingWeekdayNum)
                        };
                    });
                };
                
                // ADDING TO repeatingduedates BASED ON REPEAT INTERVAL AND CURRENT repeatingWeekday
                switch (repeatsevery[0]) {
                    case "every":
                        // if the start date and the repeating weekday are the same day of the week (e.g., Monday), add all weekly dates from start to end (inclusive) to the due dates array
                        if (startDateDayNum === repeatingWeekdayNum) {
                            const weeklyDueDates = eachDayOfInterval({
                                start: parseISO(startdate),
                                end: parseISO(enddate)
                            }, { step: 7 });
                            const ISOweeklyDueDates = weeklyDueDates.map(date => date.toISOString().slice(0, 10));
                            repeatingduedates = [...repeatingduedates, ...ISOweeklyDueDates];
                        // if the start date and the repeating weekday are not the same day of the week, find the closest repeating weekday to the start date and add all weekly dates from that to the end date (inclusive)
                        } else {
                            const nextRepeatingWeekday = nextDay(parseISO(startdate), repeatingWeekdayNum);
                            const weeklyDueDates = eachDayOfInterval({
                                start: nextRepeatingWeekday,
                                end: parseISO(enddate)
                            }, { step: 7 });
                            const ISOweeklyDueDates = weeklyDueDates.map(date => date.toISOString().slice(0, 10));
                            repeatingduedates = [...repeatingduedates, ...ISOweeklyDueDates];
                        };
                        break;
                    case "every other":
                        if (startDateDayNum === repeatingWeekdayNum) {
                            const weeklyDueDates = eachDayOfInterval({
                                start: parseISO(startdate),
                                end: parseISO(enddate)
                            }, { step: 14 });
                            const ISOweeklyDueDates = weeklyDueDates.map(date => date.toISOString().slice(0, 10));
                            repeatingduedates = [...repeatingduedates, ...ISOweeklyDueDates];
                        } else {
                            const nextRepeatingWeekday = nextDay(parseISO(startdate), repeatingWeekdayNum);
                            const weeklyDueDates = eachDayOfInterval({
                                start: nextRepeatingWeekday,
                                end: parseISO(enddate)
                            }, { step: 14 });
                            const ISOweeklyDueDates = weeklyDueDates.map(date => date.toISOString().slice(0, 10));
                            repeatingduedates = [...repeatingduedates, ...ISOweeklyDueDates];
                        };
                        break;
                    case "every first":
                        // loop through all first mondays, convert to YYYY-MM-DD, and add to repeatingduedates if between start date and end date
                        firstWeekdaysOfEachMonth.forEach(firstWeekday => {
                            const ISOfirstWeekday = firstWeekday.toISOString().slice(0, 10);
                            if (ISOfirstWeekday >= startdate && ISOfirstWeekday <= enddate) {
                                repeatingduedates.push(ISOfirstWeekday);
                            };
                        });
                        break;
                    case "every second":
                        // loop through all first mondays and add 7 days to each to get the second monday
                        const secondWeekdaysOfEachMonth = firstWeekdaysOfEachMonth.map(firstWeekday => (
                            addDays(firstWeekday, 7)
                        ));
                        // then loop through all second mondays, conver to ISO, and add to repeatingduedates if between start date and end date
                        secondWeekdaysOfEachMonth.forEach(secondWeekday => {
                            const ISOsecondWeekday = secondWeekday.toISOString().slice(0, 10);
                            if (ISOsecondWeekday >= startdate && ISOsecondWeekday <= enddate) {
                                repeatingduedates.push(ISOsecondWeekday);
                            };
                        });
                        break;
                    case "every third":
                        const thirdWeekdaysOfEachMonth = firstWeekdaysOfEachMonth.map(firstWeekday => (
                            addDays(firstWeekday, 14)
                        ));
                        thirdWeekdaysOfEachMonth.forEach(thirdWeekday => {
                            const ISOthirdWeekday = thirdWeekday.toISOString().slice(0, 10);
                            if (ISOthirdWeekday >= startdate && ISOthirdWeekday <= enddate) {
                                repeatingduedates.push(ISOthirdWeekday);
                            };
                        });
                        break;
                    case "every fourth":
                        const fourthWeekdaysOfEachMonth = firstWeekdaysOfEachMonth.map(firstWeekday => (
                            addDays(firstWeekday, 21)
                        ));
                        fourthWeekdaysOfEachMonth.forEach(fourthWeekday => {
                            const ISOfourthWeekday = fourthWeekday.toISOString().slice(0, 10);
                            if (ISOfourthWeekday >= startdate && ISOfourthWeekday <= enddate) {
                                repeatingduedates.push(ISOfourthWeekday);
                            };
                        });
                        break;
                };
            });
        };

        const addTaskReq = await pool.query(
            "INSERT INTO tasks (bedid, id, name, description, duedate, startdate, enddate, repeatsevery, assignedby, datecreated, repeatingduedates, completeddates, completed, assignedtomembers, assignedtoroles, private) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)",
            [bedid, id, name, description, duedate, startdate, enddate, repeatsevery, assignedby, datecreated, repeatingduedates, completeddates, completed, assignedtomembers, assignedtoroles, private]
        );
        res.status(200).json("Task added.");
    } catch(err) {
        console.log(err.message);
        res.status(400).json(err.message);
    };
};

exports.update_task_completion = async function(req, res, next) {
    const { taskid, duedate } = res.locals.validatedData;
    // duedate is optional, only for updating repeating tasks

    try {
        const pullTask = await pool.query(
            "SELECT * FROM tasks WHERE id = ($1)",
            [taskid]
        );
        const task = pullTask.rows[0];

        // auth
        if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("tasks") && !task.assignedMembers.includes(res.locals.user.id) && !task.assignedRoles.includes(res.locals.userRoleID)) throw new Error("You do not have permission to modify the completion status of this task.");

        // updates depending on non-repeating vs repeating
        if (task.duedate) {
            const toggleTaskCompletion = await pool.query(
                "UPDATE tasks SET completed = NOT completed WHERE id = ($1)",
                [taskid]
            );
        } else if (task.repeatsevery.length >= 2) {
            if (!task.repeatingduedates.includes(duedate)) throw new Error("The provided due date is not one of the dates when this task needs to be completed.");
            // different actions depending on whether a matching due date can be found in one of the completed date objects
            const matchingDueDate = task.completeddates.find(completionRecord => completionRecord.duedate === duedate);
            if (matchingDueDate) {
                const filteredCompletionRecords = task.completeddates.filter(completionRecord => completionRecord.duedate !== duedate);
                const updateCompletionRecords = await pool.query(
                    "UPDATE tasks SET completeddates = ($1) WHERE id = ($2)",
                    [JSON.stringify(filteredCompletionRecords), taskid]
                );
            } else {
                const todaysDate = new Date().toISOString().slice(0, 10);
                const addedCompletionRecords = [...task.completeddates, { duedate, completiondate: todaysDate }];
                const updateCompletionRecords = await pool.query(
                    "UPDATE tasks SET completeddates = ($1) WHERE id = ($2)",
                    [JSON.stringify(addedCompletionRecords), taskid]
                );
            };
        };

        res.status(200).json("Task completion updated.");
    } catch(err) {
        console.log(err.message);
        res.status(400).json(err.message);
    };
};

exports.update_task = async function(req, res, next) {

};

exports.delete_task = async function(req, res, next) {

};