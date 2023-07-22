var express = require('express');
var router = express.Router();
const { checkSchema  } = require("express-validator");
const { createUserSchema, logInSchema, logOutSchema } = require("../schemas/userSchema");
const userController = require("../controllers/userController");

router.post("/create-account", checkSchema(createUserSchema, ["body"]), userController.create_account);

router.post("/log-in", checkSchema(logInSchema, ["body"]), userController.log_in);

router.get("/log-out", checkSchema(logOutSchema, ["cookies"]), userController.log_out);

module.exports = router;
