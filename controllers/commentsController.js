const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

exports.pull_comments = async function(req, res, next) {
    const { postid } = res.locals.validatedData;
  
    async function pullComments(id, level, arr) {
      try {
        const pullCommentsReq = await pool.query(
          "SELECT * FROM comments WHERE postid = ($1) ORDER BY posted",
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
  const { postid, content, commentid, toppostid } = res.locals.validatedData;
  const posted = new Date();

  try {
    // auth
    if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("postinteractionspermission")) throw new Error("You do not have permission to add comments.");

    const addCommentReq = await pool.query(
      "INSERT INTO comments (id, toppostid, postid, authorid, authorname, authorusername, posted, edited, content, likes, dislikes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      [commentid, toppostid, postid, res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, posted, null, content, [], []]
    );

    const pullPostInfo = await pool.query(
      "SELECT subscribers, bedid, title FROM posts WHERE id = ($1)",
      [toppostid]
    );
    const { subscribers, bedid, title } = pullPostInfo.rows[0];
    if (subscribers.length > 0) {
      const dispatched = new Date().toISOString().slice(0, 10);
      subscribers.forEach(async subscriberid => {
        if (subscriberid !== res.locals.user.id) {
          const sendNotificationToSubscriber = await pool.query(
            "INSERT INTO notifications (senderid, sendername, senderusername, recipientid, dispatched, type, read, bedid, posttitle, postid, commentid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            [res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, subscriberid, dispatched, "postupdate", false, bedid, title, toppostid, commentid]
          );
        };
      });
    };

    res.status(200).json("Added comment.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};

exports.update_comment = async function(req, res, next) {
  const { content, commentid } = res.locals.validatedData;
  const edited = new Date();

  try {
    // AUTH
    // throw error if lacking both comments permissions
    if (!res.locals.userPermissions.includes("postinteractionspermission") && !res.locals.userPermissions.includes("fullpermissions"))  {
      throw new Error("You do not have permission to update comments.");
    } else {
    // throw error if comments permissions but user is not the comment creator
      const getCommentReq = await pool.query(
        "SELECT * FROM comments WHERE id = ($1)",
        [commentid]
      );
      if (getCommentReq?.rows[0]?.authorusername !== res.locals.username) throw new Error("You do not have permission to edit this comment as you are not the original author.");
    };

    const updateCommentReq = await pool.query(
      "UPDATE comments SET content = ($1), edited = ($2) WHERE id = ($3)",
      [content, edited, commentid]
    );
    res.status(200).json("Comment successfully updated.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};

exports.delete_comment = async function(req, res, next) {
  const { commentid } = res.locals.validatedData;

  try {
    // AUTH
    // throw error if lacking both comments and full permissions
    if (!res.locals.userPermissions.includes("postinteractionspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
      throw new Error("You do not have permission to update comments.");
    };
    // throw error if comments permissions (but no full permissions) and user is not the comment creator
    if (res.locals.userPermissions.includes("postinteractionspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
      const getCommentReq = await pool.query(
        "SELECT * FROM comments WHERE id = ($1)",
        [commentid]
      );
      if (getCommentReq?.rows[0]?.authorusername !== res.locals.username) throw new Error("You do not have permission to delete this comment as you are not the original author.");
    };

    const deleteCommentReq = await pool.query(
      "DELETE FROM comments WHERE id = ($1)",
      [commentid]
    );
    res.status(200).json("Comment successfully deleted.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};