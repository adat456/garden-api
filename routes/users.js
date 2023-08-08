var express = require('express');
var router = express.Router();
const { checkSchema, validationResult, matchedData  } = require("express-validator");
const { createUserSchema, logInSchema, logOutSchema } = require("../schemas/userSchemas");
const userController = require("../controllers/userController");

// middleware
function accessValidatorResults(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      res.status(400).json(trimmedErrMsgsArr);
    } else {
      res.locals.validatedData = matchedData(req, {
        includeOptionals: true,
      });
      next();
    };
};

router.post("/create-account", checkSchema(createUserSchema, ["body"]), accessValidatorResults, userController.create_account);

router.post("/log-in", checkSchema(logInSchema, ["body"]), accessValidatorResults, userController.log_in);

router.get("/log-out", checkSchema(logOutSchema, ["cookies"]), accessValidatorResults, userController.log_out);

module.exports = router;
