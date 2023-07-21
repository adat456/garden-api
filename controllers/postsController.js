const { validationResult, matchedData } = require("express-validator");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_posts = async function(req, res, next) {
    let { bedid } = req.params;
    bedid = Number(bedid);
  
    try {
      const pullPosts = await pool.query(
        "SELECT * FROM posts WHERE bedid = ($1) ORDER BY posted DESC",
        [bedid]
      );
      const pinnedPostsToTheFrontArr = [];
      pullPosts.rows.forEach(post => {
        if (post.pinned) pinnedPostsToTheFrontArr.unshift(post);
        if (!post.pinned) pinnedPostsToTheFrontArr.push(post);
      });
      res.status(200).json(pinnedPostsToTheFrontArr);
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.add_post = async function (req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      res.status(400).json(trimmedErrMsgsArr);
      return;
    };
    const validatedData = matchedData(req, {
      includeOptionals: true,
    });
    const { title, content, pinned, id } = validatedData;

    let { bedid } = req.params;
    bedid = Number(bedid);
    const posted = new Date().toLocaleDateString();
  
    try {
      const addPost = await pool.query(
        "INSERT INTO posts (bedid, authorid, authorname, authorusername, posted, edited, title, content, likes, dislikes, pinned, id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        [bedid, res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, posted, null, title, content, [], [], pinned, id]
      );
      res.status(200).json("Successfully added a post.");
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_post = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const validatedData = matchedData(req, {
      includeOptionals: true,
    });
    const { title, content, pinned, id } = validatedData;

    const edited = new Date().toLocaleDateString();
  
    try {
      const getPostReq = await pool.query(
        "SELECT * FROM posts WHERE id = ($1)",
        [id]
      );
      const postAuthorUsername = getPostReq.rows[0].authorusername;
      if (postAuthorUsername === res.locals.username) {
        const updatePostReq = await pool.query(
          "UPDATE posts SET title = ($1), content = ($2), edited = ($3), pinned = ($4) WHERE id = ($5)",
          [title, content, edited, pinned, id]
        );
        res.status(200).json("Post successfully updated.");
      } else {
        throw new Error("You do not have permission to edit this post as you are not the original author.");
      };
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.delete_post = async function(req, res, next) {
    const validationResults = validationResult(req);
    if (!validationResults.isEmpty()) {
        const errMsgsArr = validationResults.array();
        const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
        res.status(400).json(trimmedErrMsgsArr);
        return;
    };
    const validatedData = matchedData(req, {
      includeOptionals: true,
    });
    const { id } = validatedData;
  
    try {
      const getPostReq = await pool.query(
        "SELECT * FROM posts WHERE id = ($1)",
        [id]
      );
      const postAuthorUsername = getPostReq.rows[0].authorusername;
      if (postAuthorUsername === res.locals.username) {
        const deletePostReq = await pool.query(
          "DELETE FROM posts WHERE id = ($1)",
          [id]
        );
        res.status(200).json("Post successfully deleted.");
      } else {
        throw new Error("You do not have permission to delete this post as you are not the original author.");
      };
    } catch(err) {
      console.log(err.message);
      res.status(404).json(err.message);
    };
};

exports.update_reactions = async function(req, res, next) {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
      const errMsgsArr = validationResults.array();
      const trimmedErrMsgsArr = errMsgsArr.map(error => { return {msg: error.msg, field: error.path}});
      res.status(400).json(trimmedErrMsgsArr);
      return;
  };
  const validatedData = matchedData(req, {
    includeOptionals: true,
  });
  const { table, id, likes, dislikes } = validatedData;

  try {
    if (likes) {
      if (table === "posts") {
        const updateLikesReq = await pool.query(
          "UPDATE posts SET likes = ($1) WHERE id = ($2)",
          [likes, id]
        );
      } else if (table === "comments") {
        const updateLikesReq = await pool.query(
          "UPDATE comments SET likes = ($1) WHERE id = ($2)",
          [likes, id]
        );
      };
    };
    if (dislikes) {
      if (table === "posts") {
        const updateDislikesReq = await pool.query(
          "UPDATE posts SET dislikes = ($1) WHERE id = ($2)",
          [dislikes, id]
        );
      } else if (table === "comments") {
        const updateDislikesReq = await pool.query(
          "UPDATE comments SET dislikes = ($1) WHERE id = ($2)",
          [dislikes, id]
        );
      }; 
    };
    res.status(200).json("Reactions successfully updated");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};