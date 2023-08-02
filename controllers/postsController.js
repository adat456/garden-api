const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.PSQL_USER,
    database: "garden_data",
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    host: "localhost",
});

// pre-authorized by pulling of beds data
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
  const { bedid, title, content, pinned, postid } = res.locals.validatedData;
  const posted = new Date();

  try {
    // auth
    if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("postspermission")) throw new Error("You do not have permission to add posts.");

    const addPost = await pool.query(
      "INSERT INTO posts (bedid, authorid, authorname, authorusername, posted, edited, title, content, likes, dislikes, pinned, id, subscribers) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
      [bedid, res.locals.user.id, `${res.locals.user.firstname} ${res.locals.user.lastname}`, res.locals.username, posted, null, title, content, [], [], pinned, postid, []]
    );
    res.status(200).json("Successfully added a post.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};

exports.toggle_post_pin = async function(req, res, next) {
  const { postid } = res.locals.validatedData;

  try {
    if (!res.locals.userPermissions.includes("fullpermissions")) {
      throw new Error("You do not have permission to toggle the pinned status of this post.");
    } else {
      const updatePinStatus = await pool.query(
        "UPDATE posts SET pinned = NOT pinned WHERE id = ($1)",
        [postid]
      );
      res.status(200).json("Pinned status updated.");
    };
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
}

exports.update_post = async function(req, res, next) {
  const { title, content, postid } = res.locals.validatedData;
  const edited = new Date();

  try {
    // AUTH
    // throw error if lacking posts permissions
    if (!res.locals.userPermissions.includes("postspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
      throw new Error("You do not have permission to update posts.");
    } else {
    // throw error if posts permissions but user is not the post creator
      const getPostReq = await pool.query(
        "SELECT * FROM posts WHERE id = ($1)",
        [postid]
      );
      if (getPostReq?.rows[0]?.authorusername !== res.locals.username) throw new Error("You do not have permission to edit this post as you are not the author.");
    };

    const updatePostReq = await pool.query(
      "UPDATE posts SET title = ($1), content = ($2), edited = ($3) WHERE id = ($4)",
      [title, content, edited, postid]
    );
    res.status(200).json("Post successfully updated.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};

exports.update_subscribers = async function(req, res, next) {
  const { postid, userid } = res.locals.validatedData;

  try {
    const pullPostSubscribersReq = await pool.query(
      "SELECT subscribers FROM posts WHERE id = ($1)",
      [postid]
    );
    let subscribers = pullPostSubscribersReq.rows[0].subscribers;
    if (subscribers.includes(userid)) {
      subscribers = subscribers.filter(subscriberid => subscriberid !== userid);
    } else {
      subscribers = [...subscribers, userid];
    };
    const updatePostSubscribersReq = await pool.query(
      "UPDATE posts SET subscribers = ($1) WHERE id = ($2)",
      [subscribers, postid]
    );
    res.status(200).json("Post subscribers updated.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};

exports.update_reactions = async function(req, res, next) {
  const { table, id, likes, dislikes } = res.locals.validatedData;

  try {
    // auth
    if (!res.locals.userPermissions.includes("fullpermissions") && !res.locals.userPermissions.includes("postinteractionspermission")) throw new Error("You do not have permission to interact with posts.");

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

exports.delete_post = async function(req, res, next) {
  const { postid } = res.locals.validatedData;

  try {
    // AUTH
    // throw error if lacking both posts and full permissions
    if (!res.locals.userPermissions.includes("postspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
      throw new Error("You do not have permission to delete posts.");
    };
    // throw error if posts permissions (but no full permissions) and user is not the post creator
    if (res.locals.userPermissions.includes("postspermission") && !res.locals.userPermissions.includes("fullpermissions")) {
      const getPostReq = await pool.query(
        "SELECT * FROM posts WHERE id = ($1)",
        [postid]
      );
      if (getPostReq?.rows[0]?.authorusername !== res.locals.username) throw new Error("You do not have permission to delete this post as you are not the author.");
    };

    const deletePostReq = await pool.query(
      "DELETE FROM posts WHERE id = ($1)",
      [postid]
    );
    res.status(200).json("Post successfully deleted.");
  } catch(err) {
    console.log(err.message);
    res.status(404).json(err.message);
  };
};