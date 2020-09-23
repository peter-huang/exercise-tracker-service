const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const cors = require("cors");

const crypto = require("crypto");

const mongoose = require("mongoose");

// Setup MongoDB
process.env.MONGO_URI =
  "mongodb+srv://fccmongotest:fccmongotest@peter0.xkbla.mongodb.net/<dbname>?retryWrites=true&w=majority";
var db = mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

// MongoDB setup
const UserETSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  username: { type: String, required: true },
  exercise: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: { type: Date, required: false },
    },
  ],
});
const UserET = mongoose.model("UserET", UserETSchema);

// Create new user
app.post("/api/exercise/new-user", (req, res, next) => {
  const newUser = encryptName(req.body.username);

  console.log("/api/exercise/new-user " + newUser);
  if (newUser.length <= 0) {
    res.send("Username can not be empty");
  } else {
    UserET.find({ _id: newUser }, (err, results) => {
      if (err) {
        console.log("Error found when adding new user: " + err);
      } else {
        // User exists already
        if (results.length > 0) {
          res.json("Username already exists in the database.");
        } else {
          const u = new UserET({
            _id: encryptName(req.body.username),
            username: req.body.username,
          });
          u.save((err, r) => {
            if (err) {
              console.log("Error inserting new user: " + err);
            } else {
              res.json({
                _id: encryptName(req.body.username),
                username: req.body.username,
              });
            }
          });
        }
      }
    });
  }
});

// Create new exercise
app.post("/api/exercise/add", (req, res, next) => {
  const { userId, description, duration, date } = req.body;

  console.log(
    "/api/exercise/add " +
      userId +
      " " +
      description +
      " " +
      duration +
      " " +
      date
  );

  UserET.find({ _id: userId }, (err, results) => {
    if (err) {
      console.log("Error found when looking for user: " + err);
      res.send("Error found when looking for user: " + err);
    } else {
      if (results.length === 0) {
        res.send("User ID doesn't exist in the database.");
      } else if (description.length === 0) {
        res.send("Description of exercise can not be empty.");
      } else if (isNaN(parseFloat(duration))) {
        res.send("Duration of exercise must be a number.");
      } else if (!isValidDate(date)) {
        res.send("Date was entered in the wrong format " + date);
      } else {
        let newDate;

        if (date === undefined || date.length === 0) {
          newDate = new Date();
        } else {
          let d = new Date(date);
          d = d.toISOString();
          newDate = new Date(d);
        }
        UserET.findByIdAndUpdate(
          { _id: userId },
          {
            $push: {
              exercise: {
                description: description,
                duration: parseFloat(duration),
                date: newDate,
              },
            },
          },
          { new: true, upsert: true, useFindAndModify: false },
          (err, r) => {
            if (err) {
              console.log("Error adding new exercise routine: " + err);
              res.send("Error adding new exercise routine: " + err);
            } else {
              res.json({
                _id: userId,
                username: r.username,
                date: formatDate(newDate),
                duration: parseFloat(duration),
                description: description,
              });
            }
          }
        );
      }
    }
  });
});

// Lists all users
app.get("/api/exercise/users", (req, res, next) => {
  console.log("/api/exercise/users " + req);

  UserET.find({}, (err, r) => {
    if (err) {
      console.log("Error listing all users: " + err);
      res.send("Error listing all users: " + err);
    } else {
      var data = [];

      r.forEach((e) => {
        data.push({
          _id: e._id,
          username: e.username,
        });
      });
      res.json(data);
    }
  });
});

