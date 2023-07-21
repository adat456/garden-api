const { validationResult, matchedData } = require("express-validator");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_comments = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const { postid } = matchedData(req);
  
    async function pullComments(id, level, arr) {
      try {
        const pullCommentsReq = await pool.query(
          "SELECT * FROM comments WHERE postid = ($1)",
          [id]
        );
        if (pullCommentsReq.rowCount === 0) return;
        if (pullCommentsReq.rowCount > 0) {
          for (const comment of pullCommentsReq.rows) {
            comment.level = level;
            arr.push(comment);
            await pullComments(comment.id, level + 1, arr);
          };
        } else {
          throw new Error(res);
        };
      } catch(err) {
          console.error("Unable to pull comments: ", err.message);
      };
    };
  
    try {
      let finalCommentTree = [];
      let level = 0;
      await pullComments(postid, level, finalCommentTree);
      res.status(200).json(finalCommentTree);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.add_comment = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const { postid, content, id } = matchedData(req);

    const posted = new Date().toLocaleDateString();
  
    try {
      const addCommentReq = await pool.query(
        "INSERT INTO comments (id, postid, authorid, authorname, authorusername, posted, edited, content, likes, dislikes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [id, postid, res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, posted, null, content, [], []]
      )
      res.status(200).json("Added comment.");
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_comment = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const { content, id } = matchedData(req);

    const edited = new Date().toLocaleDateString();
  
    try {
      const getCommentReq = await pool.query(
        "SELECT * FROM comments WHERE id = ($1)",
        [id]
      );
      const commentAuthorUsername = getCommentReq.rows[0].authorusername;
      if (commentAuthorUsername === res.locals.username) {
        const updateCommentReq = await pool.query(
          "UPDATE comments SET content = ($1), edited = ($2) WHERE id = ($3)",
          [content, edited, id]
        );
        res.status(200).json("Comment successfully updated.");
      } else {
        throw new Error("You do not have permission to edit this comment as you are not the original author.");
      };
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.delete_comment = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const { id } = matchedData(req);
  
    try {
      const getCommentReq = await pool.query(
        "SELECT * FROM comments WHERE id = ($1)",
        [id]
      );
      const commentAuthorUsername = getCommentReq.rows[0].authorusername;
      if (commentAuthorUsername === res.locals.username) {
        const deleteCommentReq = await pool.query(
          "DELETE FROM comments WHERE id = ($1)",
          [id]
        );
        res.status(200).json("Comment successfully deleted.");
      } else {
        throw new Error("You do not have permission to delete this comment as you are not the original author.");
      };
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};