// List user and their exercise routines alongisde count, optional to from limit parameters
app.get("/api/exercise/log", (req, res, next) => {
  const { userId, to, from, limit } = req.query;

  console.log(
    "/api/exercise/log " + userId + " " + to + " " + from + " " + limit
  );

  // Check if userId exists first
  if (userId != undefined && userId.length > 0) {
    let query = {
      _id: userId,
    };

    UserET.find(query, (err, results) => {
      if (err) {
        console.log("Error listing user exercises " + err);
      } else {
        if (results.length > 0) {
          const resObj = results[0];

          let exercises = [];
          let filtered = [];

          // Filter Dates
          if (
            from !== undefined &&
            isValidDate(from) &&
            (to === undefined || !isValidDate(to))
          ) {
            let fromDate = new Date(from);
            fromDate = fromDate.getTime() / 1000;

            console.log("from");
            filtered = resObj.exercise.filter((e) => {
              let curDate = new Date(e.date);
              curDate = curDate.getTime() / 1000;

              if (curDate >= fromDate) {
                return true;
              }
              return false;
            });
          } else if (
            to !== undefined &&
            isValidDate(to) &&
            (from === undefined || !isValidDate(from))
          ) {
            let toDate = new Date(to);
            toDate = toDate.getTime() / 1000;
            console.log("to");
            filtered = resObj.exercise.filter((e) => {
              let curDate = new Date(e.date);
              curDate = curDate.getTime() / 1000;

              if (curDate <= toDate) {
                return true;
              }
              return false;
            });
          } else if (
            from !== undefined &&
            isValidDate(from) &&
            (to !== undefined || isValidDate(to))
          ) {
            console.log("both");

            let fromDate = new Date(from);
            fromDate = fromDate.getTime() / 1000;

            let toDate = new Date(to);
            toDate = toDate.getTime() / 1000;

            filtered = resObj.exercise.filter((e) => {
              let curDate = new Date(e.date);
              curDate = curDate.getTime() / 1000;

              if (curDate >= fromDate && curDate <= toDate) {
                return true;
              }
              return false;
            });
          } else {
            filtered = resObj.exercise;
          }

          // Limit number of exercise logs
          if (!isNaN(parseInt(limit)) && limit <= filtered.length) {
            for (let i = 0; i < limit; i++) {
              let e = filtered[i];
              exercises.push({
                description: e.description,
                duration: e.duration,
                date: formatDate(e.date),
              });
            }
          } else {
            filtered.forEach((e) => {
              exercises.push({
                description: e.description,
                duration: e.duration,
                date: formatDate(e.date),
              });
            });
          }

          // Send to filtered exercise logs
          res.json({
            _id: resObj._id,
            username: resObj.username,
            count: exercises.length,
            log: exercises,
          });
        } else {
          res.send("Error no user found in database");
        }
      }
    });
  } else {
    res.send("Error no user found in database");
  }
});

/*
 * Formats the date into the following format: yyyy-MM-dd
 *
 * @param date - Date object
 */
const formatDate = (date) => {
  let day = date.getDate();
  if (day < 10) {
    day = "0" + date.getDate();
  }

  return (
    getDayString(date.getDay()) +
    " " +
    getMonthString(date.getMonth()) +
    " " +
    day +
    " " +
    date.getFullYear()
  );
};

/*
 * Returns the correct month abbreviation
 *
 * @param index - index of the month
 */
const getMonthString = (index) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let i = 0; i < months.length; i++) {
    if (index === i) {
      return months[i];
    }
  }
};

/*
 * Returns the correct month abbreviation
 *
 * @param index - index of the day
 */
const getDayString = (index) => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < days.length; i++) {
    if (index === i) {
      return days[i];
    }
  }
};

/*
 * Validates the date string in yyyy-mm-dd format
 *
 * @param date - date string
 */
const isValidDate = (date) => {
  const regExDate = /^(19|20|21|22|23|24|25|26|27|28|29|30)\d\d([- /.])(0[1-9]|1[012])\2(0[1-9]|[12][0-9]|3[01])$/;
  if (date === undefined) {
    return true;
  }
  if (!regExDate.test(date)) {
    return false;
  }

  return true;
};

/*
 * Encrypts user name into a md5 hash
 *
 * @param userName - user name
 */
const encryptName = (userName) => {
  return crypto.createHash("md5").update(userName).digest("hex");
};

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;
  console.log(err);

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res.status(errCode).type("txt").send(errMessage);
});
